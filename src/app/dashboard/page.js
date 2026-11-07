import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";
import { MAX_WATCHES_PER_USER } from "@/lib/constants";
import Header from "@/components/Header";
import WatchForm from "@/components/WatchForm";
import WatchList from "@/components/WatchList";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.verifiedAt) redirect("/check-inbox");

  const rows = await prisma.watch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  // Plain values only, so they pass cleanly to client components.
  const watches = rows.map((w) => ({
    id: w.id,
    url: w.url,
    name: w.name,
    status: w.status,
    intervalMinutes: w.intervalMinutes,
    alertsEnabled: w.alertsEnabled,
    alertMode: w.alertMode,
    lastError: w.lastError,
  }));

  return (
    <>
      <Header email={user.email} />
      <main>
        <h1>Dashboard</h1>
        <WatchForm />
        <h2>Your pages</h2>
        <p className="muted">{watches.length} of {MAX_WATCHES_PER_USER} used</p>
        <WatchList watches={watches} />
      </main>
    </>
  );
}