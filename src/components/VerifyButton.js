"use client";

import { useState } from "react";
import Link from "next/link";

export default function VerifyButton({ token }) {
  const [state, setState] = useState("idle");
  const [error, setError] = useState("");

  async function verify() {
    setState("busy");
    setError("");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setState("done");
      } else {
        setError(data.error || "Something went wrong.");
        setState("idle");
      }
    } catch {
      setError("Could not reach the server. Try again.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <>
        <p>Your email is verified.</p>
        <p><Link href="/dashboard">Go to dashboard</Link></p>
      </>
    );
  }

  return (
    <>
      <p>Press the button to verify your email.</p>
      {error && <p className="error">{error}</p>}
      <button onClick={verify} disabled={state === "busy"}>Verify email</button>
    </>
  );
}