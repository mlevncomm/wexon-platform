"use client";

import { useEffect, useMemo, useState } from "react";

const ROTATE_MS = 2800;
const FADE_MS = 260;

export default function WexonHeroRotatingWord({ words }: { words: readonly string[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const longestWord = useMemo(
    () => words.reduce((longest, word) => (word.length > longest.length ? word : longest), words[0] ?? ""),
    [words],
  );

  useEffect(() => {
    // Keep rotating on real phones even when iOS "Reduce Motion" is on —
    // that preference freezes CSS/JS marketing motion in desktop-vs-device checks.
    if (words.length <= 1) return;

    let fadeTimeout: ReturnType<typeof setTimeout> | undefined;

    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setVisible(false);
      fadeTimeout = setTimeout(() => {
        setIndex((current) => (current + 1) % words.length);
        setVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);

    return () => {
      clearInterval(interval);
      if (fadeTimeout) clearTimeout(fadeTimeout);
    };
  }, [words.length]);

  const activeWord = words[index] ?? words[0] ?? "";

  return (
    <span className="wx-hero-word-chip" aria-label={activeWord}>
      <span className="wx-hero-word-chip-surface">
        <span className="wx-hero-word-chip-ring" aria-hidden />
        <span aria-hidden className="wx-hero-word-chip-measure">
          {longestWord}
        </span>
        <span
          aria-live="polite"
          className={`wx-hero-word-chip-label ${visible ? "wx-hero-word-active" : "wx-hero-word-leaving"}`}
        >
          {activeWord}
        </span>
      </span>
    </span>
  );
}
