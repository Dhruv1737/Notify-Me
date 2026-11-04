import { describe, it, expect } from "vitest";
import { checkUrl, isPublicIp } from "../src/lib/urlSafety.js";

describe("isPublicIp", () => {
  it("accepts public addresses", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("1.1.1.1")).toBe(true);
  });

  it("rejects private, loopback and special addresses", () => {
    for (const ip of [
      "127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.1",
      "169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1",
      "::1", "::", "fe80::1", "fc00::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1",
    ]) {
      expect(isPublicIp(ip), ip).toBe(false);
    }
  });

  it("rejects garbage", () => {
    expect(isPublicIp("not-an-ip")).toBe(false);
  });
});

describe("checkUrl", () => {
  it("accepts a public IP address", async () => {
    const r = await checkUrl("http://8.8.8.8/page#top");
    expect(r.ok).toBe(true);
    expect(r.url).toBe("http://8.8.8.8/page");
  });

  it("rejects internal targets", async () => {
    for (const u of [
      "http://localhost",
      "http://localhost:3000",
      "http://127.0.0.1",
      "http://127.1",
      "http://2130706433",
      "http://[::1]",
      "http://[::ffff:127.0.0.1]",
      "http://10.0.0.1",
      "http://192.168.1.1",
      "http://169.254.169.254/latest/meta-data",
      "http://intranet",
      "http://printer.local",
    ]) {
      const r = await checkUrl(u);
      expect(r.ok, u).toBe(false);
    }
  });

  it("rejects wrong protocols, ports and credentials", async () => {
    for (const u of [
      "ftp://8.8.8.8",
      "file:///etc/passwd",
      "gopher://8.8.8.8",
      "http://8.8.8.8:22",
      "http://8.8.8.8:5432",
      "http://user:pass@8.8.8.8",
    ]) {
      const r = await checkUrl(u);
      expect(r.ok, u).toBe(false);
    }
  });

  it("allows ports 80 and 443", async () => {
    expect((await checkUrl("http://8.8.8.8:80")).ok).toBe(true);
    expect((await checkUrl("https://8.8.8.8:443")).ok).toBe(true);
  });

  it("rejects invalid input", async () => {
    for (const u of ["", "   ", "not a url", null, undefined, 123, "http://" + "a".repeat(2100)]) {
      expect((await checkUrl(u)).ok).toBe(false);
    }
  });
});