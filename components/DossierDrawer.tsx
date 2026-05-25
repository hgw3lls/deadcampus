"use client";

import { deterministicMicroCaption } from "@/src/data/atlasTexts";
import type { NormalizedCampusSite } from "@/src/data/campusSites";
import { atlasStatusCodes } from "@/src/data/statusCodes";

type DossierDrawerProps = {
  site: NormalizedCampusSite | null;
};

export function DossierDrawer({ site }: DossierDrawerProps) {
  if (!site) {
    return <aside className="atlas-panel-system p-3 font-mono text-xs uppercase">Select a campus record to open a dossier.</aside>;
  }

  const status = atlasStatusCodes.find((candidate) => candidate.code === site.statusCode);
  const caption = deterministicMicroCaption(`${site.id}-${site.name}`);

  return (
    <aside className="atlas-panel-system">
      <div className="border-b border-atlas-ink bg-atlas-ink px-3 py-2 font-mono text-[10px] uppercase text-atlas-paper">
        dossier / {site.accession}
      </div>
      <div className="p-3">
        <div className="atlas-kicker">{[site.city, site.state, site.region].filter(Boolean).join(" / ")}</div>
        <h2 className="mt-2 text-3xl font-black uppercase leading-none">{site.name}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="atlas-status-stamp" style={{ color: status?.color }}>
            {site.statusCode}
          </span>
          <span className="atlas-status-stamp">{site.afterlifeCategory}</span>
        </div>

        <div className="mt-4 grid border border-atlas-ink font-mono text-[11px] uppercase md:grid-cols-2">
          <DossierCell label="Institution type" value={site.institutionType ?? "Unknown"} />
          <DossierCell label="Sector" value={site.sector ?? "Unknown"} />
          <DossierCell label="Closure year" value={site.closureYear ? String(site.closureYear) : "Unknown"} />
          <DossierCell label="Decade" value={site.decade} />
          <DossierCell label="Afterlife / reuse" value={site.afterlifeDescription ?? site.afterlifeCategory} />
          <DossierCell label="Ownership chain" value={site.buyer ?? site.owner ?? "Unresolved"} />
          <DossierCell label="Confidence" value={site.confidence} />
          <DossierCell label="Related entities" value={site.relatedEntities.length ? site.relatedEntities.join(" / ") : "Pending"} />
        </div>

        <div className="mt-4 border border-atlas-ink p-3">
          <div className="atlas-kicker">Source notes</div>
          <p className="mt-2 font-mono text-[11px] uppercase leading-4 text-atlas-rule">{site.sourceNotes ?? "No source note filed."}</p>
          {site.sourceUrls.length ? (
            <div className="mt-2 grid gap-1">
              {site.sourceUrls.map((url) => (
                <a key={url} href={url} className="break-all font-mono text-[10px] uppercase underline" target="_blank" rel="noreferrer">
                  {url}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-4 border border-atlas-ink p-3">
          <div className="atlas-kicker">Poetic caption</div>
          <p className="mt-2 font-mono text-[12px] uppercase leading-5">{caption.body}</p>
        </div>
      </div>
    </aside>
  );
}

function DossierCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-atlas-ink p-2">
      <div className="text-atlas-muted">{label}</div>
      <div className="mt-1 font-black">{value}</div>
    </div>
  );
}
