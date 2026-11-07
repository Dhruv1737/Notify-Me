"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { STATUS, INTERVAL_LABEL, MODE_LABEL } from "@/lib/watchLabels";

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
            <div className="watch-title">
              <Link href={`/watches/${w.id}`}>{w.name || w.url}</Link>
            </div>
            <div className="watch-meta">
              {w.name && <>{w.url}<br /></>}
              <span className={`dot ${s.cls}`} />{s.label}
              {w.status === "PENDING" && " · Taking the first snapshot"}
              {" · "}{INTERVAL_LABEL[w.intervalMinutes] || `${w.intervalMinutes} minutes`}
              {" · "}{w.alertsEnabled ? `Email when ${MODE_LABEL[w.alertMode]}` : "Emails off"}
              {w.status === "ERROR" && w.lastError && <><br />{w.lastError}</>}
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