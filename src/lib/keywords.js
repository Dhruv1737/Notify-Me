// Lowercase, and treat any run of whitespace (including line breaks) as one space.
function normalize(s) {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

// The keywords (as the user typed them) that appear in the text.
export function matchedKeywords(text, keywords) {
  const haystack = normalize(text);
  return keywords.filter((k) => {
    const needle = normalize(k);
    return needle.length > 0 && haystack.includes(needle);
  });
}

// ANY: at least one keyword is in the text. ALL: every keyword is.
// A phrase must appear whole, so "result declared" does not match "result".
export function containsKeywords(text, keywords, matchMode) {
  if (!keywords || keywords.length === 0) return false;
  const found = matchedKeywords(text, keywords);
  return matchMode === "ALL" ? found.length === keywords.length : found.length > 0;
}