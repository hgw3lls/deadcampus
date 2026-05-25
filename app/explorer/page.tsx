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

type ExplorerWorkbenchMode = "navigator" | "map" | "chronology" | "network" | "evidence";

const explorerModes: Array<{ key: ExplorerWorkbenchMode; label: string }> = [
  { key: "navigator", label: "Navigator" },
  { key: "map", label: "Map Plate" },
  { key: "chronology", label: "Timeline / Matrix" },
  { key: "network", label: "Network / Queue" },
  { key: "evidence", label: "Evidence Wall" }
];

export default function ExplorerRoute() {
  const { atlas, error, loading } = useCampusData();
  const [selectedSite, setSelectedSite] = useState<SiteRecord | null>(null);
  const [mode, setMode] = useState<ExplorerWorkbenchMode>("navigator");
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
      <div id="explorer" className="atlas-route-grid atlas-route-grid--console">
        <SectionHeader
          accession="01 / Atlas Explorer"
          title="Primary data navigation"
          description="A fixed workbench for the workbook-derived campus records. Switch modes instead of scrolling through every visualization at once."
          meta="Window scroll is disabled; each mode owns its pane, ledger, or table overflow."
        />

        {error ? <div className="atlas-panel p-3 font-mono text-xs uppercase text-atlas-red">{error}</div> : null}
        {loading || !atlas ? (
          <div className="atlas-panel p-3 font-mono text-xs uppercase">Loading explorer data.</div>
        ) : (
          <div className="atlas-mode-frame">
            <div className="atlas-mode-tabs" role="tablist" aria-label="Explorer workspace modes">
              {explorerModes.map((item) => (
                <button key={item.key} type="button" role="tab" aria-selected={mode === item.key} data-active={mode === item.key} onClick={() => setMode(item.key)} className="atlas-mode-tab">
                  {item.label}
                </button>
              ))}
            </div>

            <div className="atlas-mode-body">
              {mode === "navigator" ? <AtlasExplorer sites={atlas.sites} /> : null}

              {mode === "map" ? (
                <div className="atlas-mode-split atlas-mode-split--map">
                  <MapPanel sites={mappedSites} selectedSiteId={selectedSite?.id ?? null} onSelectSite={setSelectedSite} generatedAt={atlas.summary.generatedAt} atlasPlate fill />
                  <div className="atlas-mode-scroll border-l border-atlas-ink">
                    <DataLegend mode="status" />
                    <TextIntervention text={getAtlasText("abandoned-logistics-network")} accession="DCA-MAP-001" label="Map interruption" />
                  </div>
                </div>
              ) : null}

              {mode === "chronology" ? (
                <div className="atlas-mode-scroll">
                  <div className="atlas-mode-split atlas-mode-split--dual">
                    <TimelineChart sites={atlas.sites} onYearRangeChange={() => undefined} />
                    <ReplacementMatrix sites={atlas.sites} />
                  </div>
                  <div className="mt-2">
                    <TextIntervention text={getAtlasText("closure-notice")} accession="DCA-CLOSURE-001" label="Chronology interruption" />
                  </div>
                </div>
              ) : null}

              {mode === "network" ? (
                <div className="atlas-mode-scroll">
                  <div className="atlas-mode-split atlas-mode-split--dual">
                    <OwnershipNetwork nodes={atlas.nodes} edges={atlas.edges} />
                    <ResearchQueue queue={atlas.researchQueue} sites={atlas.sites} />
                  </div>
                </div>
              ) : null}

              {mode === "evidence" ? (
                evidenceGraphIndex ? (
                  <EvidenceWall index={evidenceGraphIndex} sites={atlas.sites} />
                ) : (
                  <div className="atlas-mode-scroll">
                    <div className="atlas-panel p-3 font-mono text-xs uppercase">
                      {evidenceGraphError ? `Evidence wall unavailable: ${evidenceGraphError}` : "Loading evidence wall graph slices."}
                    </div>
                  </div>
                )
              ) : null}
            </div>
            <SiteDrawer site={selectedSite} edges={atlas.edges} onClose={() => setSelectedSite(null)} />
          </div>
        )}
      </div>
    </SiteShell>
  );
}
