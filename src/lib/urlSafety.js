import dns from "node:dns/promises";
import net from "node:net";
import ipaddr from "ipaddr.js";

const MAX_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = ["http:", "https:"];
const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".lan", ".home", ".corp"];

// Only ordinary public addresses pass. Loopback, private, link-local
// (including cloud metadata 169.254.x.x), carrier-grade NAT, multicast,
// reserved and unspecified ranges are all rejected.
export function isPublicIp(ip) {
  try {
    let addr = ipaddr.parse(ip);
    if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
      addr = addr.toIPv4Address();
    }
    return addr.range() === "unicast";
  } catch {
    return false;
  }
}

function fail(reason) {
  return { ok: false, reason };
}

// Checks a URL typed by a user. Used when creating a watch, and again
// in the worker before every fetch and every redirect.
export async function checkUrl(input) {
  if (typeof input !== "string" || input.length === 0 || input.length > MAX_URL_LENGTH) {
    return fail("Enter a valid web address.");
  }

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return fail("Enter a valid web address.");
  }

  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    return fail("Only http and https addresses are allowed.");
  }
  if (url.username || url.password) {
    return fail("Addresses with a username or password are not allowed.");
  }
  // url.port is empty for the default port of the protocol.
  if (url.port !== "" && url.port !== "80" && url.port !== "443") {
    return fail("Only ports 80 and 443 are allowed.");
  }

  // IPv6 hostnames come wrapped in brackets.
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();

  if (net.isIP(host)) {
    if (!isPublicIp(host)) return fail("This address points to a private network.");
  } else {
    if (!host.includes(".") || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
      return fail("This address points to a private network.");
    }
    let results;
    try {
      results = await dns.lookup(host, { all: true });
    } catch {
      return fail("This address could not be found.");
    }
    if (results.length === 0 || !results.every((r) => isPublicIp(r.address))) {
      return fail("This address points to a private network.");
    }
  }

  url.hash = "";
  return { ok: true, url: url.toString() };
}