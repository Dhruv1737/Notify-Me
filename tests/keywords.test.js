import { describe, it, expect } from "vitest";
import { containsKeywords, matchedKeywords } from "../src/lib/keywords.js";

describe("containsKeywords", () => {
  it("ignores case and extra spaces", () => {
    expect(containsKeywords("Result   DECLARED today", ["result declared"], "ANY")).toBe(true);
  });

  it("matches a phrase that wraps across lines", () => {
    expect(containsKeywords("result\ndeclared", ["result declared"], "ANY")).toBe(true);
  });

  it("needs the whole phrase, not just one word of it", () => {
    expect(containsKeywords("the result is out", ["result declared"], "ANY")).toBe(false);
  });

  it("ANY needs one keyword, ALL needs every keyword", () => {
    const text = "Sale: in stock now";
    expect(containsKeywords(text, ["in stock", "sold out"], "ANY")).toBe(true);
    expect(containsKeywords(text, ["in stock", "sold out"], "ALL")).toBe(false);
    expect(containsKeywords(text, ["in stock", "sale"], "ALL")).toBe(true);
  });

  it("is false when there are no keywords", () => {
    expect(containsKeywords("anything", [], "ANY")).toBe(false);
    expect(containsKeywords("anything", undefined, "ALL")).toBe(false);
  });

  it("treats keywords as plain text, never as patterns", () => {
    expect(containsKeywords("price (new)", ["(new)"], "ANY")).toBe(true);
    expect(containsKeywords("abc", [".*"], "ANY")).toBe(false);
    expect(containsKeywords("a+b", ["a+b"], "ANY")).toBe(true);
  });
});

describe("matchedKeywords", () => {
  it("returns the keywords as the user typed them", () => {
    expect(matchedKeywords("RESULT out", ["Result", "Admit Card"])).toEqual(["Result"]);
  });
});