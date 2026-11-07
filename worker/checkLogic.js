import crypto from "node:crypto";
import { containsKeywords } from "../src/lib/keywords.js";

export const MAX_FAILURES = 3;

export const LOW_CONTENT_WARNING =
  "Very little text was found on this page. It may need JavaScript, which this checker cannot run.";

export function sha256(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

// Only the "appear" and "disappear" alert types remember whether the keywords
// are on the page right now. Every other type stores nothing.
export function keywordStateFor(alertMode, keywords, matchMode, text) {
  if (alertMode !== "KEYWORDS_APPEAR" && alertMode !== "KEYWORDS_DISAPPEAR") return null;
  return containsKeywords(text, keywords, matchMode);
}

// What a failed check does to the watch. Three failures in a row mean Error.
export function afterFailure(watch) {
  const failureCount = watch.failureCount + 1;
  const status = failureCount >= MAX_FAILURES ? "ERROR" : watch.status;
  return { failureCount, status };
}