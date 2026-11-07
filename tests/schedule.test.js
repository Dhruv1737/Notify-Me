import { describe, it, expect } from "vitest";
import { nextCheckTime } from "../worker/schedule.js";

describe("nextCheckTime", () => {
  it("adds the interval plus at most 10 percent", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 200; i++) {
      const delta = nextCheckTime(60, from).getTime() - from.getTime();
      expect(delta).toBeGreaterThanOrEqual(60 * 60 * 1000);
      expect(delta).toBeLessThanOrEqual(66 * 60 * 1000);
    }
  });

  it("spreads checks out instead of using one fixed delay", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const times = new Set();
    for (let i = 0; i < 50; i++) times.add(nextCheckTime(60, from).getTime());
    expect(times.size).toBeGreaterThan(1);
  });
});