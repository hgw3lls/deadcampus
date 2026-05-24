"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ResearchQueueRecord, SiteRecord } from "@/lib/data";
import { STATUS_COLORS, downloadCsv, formatNumber, normalizeIdentity, toCsv } from "@/lib/data";

type ResearchQueueProps = {
  queue: ResearchQueueRecord[];
  sites: SiteRecord[];
};

export function ResearchQueue({ queue, sites }: ResearchQueueProps) {
  const [mode, setMode] = useState<"queue" | "peps">("queue");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("ALL");
  const [missingField, setMissingField] = useState("ALL");
  const [statusCode, setStatusCode] = useState("ALL");

  const pepsSites = useMemo(
    () => sites.filter((site) => site.sourceSheets.some((sheet) => sheet.toLowerCase().includes("peps"))),
    [sites]
  );
  const stateOptions = useMemo(
    () => Array.from(new Set((mode === "queue" ? queue : pepsSites).map((item) => item.state ?? "Unknown"))).sort(),
    [mode, pepsSites, queue]
  );
  const missingOptions = useMemo(
    () => Array.from(new Set(queue.flatMap((item) => item.missingFields))).sort((a, b) => a.localeCompare(b)),
    [queue]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set((mode === "queue" ? queue : pepsSites).map((item) => item.statusCode))).sort(),
    [mode, pepsSites, queue]
  );

  const filteredQueue = useMemo(() => {
    const normalizedQuery = normalizeIdentity(query);
    return queue.filter((item) => {
      if (normalizedQuery && !normalizeIdentity([item.name, item.city, item.state, item.buyerController].filter(Boolean).join(" ")).includes(normalizedQuery)) {
        return false;
      }
      if (state !== "ALL" && (item.state ?? "Unknown") !== state) return false;
      if (missingField !== "ALL" && !item.missingFields.includes(missingField)) return false;
      if (statusCode !== "ALL" && item.statusCode !== statusCode) return false;
      return true;
    });
  }, [missingField, query, queue, state, statusCode]);

  const filteredPeps = useMemo(() => {
    const normalizedQuery = normalizeIdentity(query);
    return pepsSites.filter((site) => {
      if (normalizedQuery && !normalizeIdentity([site.name, site.city, site.state, site.address, site.opeid8].filter(Boolean).join(" ")).includes(normalizedQuery)) {
        return false;
      }
      if (state !== "ALL" && (site.state ?? "Unknown") !== state) return false;
      if (statusCode !== "ALL" && site.statusCode !== statusCode) return false;
      return true;
    });
  }, [pepsSites, query, state, statusCode]);

  const activeRows = mode === "queue" ? filteredQueue : filteredPeps;
  const densityRows = useMemo(() => stateDensity(filteredPeps), [filteredPeps]);

  return (
    <section className="atlas-panel p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-atlas-ink pb-3">
        <div>
          <div className="atlas-label text-atlas-muted">Research queue / PEPS abyss explorer</div>
          <h2 className="text-lg font-black uppercase">Unresolved campus dossier work</h2>
        </div>
        <div className="flex border border-atlas-ink font-mono text-xs uppercase">
          <button
            type="button"
            onClick={() => setMode("queue")}
            className={`px-3 py-2 ${mode === "queue" ? "bg-atlas-ink text-atlas-paper" : "bg-atlas-paper"}`}
          >
            Queue
          </button>
          <button
            type="button"
            onClick={() => setMode("peps")}
            className={`border-l border-atlas-ink px-3 py-2 ${mode === "peps" ? "bg-atlas-ink text-atlas-paper" : "bg-atlas-paper"}`}
          >
            PEPS Abyss
          </button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_160px_190px_170px_128px]">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="search records"
          className="border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs outline-none"
        />
        <select value={state} onChange={(event) => setState(event.target.value)} className="border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs">
          <option value="ALL">ALL STATES</option>
          {stateOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={missingField}
          onChange={(event) => setMissingField(event.target.value)}
          disabled={mode === "peps"}
          className="border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs disabled:text-atlas-muted"
        >
          <option value="ALL">ALL MISSING FIELDS</option>
          {missingOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select value={statusCode} onChange={(event) => setStatusCode(event.target.value)} className="border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs">
          <option value="ALL">ALL STATUS CODES</option>
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            const rows = mode === "queue" ? filteredQueue : filteredPeps;
            downloadCsv(`dead-campus-${mode}-filtered.csv`, toCsv(rows as Array<Record<string, unknown>>));
          }}
          className="border border-atlas-ink bg-atlas-ink px-3 py-2 font-mono text-xs uppercase text-atlas-paper"
        >
          Export CSV
        </button>
      </div>

      {mode === "peps" ? (
        <div className="mt-3 border border-atlas-ink">
          <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-label">Bulk map density by state</div>
          <div className="grid gap-1 p-2 md:grid-cols-2 xl:grid-cols-4">
            {densityRows.slice(0, 16).map((entry) => (
              <div key={entry.state} className="grid grid-cols-[44px_1fr_54px] items-center gap-2 font-mono text-[11px] uppercase">
                <span>{entry.state}</span>
                <div className="h-3 border border-atlas-ink bg-atlas-paper">
                  <div className="h-full bg-atlas-ink" style={{ width: `${entry.share}%` }} />
                </div>
                <span className="text-right font-black">{formatNumber(entry.count)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 overflow-hidden border border-atlas-ink">
        <div className="flex items-center justify-between border-b border-atlas-ink bg-atlas-soft px-2 py-1 font-mono text-[11px] uppercase">
          <span>{mode === "queue" ? "High-priority unresolved records" : "PEPS closure records"}</span>
          <span>{formatNumber(activeRows.length)} filtered</span>
        </div>
        <div className="scrollbar-thin max-h-[460px] overflow-auto">
          {mode === "queue" ? <QueueTable rows={filteredQueue.slice(0, 300)} /> : <PepsTable rows={filteredPeps.slice(0, 500)} />}
        </div>
      </div>
    </section>
  );
}

function QueueTable({ rows }: { rows: ResearchQueueRecord[] }) {
  return (
    <table className="w-full border-collapse font-mono text-[11px]">
      <thead className="sticky top-0 bg-atlas-paper">
        <tr className="border-b border-atlas-ink text-left uppercase">
          <Th>Score</Th>
          <Th>Site</Th>
          <Th>State</Th>
          <Th>Year</Th>
          <Th>Status</Th>
          <Th>Missing</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-atlas-soft align-top">
            <Td strong>{row.researchPriorityScore}</Td>
            <Td>{row.name}</Td>
            <Td>{row.state ?? "—"}</Td>
            <Td>{row.closureYear ?? "—"}</Td>
            <Td>
              <span style={{ color: STATUS_COLORS[row.statusCode] }}>{row.statusCode}</span>
            </Td>
            <Td>{row.missingFields.join(", ")}</Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PepsTable({ rows }: { rows: SiteRecord[] }) {
  return (
    <table className="w-full border-collapse font-mono text-[11px]">
      <thead className="sticky top-0 bg-atlas-paper">
        <tr className="border-b border-atlas-ink text-left uppercase">
          <Th>OPEID</Th>
          <Th>School</Th>
          <Th>City</Th>
          <Th>State</Th>
          <Th>Closed</Th>
          <Th>Site type</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className="border-b border-atlas-soft align-top">
            <Td>{row.opeid8 ?? "—"}</Td>
            <Td>{row.name}</Td>
            <Td>{row.city ?? "—"}</Td>
            <Td>{row.state ?? "—"}</Td>
            <Td>{row.closureYear ?? "—"}</Td>
            <Td>{row.campusType ?? row.campusMarker}</Td>
            <Td>
              <span style={{ color: STATUS_COLORS[row.statusCode] }}>{row.statusCode}</span>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="border-r border-atlas-ink px-2 py-2 font-black">{children}</th>;
}

function Td({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return <td className={`border-r border-atlas-soft px-2 py-2 ${strong ? "font-black" : ""}`}>{children}</td>;
}

function stateDensity(sites: SiteRecord[]) {
  const counts = sites.reduce<Record<string, number>>((acc, site) => {
    const key = site.state ?? "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const max = Math.max(1, ...Object.values(counts));
  return Object.entries(counts)
    .map(([state, count]) => ({ state, count, share: Math.max(4, (count / max) * 100) }))
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state));
}
