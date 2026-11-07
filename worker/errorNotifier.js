import { prisma } from "../src/lib/db.js";
import { sendEmail } from "../src/lib/email.js";
import { failureEmail, recoveryEmail } from "./alertEmails.js";
import { errorMailAction } from "./errorAlertLogic.js";
import { RETRY_MS } from "./alertTiming.js";

const BATCH = 20;
const appUrl = () => process.env.APP_URL || "http://localhost:3000";

// Kept in memory on purpose: after a failed send, wait before trying that
// watch again. If the worker restarts, it simply retries straight away.
const retryAfter = new Map();

async function sendFailure(watch, now) {
  // Atomic claim: only one worker can flip errorNotifiedAt from empty.
  const claimed = await prisma.watch.updateMany({
    where: { id: watch.id, status: "ERROR", errorNotifiedAt: null, alertsEnabled: true },
    data: { errorNotifiedAt: now },
  });
  if (claimed.count !== 1) return;

  try {
    const message = failureEmail({
      watch,
      error: watch.lastError ?? "The page could not be loaded.",
      failures: watch.failureCount,
      appUrl: appUrl(),
    });
    await sendEmail({ to: watch.user.email, ...message });
    retryAfter.delete(watch.id);
    console.log(`[worker] failure email sent for ${watch.url}`);
  } catch (err) {
    console.error(`[worker] failure email failed for ${watch.id}: ${err.message}`);
    // Give the claim back so the email is tried again later.
    await prisma.watch.updateMany({
      where: { id: watch.id, status: "ERROR" },
      data: { errorNotifiedAt: null },
    });
    retryAfter.set(watch.id, now.getTime() + RETRY_MS);
  }
}

async function sendRecovery(watch, action, now) {
  const claimed = await prisma.watch.updateMany({
    where: { id: watch.id, status: "ACTIVE", errorNotifiedAt: { not: null } },
    data: { errorNotifiedAt: null },
  });
  if (claimed.count !== 1) return;
  if (action === "clear") return; // emails are off: nothing to send

  try {
    await sendEmail({
      to: watch.user.email,
      ...recoveryEmail({ watch, appUrl: appUrl() }),
    });
    retryAfter.delete(watch.id);
    console.log(`[worker] recovery email sent for ${watch.url}`);
  } catch (err) {
    console.error(`[worker] recovery email failed for ${watch.id}: ${err.message}`);
    await prisma.watch.updateMany({
      where: { id: watch.id, status: "ACTIVE", errorNotifiedAt: null },
      data: { errorNotifiedAt: watch.errorNotifiedAt },
    });
    retryAfter.set(watch.id, now.getTime() + RETRY_MS);
  }
}

export async function sendErrorAlerts(shouldStop = () => false) {
  const now = new Date();

  const candidates = await prisma.watch.findMany({
    where: {
      OR: [
        { status: "ERROR", errorNotifiedAt: null, alertsEnabled: true },
        { status: "ACTIVE", errorNotifiedAt: { not: null } },
      ],
    },
    include: { user: { select: { email: true } } },
    take: BATCH,
  });

  for (const watch of candidates) {
    if (shouldStop()) break;
    if ((retryAfter.get(watch.id) ?? 0) > now.getTime()) continue;

    const action = errorMailAction(watch);
    if (action === "failure") await sendFailure(watch, now);
    else if (action === "recovery" || action === "clear") await sendRecovery(watch, action, now);
  }
}