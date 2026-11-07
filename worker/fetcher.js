import dns from "node:dns";
import { Agent, fetch } from "undici";
import { checkUrl as defaultCheckUrl, isPublicIp } from "../src/lib/urlSafety.js";

export const FETCH_LIMITS = {
  timeoutMs: 10 * 1000,
  maxBytes: 2 * 1024 * 1024,
  maxRedirects: 5,
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const ALLOWED_TYPES = ["text/html", "application/xhtml+xml", "text/plain"];

// An error whose message is safe to show to the user.
export class FetchError extends Error {
  constructor(message, statusCode = null) {
    super(message);
    this.name = "FetchError";
    this.statusCode = statusCode;
  }
}

// Used by the connection itself, so the address that gets checked is
// the same address that gets connected to.
export function safeLookup(hostname, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = {};
  }
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    if (!addresses.length || !addresses.every((a) => isPublicIp(a.address))) {
      return callback(new Error("BLOCKED_PRIVATE_ADDRESS"));
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

function describeError(err) {
  const cause = err?.cause;
  const code = cause?.code ?? err?.code ?? "";
  const text = `${err?.message ?? ""} ${cause?.message ?? ""}`;

  if (text.includes("BLOCKED_PRIVATE_ADDRESS")) return "The address points to a private network.";
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") return "The address could not be found.";
  if (code === "ECONNREFUSED") return "The server refused the connection.";
  if (code === "ECONNRESET") return "The connection was reset.";
  if (code === "UND_ERR_CONNECT_TIMEOUT") return "The page took too long to respond.";
  if (/CERT|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code)) {
    return "The site's security certificate is not valid.";
  }
  return "The page could not be loaded.";
}

function decode(buffer, contentType) {
  const match = /charset=["']?([\w-]+)/i.exec(contentType ?? "");
  try {
    return new TextDecoder(match ? match[1] : "utf-8").decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

async function readBody(res, maxBytes) {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new FetchError("The page is larger than 2 MB.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

// The check function and the agent can be swapped, which lets tests use a
// local dummy server. The default instance below always uses the safe ones.
export function createFetcher({
  checkUrl = defaultCheckUrl,
  agent = new Agent({ connect: { lookup: safeLookup } }),
} = {}) {
  return async function fetchPage(startUrl, options = {}) {
    const timeoutMs = options.timeoutMs ?? FETCH_LIMITS.timeoutMs;
    const maxBytes = options.maxBytes ?? FETCH_LIMITS.maxBytes;
    const maxRedirects = options.maxRedirects ?? FETCH_LIMITS.maxRedirects;

    const started = Date.now();
    const controller = new AbortController();
    let timedOut = false;
    // One timer covers connecting, redirects and reading the body.
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      let url = startUrl;

      for (let hop = 0; hop <= maxRedirects; hop++) {
        const check = await checkUrl(url);
        if (!check.ok) throw new FetchError(check.reason);
        url = check.url;

        const res = await fetch(url, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          dispatcher: agent,
          headers: {
            "User-Agent": `ChangeDetectorBot/1.0 (+${process.env.APP_URL || "http://localhost:3000"})`,
            Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.1",
            "Accept-Language": "en",
          },
        });

        if (REDIRECT_STATUSES.has(res.status)) {
          const location = res.headers.get("location");
          await res.body?.cancel();
          if (!location) throw new FetchError("The page redirected without saying where.", res.status);
          if (hop === maxRedirects) throw new FetchError("The page redirected too many times.");
          try {
            url = new URL(location, url).toString();
          } catch {
            throw new FetchError("The page redirected to an invalid address.", res.status);
          }
          continue;
        }

        if (res.status < 200 || res.status >= 300) {
          await res.body?.cancel();
          throw new FetchError(`The page returned status ${res.status}.`, res.status);
        }

        const contentType = res.headers.get("content-type") ?? "";
        const type = contentType.split(";")[0].trim().toLowerCase();
        if (type && !ALLOWED_TYPES.includes(type)) {
          await res.body?.cancel();
          throw new FetchError("This address is not a web page.", res.status);
        }

        const length = Number(res.headers.get("content-length"));
        if (Number.isFinite(length) && length > maxBytes) {
          await res.body?.cancel();
          throw new FetchError("The page is larger than 2 MB.", res.status);
        }

        const body = await readBody(res, maxBytes);
        return {
          status: res.status,
          finalUrl: url,
          html: decode(body, contentType),
          durationMs: Date.now() - started,
        };
      }

      throw new FetchError("The page redirected too many times.");
    } catch (err) {
      if (timedOut) throw new FetchError("The page took too long to respond.");
      if (err instanceof FetchError) throw err;
      throw new FetchError(describeError(err));
    } finally {
      clearTimeout(timer);
    }
  };
}

export const fetchPage = createFetcher();