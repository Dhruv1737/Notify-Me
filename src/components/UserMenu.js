"use client";

import { useEffect, useRef, useState } from "react";
import LogoutButton from "./LogoutButton";

export default function UserMenu({ email }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // While the menu is open: close it on a tap outside, or on Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const initial = (email?.[0] ?? "?").toUpperCase();

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="avatar"
        title={email}
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {initial}
      </button>

      {open && (
        <div className="menu">
          <p className="menu-email">{email}</p>
          <LogoutButton />
        </div>
      )}
    </div>
  );
}