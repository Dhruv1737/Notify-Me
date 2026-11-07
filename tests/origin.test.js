import { describe, it, expect } from "vitest";
import { isSameOrigin, getIp } from "../src/lib/origin.js";

const req = (headers) => ({ headers: new Headers(headers) });

describe("isSameOrigin", () => {
  it("accepts a request from the same site", () => {
    expect(isSameOrigin(req({ origin: "https://app.example.com", host: "app.example.com" }))).toBe(true);
  });

  it("compares ports too", () => {
    expect(isSameOrigin(req({ origin: "http://localhost:3000", host: "localhost:3000" }))).toBe(true);
    expect(isSameOrigin(req({ origin: "http://localhost:4000", host: "localhost:3000" }))).toBe(false);
  });

  it("rejects another site and look-alike hosts", () => {
    expect(isSameOrigin(req({ origin: "https://evil.com", host: "app.example.com" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "https://app.example.com.evil.com", host: "app.example.com" }))).toBe(false);
  });

  it("rejects a missing or malformed origin or host", () => {
    expect(isSameOrigin(req({ host: "app.example.com" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "https://app.example.com" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "not a url", host: "app.example.com" }))).toBe(false);
  });
});

describe("getIp", () => {
  it("uses the first address in x-forwarded-for", () => {
    expect(getIp(req({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });

  it("falls back when there is no header", () => {
    expect(getIp(req({}))).toBe("local");
  });
});