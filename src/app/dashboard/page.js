import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import Header from "@/components/Header";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
    if (!user.verifiedAt) redirect("/check-inbox");

  return (
    <>
      <Header email={user.email} />
      <main>
        <h1>Dashboard</h1>
        <p className="muted">You have no watches yet.</p>
      </main>
    </>
  );
}