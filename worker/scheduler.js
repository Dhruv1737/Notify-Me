import { prisma } from "../src/lib/db.js";
import { checkWatch } from "./checkWatch.js";
import { nextCheckTime } from "./schedule.js";

const LOCK_MS = 2 * 60 * 1000; 
export const BATCH = 20;

async function claimWatch(id) {
  const now = new Date();
  const result = await prisma.watch.updateMany({
    where: { id, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { lockedUntil: new Date(now.getTime() + LOCK_MS) },
  });
  return result.count === 1;
}

export async function runDueChecks(shouldStop) {
  const now = new Date();

  const due = await prisma.watch.findMany({
    where: {
      status: { in: ["PENDING", "ACTIVE", "ERROR"] },
      nextCheckAt: { lte: now },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
    orderBy: { nextCheckAt: "asc" },
    take: BATCH,
  });

  for (const watch of due) {
    if (shouldStop()) break;
    if (!(await claimWatch(watch.id))) continue;

    try {
      await checkWatch(watch.id);
    } catch (err) {
      console.error(`[worker] check failed for ${watch.id}: ${err.message}`);
      await prisma.watch.updateMany({
        where: { id: watch.id },
        data: {
          nextCheckAt: nextCheckTime(watch.intervalMinutes),
          lockedUntil: null,
        },
      });
    }
  }
    return due.length;
}