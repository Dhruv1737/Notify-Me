import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import LogoutButton from "@/components/LogoutButton";
import ResendButton from "@/components/ResendButton";

export default async function CheckInboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.verifiedAt) redirect("/dashboard");

  return (
    <main>
      <h1>Check your inbox</h1>
      <p>We sent a verification link to {user.email}. Open it to continue.</p>
      <p><ResendButton></ResendButton></p>
      <LogoutButton />
    </main>
  );
}