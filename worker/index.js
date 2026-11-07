import "dotenv/config";
import { prisma } from "../src/lib/db.js";
import { runDueChecks } from "./scheduler.js";
import { sendDueAlerts } from "./notifier.js";
import { sendErrorAlerts } from "./errorNotifier.js";

const TICK_MS = 10 * 1000;
let stopping = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("[worker] started");

  while (!stopping) {
    try {
      await runDueChecks(() => stopping);
    } catch (err) {
      console.error("[worker] checks failed:", err.message);
    }

    try {
      await sendDueAlerts(() => stopping);
    } catch (err) {
      console.error("[worker] alerts failed:", err.message);
    }

    try {
      await sendErrorAlerts(() => stopping);
    } catch (err) {
      console.error("[worker] error alerts failed:", err.message);
    }

    // Sleep in short steps so Ctrl+C is answered quickly.
    for (let waited = 0; waited < TICK_MS && !stopping; waited += 500) {
      await sleep(500);
    }
  }

  await prisma.$disconnect();
  console.log("[worker] stopped");
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!stopping) {
      console.log(`[worker] ${signal} received, finishing current work`);
      stopping = true;
    }
  });
}

main();