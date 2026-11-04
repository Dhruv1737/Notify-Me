"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const INTERVALS = [
  [5, "Every 5 minutes"],
  [15, "Every 15 minutes"],
  [60, "Every hour"],
  [360, "Every 6 hours"],
  [1440, "Every day"],
];

const MODES = [
  ["PAGE_CHANGES", "The page changes"],
  ["NEW_LINE_KEYWORDS", "A new line contains my keywords"],
  ["KEYWORDS_APPEAR", "My keywords appear on the page"],
  ["KEYWORDS_DISAPPEAR", "My keywords disappear from the page"],
];

export default function WatchForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [selector, setSelector] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [alertMode, setAlertMode] = useState("PAGE_CHANGES");
  const [keywordText, setKeywordText] = useState("");
  const [matchMode, setMatchMode] = useState("ANY");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const needsKeywords = alertMode !== "PAGE_CHANGES";

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);

    const keywords = needsKeywords
      ? keywordText.split(/[\n,]/).map((k) => k.trim()).filter(Boolean)
      : [];

    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          name,
          selector,
          intervalMinutes: Number(intervalMinutes),
          alertsEnabled,
          alertMode,
          keywords,
          matchMode,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
      } else {
        setUrl("");
        setName("");
        setSelector("");
        setKeywordText("");
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="row">
        <input
          type="text"
          inputMode="url"
          aria-label="Page address"
          placeholder="https://example.com/notices"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button type="submit" disabled={busy}>Add</button>
      </div>

      <details className="options">
        <summary>Options</summary>

        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" type="text" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="selector">Part of the page to watch (CSS selector)</label>
          <input id="selector" type="text" maxLength={200} placeholder="Leave empty to watch the whole page" value={selector} onChange={(e) => setSelector(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="interval">Check</label>
          <select id="interval" value={intervalMinutes} onChange={(e) => setIntervalMinutes(e.target.value)}>
            {INTERVALS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="check">
            <input type="checkbox" checked={alertsEnabled} onChange={(e) => setAlertsEnabled(e.target.checked)} />
            Send me emails
          </label>
        </div>

        <div className="field">
          <label htmlFor="mode">Email me when</label>
          <select id="mode" value={alertMode} onChange={(e) => setAlertMode(e.target.value)}>
            {MODES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {needsKeywords && (
          <>
            <div className="field">
              <label htmlFor="keywords">Keywords (up to 10, one per line or separated by commas)</label>
              <textarea id="keywords" value={keywordText} onChange={(e) => setKeywordText(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="match">Match</label>
              <select id="match" value={matchMode} onChange={(e) => setMatchMode(e.target.value)}>
                <option value="ANY">Any keyword</option>
                <option value="ALL">All keywords</option>
              </select>
            </div>
          </>
        )}
      </details>

      {error && <p className="error">{error}</p>}
    </form>
  );
}