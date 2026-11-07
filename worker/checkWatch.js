import { prisma } from "../src/lib/db.js";
import { nextCheckTime } from "./schedule.js";

export async function checkWatch(id) {
  const watch = await prisma.watch.findUnique({ where: { id } });
  if (!watch || watch.status === "PAUSED") return;

  console.log(`[worker] would check ${watch.url} (${watch.status})`);

  await prisma.watch.update({
    where: { id },
    data: {
      nextCheckAt: nextCheckTime(watch.intervalMinutes),
      lockedUntil: null,
    },
  });
}