import { describe, it, expect } from "vitest";
import { diffText, MAX_DIFF_LINES, MAX_STORED_LINE_CHARS } from "../worker/differ.js";

describe("diffText", () => {
  it("finds nothing when the texts are the same", () => {
    const r = diffText("A\nB\nC", "A\nB\nC");
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual([]);
    expect(r.truncated).toBe(false);
  });

  it("finds added lines", () => {
    const r = diffText("A\nB", "A\nNew notice\nB");
    expect(r.added).toEqual(["New notice"]);
    expect(r.removed).toEqual([]);
  });

  it("finds removed lines", () => {
    const r = diffText("A\nOld\nB", "A\nB");
    expect(r.added).toEqual([]);
    expect(r.removed).toEqual(["Old"]);
  });

  it("shows a changed line as one removed and one added", () => {
    const r = diffText("Price: 10\nIn stock", "Price: 12\nIn stock");
    expect(r.removed).toEqual(["Price: 10"]);
    expect(r.added).toEqual(["Price: 12"]);
  });

  it("handles a page that started empty or became empty", () => {
    expect(diffText("", "A\nB").added).toEqual(["A", "B"]);
    expect(diffText("A\nB", "").removed).toEqual(["A", "B"]);
    expect(diffText("", "").added).toEqual([]);
  });

  it("copes with repeated lines", () => {
    const r = diffText("x\nx", "x\nx\nx");
    expect(r.added).toEqual(["x"]);
    expect(r.removed).toEqual([]);
  });

  it("reports a moved line as removed and added", () => {
    const r = diffText("A\nB\nC", "B\nC\nA");
    expect(r.added).toEqual(["A"]);
    expect(r.removed).toEqual(["A"]);
  });

  it("stops at 200 lines per side and says so", () => {
    const many = Array.from({ length: 450 }, (_, i) => `line ${i}`).join("\n");
    const r = diffText("start", `start\n${many}`);
    expect(r.added).toHaveLength(MAX_DIFF_LINES);
    expect(r.totalAdded).toBe(450);
    expect(r.truncated).toBe(true);
    // The uncut list is still complete for keyword matching.
    expect(r.addedAll).toHaveLength(450);
  });

  it("does not flag small diffs as cut short", () => {
    expect(diffText("A", "A\nB").truncated).toBe(false);
  });

  it("clips very long lines when storing them", () => {
    const longLine = "x".repeat(5000);
    const r = diffText("A", `A\n${longLine}`);
    expect(r.added[0]).toHaveLength(MAX_STORED_LINE_CHARS + 1);
    expect(r.added[0].endsWith("…")).toBe(true);
    expect(r.addedAll[0]).toHaveLength(5000);
  });

  it("finishes quickly on two large, unrelated pages", () => {
    const a = Array.from({ length: 4000 }, (_, i) => `old ${i} ${"a".repeat(30)}`).join("\n");
    const b = Array.from({ length: 4000 }, (_, i) => `new ${i} ${"b".repeat(30)}`).join("\n");
    const started = Date.now();
    const r = diffText(a, b);
    expect(Date.now() - started).toBeLessThan(6000);
    expect(r.truncated).toBe(true);
    expect(r.added.length).toBeLessThanOrEqual(MAX_DIFF_LINES);
  }, 10_000);
});