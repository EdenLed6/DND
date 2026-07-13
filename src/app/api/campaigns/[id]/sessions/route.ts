// Game sessions (SPEC-DM §5): planning, live status, recaps.
// GET  — DM sees everything; players get a stripped view (no prep notes / DM recap).
// POST — DM-only ops: create / update / setStatus / delete.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM, canViewCampaign } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";
import { logAudit } from "@/lib/audit";

const agendaItemSchema = z.object({
  title: z.string().max(300),
  done: z.boolean(),
  notes: z.string().max(2000).optional(),
});

// Accepts datetime-local values ("2026-07-13T20:00") and full ISO strings.
const dateString = z.string().max(64).refine((s) => !Number.isNaN(new Date(s).getTime()), "Invalid date");

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create"),
    title: z.string().max(200).optional(),
    date: dateString.optional(),
  }),
  z.object({
    op: z.literal("update"),
    sessionId: z.string(),
    patch: z.object({
      title: z.string().max(200).optional(),
      date: dateString.nullable().optional(),
      agendaJson: z.array(agendaItemSchema).max(50).optional(),
      prepNotes: z.string().max(20000).optional(),
      recapPlayer: z.string().max(20000).optional(),
      recapDm: z.string().max(20000).optional(),
      xpAwarded: z.number().int().min(0).max(1_000_000).optional(),
    }),
  }),
  z.object({
    op: z.literal("setStatus"),
    sessionId: z.string(),
    status: z.enum(["PLANNED", "LIVE", "DONE"]),
  }),
  z.object({ op: z.literal("delete"), sessionId: z.string() }),
]);

function parseAgenda(json: string): { title: string; done: boolean; notes?: string }[] {
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canViewCampaign(user.id, campaignId))) return bad("Not a member", 403);
  const dm = await isDM(user.id, campaignId);

  const sessions = await prisma.gameSession.findMany({
    where: { campaignId },
    orderBy: { number: "desc" },
  });

  if (dm) {
    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id, number: s.number, title: s.title, date: s.date, status: s.status,
        agenda: parseAgenda(s.agendaJson),
        prepNotes: s.prepNotes ?? "", recapPlayer: s.recapPlayer ?? "", recapDm: s.recapDm ?? "",
        xpAwarded: s.xpAwarded,
      })),
    });
  }

  // Player view: strip DM-only fields server-side. Agenda item notes are prep
  // material — players only get titles + done flags.
  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id, number: s.number, title: s.title, date: s.date, status: s.status,
      agenda: parseAgenda(s.agendaJson).map((a) => ({ title: a.title, done: !!a.done })),
      recapPlayer: s.recapPlayer ?? "",
      xpAwarded: s.xpAwarded,
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("DM only", 403);
  const parsed = opSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const d = parsed.data;

  if (d.op === "create") {
    const max = await prisma.gameSession.aggregate({ where: { campaignId }, _max: { number: true } });
    const number = (max._max.number ?? 0) + 1;
    const session = await prisma.gameSession.create({
      data: {
        campaignId, number,
        title: d.title ?? "",
        date: d.date ? new Date(d.date) : null,
      },
    });
    await logAudit(campaignId, user.id, "session.create", `Session ${number}${session.title ? ` "${session.title}"` : ""}`);
    emitToCampaign(campaignId, "session:changed", { sessionId: session.id, op: "create" });
    return NextResponse.json({ session });
  }

  // Remaining ops target an existing session — verify it belongs to this campaign.
  const existing = await prisma.gameSession.findFirst({ where: { id: d.sessionId, campaignId } });
  if (!existing) return bad("Session not found", 404);

  if (d.op === "update") {
    const p = d.patch;
    const data: Record<string, unknown> = {};
    if (p.title !== undefined) data.title = p.title;
    if (p.date !== undefined) data.date = p.date === null ? null : new Date(p.date);
    if (p.agendaJson !== undefined) data.agendaJson = JSON.stringify(p.agendaJson);
    if (p.prepNotes !== undefined) data.prepNotes = p.prepNotes;
    if (p.recapPlayer !== undefined) data.recapPlayer = p.recapPlayer;
    if (p.recapDm !== undefined) data.recapDm = p.recapDm;
    if (p.xpAwarded !== undefined) data.xpAwarded = p.xpAwarded;
    const session = await prisma.gameSession.update({ where: { id: existing.id }, data });
    await logAudit(campaignId, user.id, "session.update", `Session ${existing.number}: ${Object.keys(data).join(", ")}`);
    emitToCampaign(campaignId, "session:changed", { sessionId: session.id, op: "update" });
    return NextResponse.json({ session });
  }

  if (d.op === "setStatus") {
    if (d.status === "LIVE") {
      // Only one session can be LIVE at a time — end any other live session.
      await prisma.gameSession.updateMany({
        where: { campaignId, status: "LIVE", id: { not: existing.id } },
        data: { status: "DONE" },
      });
    }
    const session = await prisma.gameSession.update({ where: { id: existing.id }, data: { status: d.status } });
    await logAudit(campaignId, user.id, "session.status", `Session ${existing.number} → ${d.status}`);
    emitToCampaign(campaignId, "session:changed", { sessionId: session.id, op: "setStatus", status: d.status });
    return NextResponse.json({ session });
  }

  // delete
  await prisma.gameSession.delete({ where: { id: existing.id } });
  await logAudit(campaignId, user.id, "session.delete", `Session ${existing.number} "${existing.title}"`);
  emitToCampaign(campaignId, "session:changed", { sessionId: existing.id, op: "delete" });
  return NextResponse.json({ ok: true });
}
