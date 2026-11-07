import * as cheerio from "cheerio";

export const MIN_TEXT_CHARS = 20;
export const MAX_TEXT_CHARS = 200_000;

// An error whose message is safe to show to the user.
export class CleanError extends Error {
  constructor(message) {
    super(message);
    this.name = "CleanError";
  }
}

// Elements that start and end a line of text.
const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "caption", "dd", "details",
  "dialog", "div", "dl", "dt", "fieldset", "figcaption", "figure", "footer",
  "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hgroup", "hr", "li",
  "main", "nav", "ol", "p", "pre", "section", "summary", "table", "tbody",
  "tfoot", "thead", "tr", "ul", "option",
]);

// Things a reader never sees as text.
const NEVER_VISIBLE =
  "script, style, noscript, template, svg, canvas, iframe, object, embed, [hidden], input[type=hidden]";

const HIDDEN_STYLE = /display\s*:\s*none|visibility\s*:\s*hidden/i;
const INVISIBLE_CHARS = /[\u200b-\u200d\u2060\ufeff]/g;

export function isLowContent(text) {
  return text.length < MIN_TEXT_CHARS;
}

// Keep only the outermost matches, so a selector like "div" does not
// print a nested div's text twice.
function outermost(elements) {
  const set = new Set(elements);
  return elements.filter((el) => {
    for (let p = el.parent; p; p = p.parent) {
      if (set.has(p)) return false;
    }
    return true;
  });
}

// Iterative on purpose: a deeply nested page must not overflow the stack.
function collectText(roots) {
  const out = [];
  const stack = [];

  for (let i = roots.length - 1; i >= 0; i--) {
    stack.push(roots[i]);
    if (i > 0) stack.push("\n");
  }

  while (stack.length > 0) {
    const item = stack.pop();

    if (typeof item === "string") {
      out.push(item);
      continue;
    }
    if (item.type === "text") {
      out.push(item.data);
      continue;
    }
    if (item.type !== "tag") continue;

    if (item.name === "br") {
      out.push("\n");
      continue;
    }

    const block = BLOCK_TAGS.has(item.name);
    if (block) out.push("\n");

    // Pushed first, so it is processed after the children.
    if (block) stack.push("\n");
    else if (item.name === "td" || item.name === "th") stack.push(" ");

    const kids = item.children ?? [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
  }

  return out.join("");
}

function normalize(raw) {
  return raw
    .replace(INVISIBLE_CHARS, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// Returns { text, truncated }. Throws CleanError for a selector that
// cannot be used.
export function extractText(html, selector = null) {
  const $ = cheerio.load(html);

  $(NEVER_VISIBLE).remove();
  $("[style]").each((_, el) => {
    if (HIDDEN_STYLE.test($(el).attr("style") ?? "")) $(el).remove();
  });

  let roots;
  if (selector && selector.trim()) {
    let matches;
    try {
      matches = $(selector.trim()).toArray();
    } catch {
      throw new CleanError("The selector is not valid.");
    }
    if (matches.length === 0) {
      throw new CleanError("The selector did not match anything on the page.");
    }
    roots = outermost(matches);
  } else {
    const body = $("body").toArray();
    roots = body.length > 0 ? body : $.root().toArray();
  }

  const lines = normalize(collectText(roots));

  let truncated = false;
  let total = 0;
  const kept = [];
  for (const line of lines) {
    total += line.length + 1;
    if (total > MAX_TEXT_CHARS) {
      truncated = true;
      break;
    }
    kept.push(line);
  }

  return { text: kept.join("\n"), truncated };
}