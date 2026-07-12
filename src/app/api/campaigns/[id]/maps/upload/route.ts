import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";
import { limitOr429 } from "@/lib/rate-limit";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
};

// Validate real file type by magic bytes (don't trust the client's content-type).
function sniff(b: Buffer): string | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const limited = limitOr429(req, "upload", 20, 10 * 60_000); // 20 uploads / 10 min / IP
  if (limited) return limited;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("DM only", 403);

  const form = await req.formData().catch(() => null);
  if (!form) return bad("No form data");
  const file = form.get("file");
  if (!(file instanceof File)) return bad("No file");
  if (file.size > MAX_BYTES) return bad("File too large (max 8MB)");

  const buf = Buffer.from(await file.arrayBuffer());
  const realType = sniff(buf);
  if (!realType) return bad("Unsupported or invalid image (PNG/JPG/WEBP/GIF)");
  const ext = EXT[realType];

  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  const fname = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, fname), buf);

  const name = String(form.get("name") || "Uploaded Map").slice(0, 80);
  const gridCols = Math.max(4, Math.min(60, parseInt(String(form.get("gridCols") || "20"), 10) || 20));
  const gridRows = Math.max(4, Math.min(60, parseInt(String(form.get("gridRows") || "14"), 10) || 14));

  const map = await prisma.gameMap.create({
    data: { campaignId, name, imageUrl: `/uploads/${fname}`, gridSize: 64, gridCols, gridRows },
  });
  return NextResponse.json(map);
}
