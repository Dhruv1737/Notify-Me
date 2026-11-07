import "dotenv/config";
import http from "node:http";
import { prisma } from "../src/lib/db.js";

const count = Number(process.argv[2] || 300);
const PORT = 4100;
const EMAIL = "loadtest@example.invalid";

if (!Number.isInteger(count) || count < 1 || count > 5000) {
  console.log("Usage: node scripts/load-test.mjs [number of watches, 1 to 5000]");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let aborted = false;
process.on("SIGINT", () => {
  aborted = true;
});

// A dummy site that answers after 20 to 120 ms, like a real page would.
let served = 0;
const server = http.createServer((req, res) => {
  served++;
  setTimeout(() => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(`<html><body><p>Load test page ${req.url}, with enough text to count as a page.</p></body></html>`);
  }, 20 + Math.floor(Math.random() * 100));
});
await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

console.log("Start the worker first, in another terminal, with:");
console.log('  $env:LOAD_TEST="1"; npm run worker');
console.log("and make sure no other worker is running.\n");

await prisma.user.deleteMany({ where: { email: EMAIL } }); // leftovers from an earlier run
const user = await prisma.user.create({
  data: { email: EMAIL, passwordHash: "not-a-real-hash", verifiedAt: new Date() },
});

try {
  const started = new Date();
  await prisma.watch.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      userId: user.id,
      url: `http://127.0.0.1:${PORT}/page/${i}`,
      intervalMinutes: 1440,
      alertsEnabled: false,
      nextCheckAt: started,
    })),
  });
  console.log(`Created ${count} watches, all due now. Waiting for the worker...\n`);

  const deadline = Date.now() + 30 * 60 * 1000;
  let done = 0;
  while (!aborted && Date.now() < deadline) {
    done = await prisma.watch.count({
      where: { userId: user.id, lastCheckedAt: { not: null } },
    });
    const seconds = Math.round((Date.now() - started.getTime()) / 1000);
    console.log(`${done}/${count} checked after ${seconds}s`);
    if (done >= count) break;
    await sleep(2000);
  }

  const rows = await prisma.watch.findMany({
    where: { userId: user.id, lastCheckedAt: { not: null } },
    select: { lastCheckedAt: true, failureCount: true },
  });
  const late = rows
    .map((r) => (r.lastCheckedAt.getTime() - started.getTime()) / 1000)
    .sort((a, b) => a - b);
  const pct = (p) => (late.length ? late[Math.min(late.length - 1, Math.floor(p * late.length))] : 0);
  const total = late.length ? late[late.length - 1] : 0;

  console.log("\n--- Result ---");
  console.log(`Watches checked:   ${rows.length} of ${count}`);
  console.log(`Requests served:   ${served}`);
  console.log(`Failed checks:     ${rows.filter((r) => r.failureCount > 0).length}`);
  console.log(`Total time:        ${total.toFixed(1)} s`);
  console.log(`Throughput:        ${total > 0 ? (rows.length / total).toFixed(2) : "n/a"} checks per second`);
  console.log("Lateness (seconds after becoming due):");
  console.log(`  median ${pct(0.5).toFixed(1)}   95th percentile ${pct(0.95).toFixed(1)}   slowest ${total.toFixed(1)}`);
} finally {
  await prisma.user.deleteMany({ where: { email: EMAIL } }); // cascades to its watches
  server.close();
  await prisma.$disconnect();
}