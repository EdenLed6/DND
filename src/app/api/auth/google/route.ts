import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { baseUrl } from "@/lib/api";

// GET /api/auth/google — start the Google OAuth2 authorization-code flow.
export async function GET(req: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(`${baseUrl(req)}/login?error=google_not_configured`);

  const state = randomBytes(16).toString("base64url");
  (await cookies()).set("g_oauth_state", state, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  const redirectUri = `${baseUrl(req)}/api/auth/google/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
