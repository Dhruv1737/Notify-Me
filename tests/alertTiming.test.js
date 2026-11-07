import { describe, it, expect } from "vitest";
import {
  COOLDOWN_MS,
  RETRY_MS,
  isCooledDown,
  retryStamp,
  staleCutoff,
  STALE_MS,
} from "../worker/alertTiming.js";

const now = new Date("2026-11-07T12:00:00Z");
const minutesAgo = (m) => new Date(now.getTime() - m * 60 * 1000);

describe("isCooledDown", () => {
  it("allows a watch that has never sent", () => {
    expect(isCooledDown(null, now)).toBe(true);
  });

  it("blocks a watch that sent less than 15 minutes ago", () => {
    expect(isCooledDown(minutesAgo(0), now)).toBe(false);
    expect(isCooledDown(minutesAgo(14), now)).toBe(false);
  });

  it("allows a watch once 15 minutes have passed", () => {
    expect(isCooledDown(minutesAgo(15), now)).toBe(true);
    expect(isCooledDown(minutesAgo(60), now)).toBe(true);
  });
});

describe("retryStamp", () => {
  it("makes a failed watch due again after the retry delay, not before", () => {
    const stamp = retryStamp(now);
    const justBefore = new Date(now.getTime() + RETRY_MS - 1000);
    const justAfter = new Date(now.getTime() + RETRY_MS + 1000);
    expect(isCooledDown(stamp, justBefore)).toBe(false);
    expect(isCooledDown(stamp, justAfter)).toBe(true);
  });

  it("retries much sooner than the normal cooldown", () => {
    expect(RETRY_MS).toBeLessThan(COOLDOWN_MS);
  });
});

describe("staleCutoff", () => {
  it("is 24 hours back", () => {
    expect(now.getTime() - staleCutoff(now).getTime()).toBe(STALE_MS);
  });
});