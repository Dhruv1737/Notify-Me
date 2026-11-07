import { describe, it, expect } from "vitest";
import { sha256, keywordStateFor, afterFailure } from "../worker/checkLogic.js";

describe("sha256", () => {
  it("matches the known value for abc", () => {
    expect(sha256("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("is stable, and any change gives a different code", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
    expect(sha256("hello")).not.toBe(sha256("hello "));
    expect(sha256("hello")).toHaveLength(64);
  });
});

describe("keywordStateFor", () => {
  it("is empty for alert types that do not track presence", () => {
    expect(keywordStateFor("PAGE_CHANGES", [], "ANY", "text")).toBeNull();
    expect(keywordStateFor("NEW_LINE_KEYWORDS", ["text"], "ANY", "text")).toBeNull();
  });

  it("records whether the keywords are on the page", () => {
    expect(keywordStateFor("KEYWORDS_APPEAR", ["result"], "ANY", "Result out")).toBe(true);
    expect(keywordStateFor("KEYWORDS_APPEAR", ["result"], "ANY", "nothing yet")).toBe(false);
    expect(keywordStateFor("KEYWORDS_DISAPPEAR", ["sold out"], "ANY", "In stock")).toBe(false);
  });
});

describe("afterFailure", () => {
  it("counts failures and keeps the status until the third", () => {
    expect(afterFailure({ failureCount: 0, status: "ACTIVE" })).toEqual({ failureCount: 1, status: "ACTIVE" });
    expect(afterFailure({ failureCount: 1, status: "PENDING" })).toEqual({ failureCount: 2, status: "PENDING" });
  });

  it("moves to Error on the third failure in a row and stays there", () => {
    expect(afterFailure({ failureCount: 2, status: "ACTIVE" })).toEqual({ failureCount: 3, status: "ERROR" });
    expect(afterFailure({ failureCount: 3, status: "ERROR" })).toEqual({ failureCount: 4, status: "ERROR" });
  });
});