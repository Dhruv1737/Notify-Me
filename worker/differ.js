import { diffArrays } from "diff";

export const MAX_DIFF_LINES = 200;
export const MAX_STORED_LINE_CHARS = 1000;
const DIFF_TIMEOUT_MS = 3000;

const toLines = (text) => (text ? text.split("\n") : []);

const clip = (line) =>
  line.length > MAX_STORED_LINE_CHARS ? `${line.slice(0, MAX_STORED_LINE_CHARS)}…` : line;

// Compares two cleaned texts line by line.
// added / removed: capped and clipped, ready to store.
// addedAll: every added line, uncut, for keyword matching.
export function diffText(oldText, newText) {
  const oldLines = toLines(oldText);
  const newLines = toLines(newText);

  const parts = diffArrays(oldLines, newLines, { timeout: DIFF_TIMEOUT_MS });

  let addedAll = [];
  let removedAll = [];
  let gaveUp = false;

  if (!parts) {
    // Two huge, completely different pages: treat it as "everything changed".
    addedAll = newLines;
    removedAll = oldLines;
    gaveUp = true;
  } else {
    for (const part of parts) {
      if (part.added) {
        for (const line of part.value) addedAll.push(line);
      } else if (part.removed) {
        for (const line of part.value) removedAll.push(line);
      }
    }
  }

  const truncated =
    gaveUp || addedAll.length > MAX_DIFF_LINES || removedAll.length > MAX_DIFF_LINES;

  return {
    added: addedAll.slice(0, MAX_DIFF_LINES).map(clip),
    removed: removedAll.slice(0, MAX_DIFF_LINES).map(clip),
    truncated,
    totalAdded: addedAll.length,
    totalRemoved: removedAll.length,
    addedAll,
  };
}