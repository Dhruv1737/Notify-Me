"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setNotice(data.message);
      else setError(data.error || "Something went wrong.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <h1>Forgot password</h1>
      <form onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {error && <p className="error">{error}</p>}
        {notice && <p className="notice">{notice}</p>}
        <button type="submit" disabled={busy}>Send reset link</button>
      </form>
      <p className="muted" style={{ marginTop: 24 }}>
        <Link href="/login">Back to log in</Link>
      </p>
    </main>
  );
}