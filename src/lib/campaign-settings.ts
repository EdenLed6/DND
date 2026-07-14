// Shared campaign settings schema + resolver (used by the settings API, the
// join flow, and combat-state redaction).
import { z } from "zod";

export const settingsSchema = z.object({
  xpMode: z.enum(["xp", "milestone"]).default("xp"),
  enemyHpVisible: z.boolean().default(false),
  diceVisibilityDefault: z.enum(["public", "dm"]).default("public"),
  critRule: z.enum(["standard", "double-total"]).default("standard"),
  restVariant: z.enum(["standard", "gritty"]).default("standard"),
  joinApproval: z.boolean().default(false),
});
export type CampaignSettings = z.infer<typeof settingsSchema>;

export function resolveSettings(settingsJson: string, xpModeColumn: string): CampaignSettings {
  let stored: unknown = {};
  try { stored = JSON.parse(settingsJson); } catch { /* corrupt json → defaults */ }
  const merged = settingsSchema.safeParse({
    xpMode: xpModeColumn === "milestone" ? "milestone" : "xp",
    ...(typeof stored === "object" && stored !== null ? stored : {}),
  });
  return merged.success ? merged.data : settingsSchema.parse({});
}
