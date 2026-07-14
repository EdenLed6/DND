import Link from "next/link";

export const metadata = { title: "Privacy Policy — D&D Campaign Manager" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/" className="link-gold text-sm">← Back</Link>
        <h1 className="mt-2 font-display text-3xl text-gold">Privacy Policy</h1>
        <p className="muted text-sm">Last updated: 14 July 2026</p>
      </div>

      <p className="text-sm leading-relaxed">
        D&amp;D Campaign Manager is a hobby tool for running Dungeons &amp; Dragons games with
        friends. This page explains what personal data we hold, why, and the rights you have over
        it under the EU General Data Protection Regulation (GDPR) and Israel&apos;s Protection of
        Privacy Law (חוק הגנת הפרטיות).
      </p>

      <Section title="What we collect and why">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li><b>Account:</b> your email address, display name, and a securely hashed password (or your Google account identifier if you sign in with Google). Used to sign you in and secure your account.</li>
          <li><b>Google sign-in (optional):</b> if you use it, we store your Google ID, email, and profile picture URL, provided by Google with your consent.</li>
          <li><b>Game content you create:</b> characters, notes, campaigns, NPCs, quests, sessions, and homebrew monsters. This is the point of the app.</li>
          <li><b>Operational data:</b> login sessions and single-use verification/reset tokens (auto-expiring), and a DM action log per campaign (kept up to 180 days).</li>
        </ul>
        <p className="mt-2 text-sm">We do <b>not</b> use analytics, advertising, tracking pixels, or third-party scripts. We do not sell or share your data for marketing.</p>
      </Section>

      <Section title="Legal basis">
        <p className="text-sm">We process your data to provide a service you asked for (GDPR Art. 6(1)(b), performance of a contract). Under the Israeli Protection of Privacy Law §11, you are not legally required to provide this data — you provide it voluntarily so that the app can run your games. The recipients of your data are limited to your email provider and the other members of campaigns you join.</p>
      </Section>

      <Section title="Who your data is shared with">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li><b>Other campaign members:</b> your display name and the characters/content you add to a shared campaign are visible to that campaign&apos;s members, per role. Private notes and DM secrets are access-controlled.</li>
          <li><b>Email provider (Resend):</b> processes the emails we send you (verification, password reset, campaign invitations). Only your email address and the message are shared.</li>
          <li><b>Google (only if you use Google sign-in):</b> as the identity provider.</li>
        </ul>
        <p className="mt-2 text-sm">We do not transfer your data anywhere else.</p>
      </Section>

      <Section title="Cookies">
        <p className="text-sm">We use only strictly-necessary cookies, so no consent banner is required:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          <li><code>dnd_session</code> — keeps you signed in (HTTP-only, expires after 30 days).</li>
          <li><code>g_oauth_state</code> — a short-lived security token used during Google sign-in.</li>
          <li>A small <code>localStorage</code> flag remembering that you dismissed the &quot;install app&quot; prompt.</li>
        </ul>
      </Section>

      <Section title="How long we keep it">
        <p className="text-sm">Your account and game content are kept until you delete them or your account. Expired sessions and tokens are purged automatically; DM action logs are deleted after 180 days.</p>
      </Section>

      <Section title="Your rights">
        <p className="text-sm">You can, at any time from your <Link href="/profile" className="link-gold">Profile</Link> page:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          <li><b>Access &amp; portability</b> (GDPR Art. 15/20; PPL §13): download all your data as a JSON file.</li>
          <li><b>Erasure</b> (GDPR Art. 17; PPL §14): permanently delete your account and personal data. Campaigns you run as DM, and their content, are deleted with your account.</li>
          <li><b>Rectification:</b> edit your profile and content directly in the app.</li>
        </ul>
        <p className="mt-2 text-sm">You also have the right to lodge a complaint with a supervisory authority (in Israel, the Privacy Protection Authority; in the EU, your local DPA).</p>
      </Section>

      <Section title="Security">
        <p className="text-sm">Passwords are hashed with bcrypt and never stored or logged in plain text. Sessions use cryptographically-random tokens over HTTPS with strict security headers. Access to campaign data is enforced by role on the server, not just hidden in the interface.</p>
      </Section>

      <Section title="Contact">
        <p className="text-sm">Questions or requests you can&apos;t complete in-app: contact the operator of this instance.</p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <h2 className="mb-2 font-display text-lg text-gold">{title}</h2>
      {children}
    </section>
  );
}
