import { prisma } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth";
import { isSameOrigin } from "@/lib/origin";
import { isBlocked, recordHit } from "@/lib/rateLimit";

export async function POST(request, { params }) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { user, error } = await requireVerifiedUser();
  if (error) return error;
  const { id } = await params;

  // Ownership lives in the query, so someone else's watch is simply not found.
  const watch = await prisma.watch.findFirst({
    where: { id, userId: user.id },
    select: { id: true, status: true },
  });
  if (!watch) return Response.json({ error: "Not found." }, { status: 404 });

  if (watch.status === "PAUSED") {
    return Response.json({ error: "Resume this watch before checking it." }, { status: 400 });
  }

  const key = `checknow:${watch.id}`;
  if (await isBlocked(key, 1)) {
    return Response.json({ error: "You can check a page once a minute." }, { status: 429 });
  }
  await recordHit(key, 60 * 1000);

  // The worker does the actual check on its next tick.
  await prisma.watch.updateMany({
    where: { id: watch.id, userId: user.id, status: { not: "PAUSED" } },
    data: { nextCheckAt: new Date() },
  });

  return Response.json({ ok: true });
}