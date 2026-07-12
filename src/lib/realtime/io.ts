// Shared Socket.IO reference so API route handlers (Next runtime) can broadcast
// events on the same server instance created in server.ts.
import type { Server as IOServer } from "socket.io";

const g = globalThis as unknown as { __io?: IOServer };

export function setIO(io: IOServer) {
  g.__io = io;
}
export function getIO(): IOServer | null {
  return g.__io ?? null;
}

export const rooms = {
  user: (userId: string) => `user:${userId}`,
  campaign: (id: string) => `campaign:${id}`,
  campaignDM: (id: string) => `campaign:${id}:dm`,
  encounter: (id: string) => `encounter:${id}`,
  encounterDM: (id: string) => `encounter:${id}:dm`,
};

/** Broadcast an event to everyone in a campaign. No-op if socket server not running. */
export function emitToCampaign(campaignId: string, event: string, payload: unknown) {
  getIO()?.to(rooms.campaign(campaignId)).emit(event, payload);
}
export function emitToEncounter(encounterId: string, event: string, payload: unknown) {
  getIO()?.to(rooms.encounter(encounterId)).emit(event, payload);
}
export function emitToUser(userId: string, event: string, payload: unknown) {
  getIO()?.to(rooms.user(userId)).emit(event, payload);
}
/** DM-only channel (e.g. hidden monster updates). */
export function emitToEncounterDM(encounterId: string, event: string, payload: unknown) {
  getIO()?.to(rooms.encounterDM(encounterId)).emit(event, payload);
}
