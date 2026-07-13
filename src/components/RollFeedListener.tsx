"use client";
// Listens for campaign roll-feed events ("roll:new") and pushes them into the
// dice tray. Sockets auto-join campaign rooms on connect (see server.ts), so
// mounting this anywhere on a campaign page is enough to receive the feed.
// Server-side visibility rules mean player clients never receive "dm" rolls.
import { useRealtime } from "@/lib/realtime/useRealtime";
import { pushTrayEntry } from "@/components/DiceTray";
import type { FeedRoll } from "@/lib/roll-feed";

export function RollFeedListener({ campaignId, selfName }: { campaignId: string; selfName?: string }) {
  useRealtime({
    "roll:new": (payload: FeedRoll) => {
      // Skip our own rolls — the roller already saw them locally.
      if (selfName && payload.by === selfName) return;
      pushTrayEntry({
        label: `${payload.characterName ?? payload.by ?? "?"}: ${payload.label}`,
        dice: payload.dice,
        total: payload.total,
        breakdown: payload.breakdown,
        verdict: payload.crit ? "CRIT!" : payload.fumble ? "NAT 1" : undefined,
        crit: payload.crit,
        fumble: payload.fumble,
        extra: payload.by && payload.by !== selfName ? `rolled by ${payload.by}` : undefined,
      });
    },
  }, [campaignId, selfName]);
  return null;
}
