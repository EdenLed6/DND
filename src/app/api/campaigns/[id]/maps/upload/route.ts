import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const EXT: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("רק ה-DM", 403);

  const form = await req.formData().catch(() => null);
  if (!form) return bad("No form data");
  const file = form.get("file");
  if (!(file instanceof File)) return bad("No file");
  if (file.size > MAX_BYTES) return bad("קובץ גדול מדי (מקס 8MB)");
  const ext = EXT[file.type];
  if (!ext) return bad("סוג קובץ לא נתמך (PNG/JPG/WEBP/GIF)");

  const buf = Buffer.from(await file.arrayBuffer());
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  const fname = `${randomUUID()}.${ext}`;
  await fs.writeFile(path.join(dir, fname), buf);

  const name = String(form.get("name") || "Uploaded Map");
  const gridCols = Math.max(4, Math.min(60, parseInt(String(form.get("gridCols") || "20"), 10) || 20));
  const gridRows = Math.max(4, Math.min(60, parseInt(String(form.get("gridRows") || "14"), 10) || 14));

  const map = await prisma.gameMap.create({
    data: { campaignId, name, imageUrl: `/uploads/${fname}`, gridSize: 64, gridCols, gridRows },
  });
  return NextResponse.json(map);
}
