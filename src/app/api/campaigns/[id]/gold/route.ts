import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";
import { toCopper, fromCopper } from "@/lib/dnd/rules";
import { emitToCampaign } from "@/lib/realtime/io";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  target: z.enum(["party", "character"]),
  characterId: z.string().optional(),
  deltaCp: z.number().int(), // positive add, negative remove
  fromParty: z.boolean().optional(), // if giving to character, deduct from party purse
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("DM only", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const d = parsed.data;

  if (d.target === "party") {
    const c = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!c) return bad("Not found", 404);
    const next = Math.max(0, c.partyGoldCp + d.deltaCp);
    await prisma.campaign.update({ where: { id: campaignId }, data: { partyGoldCp: next } });
    emitToCampaign(campaignId, "gold:changed", { scope: "party", partyGoldCp: next });
    await logAudit(campaignId, user.id, "gold.party", `${d.deltaCp >= 0 ? "+" : ""}${d.deltaCp}cp (party purse)`);
    return NextResponse.json({ partyGoldCp: next });
  }

  if (!d.characterId) return bad("characterId required");
  const ch = await prisma.character.findFirst({ where: { id: d.characterId, campaignId } });
  if (!ch) return bad("Character not in campaign", 404);
  const cur = toCopper({ cp: ch.cp, sp: ch.sp, ep: ch.ep, gp: ch.gp, pp: ch.pp });
  const purse = fromCopper(Math.max(0, cur + d.deltaCp));
  await prisma.character.update({ where: { id: ch.id }, data: purse });

  let partyGoldCp: number | undefined;
  if (d.fromParty) {
    const c = await prisma.campaign.findUnique({ where: { id: campaignId } });
    partyGoldCp = Math.max(0, (c?.partyGoldCp ?? 0) - d.deltaCp);
    await prisma.campaign.update({ where: { id: campaignId }, data: { partyGoldCp } });
    emitToCampaign(campaignId, "gold:changed", { scope: "party", partyGoldCp });
  }
  emitToCampaign(campaignId, "character:updated", { characterId: ch.id, patch: purse, by: user.id });
  await logAudit(campaignId, user.id, "gold.character", `${d.deltaCp >= 0 ? "+" : ""}${d.deltaCp}cp to ${ch.name}${d.fromParty ? " (from party purse)" : ""}`);
  return NextResponse.json({ purse, partyGoldCp });
}
