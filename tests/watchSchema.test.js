import { describe, it, expect } from "vitest";
import { createWatchSchema } from "../src/lib/validation.js";

const base = { url: "https://example.com" };

describe("createWatchSchema", () => {
  it("fills in defaults", () => {
    const r = createWatchSchema.safeParse(base);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      intervalMinutes: 60,
      alertsEnabled: true,
      alertMode: "PAGE_CHANGES",
      keywords: [],
      matchMode: "ANY",
      name: null,
      selector: null,
    });
  });

  it("turns empty name and selector into null", () => {
    const r = createWatchSchema.safeParse({ ...base, name: "  ", selector: "" });
    expect(r.data.name).toBeNull();
    expect(r.data.selector).toBeNull();
  });

  it("accepts only the allowed intervals", () => {
    for (const v of [5, 15, 60, 360, 1440]) {
      expect(createWatchSchema.safeParse({ ...base, intervalMinutes: v }).success).toBe(true);
    }
    for (const v of [0, 1, 7, 59, 1441, "60", null]) {
      expect(createWatchSchema.safeParse({ ...base, intervalMinutes: v }).success).toBe(false);
    }
  });

  it("requires keywords for the three keyword modes", () => {
    for (const alertMode of ["NEW_LINE_KEYWORDS", "KEYWORDS_APPEAR", "KEYWORDS_DISAPPEAR"]) {
      expect(createWatchSchema.safeParse({ ...base, alertMode }).success).toBe(false);
      expect(
        createWatchSchema.safeParse({ ...base, alertMode, keywords: ["result"] }).success
      ).toBe(true);
    }
  });

  it("does not require keywords for page changes", () => {
    expect(createWatchSchema.safeParse({ ...base, alertMode: "PAGE_CHANGES" }).success).toBe(true);
  });

  it("cleans and de-duplicates keywords", () => {
    const r = createWatchSchema.safeParse({
      ...base,
      alertMode: "KEYWORDS_APPEAR",
      keywords: ["  Result   declared ", "result declared", "In Stock"],
    });
    expect(r.data.keywords).toEqual(["Result declared", "In Stock"]);
  });

  it("enforces keyword length and count", () => {
    const mode = { ...base, alertMode: "KEYWORDS_APPEAR" };
    expect(createWatchSchema.safeParse({ ...mode, keywords: ["a"] }).success).toBe(false);
    expect(createWatchSchema.safeParse({ ...mode, keywords: ["a".repeat(101)] }).success).toBe(false);
    expect(createWatchSchema.safeParse({ ...mode, keywords: ["a".repeat(100)] }).success).toBe(true);
    const eleven = Array.from({ length: 11 }, (_, i) => `word${i}`);
    expect(createWatchSchema.safeParse({ ...mode, keywords: eleven }).success).toBe(false);
  });

  it("rejects unknown modes and a missing url", () => {
    expect(createWatchSchema.safeParse({ ...base, alertMode: "ALWAYS" }).success).toBe(false);
    expect(createWatchSchema.safeParse({ ...base, matchMode: "SOME" }).success).toBe(false);
    expect(createWatchSchema.safeParse({}).success).toBe(false);
  });
});