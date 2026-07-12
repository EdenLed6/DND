import { NextResponse } from "next/server";

// Public: which login providers are configured (so the UI can show/hide buttons).
export async function GET() {
  return NextResponse.json({ google: !!process.env.GOOGLE_CLIENT_ID });
}
