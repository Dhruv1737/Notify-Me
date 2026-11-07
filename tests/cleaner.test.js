import { describe, it, expect } from "vitest";
import { extractText, isLowContent, CleanError, MAX_TEXT_CHARS } from "../worker/cleaner.js";

const text = (html, selector) => extractText(html, selector).text;

describe("extractText: what is removed", () => {
  it("drops scripts, styles, noscript, templates and svg", () => {
    const html = `<body>
      <script>var secret = 1;</script>
      <style>p { color: red }</style>
      <noscript>Please enable JavaScript</noscript>
      <template><p>Template text</p></template>
      <svg><text>Vector text</text></svg>
      <p>Visible</p></body>`;
    expect(text(html)).toBe("Visible");
  });

  it("drops hidden elements", () => {
    const html = `<body>
      <p hidden>Hidden attribute</p>
      <p style="display:none">None</p>
      <p style="color:red; DISPLAY : NONE">Spaced none</p>
      <p style="visibility: hidden">Invisible</p>
      <input type="hidden" value="token123">
      <p>Shown</p></body>`;
    expect(text(html)).toBe("Shown");
  });

  it("uses the body only, never the head", () => {
    const html = "<html><head><title>Title</title></head><body><p>Body text</p></body></html>";
    expect(text(html)).toBe("Body text");
  });
});

describe("extractText: lines and spacing", () => {
  it("puts blocks on separate lines and keeps inline text together", () => {
    expect(text("<p>Hello <b>big</b> world</p><p>Second</p>")).toBe("Hello big world\nSecond");
  });

  it("turns br into a new line", () => {
    expect(text("<p>One<br>Two<br/>Three</p>")).toBe("One\nTwo\nThree");
  });

  it("collapses spaces, tabs and non-breaking spaces", () => {
    expect(text("<p>  A \t  B&nbsp;&nbsp;C  </p>")).toBe("A B C");
  });

  it("decodes entities", () => {
    expect(text("<p>Fish &amp; Chips &lt;3</p>")).toBe("Fish & Chips <3");
  });

  it("removes empty lines and invisible characters", () => {
    expect(text("<p></p><p>A\u200bB</p><div>   </div><p>C</p>")).toBe("AB\nC");
  });

  it("separates table cells with a space and rows with a line", () => {
    const html = "<table><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></table>";
    expect(text(html)).toBe("A B\nC D");
  });

  it("lists one item per line", () => {
    expect(text("<ul><li>One</li><li>Two</li></ul>")).toBe("One\nTwo");
  });

  it("gives the same text for different markup of the same content", () => {
    const a = "<div>  Hello   <span>world</span></div>";
    const b = "<div class='x'>Hello world</div><script>track()</script>";
    expect(text(a)).toBe(text(b));
  });

  it("joins adjacent inline elements without inventing a space", () => {
    expect(text("<p><span>Hello</span><span>World</span></p>")).toBe("HelloWorld");
  });

  it("copes with empty and broken html", () => {
    expect(text("")).toBe("");
    expect(text("<div><p>Unclosed <b>tags")).toBe("Unclosed tags");
  });
});

describe("extractText: selectors", () => {
  const page = `<body>
    <div id="notices"><p>Notice one</p><p>Notice two</p></div>
    <div id="footer"><p>Footer</p></div></body>`;

  it("keeps only the selected part", () => {
    expect(text(page, "#notices")).toBe("Notice one\nNotice two");
  });

  it("joins several matches in page order", () => {
    expect(text(page, "#notices p, #footer p")).toBe("Notice one\nNotice two\nFooter");
  });

  it("does not repeat text when matches are nested", () => {
    expect(text("<div><div>Inner</div></div>", "div")).toBe("Inner");
  });

  it("treats a selector that matches nothing as an error", () => {
    expect(() => extractText(page, "#missing")).toThrow(CleanError);
    expect(() => extractText(page, "#missing")).toThrow(/did not match/);
  });

  it("treats invalid selector syntax as an error", () => {
    expect(() => extractText(page, "div[")).toThrow(/not valid/);
  });

  it("ignores an empty selector", () => {
    expect(text(page, "  ")).toBe("Notice one\nNotice two\nFooter");
    expect(text(page, null)).toBe("Notice one\nNotice two\nFooter");
  });

  it("cannot select something that was removed as hidden", () => {
    const html = "<body><p class='x' hidden>Gone</p></body>";
    expect(() => extractText(html, ".x")).toThrow(/did not match/);
  });
});

describe("extractText: size and content checks", () => {
  it("cuts very long pages at a line boundary and says so", () => {
    const html = Array.from({ length: 4000 }, (_, i) => `<p>${"x".repeat(100)} ${i}</p>`).join("");
    const r = extractText(html);
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(MAX_TEXT_CHARS);
    expect(r.text.split("\n").every((l) => l.startsWith("xxxx"))).toBe(true);
  });

  it("does not flag short pages as truncated", () => {
    expect(extractText("<p>Short</p>").truncated).toBe(false);
  });

  it("detects pages with very little text", () => {
    expect(isLowContent("")).toBe(true);
    expect(isLowContent("Loading...")).toBe(true);
    expect(isLowContent("This page has plenty of readable words.")).toBe(false);
  });

  it("survives very deep nesting", () => {
    const html = "<div>".repeat(5000) + "Deep" + "</div>".repeat(5000);
    expect(text(html)).toContain("Deep");
  });
});