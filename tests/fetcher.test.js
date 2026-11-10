import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { Agent } from "undici";
import { createFetcher, safeLookup } from "../worker/fetcher.js";

let server;
let base;
let lastUserAgent = null;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    lastUserAgent = req.headers["user-agent"];
    res.on("error", () => {});

    switch (req.url) {
      case "/ok":
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end("<html><body>Hello</body></html>");
        break;
      case "/missing":
        res.writeHead(404, { "content-type": "text/html" });
        res.end("not here");
        break;
      case "/redirect":
        res.writeHead(302, { location: "/ok" });
        res.end();
        break;
      case "/loop":
        res.writeHead(302, { location: "/loop" });
        res.end();
        break;
      case "/to-internal":
        res.writeHead(302, { location: "/internal" });
        res.end();
        break;
      case "/big-header":
        res.writeHead(200, { "content-type": "text/html" });
        res.end("a".repeat(3 * 1024 * 1024));
        break;
      case "/big-stream": {
        // No content-length: sent in chunks, so only the stream limit can stop it.
        res.writeHead(200, { "content-type": "text/html" });
        for (let i = 0; i < 40 && !res.destroyed; i++) res.write("a".repeat(100 * 1024));
        res.end();
        break;
      }
      case "/pdf":
        res.writeHead(200, { "content-type": "application/pdf" });
        res.end("%PDF");
        break;
      case "/slow":
        break; // never answers
      default:
        res.writeHead(404);
        res.end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

const allowAll = async (url) => ({ ok: true, url });
const fetcher = createFetcher({ checkUrl: allowAll, agent: new Agent() });

describe("fetchPage", () => {
  it("returns the page text", async () => {
    const r = await fetcher(`${base}/ok`);
    expect(r.status).toBe(200);
    expect(r.html).toContain("Hello");
    expect(r.finalUrl).toBe(`${base}/ok`);
  });

  it("identifies itself as a bot", async () => {
    await fetcher(`${base}/ok`);
        expect(lastUserAgent).toMatch(/ChangeDetector\//);
  });

  it("fails on error status codes and keeps the code", async () => {
    await expect(fetcher(`${base}/missing`)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("follows redirects", async () => {
    const r = await fetcher(`${base}/redirect`);
    expect(r.html).toContain("Hello");
    expect(r.finalUrl).toBe(`${base}/ok`);
  });

  it("stops redirect loops", async () => {
    await expect(fetcher(`${base}/loop`)).rejects.toThrow(/too many times/);
  });

  it("re-checks every redirect target", async () => {
    const guarded = createFetcher({
      agent: new Agent(),
      checkUrl: async (url) =>
        url.endsWith("/internal")
          ? { ok: false, reason: "The address points to a private network." }
          : { ok: true, url },
    });
    await expect(guarded(`${base}/to-internal`)).rejects.toThrow(/private network/);
  });

  it("rejects pages over 2 MB by header and by stream", async () => {
    await expect(fetcher(`${base}/big-header`)).rejects.toThrow(/larger than 2 MB/);
    await expect(fetcher(`${base}/big-stream`)).rejects.toThrow(/larger than 2 MB/);
  });

  it("rejects things that are not web pages", async () => {
    await expect(fetcher(`${base}/pdf`)).rejects.toThrow(/not a web page/);
  });

  it("gives up after the time limit", async () => {
    await expect(fetcher(`${base}/slow`, { timeoutMs: 300 })).rejects.toThrow(/too long/);
  });
});

describe("safeLookup", () => {
  it("blocks names that resolve to private addresses", async () => {
    await new Promise((resolve) => {
      safeLookup("localhost", {}, (err) => {
        expect(err).toBeTruthy();
        resolve();
      });
    });
  });

  it("blocks them in all-addresses mode too", async () => {
    await new Promise((resolve) => {
      safeLookup("localhost", { all: true }, (err) => {
        expect(err).toBeTruthy();
        resolve();
      });
    });
  });

  it("lets public addresses through", async () => {
    await new Promise((resolve) => {
      safeLookup("8.8.8.8", {}, (err, address) => {
        expect(err).toBeNull();
        expect(address).toBe("8.8.8.8");
        resolve();
      });
    });
  });
});