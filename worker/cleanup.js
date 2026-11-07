import { prisma } from "../src/lib/db.js";
import { cleanupCutoffs } from "./cleanupRules.js";

// Safe to run from several workers at once: every step is an idempotent delete.
export async function runCleanup(now = new Date()) {
  const cut = cleanupCutoffs(now);

  const logs = await prisma.checkLog.deleteMany({ where: { checkedAt: { lt: cut.checkLogs } } });
  const changes = await prisma.change.deleteMany({ where: { createdAt: { lt: cut.changes } } });
  const sessions = await prisma.session.deleteMany({ where: { expiresAt: { lt: cut.now } } });
  const tokens = await prisma.emailToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: cut.tokens } }, { usedAt: { lt: cut.tokens } }] },
  });
  const limits = await prisma.rateLimit.deleteMany({ where: { resetAt: { lt: cut.now } } });

  console.log(
    `[worker] cleanup: ${logs.count} check logs, ${changes.count} old changes, ` +
      `${sessions.count} sessions, ${tokens.count} email tokens, ${limits.count} rate limits`
  );
}