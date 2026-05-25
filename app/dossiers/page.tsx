"use client";

import { useMemo, useState } from "react";
import { DossierDrawer } from "@/components/DossierDrawer";
import { TextIntervention } from "@/components/TextIntervention";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SiteShell } from "@/components/layout/SiteShell";
import { getAtlasText } from "@/src/data/atlasTexts";
import type { NormalizedCampusSite } from "@/src/data/campusSites";
import { useCampusData } from "@/src/lib/useCampusData";
import { normalizeIdentity } from "@/lib/data";

export default function DossiersRoute() {
  const { campusSites, error, loading } = useCampusData();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const normalizedQuery = normalizeIdentity(query);
  const filteredSites = useMemo(
    () =>
      campusSites
        .filter((site) =>
          normalizeIdentity([site.name, site.city, site.state, site.statusCode, site.afterlifeCategory, site.buyer, site.owner].filter(Boolean).join(" ")).includes(
            normalizedQuery
          )
        )
        .slice(0, 500),
    [campusSites, normalizedQuery]
  );
  const selected = filteredSites.find((site) => site.id === selectedId) ?? filteredSites[0] ?? null;

  return (
    <SiteShell>
      <div id="dossiers" className="atlas-route-grid">
        <SectionHeader
          accession="02 / Dossiers"
          title="Individual campus files"
          description="Searchable institutional profiles with closure year, afterlife category, controller fields, source notes, related entities, confidence, and generated poetic captions."
          meta="The dossier format is the stable object model for future route-level pages or static campus slugs."
        />

        {error ? <div className="atlas-panel p-3 font-mono text-xs uppercase text-atlas-red">{error}</div> : null}
        {loading ? (
          <div className="atlas-panel p-3 font-mono text-xs uppercase">Loading dossier index.</div>
        ) : (
          <div className="dossier-layout">
            <aside className="atlas-panel-system">
              <div className="border-b border-atlas-ink p-3">
                <label className="block">
                  <span className="atlas-kicker">Dossier search</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="institution, state, buyer, status"
                    className="mt-2 w-full border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs outline-none"
                  />
                </label>
              </div>
              <div className="scrollbar-thin max-h-[700px] overflow-auto divide-y divide-atlas-ink">
                {filteredSites.map((site) => (
                  <DossierListButton key={site.id} site={site} active={site.id === selected?.id} onClick={() => setSelectedId(site.id)} />
                ))}
              </div>
            </aside>
            <DossierDrawer site={selected} />
          </div>
        )}

        <TextIntervention text={getAtlasText("field-recording-notes")} accession="DCA-FIELD-001" label="Dossier footer intervention" />
      </div>
    </SiteShell>
  );
}

function DossierListButton({ site, active, onClick }: { site: NormalizedCampusSite; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`block w-full p-3 text-left font-mono text-[11px] uppercase ${active ? "bg-atlas-ink text-atlas-paper" : "bg-atlas-paper"}`}>
      <div className="font-black">{site.name}</div>
      <div className="mt-1 opacity-70">{[site.city, site.state, site.closureYear ?? "year unknown"].filter(Boolean).join(" / ")}</div>
      <div className="mt-1 opacity-70">{site.statusCode} / {site.afterlifeCategory}</div>
    </button>
  );
}
