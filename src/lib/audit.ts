// Audit log for DM actions (SPEC-DM §17). Writes are best-effort: auditing
// must never break the primary operation, so failures are swallowed.
import { prisma } from "@/lib/db";

export async function logAudit(campaignId: string, userId: string, action: string, detail?: string) {
  try {
    await prisma.auditLog.create({ data: { campaignId, userId, action, detail } });
  } catch {
    // intentionally ignored — audit failures must not affect the caller
  }
}
