import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TopNav } from "@/components/TopNav";
import { ProfileActions } from "./ProfileActions";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const verified = !!user.emailVerified;
  const initial = (user.displayName || user.email || "?").trim().charAt(0).toUpperCase();
  const created = new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <TopNav user={user} />
      <main className="mx-auto max-w-2xl space-y-4 p-4">
        <h1 className="font-display text-2xl text-gold">Profile</h1>

        <div className="card flex items-center gap-4">
          <div className="avatar-circle" aria-hidden>{initial}</div>
          <div className="min-w-0">
            <div className="font-display text-xl">{user.displayName}</div>
            <div className="muted truncate text-sm">{user.email}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {verified ? (
                <span className="chip chip-success">Email verified ✓</span>
              ) : (
                <span className="chip">Not verified</span>
              )}
              <span className="faint">Member since {created}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 font-display text-lg text-gold">Account</h2>
          <ProfileActions />
        </div>
      </main>
    </div>
  );
}
