"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function WatchControls({ id, status, alertsEnabled }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const paused = status === "PAUSED";

  async function request(path, method, body) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong. Try again.");
        return null;
      }
      return data;
    } catch {
      setError("Could not reach the server. Try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function checkNow() {
    const data = await request(`/api/watches/${id}/check`, "POST");
    if (!data) return;
    setNotice("Check requested. The result will appear here in a few seconds.");
    // The worker ticks every 10 seconds, so look again a few times.
    timers.current.forEach(clearTimeout);
    timers.current = [6000, 13000, 22000].map((ms) =>
      setTimeout(() => router.refresh(), ms)
    );
  }

  async function togglePause() {
    const data = await request(`/api/watches/${id}`, "PATCH", {
      action: paused ? "resume" : "pause",
    });
    if (data) router.refresh();
  }

  async function toggleEmails() {
    const data = await request(`/api/watches/${id}`, "PATCH", {
      alertsEnabled: !alertsEnabled,
    });
    if (data) router.refresh();
  }

  async function remove() {
    if (!window.confirm("Delete this watch?")) return;
    const data = await request(`/api/watches/${id}`, "DELETE");
    if (data) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div>
      <div className="watch-actions">
        <button disabled={busy || paused} onClick={checkNow}>Check now</button>
        <button className="plain" disabled={busy} onClick={togglePause}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button className="plain" disabled={busy} onClick={toggleEmails}>
          {alertsEnabled ? "Turn emails off" : "Turn emails on"}
        </button>
        <button className="plain" disabled={busy} onClick={remove}>Delete</button>
      </div>
      {notice && <p className="notice" style={{ marginTop: 12 }}>{notice}</p>}
      {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}