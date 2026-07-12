import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { baseUrl } from "@/lib/api";
import { createSession } from "@/lib/auth/session";

// GET /api/auth/google/callback — exchange the code, sign the user in.
export async function GET(req: Request) {
  const base = baseUrl(req);
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const store = await cookies();
  const savedState = store.get("g_oauth_state")?.value;
  store.delete("g_oauth_state");

  if (searchParams.get("error")) return NextResponse.redirect(`${base}/login?error=google_denied`);
  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${base}/login?error=google_state`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  if (!clientId || !clientSecret) return NextResponse.redirect(`${base}/login?error=google_not_configured`);

  try {
    // 1) Exchange the authorization code for tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: `${base}/api/auth/google/callback`, grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
    const { access_token } = await tokenRes.json();

    // 2) Fetch the user's profile.
    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!infoRes.ok) throw new Error(`userinfo ${infoRes.status}`);
    const info = await infoRes.json() as { sub: string; email: string; email_verified?: boolean; name?: string; picture?: string };
    if (!info.email) throw new Error("no email");

    // 3) Find or create the account (link to an existing email if present).
    let user = await prisma.user.findUnique({ where: { googleId: info.sub } });
    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email: info.email } });
      // Only auto-link to a pre-existing (password) account if Google asserts the
      // email is verified — otherwise a Google account with an unverified address
      // could be linked to someone else's account.
      if (byEmail && !info.email_verified) {
        return NextResponse.redirect(`${base}/login?error=google_unverified`);
      }
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: info.sub,
            avatarUrl: byEmail.avatarUrl ?? info.picture ?? null,
            emailVerified: byEmail.emailVerified ?? (info.email_verified ? new Date() : null),
          },
        });
      } else {
        user = await prisma.user.create({
          data: {
            email: info.email,
            displayName: info.name || info.email.split("@")[0],
            googleId: info.sub,
            avatarUrl: info.picture ?? null,
            emailVerified: info.email_verified ? new Date() : null,
          },
        });
      }
    }

    await createSession(user.id);
    return NextResponse.redirect(`${base}/dashboard`);
  } catch (e) {
    console.error("[google callback]", (e as Error).message);
    return NextResponse.redirect(`${base}/login?error=google_failed`);
  }
}
