import "dotenv/config";
import { prisma } from "../src/lib/db.js";
import { runDueChecks, BATCH } from "./scheduler.js";
import { sendDueAlerts } from "./notifier.js";
import { sendErrorAlerts } from "./errorNotifier.js";
import { runCleanup } from "./cleanup.js";

// One tick: do all the work that is due now, then exit.
const BUDGET_MS = 4 * 60 * 1000; // stop starting new work after 4 minutes
const started = Date.now();
const outOfTime = () => Date.now() - started > BUDGET_MS;

async function main() {
  console.log("[tick] started");

  // Keep going while full batches of due watches are waiting.
  let found;
  do {
    found = await runDueChecks(outOfTime);
  } while (found >= BATCH && !outOfTime());

  await sendDueAlerts(outOfTime);
  await sendErrorAlerts(outOfTime);

  // Housekeeping once a day, at about 03:00 UTC.
  const now = new Date();
  if (now.getUTCHours() === 3 && now.getUTCMinutes() < 10) {
    await runCleanup();
  }
}

try {
  await main();
} catch (err) {
  console.error("[tick] failed:", err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

console.log(`[tick] done in ${Math.round((Date.now() - started) / 1000)}s`);
process.exit(process.exitCode ?? 0);