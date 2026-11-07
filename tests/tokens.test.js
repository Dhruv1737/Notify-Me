import { describe, it, expect } from "vitest";
import { randomToken, hashToken } from "../src/lib/tokens.js";

describe("tokens", () => {
  it("makes 64 hex characters of randomness, different every time", () => {
    const a = randomToken();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(randomToken()).not.toBe(a);
  });

  it("hashes with SHA-256", () => {
    expect(hashToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });

  it("gives a stable hash that differs from the token", () => {
    const t = randomToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).not.toBe(t);
    expect(hashToken(t + "x")).not.toBe(hashToken(t));
  });
});