"use client";

import { useMemo, useState } from "react";
import type { SiteRecord } from "@/lib/data";
import { countBy, formatNumber, normalizeIdentity } from "@/lib/data";

type ReplacementMatrixProps = {
  sites: SiteRecord[];
};

const pathways = [
  {
    from: "liberal arts",
    to: "security",
    label: "liberal arts → security",
    test: /(liberal arts|college).*security|security.*(liberal arts|college)|coast guard|federal training/
  },
  {
    from: "research",
    to: "cloud infrastructure",
    label: "research → cloud infrastructure",
    test: /(research).*cloud|cloud.*research|data center|amazon data|data infrastructure/
  },
  {
    from: "student housing",
    to: "senior housing",
    label: "student housing → senior housing",
    test: /student housing.*senior|senior housing|assisted living|retirement/
  },
  {
    from: "theology",
    to: "logistics",
    label: "theology → logistics",
    test: /theolog|seminary|logistics|warehouse|distribution/
  },
  {
    from: "campus",
    to: "parcelized real estate",
    label: "campus → parcelized real estate",
    test: /parcel|real estate|auction|subdivid|land bank|speculative/
  }
];

export function ReplacementMatrix({ sites }: ReplacementMatrixProps) {
  const [morphology, setMorphology] = useState("ALL");
  const morphologies = useMemo(
    () =>
      Array.from(new Set(sites.map((site) => site.morphology ?? "Unclassified"))).sort((a, b) => a.localeCompare(b)),
    [sites]
  );
  const scopedSites = useMemo(
    () => (morphology === "ALL" ? sites : sites.filter((site) => (site.morphology ?? "Unclassified") === morphology)),
    [morphology, sites]
  );

  const rows = useMemo(
    () =>
      pathways.map((pathway) => {
        const count = scopedSites.filter((site) =>
          pathway.test.test(
            normalizeIdentity(
              [site.morphology, site.afterlifeStatus, site.reuseType, site.buyerController, site.transformation, site.notes]
                .filter(Boolean)
                .join(" ")
            )
          )
        ).length;
        return { ...pathway, count };
      }),
    [scopedSites]
  );

  const topTransformations = useMemo(
    () => countBy(scopedSites, (site) => site.transformation ?? site.afterlifeStatus ?? site.reuseType).slice(0, 8),
    [scopedSites]
  );

  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <section className="atlas-panel p-3">
      <div className="mb-3 flex items-start justify-between gap-4 border-b border-atlas-ink pb-3">
        <div>
          <div className="atlas-label text-atlas-muted">Replacement economy matrix</div>
          <h2 className="text-lg font-black uppercase">Educational land afterlives</h2>
        </div>
        <select
          value={morphology}
          onChange={(event) => setMorphology(event.target.value)}
          className="border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs"
        >
          <option value="ALL">ALL MORPHOLOGIES</option>
          {morphologies.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2">
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-[180px_1fr_74px] items-center border border-atlas-ink font-mono text-xs">
            <div className="border-r border-atlas-ink p-2 uppercase">{row.from}</div>
            <div className="relative h-10 border-r border-atlas-ink bg-atlas-soft">
              <div className="absolute inset-y-0 left-0 bg-atlas-ink" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
              <div className="absolute inset-0 flex items-center px-2 uppercase text-atlas-paper mix-blend-difference">{row.to}</div>
            </div>
            <div className="p-2 text-right font-black">{formatNumber(row.count)}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 border border-atlas-ink">
        <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-label">Observed top transformations</div>
        <div className="divide-y divide-atlas-ink">
          {topTransformations.map((entry) => (
            <div key={entry.key} className="flex items-center justify-between gap-3 px-2 py-1 font-mono text-[11px]">
              <span className="truncate uppercase">{entry.key}</span>
              <span className="font-black">{formatNumber(entry.count)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
