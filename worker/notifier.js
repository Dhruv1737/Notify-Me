import { prisma } from "../src/lib/db.js";
import { sendEmail } from "../src/lib/email.js";
import { changeEmail } from "./alertEmails.js";
import { cooldownCutoff, staleCutoff, retryStamp } from "./alertTiming.js";

const BATCH = 20;
const MAX_CHANGES_PER_EMAIL = 50;

const appUrl = () => process.env.APP_URL || "http://localhost:3000";

async function sendForWatch(candidate, claimedAt) {
  const watch = await prisma.watch.findUnique({
    where: { id: candidate.id },
    include: { user: { select: { email: true } } },
  });

  const changes = watch
    ? await prisma.change.findMany({
        where: {
          watchId: watch.id,
          alertable: true,
          emailedAt: null,
          createdAt: { gte: staleCutoff(claimedAt) },
        },
        orderBy: { createdAt: "asc" },
        take: MAX_CHANGES_PER_EMAIL,
      })
    : [];

  // Things can change between "found due" and "claimed". If there is
  // nothing left to send, give the cooldown back.
  if (!watch || !watch.alertsEnabled || watch.status === "PAUSED" || changes.length === 0) {
    await prisma.watch.updateMany({
      where: { id: candidate.id },
      data: { lastAlertAt: candidate.lastAlertAt },
    });
    return;
  }

  const message = changeEmail({ watch, changes, appUrl: appUrl() });
  await sendEmail({ to: watch.user.email, ...message });

  await prisma.change.updateMany({
    where: { id: { in: changes.map((c) => c.id) }, emailedAt: null },
    data: { emailedAt: new Date() },
  });

  console.log(
    `[worker] alert sent for ${watch.url} (${changes.length} change${changes.length === 1 ? "" : "s"})`
  );
}

export async function sendDueAlerts(shouldStop = () => false) {
  const now = new Date();

  const dueWatch = {
    alertsEnabled: true,
    status: { not: "PAUSED" },
    OR: [{ lastAlertAt: null }, { lastAlertAt: { lte: cooldownCutoff(now) } }],
  };

  const candidates = await prisma.watch.findMany({
    where: {
      ...dueWatch,
      changes: {
        some: { alertable: true, emailedAt: null, createdAt: { gte: staleCutoff(now) } },
      },
    },
    select: { id: true, lastAlertAt: true },
    take: BATCH,
  });

  for (const candidate of candidates) {
    if (shouldStop()) break;

    // Atomic claim: only one caller can move lastAlertAt out of the due window.
    const claimed = await prisma.watch.updateMany({
      where: { id: candidate.id, ...dueWatch },
      data: { lastAlertAt: now },
    });
    if (claimed.count !== 1) continue;

    try {
      await sendForWatch(candidate, now);
    } catch (err) {
      console.error(`[worker] alert email failed for ${candidate.id}: ${err.message}`);
      await prisma.watch.updateMany({
        where: { id: candidate.id },
        data: { lastAlertAt: retryStamp(now) },
      });
    }
  }
}