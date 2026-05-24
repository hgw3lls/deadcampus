"use client";

import type { FilterOptions, FilterState, SummaryData } from "@/lib/data";
import { formatNumber } from "@/lib/data";

type FilterRailProps = {
  filters: FilterState;
  options: FilterOptions;
  summary: SummaryData | null;
  onChange: (filters: FilterState) => void;
  onReset: () => void;
};

export function FilterRail({ filters, options, summary, onChange, onReset }: FilterRailProps) {
  const minYear = summary?.yearRange.min ?? 1980;
  const maxYear = summary?.yearRange.max ?? new Date().getFullYear();

  const update = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <aside className="atlas-panel flex h-full min-h-0 flex-col">
      <div className="border-b border-atlas-ink p-3">
        <div className="atlas-label text-atlas-muted">Control file</div>
        <h2 className="mt-1 text-lg font-black uppercase leading-tight">Retreat Filters</h2>
        <p className="mt-2 font-mono text-[11px] leading-4 text-atlas-rule">
          {formatNumber(summary?.totalRecords)} source records / {formatNumber(summary?.coordinateCount)} spatialized
        </p>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-3">
        <label className="block">
          <span className="atlas-label text-atlas-muted">Search dossier</span>
          <input
            value={filters.query}
            onChange={(event) => update("query", event.target.value)}
            placeholder="institution, city, buyer, OPEID"
            className="mt-1 w-full border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs outline-none focus:bg-white"
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="atlas-label text-atlas-muted">From</span>
            <input
              type="number"
              min={minYear}
              max={maxYear}
              value={filters.yearMin ?? ""}
              onChange={(event) => update("yearMin", event.target.value ? Number(event.target.value) : null)}
              className="mt-1 w-full border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs outline-none"
            />
          </label>
          <label className="block">
            <span className="atlas-label text-atlas-muted">Through</span>
            <input
              type="number"
              min={minYear}
              max={maxYear}
              value={filters.yearMax ?? ""}
              onChange={(event) => update("yearMax", event.target.value ? Number(event.target.value) : null)}
              className="mt-1 w-full border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs outline-none"
            />
          </label>
        </div>

        <SelectControl label="State" value={filters.state} options={options.states} onChange={(value) => update("state", value)} />
        <SelectControl
          label="Morphology"
          value={filters.morphology}
          options={options.morphologies}
          onChange={(value) => update("morphology", value)}
        />
        <SelectControl label="Sector" value={filters.sector} options={options.sectors} onChange={(value) => update("sector", value)} />
        <SelectControl
          label="Campus type"
          value={filters.campusType}
          options={options.campusTypes}
          onChange={(value) => update("campusType", value)}
        />
        <SelectControl
          label="Afterlife"
          value={filters.afterlifeStatus}
          options={options.afterlifeStatuses}
          onChange={(value) => update("afterlifeStatus", value)}
        />
        <SelectControl
          label="Status code"
          value={filters.statusCode}
          options={options.statusCodes}
          onChange={(value) => update("statusCode", value)}
        />
        <SelectControl
          label="Research priority"
          value={filters.researchPriority}
          options={options.researchPriorityBands}
          onChange={(value) => update("researchPriority", value)}
        />

        <label className="mt-4 flex items-center gap-2 border border-atlas-ink bg-atlas-soft px-2 py-2 font-mono text-[11px] uppercase">
          <input
            type="checkbox"
            checked={filters.coordinatesOnly}
            onChange={(event) => update("coordinatesOnly", event.target.checked)}
            className="h-4 w-4 accent-atlas-ink"
          />
          Coordinates only
        </label>
      </div>

      <div className="border-t border-atlas-ink p-3">
        <button
          type="button"
          onClick={onReset}
          className="w-full border border-atlas-ink bg-atlas-ink px-3 py-2 font-mono text-[11px] uppercase text-atlas-paper"
        >
          Reset filter stack
        </button>
      </div>
    </aside>
  );
}

function SelectControl({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-3 block">
      <span className="atlas-label text-atlas-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs outline-none"
      >
        <option value="ALL">ALL</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
