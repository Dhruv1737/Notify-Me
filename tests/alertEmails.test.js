import { describe, it, expect } from "vitest";
import { changeEmail, failureEmail, recoveryEmail, labelFor } from "../worker/alertEmails.js";

const appUrl = "http://localhost:3000/";
const watch = {
  id: "w1",
  name: "College notices",
  url: "https://example.edu/notices",
  alertMode: "PAGE_CHANGES",
};
const change = (o = {}) => ({
  added: [],
  removed: [],
  matchedKeywords: [],
  matchedLines: [],
  truncated: false,
  createdAt: new Date("2026-11-07T12:34:56Z"),
  ...o,
});
const linesStarting = (text, prefix) => text.split("\n").filter((l) => l.startsWith(prefix));

describe("changeEmail: page changes", () => {
  it("shows added and removed lines, the page, the time and a link", () => {
    const e = changeEmail({
      watch,
      appUrl,
      changes: [change({ added: ["New notice"], removed: ["Old notice"] })],
    });
    expect(e.subject).toBe("Page changed: College notices");
    expect(e.text).toContain("Page: College notices");
    expect(e.text).toContain("Address: https://example.edu/notices");
    expect(e.text).toContain("Detected: 2026-11-07 12:34 UTC");
    expect(e.text).toContain("Added (1)\n+ New notice");
    expect(e.text).toContain("Removed (1)\n- Old notice");
    expect(e.text).toContain("\nhttp://localhost:3000/watches/w1\n");
  });

  it("caps long lists and says how many are left", () => {
    const added = Array.from({ length: 15 }, (_, i) => `line ${i}`);
    const e = changeEmail({ watch, appUrl, changes: [change({ added })] });
    expect(e.text).toContain("Added (15)");
    expect(linesStarting(e.text, "+ ")).toHaveLength(10);
    expect(e.text).toContain("... and 5 more");
  });

  it("clips very long lines", () => {
    const e = changeEmail({ watch, appUrl, changes: [change({ added: ["x".repeat(1000)] })] });
    expect(e.text).toContain(`${"x".repeat(300)}…`);
    expect(e.text).not.toContain("x".repeat(301));
  });

  it("joins several changes into one email", () => {
    const e = changeEmail({
      watch,
      appUrl,
      changes: [
        change({ added: ["First"] }),
        change({ added: ["Second"], createdAt: new Date("2026-11-07T12:40:00Z") }),
      ],
    });
    expect(e.text).toContain("This page changed 2 times since the last email.");
    expect(e.text).toContain("Changes: 2 since the last email");
    expect(e.text).toContain("Detected: 2026-11-07 12:40 UTC");
    expect(e.text).toContain("+ First");
    expect(e.text).toContain("+ Second");
  });

  it("mentions large changes that were cut short", () => {
    const e = changeEmail({ watch, appUrl, changes: [change({ added: ["a"], truncated: true })] });
    expect(e.text).toContain("only the first 200 lines");
  });
});

describe("changeEmail: keyword modes", () => {
  const kw = (alertMode) => ({ ...watch, alertMode });

  it("new line: names the keywords and shows the matching lines, not the whole diff", () => {
    const e = changeEmail({
      watch: kw("NEW_LINE_KEYWORDS"),
      appUrl,
      changes: [
        change({
          added: ["Result declared", "Holiday notice"],
          matchedKeywords: ["result"],
          matchedLines: ["Result declared"],
        }),
      ],
    });
    expect(e.subject).toBe("Keywords in a new line: College notices");
    expect(e.text).toContain("A new line on this page contains your keywords.");
    expect(e.text).toContain("Matched keywords: result");
    expect(e.text).toContain("Matching lines (1)\n> Result declared");
    expect(e.text).not.toContain("Holiday notice");
    expect(e.text).not.toContain("Added (");
  });

  it("appear and disappear have their own headlines", () => {
    const a = changeEmail({
      watch: kw("KEYWORDS_APPEAR"),
      appUrl,
      changes: [change({ matchedKeywords: ["in stock"], matchedLines: ["In stock now"] })],
    });
    expect(a.subject).toBe("Keywords appeared: College notices");
    expect(a.text).toContain("Your keywords are now on this page.");

    const d = changeEmail({
      watch: kw("KEYWORDS_DISAPPEAR"),
      appUrl,
      changes: [change({ matchedKeywords: ["sold out"] })],
    });
    expect(d.subject).toBe("Keywords disappeared: College notices");
    expect(d.text).toContain("Your keywords are no longer on this page.");
    expect(d.text).toContain("Matched keywords: sold out");
    expect(d.text).not.toContain("Matching lines");
  });

  it("shows at most 5 matching lines", () => {
    const lines = Array.from({ length: 8 }, (_, i) => `match ${i}`);
    const e = changeEmail({
      watch: kw("KEYWORDS_APPEAR"),
      appUrl,
      changes: [change({ matchedKeywords: ["match"], matchedLines: lines })],
    });
    expect(linesStarting(e.text, "> ")).toHaveLength(5);
    expect(e.text).toContain("... and 3 more");
  });

  it("lists each keyword once, ignoring case", () => {
    const e = changeEmail({
      watch: kw("NEW_LINE_KEYWORDS"),
      appUrl,
      changes: [
        change({ matchedKeywords: ["Result"], matchedLines: ["a"] }),
        change({ matchedKeywords: ["result", "admit card"], matchedLines: ["b"] }),
      ],
    });
    expect(e.text).toContain("Matched keywords: Result, admit card");
  });
});

describe("labels and safety", () => {
  it("uses the address when there is no name", () => {
    expect(labelFor({ name: null, url: "https://example.edu/x" })).toBe("https://example.edu/x");
  });

  it("removes line breaks so a name cannot add lines to the subject", () => {
    const e = changeEmail({
      watch: { ...watch, name: "Notices\r\nBcc: someone@example.com" },
      appUrl,
      changes: [change({ added: ["x"] })],
    });
    expect(e.subject).not.toMatch(/[\r\n]/);
    expect(e.subject).toBe("Page changed: Notices Bcc: someone@example.com");
  });

  it("shortens very long names", () => {
    const label = labelFor({ name: "n".repeat(200), url: "https://example.edu" });
    expect(label).toHaveLength(81);
    expect(label.endsWith("…")).toBe(true);
  });

  it("never produces html", () => {
    const e = changeEmail({ watch, appUrl, changes: [change({ added: ["<b>bold</b>"] })] });
    expect(e.text).not.toMatch(/<html|<a /i);
    expect(e.text).toContain("<b>bold</b>"); // shown as plain text, not interpreted
  });
});

describe("failure and recovery emails", () => {
  it("tells the user what failed and what happens next", () => {
    const e = failureEmail({ watch, appUrl, error: "The page took too long to respond." });
    expect(e.subject).toBe("Cannot check: College notices");
    expect(e.text).toContain("3 times in a row");
    expect(e.text).toContain("Last error: The page took too long to respond.");
    expect(e.text).toContain("one more email when it works again");
    expect(e.text).toContain("http://localhost:3000/watches/w1");
  });

  it("says when the page works again", () => {
    const e = recoveryEmail({ watch, appUrl });
    expect(e.subject).toBe("Working again: College notices");
    expect(e.text).toContain("loaded successfully again");
    expect(e.text).toContain("http://localhost:3000/watches/w1");
  });
});