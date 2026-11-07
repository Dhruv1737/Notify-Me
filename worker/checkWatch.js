import { prisma } from "../src/lib/db.js";
import { fetchPage, FetchError } from "./fetcher.js";
import { extractText, isLowContent, CleanError } from "./cleaner.js";
import { nextCheckTime } from "./schedule.js";
import { diffText } from "./differ.js";
import { decideAlert } from "./alertDecision.js";
import {
  sha256,
  keywordStateFor,
  afterFailure,
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
    select: { id: true, hash: true, content: true },
  });
  const isBaseline = !last;
  const changed = !!last && last.hash !== hash;

  // CPU work happens before the transaction, so the database is not held open.
  const diff = changed ? diffText(last.content, text) : null;
  const decision = changed
    ? decideAlert({
        alertMode: watch.alertMode,
        alertsEnabled: watch.alertsEnabled,
        keywords: watch.keywords,
        matchMode: watch.matchMode,
        previousState: watch.keywordState,
        oldText: last.content,
        newText: text,
        addedLines: diff.addedAll,
      })
    : null;

  const data = {
    status: "ACTIVE",
    failureCount: 0,
    lastError: null,
    warning: isLowContent(text) ? LOW_CONTENT_WARNING : null,
    // Baseline: the silent starting value. Later: the new state, used for the next flip.
    keywordState: decision
      ? decision.keywordState
      : keywordStateFor(watch.alertMode, watch.keywords, watch.matchMode, text),
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
      await tx.change.create({
        data: {
          watchId: watch.id,
          fromSnapshotId: last.id,
          toSnapshotId: snapshot.id,
          added: diff.added,
          removed: diff.removed,
          truncated: diff.truncated,
          alertable: decision.alertable,
          matchedKeywords: decision.matchedKeywords,
          matchedLines: decision.matchedLines,
        },
      });
    }

    await tx.checkLog.create({
      data: { watchId: watch.id, success: true, statusCode, durationMs, changed },
    });

    if (snapshot) await pruneSnapshots(tx, watch.id);

    if (isBaseline) return `baseline saved (${text.length} characters)`;
    if (!changed) return "unchanged";
    const cut = diff.truncated ? ", cut short" : "";
    const alert = decision.alertable ? "alert due" : "no alert";
    return `changed (+${diff.totalAdded} / -${diff.totalRemoved} lines${cut}, ${alert})`;
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