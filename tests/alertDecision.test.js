import { describe, it, expect } from "vitest";
import { decideAlert, MAX_MATCHED_LINES } from "../worker/alertDecision.js";
import { matchingLines } from "../src/lib/keywords.js";

const base = {
  alertsEnabled: true,
  keywords: [],
  matchMode: "ANY",
  previousState: null,
  oldText: "",
  newText: "",
  addedLines: [],
};
const decide = (o) => decideAlert({ ...base, ...o });

describe("matchingLines", () => {
  it("with ALL, one line must hold every keyword", () => {
    expect(matchingLines(["a b", "a", "b"], ["a", "b"], "ALL")).toEqual(["a b"]);
  });
  it("with ANY, one keyword is enough", () => {
    expect(matchingLines(["a b", "a", "c"], ["a", "b"], "ANY")).toEqual(["a b", "a"]);
  });
});

describe("page changes", () => {
  it("alerts on any change", () => {
    const r = decide({ alertMode: "PAGE_CHANGES", addedLines: ["x"] });
    expect(r.alertable).toBe(true);
    expect(r.keywordState).toBeNull();
    expect(r.matchedKeywords).toEqual([]);
    expect(r.matchedLines).toEqual([]);
  });

  it("stays quiet when emails are off", () => {
    expect(decide({ alertMode: "PAGE_CHANGES", alertsEnabled: false }).alertable).toBe(false);
  });
});

describe("new line has keywords", () => {
  const mode = { alertMode: "NEW_LINE_KEYWORDS", keywords: ["result"] };

  it("alerts when an added line has the keyword", () => {
    const r = decide({ ...mode, addedLines: ["Result declared for B.Tech", "Holiday notice"] });
    expect(r.alertable).toBe(true);
    expect(r.matchedLines).toEqual(["Result declared for B.Tech"]);
    expect(r.matchedKeywords).toEqual(["result"]);
  });

  it("ignores an unrelated new notice", () => {
    const r = decide({ ...mode, addedLines: ["Holiday notice"] });
    expect(r.alertable).toBe(false);
    expect(r.matchedLines).toEqual([]);
  });

  it("only looks at added lines, not the rest of the page", () => {
    const r = decide({ ...mode, newText: "Result page\nHoliday notice", addedLines: ["Holiday notice"] });
    expect(r.alertable).toBe(false);
  });

  it("with ALL, one added line must have every keyword", () => {
    const all = { alertMode: "NEW_LINE_KEYWORDS", keywords: ["result", "btech"], matchMode: "ALL" };
    expect(decide({ ...all, addedLines: ["result out", "btech notice"] }).alertable).toBe(false);
    expect(decide({ ...all, addedLines: ["result for btech"] }).alertable).toBe(true);
  });

  it("does not track presence", () => {
    expect(decide({ ...mode, addedLines: ["result"] }).keywordState).toBeNull();
  });
});

describe("keywords appear", () => {
  const mode = { alertMode: "KEYWORDS_APPEAR", keywords: ["in stock"] };

  it("alerts when they go from absent to present", () => {
    const r = decide({ ...mode, previousState: false, newText: "Now IN STOCK!\nOther" });
    expect(r.alertable).toBe(true);
    expect(r.keywordState).toBe(true);
    expect(r.matchedKeywords).toEqual(["in stock"]);
    expect(r.matchedLines).toEqual(["Now IN STOCK!"]);
  });

  it("stays quiet while they remain on the page", () => {
    const r = decide({ ...mode, previousState: true, newText: "in stock, price changed" });
    expect(r.alertable).toBe(false);
    expect(r.keywordState).toBe(true);
  });

  it("stays quiet while they remain absent", () => {
    const r = decide({ ...mode, previousState: false, newText: "sold out" });
    expect(r.alertable).toBe(false);
    expect(r.keywordState).toBe(false);
  });

  it("does not treat a missing starting state as a flip", () => {
    expect(decide({ ...mode, previousState: null, newText: "in stock" }).alertable).toBe(false);
  });

  it("re-arms after the keywords leave and come back", () => {
    const gone = decide({ ...mode, previousState: true, newText: "sold out" });
    expect(gone.alertable).toBe(false);
    const back = decide({ ...mode, previousState: gone.keywordState, newText: "in stock again" });
    expect(back.alertable).toBe(true);
  });

  it("with ALL, needs every keyword on the page", () => {
    const all = { alertMode: "KEYWORDS_APPEAR", keywords: ["sale", "free shipping"], matchMode: "ALL" };
    expect(decide({ ...all, previousState: false, newText: "sale only" }).alertable).toBe(false);
    expect(decide({ ...all, previousState: false, newText: "sale\nfree shipping" }).alertable).toBe(true);
  });

  it("lists at most 5 matching lines and clips long ones", () => {
    const lines = Array.from({ length: 8 }, (_, i) => `in stock item ${i}`);
    lines[0] = `in stock ${"x".repeat(3000)}`;
    const r = decide({ ...mode, previousState: false, newText: lines.join("\n") });
    expect(r.matchedLines).toHaveLength(MAX_MATCHED_LINES);
    expect(r.matchedLines[0]).toHaveLength(1001);
  });
});

describe("keywords disappear", () => {
  const mode = { alertMode: "KEYWORDS_DISAPPEAR", keywords: ["in stock", "sale"] };

  it("alerts when they go from present to absent", () => {
    const r = decide({ ...mode, previousState: true, oldText: "In stock\nSale", newText: "Sold out" });
    expect(r.alertable).toBe(true);
    expect(r.keywordState).toBe(false);
    expect(r.matchedKeywords).toEqual(["in stock", "sale"]);
  });

  it("with ANY, one keyword leaving is not enough", () => {
    const r = decide({ ...mode, previousState: true, oldText: "in stock sale", newText: "sale only" });
    expect(r.alertable).toBe(false);
    expect(r.keywordState).toBe(true);
  });

  it("with ALL, the first missing keyword counts, and only it is named", () => {
    const all = { alertMode: "KEYWORDS_DISAPPEAR", keywords: ["a b", "c d"], matchMode: "ALL" };
    const r = decide({ ...all, previousState: true, oldText: "a b\nc d", newText: "a b" });
    expect(r.alertable).toBe(true);
    expect(r.matchedKeywords).toEqual(["c d"]);
  });

  it("stays quiet when they were already absent or still present", () => {
    expect(decide({ ...mode, previousState: false, newText: "nothing" }).alertable).toBe(false);
    expect(decide({ ...mode, previousState: true, newText: "in stock" }).alertable).toBe(false);
  });
});

describe("emails switched off", () => {
  it("still tracks the keyword state, so turning emails on later is clean", () => {
    const r = decide({
      alertMode: "KEYWORDS_APPEAR",
      keywords: ["in stock"],
      alertsEnabled: false,
      previousState: false,
      newText: "in stock",
    });
    expect(r.alertable).toBe(false);
    expect(r.keywordState).toBe(true);
    expect(r.matchedKeywords).toEqual(["in stock"]);
  });
});