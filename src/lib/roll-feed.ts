// Client helper for the campaign roll feed: publish a local dice roll to the
// server so it can be broadcast (per visibility) to other campaign members.
// Server enforces visibility — "dm" rolls only reach the campaign DM room.

export type RollVisibility = "public" | "dm" | "self";

export interface FeedRoll {
  label: string;
  expression?: string;
  total: number;
  breakdown: string;
  dice: { sides: number; value: number }[];
  crit?: boolean;
  fumble?: boolean;
  by?: string;            // display name of the roller (set by the server)
  characterName?: string; // name of the character that rolled
  visibility: RollVisibility;
  ts: number;             // set by the server
}

/**
 * Publish a roll to the campaign feed. Fire-and-forget: failures are logged
 * but never interrupt the local roll UX.
 */
export async function publishRoll(campaignId: string, roll: Omit<FeedRoll, "ts" | "by">): Promise<void> {
  try {
    const res = await fetch(`/api/campaigns/${campaignId}/rolls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(roll),
    });
    if (!res.ok && process.env.NODE_ENV !== "production") {
      console.warn("publishRoll failed:", res.status);
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") console.warn("publishRoll error:", err);
  }
}
