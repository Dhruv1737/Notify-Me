const MAX_LABEL_CHARS = 80;
const MAX_LINE_CHARS = 300;
const MAX_DIFF_LINES = 10;
const MAX_KEYWORD_LINES = 5;

// Page names and addresses come from users and pages. Remove line breaks
// so nothing can smuggle extra lines into a subject or a field.
function clean(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function shorten(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function labelFor(watch) {
  return shorten(clean(watch.name || watch.url), MAX_LABEL_CHARS);
}

function formatTime(date) {
  return `${new Date(date).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function watchLink(appUrl, id) {
  return `${appUrl.replace(/\/+$/, "")}/watches/${id}`;
}

function unique(items, key = (x) => x) {
  const seen = new Set();
  return items.filter((item) => {
    const k = key(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// A titled list of lines, capped, with a "... and N more" note.
function section(title, lines, prefix, max) {
  if (lines.length === 0) return [];
  const out = [`${title} (${lines.length})`];
  for (const line of lines.slice(0, max)) {
    out.push(`${prefix} ${shorten(clean(line), MAX_LINE_CHARS)}`);
  }
  if (lines.length > max) out.push(`... and ${lines.length - max} more`);
  out.push("");
  return out;
}

const SUBJECT = {
  PAGE_CHANGES: "Page changed",
  NEW_LINE_KEYWORDS: "Keywords in a new line",
  KEYWORDS_APPEAR: "Keywords appeared",
  KEYWORDS_DISAPPEAR: "Keywords disappeared",
};

function intro(mode, count) {
  switch (mode) {
    case "NEW_LINE_KEYWORDS":
      return "A new line on this page contains your keywords.";
    case "KEYWORDS_APPEAR":
      return "Your keywords are now on this page.";
    case "KEYWORDS_DISAPPEAR":
      return "Your keywords are no longer on this page.";
    default:
      return count > 1 ? `This page changed ${count} times since the last email.` : "This page changed.";
  }
}

const FOOTER =
  "You get this email because alerts are on for this page. You can turn them off on that page.";

// changes: the alertable changes not yet emailed, oldest first.
export function changeEmail({ watch, changes, appUrl }) {
  const label = labelFor(watch);
  const mode = watch.alertMode;
  const count = changes.length;
  const newest = changes[count - 1];

  const text = [
    intro(mode, count),
    "",
    `Page: ${label}`,
    `Address: ${clean(watch.url)}`,
    `Detected: ${formatTime(newest.createdAt)}`,
  ];
  if (count > 1) text.push(`Changes: ${count} since the last email`);
  text.push("");

  if (mode === "PAGE_CHANGES") {
    text.push(...section("Added", changes.flatMap((c) => c.added), "+", MAX_DIFF_LINES));
    text.push(...section("Removed", changes.flatMap((c) => c.removed), "-", MAX_DIFF_LINES));
    if (changes.some((c) => c.truncated)) {
      text.push("This change was large, so only the first 200 lines of it are kept.", "");
    }
  } else {
    const keywords = unique(
      changes.flatMap((c) => c.matchedKeywords),
      (k) => k.toLowerCase()
    );
    if (keywords.length > 0) {
      text.push(`Matched keywords: ${keywords.map(clean).join(", ")}`, "");
    }
    text.push(
      ...section("Matching lines", unique(changes.flatMap((c) => c.matchedLines)), ">", MAX_KEYWORD_LINES)
    );
  }

  text.push("See the full history:", watchLink(appUrl, watch.id), "", FOOTER);

  return { subject: `${SUBJECT[mode]}: ${labelFor(watch)}`, text: text.join("\n") };
}

export function failureEmail({ watch, error, failures = 3, appUrl }) {
  const label = labelFor(watch);
  return {
    subject: `Cannot check: ${label}`,
    text: [
      `We could not check this page ${failures} times in a row.`,
      "",
      `Page: ${label}`,
      `Address: ${clean(watch.url)}`,
      `Last error: ${clean(error)}`,
      "",
      "We keep checking at the normal interval. You will get one more email when it works again.",
      "",
      watchLink(appUrl, watch.id),
    ].join("\n"),
  };
}

export function recoveryEmail({ watch, appUrl }) {
  const label = labelFor(watch);
  return {
    subject: `Working again: ${label}`,
    text: [
      "This page loaded successfully again.",
      "",
      `Page: ${label}`,
      `Address: ${clean(watch.url)}`,
      "",
      watchLink(appUrl, watch.id),
    ].join("\n"),
  };
}