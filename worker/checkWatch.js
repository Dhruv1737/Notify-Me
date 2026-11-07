import { prisma } from "../src/lib/db.js";
import { fetchPage, FetchError } from "./fetcher.js";
import { extractText, isLowContent, CleanError } from "./cleaner.js";
import { nextCheckTime } from "./schedule.js";
import {
  sha256,
  keywordStateFor,
  afterFailure,
  MAX_FAILURES,
  LOW_CONTENT_WARNING,
} from "./checkLogic.js";

const KEEP_SNAPSHOTS = 20;
const TX_OPTIONS = { timeout: 15_000, maxWait: 10_000 };

async function releaseLock(client, id) {
  await client.watch.updateMany({ where: { id }, data: { lockedUntil: null } });
}

// Only the 20 newest snapshots are kept per watch.
async function pruneSnapshots(tx, watchId) {
  const old = await tx.snapshot.findMany({
    where: { watchId },
    orderBy: { createdAt: "desc" },
    skip: KEEP_SNAPSHOTS,
    select: { id: true },
  });
  if (old.length > 0) {
    await tx.snapshot.deleteMany({ where: { id: { in: old.map((s) => s.id) } } });
  }
}

async function recordFailure(watch, message, statusCode, durationMs) {
  const { failureCount, status } = afterFailure(watch);
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    // The guard means a watch paused (or deleted) while we were fetching is left alone.
    const updated = await tx.watch.updateMany({
      where: { id: watch.id, status: { not: "PAUSED" } },
      data: {
        failureCount,
        status,
        lastError: message,
        lastCheckedAt: now,
        nextCheckAt: nextCheckTime(watch.intervalMinutes, now),
        lockedUntil: null,
      },
    });
    if (updated.count === 0) {
      await releaseLock(tx, watch.id);
      return "skipped (paused or deleted during the check)";
    }

    await tx.checkLog.create({
      data: { watchId: watch.id, success: false, statusCode, durationMs, error: message },
    });

    return status === "ERROR" && watch.status !== "ERROR"
      ? `failed ${failureCount} times in a row, now in Error state: ${message}`
      : `failed (${failureCount} in a row): ${message}`;
  }, TX_OPTIONS);
}

async function recordSuccess(watch, text, statusCode, durationMs) {
  const hash = sha256(text);
  const now = new Date();

  const last = await prisma.snapshot.findFirst({
    where: { watchId: watch.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, hash: true },
  });
  const isBaseline = !last;
  const changed = !!last && last.hash !== hash;

  const data = {
    status: "ACTIVE",
    failureCount: 0,
    lastError: null,
    warning: isLowContent(text) ? LOW_CONTENT_WARNING : null,
    // At the baseline this is the silent starting value. Alerts come in Phase 5.
    keywordState: keywordStateFor(watch.alertMode, watch.keywords, watch.matchMode, text),
    lastCheckedAt: now,
    nextCheckAt: nextCheckTime(watch.intervalMinutes, now),
    lockedUntil: null,
  };
  if (changed) data.lastChangedAt = now;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.watch.updateMany({
      where: { id: watch.id, status: { not: "PAUSED" } },
      data,
    });
    if (updated.count === 0) {
      await releaseLock(tx, watch.id);
      return "skipped (paused or deleted during the check)";
    }

    let snapshot = null;
    if (isBaseline || changed) {
      snapshot = await tx.snapshot.create({
        data: { watchId: watch.id, content: text, hash },
      });
    }

    if (changed) {
      // Step 5 fills in the added and removed lines here.
      await tx.change.create({
        data: { watchId: watch.id, fromSnapshotId: last.id, toSnapshotId: snapshot.id },
      });
    }

    await tx.checkLog.create({
      data: { watchId: watch.id, success: true, statusCode, durationMs, changed },
    });

    if (snapshot) await pruneSnapshots(tx, watch.id);

    if (isBaseline) return `baseline saved (${text.length} characters)`;
    return changed ? "changed" : "unchanged";
  }, TX_OPTIONS);
}

export async function checkWatch(id) {
  // Always reload: the watch may have changed since it was found as due.
  const watch = await prisma.watch.findUnique({ where: { id } });
  if (!watch) return;
  if (watch.status === "PAUSED") {
    await releaseLock(prisma, id);
    return;
  }

  const started = Date.now();
  let statusCode = null;
  let text;

  try {
    const page = await fetchPage(watch.url);
    statusCode = page.status;
    text = extractText(page.html, watch.selector).text;
  } catch (err) {
    if (err instanceof FetchError || err instanceof CleanError) {
      const outcome = await recordFailure(
        watch,
        err.message,
        err.statusCode ?? statusCode,
        Date.now() - started
      );
      console.log(`[worker] ${watch.url}: ${outcome}`);
      return;
    }
    throw err; // unexpected: the scheduler logs it and moves the watch on
  }

  const outcome = await recordSuccess(watch, text, statusCode, Date.now() - started);
  console.log(`[worker] ${watch.url}: ${outcome}`);
}