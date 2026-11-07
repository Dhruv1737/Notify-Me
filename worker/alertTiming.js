export const COOLDOWN_MS = 15 * 60 * 1000; // at most one change email per watch per 15 minutes
export const RETRY_MS = 2 * 60 * 1000; // after a failed send, try again after this
export const STALE_MS = 24 * 60 * 60 * 1000; // changes older than this are no longer emailed

export const cooldownCutoff = (now) => new Date(now.getTime() - COOLDOWN_MS);
export const staleCutoff = (now) => new Date(now.getTime() - STALE_MS);

// A watch may send when it has never sent, or its last send is at least 15 minutes old.
export function isCooledDown(lastAlertAt, now) {
  return !lastAlertAt || lastAlertAt <= cooldownCutoff(now);
}

// After a failed send, pretend the last alert was (cooldown - retry) ago,
// so the watch becomes due again after RETRY_MS instead of after 15 minutes.
export const retryStamp = (now) => new Date(now.getTime() - COOLDOWN_MS + RETRY_MS);