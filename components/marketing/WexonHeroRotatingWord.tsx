"use client";

import { useEffect, useMemo, useState } from "react";

const ROTATE_MS = 2600;
const FADE_MS = 220;

export default function WexonHeroRotatingWord({ words }: { words: readonly string[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const longestWord = useMemo(
    () => words.reduce((longest, word) => (word.length > longest.length ? word : longest), words[0] ?? ""),
    [words],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncReducedMotion = () => setReducedMotion(media.matches);
    syncReducedMotion();
    media.addEventListener("change", syncReducedMotion);
    return () => media.removeEventListener("change", syncReducedMotion);
  }, []);

  useEffect(() => {
    if (words.length <= 1 || reducedMotion) return;

    let fadeTimeout: ReturnType<typeof setTimeout> | undefined;

    const interval = setInterval(() => {
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
  }, [words.length, reducedMotion]);

  const activeWord = reducedMotion ? words[0] : words[index];

  return (
    <span className="wx-hero-word-slot text-emerald-300">
      <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
        {longestWord}
      </span>
      <span
        aria-live={reducedMotion ? "off" : "polite"}
        className={`col-start-1 row-start-1 whitespace-nowrap ${reducedMotion || visible ? "wx-hero-word-active" : "wx-hero-word-leaving"}`}
      >
        {activeWord}
      </span>
    </span>
  );
}
