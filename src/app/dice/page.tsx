import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TopNav } from "@/components/TopNav";
import { DiceHistory } from "./DiceHistory";

export default async function DicePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div>
      <TopNav user={user} />
      <DiceHistory />
    </div>
  );
}
