// Campaign settings (SPEC-DM §16): rule toggles persisted in Campaign.settingsJson.
// GET — any campaign member. PUT — DM only, merges partial updates.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM, canViewCampaign } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";
import { logAudit } from "@/lib/audit";

const settingsSchema = z.object({
  xpMode: z.enum(["xp", "milestone"]).default("xp"),
  enemyHpVisible: z.boolean().default(false),
  diceVisibilityDefault: z.enum(["public", "dm"]).default("public"),
  critRule: z.enum(["standard", "double-total"]).default("standard"),
  restVariant: z.enum(["standard", "gritty"]).default("standard"),
  joinApproval: z.boolean().default(false),
});
export type CampaignSettings = z.infer<typeof settingsSchema>;

function resolveSettings(settingsJson: string, xpModeColumn: string): CampaignSettings {
  let stored: unknown = {};
  try { stored = JSON.parse(settingsJson); } catch { /* corrupt json → defaults */ }
  const merged = settingsSchema.safeParse({
    xpMode: xpModeColumn === "milestone" ? "milestone" : "xp",
    ...(typeof stored === "object" && stored !== null ? stored : {}),
  });
  return merged.success ? merged.data : settingsSchema.parse({});
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canViewCampaign(user.id, campaignId))) return bad("Not a member", 403);
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return bad("Not found", 404);
  return NextResponse.json({ settings: resolveSettings(campaign.settingsJson, campaign.xpMode) });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("DM only", 403);
  const parsed = settingsSchema.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return bad("Not found", 404);

  const current = resolveSettings(campaign.settingsJson, campaign.xpMode);
  const next: CampaignSettings = { ...current, ...parsed.data };
  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      settingsJson: JSON.stringify(next),
      xpMode: next.xpMode, // keep the legacy column in sync
    },
  });
  await logAudit(campaignId, user.id, "settings.update", Object.keys(parsed.data).join(", ") || "no-op");
  emitToCampaign(campaignId, "settings:changed", { by: user.id });
  return NextResponse.json({ settings: next });
}
