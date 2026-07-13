import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/session";
import { PortalChooser } from "./PortalChooser";

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ choose?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { choose } = await searchParams;
  if (choose !== "1") {
    const store = await cookies();
    const portal = store.get("dnd_portal")?.value;
    if (portal === "player") redirect("/dashboard");
    if (portal === "dm") redirect("/dm");
  }

  return <PortalChooser displayName={user.displayName} />;
}
