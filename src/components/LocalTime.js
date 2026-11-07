"use client";

import { useEffect, useState } from "react";

export default function LocalTime({ iso }) {
  const [text, setText] = useState(null);

  useEffect(() => {
    setText(new Date(iso).toLocaleString());
  }, [iso]);

  return <time dateTime={iso}>{text ?? `${iso.slice(0, 16).replace("T", " ")} UTC`}</time>;
}