// Custom Node server: Next.js + Socket.IO on the same port (live sync).
// See docs/01-ARCHITECTURE.md and docs/07-REALTIME-SYNC.md.
import { createServer } from "node:http";
import next from "next";
import { Server as IOServer } from "socket.io";
import { PrismaClient } from "@prisma/client";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

function parseSessionCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/dnd_session=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

// In production, only allow the app's own origin(s) to open a credentialed socket.
// Set ALLOWED_ORIGIN (comma-separated) in prod, e.g. "https://yourdomain.com".
const allowedOrigin: string[] | boolean = dev
  ? true
  : (process.env.ALLOWED_ORIGIN
      ? process.env.ALLOWED_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
      : false);

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  const io = new IOServer(server, { cors: { origin: allowedOrigin, credentials: true } });

  // expose io to API route handlers via global
  (globalThis as any).__io = io;

  io.use(async (socket, nextFn) => {
    try {
      const sid = parseSessionCookie(socket.handshake.headers.cookie);
      const session = sid
        ? await prisma.session.findUnique({ where: { id: sid }, include: { user: true } })
        : null;
      if (session && session.expiresAt > new Date()) {
        (socket.data as any).userId = session.user.id;
      }
      nextFn();
    } catch (e) {
      nextFn();
    }
  });

  io.on("connection", async (socket) => {
    const userId: string | undefined = (socket.data as any).userId;
    if (userId) {
      socket.join(`user:${userId}`);
      // auto-join all campaigns the user belongs to (as member or DM)
      const owned = await prisma.campaign.findMany({ where: { dmId: userId }, select: { id: true } });
      const member = await prisma.campaignMember.findMany({ where: { userId }, select: { campaignId: true } });
      for (const c of owned) { socket.join(`campaign:${c.id}`); socket.join(`campaign:${c.id}:dm`); }
      for (const m of member) socket.join(`campaign:${m.campaignId}`);
    }

    // clients ask to (un)watch a specific encounter room
    socket.on("watch:encounter", async (encounterId: string) => {
      if (typeof encounterId !== "string" || !userId) return;
      const enc = await prisma.encounter.findUnique({ where: { id: encounterId } });
      if (!enc) return;
      // Authorization: only members of the encounter's campaign may watch it.
      const campaign = await prisma.campaign.findUnique({ where: { id: enc.campaignId } });
      if (!campaign) return;
      const isDm = campaign.dmId === userId;
      let isMember = isDm;
      if (!isMember) {
        const m = await prisma.campaignMember.findUnique({
          where: { campaignId_userId: { campaignId: enc.campaignId, userId } },
        });
        isMember = !!m;
      }
      if (!isMember) return; // not in this campaign -> denied
      socket.join(`encounter:${encounterId}`);
      if (isDm) socket.join(`encounter:${encounterId}:dm`);
    });
    socket.on("unwatch:encounter", (encounterId: string) => {
      socket.leave(`encounter:${encounterId}`);
      socket.leave(`encounter:${encounterId}:dm`);
    });
  });

  // Data-retention sweep (GDPR storage limitation / Israeli Security Regs):
  // prune expired sessions & tokens and age out old audit logs. Runs on boot
  // and daily thereafter.
  const AUDIT_RETENTION_DAYS = 180;
  async function retentionSweep() {
    try {
      const now = new Date();
      const auditCutoff = new Date(now.getTime() - AUDIT_RETENTION_DAYS * 864e5);
      await prisma.session.deleteMany({ where: { expiresAt: { lt: now } } });
      await prisma.authToken.deleteMany({ where: { expiresAt: { lt: now } } });
      await prisma.auditLog.deleteMany({ where: { ts: { lt: auditCutoff } } });
    } catch (e) {
      console.error("[retention] sweep failed:", (e as Error).message);
    }
  }
  retentionSweep();
  setInterval(retentionSweep, 24 * 60 * 60 * 1000);

  server.listen(port, () => {
    console.log(`> D&D Campaign Manager ready on http://localhost:${port} (dev=${dev})`);
  });
});
