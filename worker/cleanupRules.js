const DAY = 24 * 60 * 60 * 1000;

export const CHECK_LOG_DAYS = 30;
export const CHANGE_DAYS = 90;
export const CLEANUP_EVERY_MS = 6 * 60 * 60 * 1000;

export function cleanupCutoffs(now = new Date()) {
  const ago = (ms) => new Date(now.getTime() - ms);
  return {
    now,
    checkLogs: ago(CHECK_LOG_DAYS * DAY),
    changes: ago(CHANGE_DAYS * DAY),
    tokens: ago(DAY),
  };
}