"use client";

import { useEffect, useState } from "react";
import type { AtlasTextBlock } from "@/src/data/atlasTexts";

type FragmentTickerProps = {
  captions: AtlasTextBlock[];
};

export function FragmentTicker({ captions }: FragmentTickerProps) {
  const visibleCaptions = captions.length ? captions : [];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (visibleCaptions.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % visibleCaptions.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [visibleCaptions.length]);

  const activeCaption = visibleCaptions[index % Math.max(1, visibleCaptions.length)];
  const advance = (direction: -1 | 1) => {
    if (!visibleCaptions.length) return;
    setIndex((current) => (current + direction + visibleCaptions.length) % visibleCaptions.length);
  };

  return (
    <section className="atlas-panel overflow-hidden" aria-label="Rotating atlas micro captions">
      <div className="grid border-b border-atlas-ink md:grid-cols-[190px_1fr_132px]">
        <div className="border-b border-atlas-ink bg-atlas-ink px-3 py-2 font-mono text-[10px] uppercase text-atlas-paper md:border-b-0 md:border-r">
          bulletin feed / closure notices
        </div>
        <div className="min-h-10 px-3 py-2 font-mono text-[11px] uppercase leading-5" aria-live="polite">
          {activeCaption?.body ?? "No micro-caption filed."}
        </div>
        <div className="grid grid-cols-2 border-t border-atlas-ink font-mono text-[10px] uppercase md:border-l md:border-t-0">
          <button
            type="button"
            onClick={() => advance(-1)}
            className="border-r border-atlas-ink px-2 py-2 text-left"
          >
            Prev
          </button>
          <button type="button" onClick={() => advance(1)} className="px-2 py-2 text-left">
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
