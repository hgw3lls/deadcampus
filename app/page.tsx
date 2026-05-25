"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MapPanel } from "@/components/MapPanel";
import { SiteDrawer } from "@/components/SiteDrawer";
import { TextIntervention } from "@/components/TextIntervention";
import { AtlasPanel } from "@/components/layout/AtlasPanel";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SiteShell } from "@/components/layout/SiteShell";
import { getAtlasText } from "@/src/data/atlasTexts";
import { useCampusData } from "@/src/lib/useCampusData";
import type { SiteRecord } from "@/lib/data";
import { formatNumber } from "@/lib/data";

export default function OverviewRoute() {
  const { atlas, error, loading } = useCampusData();
  const [selectedSite, setSelectedSite] = useState<SiteRecord | null>(null);
  const previewSites = useMemo(() => atlas?.sites.filter((site) => site.hasCoordinates).slice(0, 900) ?? [], [atlas]);

  return (
    <SiteShell>
      <div id="overview" className="atlas-route-grid">
        <SectionHeader
          accession="00 / Overview"
          title="Dead Campus Atlas / Terminal Education"
          description="A forensic-poetic atlas of educational withdrawal: campus closure, real-estate transfer, parcelization, cloud/security conversion, and the neoliberal replacement economy of educational land."
          meta="Entry route. Use the archive index to move into Explorer, Dossiers, Fieldwork, Replacement Economy, Texts, and Sources."
        />

        <TextIntervention text={getAtlasText("campus-did-not-disappear")} accession="DCA-TEXT-001" label="Manifesto insertion" />

        {error ? (
          <AtlasPanel className="p-3 font-mono text-xs uppercase text-atlas-red">Data load failure: {error}</AtlasPanel>
        ) : loading || !atlas ? (
          <AtlasPanel className="p-3 font-mono text-xs uppercase">Loading atlas data / public data registry</AtlasPanel>
        ) : (
          <>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
              <MapPanel sites={previewSites} selectedSiteId={selectedSite?.id ?? null} onSelectSite={setSelectedSite} generatedAt={atlas.summary.generatedAt} />
              <AtlasPanel className="p-3">
                <div className="atlas-kicker">Key stats / generated extract</div>
                <div className="mt-3 grid grid-cols-2 border border-atlas-ink font-mono text-[11px] uppercase">
                  <OverviewMetric label="Records" value={formatNumber(atlas.summary.totalRecords)} />
                  <OverviewMetric label="Mapped" value={formatNumber(atlas.summary.coordinateCount)} />
                  <OverviewMetric label="Missing coords" value={formatNumber(atlas.summary.missingCoordinateCount)} />
                  <OverviewMetric label="Afterlife gap" value={formatNumber(atlas.summary.unresolvedAfterlifeCount)} />
                </div>
                <div className="mt-3 border border-atlas-ink">
                  <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-kicker">Route entries</div>
                  <div className="grid font-mono text-[11px] uppercase">
                    <RouteLink href="/explorer" label="Atlas Explorer" />
                    <RouteLink href="/dossiers" label="Dossiers" />
                    <RouteLink href="/fieldwork" label="Fieldwork" />
                    <RouteLink href="/replacement-economy" label="Replacement Economy" />
                    <RouteLink href="/texts" label="Texts / Interventions" />
                    <RouteLink href="/about" label="About / Sources" />
                  </div>
                </div>
              </AtlasPanel>
            </div>

            <TextIntervention text={getAtlasText("abandoned-logistics-network")} accession="DCA-MAP-001" label="Map interruption" />
            <SiteDrawer site={selectedSite} edges={atlas.edges} onClose={() => setSelectedSite(null)} />
          </>
        )}
      </div>
    </SiteShell>
  );
}

function OverviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-atlas-ink p-2">
      <div className="text-atlas-muted">{label}</div>
      <div className="mt-1 text-xl font-black">{value}</div>
    </div>
  );
}

function RouteLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="border-b border-atlas-ink px-2 py-2 hover:bg-atlas-ink hover:text-atlas-paper">
      {label}
    </Link>
  );
}
