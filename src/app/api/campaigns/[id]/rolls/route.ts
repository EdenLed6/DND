import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { roleInCampaign } from "@/lib/auth/rbac";
import { limitOr429 } from "@/lib/rate-limit";
import { emitToCampaign, getIO, rooms } from "@/lib/realtime/io";

const DIE_SIDES = [2, 3, 4, 6, 8, 10, 12, 20, 100] as const;

const rollSchema = z.object({
  label: z.string().min(1).max(80),
  expression: z.string().max(100).optional(),
  total: z.number().int().min(-100_000).max(100_000),
  breakdown: z.string().max(400),
  dice: z.array(z.object({
    sides: z.number().int().refine((s) => (DIE_SIDES as readonly number[]).includes(s), "invalid die"),
    value: z.number().int().min(0).max(100),
  })).max(40),
  crit: z.boolean().optional(),
  fumble: z.boolean().optional(),
  characterName: z.string().max(60).optional(),
  visibility: z.enum(["public", "dm", "self"]).default("public"),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;

  const limited = limitOr429(req, "rolls", 60, 60_000); // 60 rolls / min / IP
  if (limited) return limited;

  const role = await roleInCampaign(user.id, campaignId);
  // VIEWER is read-only; only DM/PLAYER may publish rolls.
  if (role !== "DM" && role !== "PLAYER") return bad("Not a member of this campaign", 403);

  const parsed = rollSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  // Prevent impersonation: a claimed characterName must be a character the caller
  // owns in this campaign (the DM may roll as any character in the campaign).
  let characterName = parsed.data.characterName;
  if (characterName) {
    const owned = await prisma.character.findFirst({
      where: {
        campaignId,
        name: characterName,
        ...(role === "DM" ? {} : { ownerId: user.id }),
      },
      select: { id: true },
    });
    if (!owned) characterName = undefined;
  }

  const payload = { ...parsed.data, characterName, by: user.displayName, ts: Date.now() };

  switch (payload.visibility) {
    case "self":
      // Hidden roll: never broadcast. Accepted for symmetry (and future logging).
      break;
    case "dm":
      // DM-only: emit solely to the DM room — player sockets never join it.
      getIO()?.to(rooms.campaignDM(campaignId)).emit("roll:new", payload);
      break;
    default:
      emitToCampaign(campaignId, "roll:new", payload);
  }
  return NextResponse.json({ ok: true });
}
