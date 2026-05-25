"use client";

import { useEffect, useMemo, useState } from "react";
import { AtlasExplorer } from "@/components/AtlasExplorer";
import { DataLegend } from "@/components/DataLegend";
import { EvidenceWall } from "@/components/EvidenceWall";
import { MapPanel } from "@/components/MapPanel";
import { OwnershipNetwork } from "@/components/OwnershipNetwork";
import { ReplacementMatrix } from "@/components/ReplacementMatrix";
import { ResearchQueue } from "@/components/ResearchQueue";
import { SiteDrawer } from "@/components/SiteDrawer";
import { TextIntervention } from "@/components/TextIntervention";
import { TimelineChart } from "@/components/TimelineChart";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SiteShell } from "@/components/layout/SiteShell";
import { getAtlasText } from "@/src/data/atlasTexts";
import { useCampusData } from "@/src/lib/useCampusData";
import type { EvidenceGraphIndex, SiteRecord } from "@/lib/data";
import { loadEvidenceGraphIndex } from "@/lib/data";

export default function ExplorerRoute() {
  const { atlas, error, loading } = useCampusData();
  const [selectedSite, setSelectedSite] = useState<SiteRecord | null>(null);
  const [evidenceGraphIndex, setEvidenceGraphIndex] = useState<EvidenceGraphIndex | null>(null);
  const [evidenceGraphError, setEvidenceGraphError] = useState<string | null>(null);
  const mappedSites = useMemo(() => atlas?.sites.filter((site) => site.hasCoordinates) ?? [], [atlas]);

  useEffect(() => {
    if (evidenceGraphIndex || evidenceGraphError) return;
    loadEvidenceGraphIndex()
      .then(setEvidenceGraphIndex)
      .catch((loadError: Error) => setEvidenceGraphError(loadError.message));
  }, [evidenceGraphError, evidenceGraphIndex]);

  return (
    <SiteShell>
      <div id="explorer" className="atlas-route-grid">
        <SectionHeader
          accession="01 / Atlas Explorer"
          title="Primary data navigation"
          description="Tabbed map, timeline, replacement matrix, ownership network, state/status views, and table fallback for the workbook-derived campus records."
          meta="The explorer is wired to generated JSON in public/data and a normalized loader in src/lib."
        />

        {error ? <div className="atlas-panel p-3 font-mono text-xs uppercase text-atlas-red">{error}</div> : null}
        {loading || !atlas ? (
          <div className="atlas-panel p-3 font-mono text-xs uppercase">Loading explorer data.</div>
        ) : (
          <>
            <AtlasExplorer sites={atlas.sites} />
            <TextIntervention text={getAtlasText("closure-notice")} accession="DCA-CLOSURE-001" label="Between map and timeline" />
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
              <MapPanel sites={mappedSites} selectedSiteId={selectedSite?.id ?? null} onSelectSite={setSelectedSite} generatedAt={atlas.summary.generatedAt} />
              <DataLegend mode="status" />
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              <TimelineChart sites={atlas.sites} onYearRangeChange={() => undefined} />
              <ReplacementMatrix sites={atlas.sites} />
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              <OwnershipNetwork nodes={atlas.nodes} edges={atlas.edges} />
              <ResearchQueue queue={atlas.researchQueue} sites={atlas.sites} />
            </div>
            {evidenceGraphIndex ? (
              <EvidenceWall index={evidenceGraphIndex} sites={atlas.sites} />
            ) : (
              <div className="atlas-panel p-3 font-mono text-xs uppercase">
                {evidenceGraphError ? `Evidence wall unavailable: ${evidenceGraphError}` : "Loading evidence wall graph slices."}
              </div>
            )}
            <SiteDrawer site={selectedSite} edges={atlas.edges} onClose={() => setSelectedSite(null)} />
          </>
        )}
      </div>
    </SiteShell>
  );
}
