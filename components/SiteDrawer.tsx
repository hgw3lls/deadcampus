"use client";

import type { EdgeRecord, SiteRecord } from "@/lib/data";
import { STATUS_COLORS, formatMaybe, normalizeIdentity } from "@/lib/data";

type SiteDrawerProps = {
  site: SiteRecord | null;
  edges: EdgeRecord[];
  onClose: () => void;
};

export function SiteDrawer({ site, edges, onClose }: SiteDrawerProps) {
  if (!site) return null;

  const siteKey = normalizeIdentity(site.name);
  const relatedEdges = edges.filter(
    (edge) => normalizeIdentity(edge.source) === siteKey || normalizeIdentity(edge.target) === siteKey
  );

  return (
    <div className="fixed inset-y-0 right-0 z-[1000] w-full max-w-xl border-l border-atlas-ink bg-atlas-paper shadow-atlas">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between border-b border-atlas-ink p-4">
          <div>
            <div className="atlas-label" style={{ color: STATUS_COLORS[site.statusCode] }}>
              {site.statusCode}
            </div>
            <h2 className="mt-1 text-2xl font-black uppercase leading-tight">{site.name}</h2>
            <div className="mt-2 font-mono text-xs uppercase text-atlas-muted">
              {[site.city, site.state, site.zipCode].filter(Boolean).join(" / ") || "Location unresolved"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-atlas-ink px-3 py-2 font-mono text-xs uppercase"
            aria-label="Close site dossier"
          >
            Close
          </button>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-4">
          <div className="grid grid-cols-2 border border-atlas-ink font-mono text-xs">
            <Field label="Institution" value={site.institution ?? site.schoolName ?? site.name} />
            <Field label="Closure" value={site.closedDate ?? site.closureYear} />
            <Field label="Address" value={[site.address, site.city, site.state].filter(Boolean).join(", ")} wide />
            <Field label="Morphology" value={site.morphology} />
            <Field label="Afterlife" value={site.afterlifeStatus ?? site.reuseType} />
            <Field label="Buyer/controller" value={site.buyerController} wide />
            <Field label="Transformation" value={site.transformation} wide />
            <Field label="Sale price" value={site.salePrice} />
            <Field label="Acreage" value={site.acreage} />
            <Field label="Sector" value={site.sector} />
            <Field label="Campus type" value={site.campusType} />
            <Field label="Verification" value={site.verification} />
            <Field label="Source sheet" value={site.sourceSheets.join(" / ")} wide />
            <Field label="Notes" value={site.notes} wide />
          </div>

          <div className="mt-4 border border-atlas-ink">
            <div className="border-b border-atlas-ink bg-atlas-soft px-3 py-2">
              <div className="atlas-label">Research defects</div>
            </div>
            <div className="flex flex-wrap gap-2 p-3">
              {site.missingFields.length ? (
                site.missingFields.map((field) => (
                  <span key={field} className="border border-atlas-ink px-2 py-1 font-mono text-[11px] uppercase">
                    {field}
                  </span>
                ))
              ) : (
                <span className="font-mono text-xs uppercase">No missing core fields flagged.</span>
              )}
            </div>
          </div>

          <div className="mt-4 border border-atlas-ink">
            <div className="border-b border-atlas-ink bg-atlas-soft px-3 py-2">
              <div className="atlas-label">Related ownership edges</div>
            </div>
            {relatedEdges.length ? (
              <div className="divide-y divide-atlas-ink">
                {relatedEdges.map((edge) => (
                  <div key={edge.id} className="p-3 font-mono text-xs">
                    <div className="font-black uppercase">
                      {edge.source} → {edge.target}
                    </div>
                    <div className="mt-1 text-atlas-muted">
                      {[edge.relationship, edge.morphology, edge.salePrice, edge.transformation].filter(Boolean).join(" / ")}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 font-mono text-xs uppercase text-atlas-muted">No ownership edge linked by exact site name.</div>
            )}
          </div>

          {site.sourceUrl ? (
            <a
              href={site.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 block border border-atlas-ink bg-atlas-ink px-3 py-2 text-center font-mono text-xs uppercase text-atlas-paper"
            >
              Open source URL
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, wide = false }: { label: string; value: unknown; wide?: boolean }) {
  const displayValue = label === "Closure" && typeof value === "number" ? String(value) : formatMaybe(value as string | number | boolean | null | undefined);
  return (
    <div className={`min-h-16 border-b border-atlas-ink p-3 ${wide ? "col-span-2" : ""}`}>
      <div className="atlas-label text-atlas-muted">{label}</div>
      <div className="mt-1 break-words text-[12px] leading-4">{displayValue}</div>
    </div>
  );
}
