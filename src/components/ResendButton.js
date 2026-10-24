"use client";

import { useState } from "react";

export default function ResendButton() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function resend() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/auth/resend", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setMessage(data.message);
      else setError(data.error || "Something went wrong.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}
      <button onClick={resend} disabled={busy}>Send the link again</button>
    </>
  );
}