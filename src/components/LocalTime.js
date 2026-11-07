"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Server and first render show a plain UTC time. After hydration, React
// switches to the viewer's own timezone with no extra effect or state.
export default function LocalTime({ iso }) {
  const local = useSyncExternalStore(
    subscribe,
    () => new Date(iso).toLocaleString(),
    () => null
  );

  return <time dateTime={iso}>{local ?? `${iso.slice(0, 16).replace("T", " ")} UTC`}</time>;
}