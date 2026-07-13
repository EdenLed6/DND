"use client";
// Listens for campaign roll-feed events ("roll:new") and pushes them into the
// dice tray. Sockets auto-join campaign rooms on connect (see server.ts), so
// mounting this anywhere on a campaign page is enough to receive the feed.
// Server-side visibility rules mean player clients never receive "dm" rolls.
import { useEffect } from "react";
import { useRealtime } from "@/lib/realtime/useRealtime";
import { pushTrayEntry, setRollPublisher } from "@/components/DiceTray";
import { publishRoll } from "@/lib/roll-feed";
import type { FeedRoll } from "@/lib/roll-feed";

export function RollFeedListener({ campaignId, selfName, characterName }: { campaignId: string; selfName?: string; characterName?: string }) {
  // Publish this page's local rolls to the campaign feed (public visibility).
  useEffect(() => {
    setRollPublisher((entry) => {
      void publishRoll(campaignId, {
        label: entry.label,
        total: entry.total,
        breakdown: entry.breakdown,
        dice: entry.dice,
        crit: entry.crit,
        fumble: entry.fumble,
        characterName,
        visibility: "public",
      });
    });
    return () => setRollPublisher(null);
  }, [campaignId, characterName]);

  useRealtime({
    "roll:new": (payload: FeedRoll) => {
      // Skip our own rolls — the roller already saw them locally.
      if (selfName && payload.by === selfName) return;
      pushTrayEntry({
        remote: true, // never republish feed entries
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
