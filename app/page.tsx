"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterRail } from "@/components/FilterRail";
import { MapPanel } from "@/components/MapPanel";
import { OwnershipNetwork } from "@/components/OwnershipNetwork";
import { ReplacementMatrix } from "@/components/ReplacementMatrix";
import { ResearchQueue } from "@/components/ResearchQueue";
import { SiteDrawer } from "@/components/SiteDrawer";
import { TimelineChart } from "@/components/TimelineChart";
import {
  DEFAULT_FILTERS,
  STATUS_COLORS,
  STATUS_LABELS,
  type AtlasData,
  type FilterState,
  type SiteRecord,
  countBy,
  filterSites,
  formatNumber,
  getFilterOptions,
  loadAtlasData,
  priorityBand
} from "@/lib/data";

export default function DashboardPage() {
  const [data, setData] = useState<AtlasData | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedSite, setSelectedSite] = useState<SiteRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAtlasData()
      .then(setData)
      .catch((loadError: Error) => setError(loadError.message));
  }, []);

  const options = useMemo(() => (data ? getFilterOptions(data.sites) : getFilterOptions([])), [data]);
  const filteredSites = useMemo(() => (data ? filterSites(data.sites, filters) : []), [data, filters]);
  const selectSite = useCallback((site: SiteRecord) => setSelectedSite(site), []);

  const setYearRange = useCallback((min: number | null, max: number | null) => {
    setFilters((current) => ({ ...current, yearMin: min, yearMax: max }));
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="atlas-panel max-w-xl p-5">
          <div className="atlas-label text-atlas-red">Data load failure</div>
          <h1 className="mt-2 text-2xl font-black uppercase">Dead Campus Atlas</h1>
          <p className="mt-3 font-mono text-sm">{error}</p>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="atlas-panel p-5 font-mono text-xs uppercase">Loading atlas data / public data registry</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-3 text-atlas-ink">
      <header className="atlas-panel mb-3 grid gap-3 p-3 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="atlas-label text-atlas-muted">Dead Campus Atlas / master workbook dashboard</div>
          <h1 className="text-2xl font-black uppercase leading-none md:text-3xl">Educational Infrastructure Collapse, 1980-present</h1>
          <p className="mt-2 max-w-5xl font-mono text-[11px] uppercase leading-4 text-atlas-rule">
            Campus closure, institutional retreat, real-estate transfer, parcelization, cloud/security conversion, and educational land afterlives.
          </p>
        </div>
        <div className="grid min-w-[290px] grid-cols-2 border border-atlas-ink font-mono text-[10px] uppercase">
          <HeaderMetric label="Workbook" value={data.summary.workbookFile} />
          <HeaderMetric label="Generated" value={new Date(data.summary.generatedAt).toLocaleDateString()} />
          <HeaderMetric label="Records" value={formatNumber(data.summary.totalRecords)} />
          <HeaderMetric label="Filtered" value={formatNumber(filteredSites.length)} />
        </div>
      </header>

      <div className="grid min-h-[560px] gap-3 xl:h-[calc(100vh-150px)] xl:grid-cols-[280px_minmax(0,1fr)_330px]">
        <FilterRail
          filters={filters}
          options={options}
          summary={data.summary}
          onChange={setFilters}
          onReset={() => setFilters(DEFAULT_FILTERS)}
        />
        <MapPanel sites={filteredSites} selectedSiteId={selectedSite?.id ?? null} onSelectSite={selectSite} />
        <StatsColumn sites={filteredSites} allSites={data.sites} filters={filters} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <TimelineChart sites={data.sites} onYearRangeChange={setYearRange} />
        <TerritorialAnalysis sites={filteredSites} phaseSheets={data.summary.phaseSheets} />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <ReplacementMatrix sites={filteredSites} />
        <OwnershipNetwork nodes={data.nodes} edges={data.edges} />
      </div>

      <div className="mt-3">
        <ResearchQueue queue={data.researchQueue} sites={data.sites} />
      </div>

      <StatusLegend />
      <SiteDrawer site={selectedSite} edges={data.edges} onClose={() => setSelectedSite(null)} />
    </main>
  );
}

function HeaderMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-atlas-ink p-2">
      <div className="text-atlas-muted">{label}</div>
      <div className="mt-1 break-words font-black">{value}</div>
    </div>
  );
}

function StatsColumn({ sites, allSites, filters }: { sites: SiteRecord[]; allSites: SiteRecord[]; filters: FilterState }) {
  const withCoordinates = sites.filter((site) => site.hasCoordinates).length;
  const unresolvedAfterlife = sites.filter((site) => !site.afterlifeStatus && !site.reuseType).length;
  const closureCountByYearRange = sites.filter((site) => {
    if (site.closureYear === null) return false;
    if (filters.yearMin !== null && site.closureYear < filters.yearMin) return false;
    if (filters.yearMax !== null && site.closureYear > filters.yearMax) return false;
    return true;
  }).length;
  const topStates = countBy(sites, (site) => site.state).slice(0, 10);
  const morphologies = countBy(sites, (site) => site.morphology ?? "Unclassified").slice(0, 10);
  const priorityCounts = countBy(sites, (site) => priorityBand(site.researchPriorityScore));
  const statusCounts = countBy(sites, (site) => site.statusCode);

  return (
    <aside className="atlas-panel flex min-h-0 flex-col">
      <div className="border-b border-atlas-ink p-3">
        <div className="atlas-label text-atlas-muted">Right column / current extract</div>
        <h2 className="mt-1 text-lg font-black uppercase">Retreat Statistics</h2>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-3">
        <div className="grid grid-cols-2 border border-atlas-ink font-mono text-[11px] uppercase">
          <Metric label="Total records" value={formatNumber(sites.length)} />
          <Metric label="All records" value={formatNumber(allSites.length)} />
          <Metric label="With coordinates" value={formatNumber(withCoordinates)} />
          <Metric label="Year-range closures" value={formatNumber(closureCountByYearRange)} />
          <Metric label="Unresolved afterlife" value={formatNumber(unresolvedAfterlife)} />
          <Metric label="Coordinate gap" value={formatNumber(sites.length - withCoordinates)} />
        </div>

        <MiniList title="Top states" rows={topStates} />
        <MiniList title="Morphology counts" rows={morphologies} />
        <MiniList title="Research priority count" rows={priorityCounts} />

        <div className="mt-3 border border-atlas-ink">
          <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-label">Status code distribution</div>
          <div className="divide-y divide-atlas-ink">
            {statusCounts.map((row) => (
              <div key={row.key} className="grid grid-cols-[18px_1fr_auto] items-center gap-2 px-2 py-1 font-mono text-[11px] uppercase">
                <span className="h-3 w-3 border border-atlas-ink" style={{ background: STATUS_COLORS[row.key as keyof typeof STATUS_COLORS] }} />
                <span>{row.key}</span>
                <span className="font-black">{formatNumber(row.count)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-atlas-ink p-2">
      <div className="text-atlas-muted">{label}</div>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  );
}

function MiniList({ title, rows }: { title: string; rows: Array<{ key: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="mt-3 border border-atlas-ink">
      <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-label">{title}</div>
      <div className="divide-y divide-atlas-ink">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[1fr_56px] gap-2 px-2 py-1 font-mono text-[11px] uppercase">
            <div className="min-w-0">
              <div className="truncate">{row.key}</div>
              <div className="mt-1 h-1.5 border border-atlas-ink bg-atlas-paper">
                <div className="h-full bg-atlas-ink" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
              </div>
            </div>
            <div className="text-right font-black">{formatNumber(row.count)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TerritorialAnalysis({
  sites,
  phaseSheets
}: {
  sites: SiteRecord[];
  phaseSheets: Record<string, Array<Record<string, string | number | boolean | null>>>;
}) {
  const states = countBy(sites, (site) => site.state).slice(0, 14);
  const territorialTypes = phaseSheets.dead_campus_atlas__TERRITORIA ?? phaseSheets.dead_campus_atlas__TERRITORIA1 ?? [];
  const regionalBelts = phaseSheets.dead_campus_atlas__REGIONAL_B ?? phaseSheets.dead_campus_atlas__REGIONAL_C ?? [];
  const max = Math.max(1, ...states.map((row) => row.count));

  return (
    <section className="atlas-panel p-3">
      <div className="mb-3 border-b border-atlas-ink pb-3">
        <div className="atlas-label text-atlas-muted">Territorial analysis</div>
        <h2 className="text-lg font-black uppercase">State intensity and regional belts</h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
        <div className="border border-atlas-ink">
          <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-label">Counts by state</div>
          <div className="divide-y divide-atlas-ink">
            {states.map((row) => (
              <div key={row.key} className="grid grid-cols-[42px_1fr_64px] items-center gap-2 px-2 py-1 font-mono text-[11px] uppercase">
                <span className="font-black">{row.key}</span>
                <div className="h-3 border border-atlas-ink bg-atlas-paper">
                  <div className="h-full bg-atlas-ink" style={{ width: `${Math.max(4, (row.count / max) * 100)}%` }} />
                </div>
                <span className="text-right font-black">{formatNumber(row.count)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3">
          <GenericSheet title="Territorial types" rows={territorialTypes.slice(0, 8)} />
          <GenericSheet title="Regional belts / clusters" rows={regionalBelts.slice(0, 8)} />
        </div>
      </div>
    </section>
  );
}

function GenericSheet({ title, rows }: { title: string; rows: Array<Record<string, string | number | boolean | null>> }) {
  return (
    <div className="border border-atlas-ink">
      <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-label">{title}</div>
      <div className="divide-y divide-atlas-ink">
        {rows.length ? (
          rows.map((row, index) => (
            <div key={index} className="px-2 py-1 font-mono text-[11px] uppercase">
              {Object.values(row)
                .filter((value) => value !== null && value !== "")
                .join(" / ")}
            </div>
          ))
        ) : (
          <div className="px-2 py-2 font-mono text-[11px] uppercase text-atlas-muted">No workbook summary rows found.</div>
        )}
      </div>
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="mt-3 grid border border-atlas-ink bg-atlas-paper font-mono text-[10px] uppercase md:grid-cols-4 xl:grid-cols-8">
      {STATUS_LABELS.map((status) => (
        <div key={status.key} className="flex items-center gap-2 border-r border-atlas-ink px-2 py-2">
          <span className="h-3 w-3 border border-atlas-ink" style={{ background: STATUS_COLORS[status.key] }} />
          <span>{status.label}</span>
        </div>
      ))}
    </div>
  );
}
