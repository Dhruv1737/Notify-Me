import { matchedKeywords, matchingLines } from "../src/lib/keywords.js";
import { keywordStateFor } from "./checkLogic.js";

export const MAX_MATCHED_LINES = 5;
const MAX_LINE_CHARS = 1000;

const clip = (line) =>
  line.length > MAX_LINE_CHARS ? `${line.slice(0, MAX_LINE_CHARS)}…` : line;

// Decides what one detected change means for this watch's alert settings.
//   previousState: whether the keywords were on the page at the last successful check
//   addedLines:    every line added by this change, uncut
// Returns the new keyword state, whether an email is due, and what matched.
export function decideAlert({
  alertMode,
  alertsEnabled,
  keywords,
  matchMode,
  previousState,
  oldText,
  newText,
  addedLines,
}) {
  const keywordState = keywordStateFor(alertMode, keywords, matchMode, newText);

  let conditionMet = false;
  let found = [];
  let lines = [];

  switch (alertMode) {
    case "PAGE_CHANGES":
      conditionMet = true;
      break;

    case "NEW_LINE_KEYWORDS": {
      const hits = matchingLines(addedLines, keywords, matchMode);
      conditionMet = hits.length > 0;
      if (conditionMet) {
        lines = hits;
        found = matchedKeywords(hits.join("\n"), keywords);
      }
      break;
    }

    case "KEYWORDS_APPEAR":
      conditionMet = previousState === false && keywordState === true;
      if (conditionMet) {
        found = matchedKeywords(newText, keywords);
        lines = matchingLines(newText.split("\n"), keywords, "ANY");
      }
      break;

    case "KEYWORDS_DISAPPEAR":
      conditionMet = previousState === true && keywordState === false;
      if (conditionMet) {
        // The keywords that were there before and are gone now.
        const stillThere = new Set(matchedKeywords(newText, keywords));
        found = matchedKeywords(oldText, keywords).filter((k) => !stillThere.has(k));
      }
      break;
  }

  return {
    keywordState,
    alertable: alertsEnabled && conditionMet,
    matchedKeywords: found,
    matchedLines: lines.slice(0, MAX_MATCHED_LINES).map(clip),
  };
}