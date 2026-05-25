"use client";

import { useState } from "react";
import { ResearchQueue } from "@/components/ResearchQueue";
import { TextIntervention } from "@/components/TextIntervention";
import { AtlasPanel } from "@/components/layout/AtlasPanel";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SiteShell } from "@/components/layout/SiteShell";
import { fieldworkChecklist } from "@/lib/atlasExplorer";
import { getAtlasText } from "@/src/data/atlasTexts";
import { useCampusData } from "@/src/lib/useCampusData";

const fieldworkSections = [
  "Campus signage",
  "Administrative residue",
  "Spatial evidence",
  "Promotional media",
  "Government traces",
  "Audio / atmospheric evidence"
];

export default function FieldworkRoute() {
  const { atlas, error, loading } = useCampusData();
  const [checked, setChecked] = useState<string[]>([]);

  return (
    <SiteShell>
      <div id="fieldwork" className="atlas-route-grid">
        <SectionHeader
          accession="03 / Fieldwork"
          title="Methodology and evidence intake"
          description="A future user-facing documentation system for signage, bureaucracy, spatial evidence, promotional media, government traces, and audio."
          meta="Current state: scaffolded method file plus unresolved research queue from generated workbook records."
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {fieldworkSections.map((section, index) => (
            <AtlasPanel key={section} className="min-h-[170px] p-3">
              <div className="atlas-kicker">Method file {String(index + 1).padStart(2, "0")}</div>
              <h2 className="mt-2 text-2xl font-black uppercase leading-none">{section}</h2>
              <p className="atlas-copy mt-3 text-atlas-muted">Evidence category awaiting structured submission schema, source fields, and verification workflow.</p>
            </AtlasPanel>
          ))}
        </div>

        <AtlasPanel className="p-3">
          <div className="atlas-kicker">Fieldwork checklist</div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {fieldworkChecklist.map((item) => (
              <label key={item} className="flex items-start gap-3 border border-atlas-ink p-3 font-mono text-[11px] uppercase">
                <input
                  type="checkbox"
                  checked={checked.includes(item)}
                  onChange={() => setChecked((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]))}
                  className="mt-0.5 h-4 w-4 accent-atlas-red"
                />
                <span>{item}</span>
              </label>
            ))}
          </div>
        </AtlasPanel>

        <TextIntervention text={getAtlasText("administrative-residue")} accession="DCA-METHOD-002" label="Method intervention" />

        <AtlasPanel className="p-3">
          <div className="atlas-kicker">Upload / submit placeholder</div>
          <div className="mt-2 border border-dashed border-atlas-ink p-6 font-mono text-xs uppercase text-atlas-muted">
            Submission workflow pending: campus name, location, media URL, source citation, field note, evidence type, contact consent, verification status.
          </div>
        </AtlasPanel>

        {error ? <div className="atlas-panel p-3 font-mono text-xs uppercase text-atlas-red">{error}</div> : null}
        {loading || !atlas ? <div className="atlas-panel p-3 font-mono text-xs uppercase">Loading research queue.</div> : <ResearchQueue queue={atlas.researchQueue} sites={atlas.sites} />}
      </div>
    </SiteShell>
  );
}
