import { prisma } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth";
import { patchWatchSchema } from "@/lib/validation";
import { isSameOrigin } from "@/lib/origin";

const NOT_FOUND = () => Response.json({ error: "Not found." }, { status: 404 });

// Ownership lives in the query: another user's watch simply isn't found.
export async function GET(request, { params }) {
  const { user, error } = await requireVerifiedUser();
  if (error) return error;
  const { id } = await params;

  const watch = await prisma.watch.findFirst({ where: { id, userId: user.id } });
  if (!watch) return NOT_FOUND();
  return Response.json({ watch });
}

export async function PATCH(request, { params }) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { user, error } = await requireVerifiedUser();
  if (error) return error;
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = patchWatchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { action, alertsEnabled } = parsed.data;

  const existing = await prisma.watch.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NOT_FOUND();

  const update = {};
  if (alertsEnabled !== undefined) update.alertsEnabled = alertsEnabled;
  if (action === "pause") {
    update.status = "PAUSED";
  }
  if (action === "resume") {
    const baselines = await prisma.snapshot.count({ where: { watchId: id } });
    update.status = baselines > 0 ? "ACTIVE" : "PENDING";
    update.nextCheckAt = new Date();
    update.failureCount = 0;
    update.lastError = null;
  }

  const result = await prisma.watch.updateMany({
    where: { id, userId: user.id },
    data: update,
  });
  if (result.count === 0) return NOT_FOUND();

  const watch = await prisma.watch.findFirst({ where: { id, userId: user.id } });
  return Response.json({ watch });
}

export async function DELETE(request, { params }) {
  if (!isSameOrigin(request)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const { user, error } = await requireVerifiedUser();
  if (error) return error;
  const { id } = await params;

  const result = await prisma.watch.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return NOT_FOUND();
  return Response.json({ ok: true });
}