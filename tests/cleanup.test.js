import { describe, it, expect } from "vitest";
import { cleanupCutoffs, CHECK_LOG_DAYS, CHANGE_DAYS } from "../worker/cleanupRules.js";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-07T00:00:00Z");

describe("cleanupCutoffs", () => {
  it("keeps check logs for 30 days and changes for 90", () => {
    const c = cleanupCutoffs(now);
    expect(now.getTime() - c.checkLogs.getTime()).toBe(CHECK_LOG_DAYS * DAY);
    expect(now.getTime() - c.changes.getTime()).toBe(CHANGE_DAYS * DAY);
    expect(CHECK_LOG_DAYS).toBe(30);
  });

  it("gives used and expired tokens a day of grace", () => {
    expect(now.getTime() - cleanupCutoffs(now).tokens.getTime()).toBe(DAY);
  });
});