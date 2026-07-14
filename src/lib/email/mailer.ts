// Provider-agnostic email sender. Swapping providers = edit ONLY this file.
// Default: Resend (HTTP API, no SDK/lock-in). Falls back to console in dev.
//
// To switch providers (Postmark/SendGrid/SMTP/etc.), replace `deliver()` below.
// Everything else in the app calls sendEmail() and is provider-independent.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const FROM = process.env.EMAIL_FROM || "D&D Campaign Manager <onboarding@resend.dev>";

async function deliver(msg: EmailMessage): Promise<void> {
  const provider = (process.env.EMAIL_PROVIDER || "resend").toLowerCase();

  // ---- Resend (default) ----
  if (provider === "resend" && process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) throw new Error(`Email send failed: ${res.status} ${await res.text().catch(() => "")}`);
    return;
  }

  // ---- Add other providers here (Postmark/SendGrid/SMTP) ----

  // In production a missing provider is a misconfiguration — fail loudly rather
  // than silently logging recipient email addresses (PII) to server logs.
  if (process.env.NODE_ENV === "production") {
    throw new Error("No email provider configured (set RESEND_API_KEY / EMAIL_PROVIDER).");
  }

  // ---- Dev fallback: log instead of sending ----
  console.log("\n📧 [dev email — no provider configured]");
  console.log(`   To: ${msg.to}`);
  console.log(`   Subject: ${msg.subject}`);
  const link = msg.text?.match(/https?:\/\/\S+/)?.[0];
  if (link) console.log(`   Link: ${link}`);
  console.log("");
}

export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean }> {
  try {
    await deliver(msg);
    return { ok: true };
  } catch (e) {
    console.error("[mailer] send error:", (e as Error).message);
    return { ok: false };
  }
}

// ---------- Templates ----------
const wrap = (title: string, body: string, cta?: { url: string; label: string }) => `
  <div style="font-family:system-ui,Segoe UI,sans-serif;background:#120f0d;color:#ece5d8;padding:24px">
    <div style="max-width:480px;margin:auto;background:#1c1712;border:1px solid #3a2f24;border-radius:12px;padding:24px">
      <div style="font-size:28px">🐉</div>
      <h1 style="color:#c9a227;font-size:20px;margin:8px 0">${title}</h1>
      <div style="color:#c9bda5;font-size:14px;line-height:1.6">${body}</div>
      ${cta ? `<a href="${cta.url}" style="display:inline-block;margin-top:16px;background:#8b2020;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${cta.label}</a>
      <div style="color:#7d6f5c;font-size:12px;margin-top:14px;word-break:break-all">Or paste this link: ${cta.url}</div>` : ""}
    </div>
    <div style="max-width:480px;margin:8px auto 0;color:#7d6f5c;font-size:11px;text-align:center">D&D Campaign Manager</div>
  </div>`;

export function verificationEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: "Verify your email — D&D Campaign Manager",
    html: wrap("Verify your email", "Welcome! Confirm your email address to secure your account.", { url, label: "Verify email" }),
    text: `Verify your email for D&D Campaign Manager: ${url}`,
  };
}

export function inviteEmail(campaignName: string, dmName: string, code: string, url: string): { subject: string; html: string; text: string } {
  return {
    subject: `You're invited to the campaign "${campaignName}"`,
    html: wrap(
      `Adventure awaits: ${campaignName}`,
      `${dmName} invited you to join their D&amp;D campaign. Sign in (or create an account) with <b>this email address</b>, then enter the invite code below.<div style="margin-top:12px;font-size:22px;letter-spacing:4px;color:#c9a227;font-weight:700">${code}</div>`,
      { url, label: "Join the campaign" }
    ),
    text: `${dmName} invited you to join the D&D campaign "${campaignName}". Sign in with this email address and use invite code ${code}: ${url}`,
  };
}

export function resetEmail(url: string): { subject: string; html: string; text: string } {
  return {
    subject: "Reset your password — D&D Campaign Manager",
    html: wrap("Reset your password", "We received a request to reset your password. This link expires in 1 hour. If you didn't request it, you can ignore this email.", { url, label: "Reset password" }),
    text: `Reset your D&D Campaign Manager password (expires in 1 hour): ${url}`,
  };
}
