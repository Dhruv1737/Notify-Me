"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS = {
  PENDING: { label: "Pending", cls: "pending" },
  ACTIVE: { label: "Active", cls: "active" },
  ERROR: { label: "Error", cls: "error" },
  PAUSED: { label: "Paused", cls: "" },
};

const INTERVAL_LABEL = {
  5: "every 5 minutes",
  15: "every 15 minutes",
  60: "every hour",
  360: "every 6 hours",
  1440: "every day",
};

const MODE_LABEL = {
  PAGE_CHANGES: "page changes",
  NEW_LINE_KEYWORDS: "new line has keywords",
  KEYWORDS_APPEAR: "keywords appear",
  KEYWORDS_DISAPPEAR: "keywords disappear",
};

export default function WatchList({ watches }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function send(id, method, body) {
    setError("");
    setBusyId(id);
    try {
      const res = await fetch(`/api/watches/${id}`, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong. Try again.");
      } else {
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  function remove(w) {
    if (window.confirm("Delete this watch?")) send(w.id, "DELETE");
  }

  if (watches.length === 0) {
    return <p className="muted">You have no watches yet.</p>;
  }

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {watches.map((w) => {
        const s = STATUS[w.status] || STATUS.PENDING;
        const paused = w.status === "PAUSED";
        const busy = busyId === w.id;
        return (
          <div className="watch" key={w.id}>
            <div className="watch-title">{w.name || w.url}</div>
            <div className="watch-meta">
              {w.name && <>{w.url}<br /></>}
              <span className={`dot ${s.cls}`} />{s.label}
              {w.status === "PENDING" && " · Taking the first snapshot"}
              {" · "}{INTERVAL_LABEL[w.intervalMinutes] || `${w.intervalMinutes} minutes`}
              {" · "}{w.alertsEnabled ? `Email when ${MODE_LABEL[w.alertMode]}` : "Emails off"}
            </div>
            <div className="watch-actions">
              <button
                className="plain"
                disabled={busy}
                onClick={() => send(w.id, "PATCH", { action: paused ? "resume" : "pause" })}
              >
                {paused ? "Resume" : "Pause"}
              </button>
              <button
                className="plain"
                disabled={busy}
                onClick={() => send(w.id, "PATCH", { alertsEnabled: !w.alertsEnabled })}
              >
                {w.alertsEnabled ? "Turn emails off" : "Turn emails on"}
              </button>
              <button className="plain" disabled={busy} onClick={() => remove(w)}>
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}