// Client helper: persist a dice roll to the character's roll log (fire-and-forget).
import type { RollResult } from "@/lib/dnd/dice";

export async function logRoll(opts: {
  characterId?: string;
  campaignId?: string;
  label: string;
  result: RollResult;
  visibility?: "public" | "dm" | "self";
}): Promise<void> {
  try {
    await fetch("/api/roll-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: opts.characterId,
        campaignId: opts.campaignId,
        label: opts.label,
        expression: opts.result.expression,
        total: opts.result.total,
        breakdown: opts.result.breakdown,
        visibility: opts.visibility ?? "public",
      }),
    });
  } catch { /* never block the roll UX */ }
}
