"use client";

import { DataLegend } from "@/components/DataLegend";
import { ReplacementMatrix } from "@/components/ReplacementMatrix";
import { TextIntervention } from "@/components/TextIntervention";
import { AtlasPanel } from "@/components/layout/AtlasPanel";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SiteShell } from "@/components/layout/SiteShell";
import { getAtlasText } from "@/src/data/atlasTexts";
import { replacementCategories } from "@/src/data/replacementCategories";
import { useCampusData } from "@/src/lib/useCampusData";

export default function ReplacementEconomyRoute() {
  const { atlas, error, loading } = useCampusData();

  return (
    <SiteShell>
      <div id="replacement-economy" className="atlas-route-grid">
        <SectionHeader
          accession="04 / Replacement Economy"
          title="What campuses become"
          description="Interpretive analysis of educational land afterlives: cloud, security, housing, healthcare, logistics, civic counter-use, and ruin."
          meta="This route keeps matrix analysis beside the poetic theory layer."
        />

        <TextIntervention text={getAtlasText("afterlife-of-educational-land")} accession="DCA-REUSE-001" label="Replacement economy thesis" />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {replacementCategories.map((category) => (
            <AtlasPanel key={category.id} className="min-h-[168px] p-3">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 border border-atlas-ink" style={{ background: category.color }} />
                <div className="atlas-kicker">{category.id}</div>
              </div>
              <h2 className="mt-2 text-xl font-black uppercase leading-none">{category.label}</h2>
              <p className="atlas-copy mt-3 text-atlas-muted">{category.description}</p>
            </AtlasPanel>
          ))}
        </div>

        {error ? <div className="atlas-panel p-3 font-mono text-xs uppercase text-atlas-red">{error}</div> : null}
        {loading || !atlas ? <div className="atlas-panel p-3 font-mono text-xs uppercase">Loading replacement matrix.</div> : <ReplacementMatrix sites={atlas.sites} />}

        <TextIntervention text={getAtlasText("parcel-theory")} accession="DCA-PARCEL-001" label="Parcel theory" />
        <TextIntervention text={getAtlasText("campus-weather-system")} accession="DCA-CLOUD-001" label="Cloud / security climate note" />
        <DataLegend mode="replacement" />
      </div>
    </SiteShell>
  );
}
