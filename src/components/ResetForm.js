"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetForm({ token }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setDone(true);
      else setError(data.error || "Something went wrong.");
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <p>Your password has been changed.</p>
        <p><Link href="/login">Log in</Link></p>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit" disabled={busy}>Change password</button>
    </form>
  );
}