"use client";

import { useEffect, useMemo, useState } from "react";
import { deterministicMicroCaption } from "@/src/data/atlasTexts";
import {
  buildOwnershipLinks,
  buildReplacementEconomyCells,
  defaultAtlasExplorerFilters,
  explorerAfterlifeFunctions,
  explorerOriginalFunctions,
  fieldworkChecklist,
  filterAtlasExplorerSites,
  normalizeAtlasExplorerSites,
  uniqueExplorerOptions,
  type AtlasExplorerFilters,
  type AtlasExplorerSite
} from "@/lib/atlasExplorer";
import type { SiteRecord, StatusCode } from "@/lib/data";
import { STATUS_COLORS, STATUS_LABELS, formatNumber, normalizeIdentity } from "@/lib/data";

type AtlasExplorerProps = {
  sites: SiteRecord[];
};

type ExplorerView = "map" | "timeline" | "matrix" | "network" | "state" | "status" | "table" | "fieldwork";

export function AtlasExplorer({ sites }: AtlasExplorerProps) {
  const [view, setView] = useState<ExplorerView>("map");
  const [filters, setFilters] = useState<AtlasExplorerFilters>(defaultAtlasExplorerFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedEvidence, setCheckedEvidence] = useState<string[]>([]);

  const explorerSites = useMemo(() => normalizeAtlasExplorerSites(sites), [sites]);
  const filteredSites = useMemo(() => filterAtlasExplorerSites(explorerSites, filters), [explorerSites, filters]);
  const selectedSite = useMemo(
    () => filteredSites.find((site) => site.id === selectedId) ?? filteredSites[0] ?? explorerSites[0] ?? null,
    [explorerSites, filteredSites, selectedId]
  );

  useEffect(() => {
    if (selectedSite && selectedSite.id !== selectedId) {
      setSelectedId(selectedSite.id);
    }
  }, [selectedId, selectedSite]);

  const stateOptions = useMemo(() => uniqueExplorerOptions(explorerSites, "state"), [explorerSites]);
  const decadeOptions = useMemo(() => uniqueExplorerOptions(explorerSites, "decade"), [explorerSites]);
  const institutionOptions = useMemo(() => uniqueExplorerOptions(explorerSites, "institutionType"), [explorerSites]);
  const statusRows = useMemo(() => countRows(filteredSites, (site) => site.statusCode), [filteredSites]);
  const stateRows = useMemo(() => countRows(filteredSites, (site) => site.state ?? "Unknown").slice(0, 18), [filteredSites]);
  const decadeRows = useMemo(() => countRows(filteredSites, (site) => site.decade), [filteredSites]);
  const matrixCells = useMemo(() => buildReplacementEconomyCells(filteredSites), [filteredSites]);
  const ownershipLinks = useMemo(() => buildOwnershipLinks(filteredSites), [filteredSites]);

  return (
    <section id="atlas-explorer" className="atlas-explorer atlas-panel atlas-explorer-console">
      <div className="grid border-b border-atlas-ink xl:grid-cols-[1fr_380px]">
        <div className="p-3">
          <div className="atlas-label text-atlas-muted">Atlas Explorer / scaffold for stronger data navigation</div>
          <h2 className="mt-1 text-3xl font-black uppercase leading-none md:text-5xl">Navigation System for Educational Withdrawal</h2>
          <p className="mt-3 max-w-5xl font-mono text-[12px] uppercase leading-5 text-atlas-rule">
            A new interface layer for map, timeline, replacement economy, ownership network, dossier, and fieldwork modes. It is wired to the current
            workbook-derived JSON and can absorb richer CSV/JSON later through the normalized loader.
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-atlas-ink font-mono text-[10px] uppercase xl:border-l xl:border-t-0">
          <ExplorerMetric label="Records" value={formatNumber(explorerSites.length)} />
          <ExplorerMetric label="Filtered" value={formatNumber(filteredSites.length)} />
          <ExplorerMetric label="With coordinates" value={formatNumber(filteredSites.filter((site) => site.latitude !== null && site.longitude !== null).length)} />
          <ExplorerMetric label="Ownership links" value={formatNumber(ownershipLinks.length)} />
        </div>
      </div>

      <div className="atlas-explorer__body grid xl:grid-cols-[250px_minmax(0,1fr)_360px]">
        <aside className="atlas-explorer__rail min-w-0 border-b border-atlas-ink p-3 xl:border-b-0 xl:border-r">
          <div className="atlas-label text-atlas-muted">Archive tabs</div>
          <div className="mt-2 grid border border-atlas-ink font-mono text-[11px] uppercase">
            <ViewButton label="Map View" active={view === "map"} onClick={() => setView("map")} />
            <ViewButton label="Timeline View" active={view === "timeline"} onClick={() => setView("timeline")} />
            <ViewButton label="Replacement Matrix" active={view === "matrix"} onClick={() => setView("matrix")} />
            <ViewButton label="Ownership Network" active={view === "network"} onClick={() => setView("network")} />
            <ViewButton label="State / Region View" active={view === "state"} onClick={() => setView("state")} />
            <ViewButton label="Status Code View" active={view === "status"} onClick={() => setView("status")} />
            <ViewButton label="Table View" active={view === "table"} onClick={() => setView("table")} />
            <ViewButton label="Fieldwork Mode" active={view === "fieldwork"} onClick={() => setView("fieldwork")} />
          </div>

          <div className="mt-3 grid gap-2">
            <FilterSelect label="State" value={filters.state} options={stateOptions} onChange={(state) => setFilters((current) => ({ ...current, state }))} />
            <FilterSelect label="Decade" value={filters.decade} options={decadeOptions} onChange={(decade) => setFilters((current) => ({ ...current, decade }))} />
            <FilterSelect
              label="Status code"
              value={filters.statusCode}
              options={STATUS_LABELS.map((status) => status.key)}
              onChange={(statusCode) => setFilters((current) => ({ ...current, statusCode }))}
            />
            <FilterSelect
              label="Afterlife"
              value={filters.afterlife}
              options={explorerAfterlifeFunctions}
              onChange={(afterlife) => setFilters((current) => ({ ...current, afterlife }))}
            />
            <FilterSelect
              label="Institution type"
              value={filters.institutionType}
              options={institutionOptions}
              onChange={(institutionType) => setFilters((current) => ({ ...current, institutionType }))}
            />
            <button
              type="button"
              onClick={() => setFilters(defaultAtlasExplorerFilters)}
              className="border border-atlas-ink bg-atlas-ink px-3 py-2 text-left font-mono text-[11px] uppercase text-atlas-paper"
            >
              Reset filter file
            </button>
          </div>
        </aside>

        <div className="atlas-explorer__viewport min-w-0 border-b border-atlas-ink p-3 xl:border-b-0">
          {view === "map" ? <ExplorerMapView sites={filteredSites} stateRows={stateRows} onSelect={setSelectedId} onFilterState={(state) => setFilters((current) => ({ ...current, state }))} /> : null}
          {view === "timeline" ? <ExplorerTimelineView decadeRows={decadeRows} onFilterDecade={(decade) => setFilters((current) => ({ ...current, decade }))} /> : null}
          {view === "matrix" ? <ExplorerMatrixView cells={matrixCells} sites={filteredSites} onSelect={setSelectedId} /> : null}
          {view === "network" ? <ExplorerNetworkView links={ownershipLinks} sites={filteredSites} onSelect={setSelectedId} /> : null}
          {view === "state" ? <ExplorerStateView stateRows={stateRows} onFilterState={(state) => setFilters((current) => ({ ...current, state }))} /> : null}
          {view === "status" ? <ExplorerStatusView statusRows={statusRows} onFilterStatus={(statusCode) => setFilters((current) => ({ ...current, statusCode }))} /> : null}
          {view === "table" ? <ExplorerTableView sites={filteredSites} onSelect={setSelectedId} /> : null}
          {view === "fieldwork" ? (
            <ExplorerFieldworkView
              checkedEvidence={checkedEvidence}
              onToggle={(item) =>
                setCheckedEvidence((current) => (current.includes(item) ? current.filter((value) => value !== item) : [...current, item]))
              }
            />
          ) : null}
        </div>

        <ExplorerDossier site={selectedSite} statusRows={statusRows} />
      </div>
    </section>
  );
}

function ExplorerMapView({
  sites,
  stateRows,
  onSelect,
  onFilterState
}: {
  sites: AtlasExplorerSite[];
  stateRows: Array<{ key: string; count: number }>;
  onSelect: (id: string) => void;
  onFilterState: (state: string) => void;
}) {
  const max = Math.max(1, ...stateRows.map((row) => row.count));
  const plottedSites = sites.filter((site) => site.latitude !== null && site.longitude !== null).slice(0, 42);

  return (
    <div>
      <ExplorerSectionHeader code="A" title="Map View" text="National retreat intensity, state filters, coordinate-bearing sites, and dossier selection." />
      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="explorer-map-field min-h-[420px] border border-atlas-ink p-3">
          <div className="atlas-label text-atlas-muted">Coordinate trace / sampled mapped closures</div>
          <div className="relative mt-3 min-h-[360px] border border-atlas-ink bg-atlas-soft">
            <div className="absolute inset-0 atlas-map-scan" />
            {plottedSites.map((site, index) => (
              <button
                key={site.id}
                type="button"
                onClick={() => onSelect(site.id)}
                className="absolute h-4 w-4 border border-atlas-ink bg-atlas-paper focus:outline focus:outline-2 focus:outline-atlas-red"
                style={{
                  left: `${8 + ((index * 19) % 84)}%`,
                  top: `${10 + ((index * 31) % 78)}%`,
                  background: STATUS_COLORS[site.statusCode]
                }}
                aria-label={`Open dossier for ${site.name}`}
                title={site.name}
              />
            ))}
          </div>
        </div>
        <div className="border border-atlas-ink">
          <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-label">State retreat intensity</div>
          <div className="divide-y divide-atlas-ink">
            {stateRows.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={() => onFilterState(row.key)}
                className="grid w-full grid-cols-[46px_1fr_62px] items-center gap-2 px-2 py-2 text-left font-mono text-[11px] uppercase hover:bg-atlas-soft"
              >
                <span className="font-black">{row.key}</span>
                <span className="h-3 border border-atlas-ink bg-atlas-paper">
                  <span className="block h-full bg-atlas-ink" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
                </span>
                <span className="text-right font-black">{formatNumber(row.count)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExplorerTimelineView({ decadeRows, onFilterDecade }: { decadeRows: Array<{ key: string; count: number }>; onFilterDecade: (decade: string) => void }) {
  const max = Math.max(1, ...decadeRows.map((row) => row.count));
  return (
    <div>
      <ExplorerSectionHeader code="B" title="Timeline View" text="Closure, sale, and transfer chronology scaffold with decade bands and policy-era overlays." />
      <div className="grid gap-3">
        {decadeRows.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={() => onFilterDecade(row.key)}
            className="grid grid-cols-[86px_1fr_80px] items-center border border-atlas-ink text-left font-mono text-xs uppercase"
          >
            <span className="border-r border-atlas-ink p-2 font-black">{row.key}</span>
            <span className="relative h-12 border-r border-atlas-ink bg-atlas-soft">
              <span className="absolute inset-y-0 left-0 bg-atlas-ink" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
              <span className="absolute inset-y-0 left-[48%] border-l border-atlas-red" />
              <span className="absolute inset-0 flex items-center px-2 text-atlas-paper mix-blend-difference">policy era band / consolidation pressure</span>
            </span>
            <span className="p-2 text-right font-black">{formatNumber(row.count)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExplorerMatrixView({ cells, sites, onSelect }: { cells: ReturnType<typeof buildReplacementEconomyCells>; sites: AtlasExplorerSite[]; onSelect: (id: string) => void }) {
  const max = Math.max(1, ...cells.map((cell) => cell.count));
  return (
    <div>
      <ExplorerSectionHeader code="C" title="Replacement Economy Matrix" text="Rows are original educational functions. Columns are afterlife functions." />
      <div className="overflow-auto border border-atlas-ink">
        <table className="w-full min-w-[820px] border-collapse font-mono text-[11px] uppercase">
          <thead>
            <tr className="border-b border-atlas-ink bg-atlas-soft text-left">
              <th className="border-r border-atlas-ink p-2">Original / afterlife</th>
              {explorerAfterlifeFunctions.map((afterlife) => (
                <th key={afterlife} className="border-r border-atlas-ink p-2">
                  {afterlife}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {explorerOriginalFunctions.map((original) => (
              <tr key={original} className="border-b border-atlas-soft">
                <th className="border-r border-atlas-ink p-2 text-left">{original}</th>
                {explorerAfterlifeFunctions.map((afterlife) => {
                  const cell = cells.find((candidate) => candidate.originalFunction === original && candidate.afterlifeFunction === afterlife)!;
                  const firstSite = sites.find((site) => cell.siteIds.includes(site.id));
                  return (
                    <td key={`${original}-${afterlife}`} className="border-r border-atlas-soft p-1 align-top">
                      <button
                        type="button"
                        disabled={!firstSite}
                        onClick={() => firstSite && onSelect(firstSite.id)}
                        className="min-h-16 w-full border border-atlas-ink bg-atlas-paper p-2 text-left disabled:border-atlas-soft disabled:text-atlas-muted"
                        style={{ boxShadow: cell.count ? `inset 0 -${Math.max(2, (cell.count / max) * 36)}px 0 #111111` : undefined }}
                      >
                        <span className="block font-black">{formatNumber(cell.count)}</span>
                        <span className="block text-[10px]">dossiers</span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExplorerNetworkView({ links, sites, onSelect }: { links: ReturnType<typeof buildOwnershipLinks>; sites: AtlasExplorerSite[]; onSelect: (id: string) => void }) {
  const nodes = Array.from(new Set(links.flatMap((link) => [link.source, link.target]))).slice(0, 36);
  const points = nodes.map((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
    return { node, x: 380 + Math.cos(angle) * 270, y: 210 + Math.sin(angle) * 135 };
  });

  return (
    <div>
      <ExplorerSectionHeader code="D" title="Ownership Network View" text="Institutions, buyers, owners, and afterlife controllers as provisional node-edge evidence." />
      <div className="grid gap-3 lg:grid-cols-[1fr_290px]">
        <svg viewBox="0 0 760 420" className="min-h-[420px] w-full border border-atlas-ink bg-atlas-soft" role="img" aria-label="Atlas explorer ownership network scaffold">
          <rect width="760" height="420" fill="#d8d5cb" />
          {links.slice(0, 120).map((link) => {
            const source = points.find((point) => point.node === link.source);
            const target = points.find((point) => point.node === link.target);
            if (!source || !target) return null;
            return <line key={link.id} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke={STATUS_COLORS[link.statusCode]} strokeWidth="1.2" opacity="0.7" />;
          })}
          {points.map((point) => (
            <g key={point.node}>
              <rect x={point.x - 4} y={point.y - 4} width="8" height="8" fill="#f2f0e9" stroke="#111111" />
              <text x={point.x + 8} y={point.y + 4} fontSize="9" fontFamily="monospace" fill="#111111">
                {point.node.slice(0, 34)}
              </text>
            </g>
          ))}
        </svg>
        <div className="border border-atlas-ink">
          <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-label">Transfer ledger</div>
          <div className="scrollbar-thin max-h-[420px] overflow-auto divide-y divide-atlas-ink">
            {links.slice(0, 80).map((link) => {
              const linkedSite = sites.find((site) => site.id === link.siteId);
              return (
                <button key={link.id} type="button" onClick={() => onSelect(link.siteId)} className="block w-full p-2 text-left font-mono text-[11px] uppercase hover:bg-atlas-soft">
                  <div className="font-black">{link.relationship}</div>
                  <div>{linkedSite?.name ?? link.source}</div>
                  <div className="text-atlas-muted">to {link.target}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExplorerStateView({ stateRows, onFilterState }: { stateRows: Array<{ key: string; count: number }>; onFilterState: (state: string) => void }) {
  const max = Math.max(1, ...stateRows.map((row) => row.count));
  return (
    <div>
      <ExplorerSectionHeader code="E1" title="State / Region View" text="Territorial retreat intensity by state. Region bands can be expanded from src/data/regions.ts." />
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {stateRows.map((row) => (
          <button key={row.key} type="button" onClick={() => onFilterState(row.key)} className="border border-atlas-ink bg-atlas-paper p-3 text-left font-mono text-[11px] uppercase">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xl font-black">{row.key}</span>
              <span>{formatNumber(row.count)}</span>
            </div>
            <div className="mt-3 h-3 border border-atlas-ink bg-atlas-soft">
              <div className="h-full bg-atlas-ink" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExplorerStatusView({ statusRows, onFilterStatus }: { statusRows: Array<{ key: string; count: number }>; onFilterStatus: (statusCode: string) => void }) {
  const max = Math.max(1, ...statusRows.map((row) => row.count));
  return (
    <div>
      <ExplorerSectionHeader code="E2" title="Status Code View" text="Classification surface for active risk, closure events, transfers, parcelization, cloud, security, ruin, and counter-use." />
      <div className="grid gap-2 md:grid-cols-2">
        {statusRows.map((row) => (
          <button key={row.key} type="button" onClick={() => onFilterStatus(row.key)} className="border border-atlas-ink bg-atlas-paper p-3 text-left font-mono text-[11px] uppercase">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-black">
                <span className="h-3 w-3 border border-atlas-ink" style={{ background: STATUS_COLORS[row.key as StatusCode] }} />
                {row.key}
              </span>
              <span>{formatNumber(row.count)}</span>
            </div>
            <div className="mt-3 h-3 border border-atlas-ink bg-atlas-soft">
              <div className="h-full" style={{ width: `${Math.max(4, (row.count / max) * 100)}%`, background: STATUS_COLORS[row.key as StatusCode] }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ExplorerTableView({ sites, onSelect }: { sites: AtlasExplorerSite[]; onSelect: (id: string) => void }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeIdentity(query);
  const rows = sites
    .filter((site) => normalizeIdentity([site.name, site.city, site.state, site.statusCode, site.afterlife, site.buyer].filter(Boolean).join(" ")).includes(normalizedQuery))
    .slice(0, 500);

  return (
    <div>
      <ExplorerSectionHeader code="E3" title="Table View" text="Reliable fallback for all data modes: searchable, keyboard-accessible record list with dossier selection." />
      <label className="mb-3 block">
        <span className="atlas-label text-atlas-muted">Search table</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="institution, state, buyer, status"
          className="mt-1 w-full border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs outline-none"
        />
      </label>
      <div className="atlas-table-scroll border border-atlas-ink">
        <table className="w-full min-w-[920px] border-collapse font-mono text-[11px] uppercase">
          <thead className="bg-atlas-soft">
            <tr className="border-b border-atlas-ink text-left">
              <th className="border-r border-atlas-ink p-2">Institution</th>
              <th className="border-r border-atlas-ink p-2">Place</th>
              <th className="border-r border-atlas-ink p-2">Year</th>
              <th className="border-r border-atlas-ink p-2">Status</th>
              <th className="border-r border-atlas-ink p-2">Type</th>
              <th className="p-2">Afterlife / buyer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((site) => (
              <tr key={site.id} className="border-b border-atlas-soft align-top">
                <td className="border-r border-atlas-soft p-2">
                  <button type="button" onClick={() => onSelect(site.id)} className="text-left font-black underline-offset-2 hover:underline">
                    {site.name}
                  </button>
                </td>
                <td className="border-r border-atlas-soft p-2">{[site.city, site.state].filter(Boolean).join(", ") || "Unknown"}</td>
                <td className="border-r border-atlas-soft p-2">{site.closureYear ?? "Unknown"}</td>
                <td className="border-r border-atlas-soft p-2" style={{ color: STATUS_COLORS[site.statusCode] }}>
                  {site.statusCode}
                </td>
                <td className="border-r border-atlas-soft p-2">{site.institutionType ?? "Unknown"}</td>
                <td className="p-2">{[site.afterlife ?? site.afterlifeFunction, site.buyer].filter(Boolean).join(" / ") || "Pending"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExplorerFieldworkView({ checkedEvidence, onToggle }: { checkedEvidence: string[]; onToggle: (item: string) => void }) {
  return (
    <div>
      <ExplorerSectionHeader code="F" title="Fieldwork Mode" text="Checklist interface for evidence collection: signs, paperwork, spatial traces, media, government documents, and audio." />
      <div className="grid gap-3 md:grid-cols-2">
        {fieldworkChecklist.map((item, index) => {
          const checked = checkedEvidence.includes(item);
          return (
            <label key={item} className="flex min-h-[128px] cursor-pointer items-start gap-3 border border-atlas-ink bg-atlas-paper p-3 font-mono uppercase">
              <input type="checkbox" checked={checked} onChange={() => onToggle(item)} className="mt-1 h-4 w-4 accent-atlas-red" />
              <span>
                <span className="atlas-label text-atlas-muted">field evidence {String(index + 1).padStart(2, "0")}</span>
                <span className="mt-2 block text-lg font-black">{item}</span>
                <span className="mt-2 block text-[11px] leading-4 text-atlas-muted">
                  {checked ? "Filed into provisional method record." : "Unverified. Requires observation, citation, or sensory trace."}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function ExplorerDossier({ site, statusRows }: { site: AtlasExplorerSite | null; statusRows: Array<{ key: string; count: number }> }) {
  const caption = site ? deterministicMicroCaption(`${site.id}-${site.name}`) : null;

  return (
    <aside className="atlas-explorer__dossier min-w-0 border-atlas-ink p-3 xl:border-l">
      <div className="atlas-label text-atlas-muted">E / dossier view</div>
      {site ? (
        <div className="mt-2 border border-atlas-ink">
          <div className="border-b border-atlas-ink bg-atlas-ink px-3 py-2 font-mono text-[10px] uppercase text-atlas-paper">
            accession {site.accession}
          </div>
          <div className="p-3">
            <h3 className="text-2xl font-black uppercase leading-none">{site.name}</h3>
            <div className="mt-2 font-mono text-[11px] uppercase text-atlas-muted">
              {[site.city, site.state, site.closureYear ?? "year unknown"].filter(Boolean).join(" / ")}
            </div>
            <DossierRow label="Status code" value={site.statusCode} color={STATUS_COLORS[site.statusCode]} />
            <DossierRow label="Institution type" value={site.institutionType ?? "unclassified"} />
            <DossierRow label="Afterlife / reuse" value={site.afterlife ?? site.afterlifeFunction} />
            <DossierRow label="Ownership chain" value={site.buyer ?? site.owner ?? "unresolved"} />
            <DossierRow label="Source notes" value={site.source ?? "source pending"} />
            <div className="mt-3 border border-atlas-ink p-2">
              <div className="atlas-label text-atlas-muted">Poetic caption</div>
              <p className="mt-2 font-mono text-[12px] uppercase leading-5">{caption?.body}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2 border border-atlas-ink p-3 font-mono text-xs uppercase">No dossier selected.</div>
      )}

      <div className="mt-3 border border-atlas-ink">
        <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-label">Filtered status distribution</div>
        <div className="divide-y divide-atlas-ink">
          {statusRows.map((row) => (
            <div key={row.key} className="grid grid-cols-[14px_1fr_auto] items-center gap-2 px-2 py-1 font-mono text-[10px] uppercase">
              <span className="h-3 w-3 border border-atlas-ink" style={{ background: STATUS_COLORS[row.key as StatusCode] }} />
              <span>{row.key}</span>
              <span className="font-black">{formatNumber(row.count)}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function DossierRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="mt-3 border-t border-atlas-soft pt-2 font-mono text-[11px] uppercase leading-4">
      <div className="text-atlas-muted">{label}</div>
      <div className="font-black" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ExplorerSectionHeader({ code, title, text }: { code: string; title: string; text: string }) {
  return (
    <div className="mb-3 grid border border-atlas-ink bg-atlas-paper md:grid-cols-[58px_1fr]">
      <div className="border-b border-atlas-ink bg-atlas-ink p-3 text-center font-mono text-xl font-black text-atlas-paper md:border-b-0 md:border-r">
        {code}
      </div>
      <div className="p-3">
        <h3 className="text-xl font-black uppercase leading-none">{title}</h3>
        <p className="mt-2 font-mono text-[11px] uppercase leading-4 text-atlas-muted">{text}</p>
      </div>
    </div>
  );
}

function ExplorerMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-atlas-ink p-3">
      <div className="text-atlas-muted">{label}</div>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  );
}

function ViewButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`border-b border-atlas-ink px-3 py-2 text-left ${active ? "bg-atlas-ink text-atlas-paper" : "bg-atlas-paper"}`}>
      {label}
    </button>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="atlas-label text-atlas-muted">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full min-w-0 max-w-full border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs">
        <option value="ALL">ALL</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function countRows<T>(items: T[], keyFor: (item: T) => string): Array<{ key: string; count: number }> {
  const map = new Map<string, number>();
  items.forEach((item) => {
    const key = keyFor(item) || "Unknown";
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
