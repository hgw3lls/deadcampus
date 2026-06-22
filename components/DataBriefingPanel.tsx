import type { DataBriefing } from "@/lib/data";
import { formatNumber } from "@/lib/data";

type DataBriefingPanelProps = {
  briefing: DataBriefing;
};

const coverageOrder = [
  ["coordinates", "Mapped"],
  ["state", "State Known"],
  ["afterlife", "Afterlife Known"],
  ["buyerController", "Buyer / Controller"],
  ["sourceNoteOrUrl", "Source Note / URL"],
  ["verification", "Verified"]
] as const;

export function DataBriefingPanel({ briefing }: DataBriefingPanelProps) {
  return (
    <section className="data-briefing atlas-panel">
      <div className="data-briefing__hero">
        <div>
          <div className="atlas-label text-atlas-muted">Read first / data briefing</div>
          <h2>What this atlas can prove right now</h2>
          <p>
            This view separates the strong parts of the dataset from the unfinished research surface. Use it before moving into the map, matrix, queue, or evidence wall.
          </p>
        </div>
        <div className="data-briefing__stamp">
          <span>{formatNumber(briefing.totals.records)}</span>
          canonical records
        </div>
      </div>

      <div className="data-briefing__grid">
        <div className="data-briefing__panel data-briefing__panel--summary">
          <div className="atlas-label text-atlas-muted">Plain language summary</div>
          <div className="mt-3 grid gap-2">
            {briefing.plainLanguageSummary.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </div>

        <div className="data-briefing__panel">
          <div className="atlas-label text-atlas-muted">Coverage ledger</div>
          <div className="mt-3 grid gap-2">
            {coverageOrder.map(([key, label]) => {
              const row = briefing.coverage[key];
              return row ? <CoverageRow key={key} label={label} count={row.count} missing={row.missing} percent={row.percent} /> : null;
            })}
          </div>
        </div>

        <div className="data-briefing__panel">
          <div className="atlas-label text-atlas-muted">Where the dataset is densest</div>
          <RankRows rows={briefing.topStates.slice(0, 8)} />
        </div>

        <div className="data-briefing__panel">
          <div className="atlas-label text-atlas-muted">Closure waves by decade</div>
          <RankRows rows={briefing.decadeCounts} />
        </div>
      </div>

      <div className="data-briefing__next">
        <div className="atlas-label text-atlas-muted">Best expansion path</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {briefing.recommendedNextWork.map((item) => (
            <article key={item.id} className="data-briefing__task">
              <div className="data-briefing__task-count">{formatNumber(item.count)}</div>
              <h3>{item.label}</h3>
              <p>{item.rationale}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CoverageRow({ label, count, missing, percent }: { label: string; count: number; missing: number; percent: number }) {
  return (
    <div className="data-briefing__coverage-row">
      <div>
        <div className="font-black">{label}</div>
        <div className="text-atlas-muted">{formatNumber(count)} known / {formatNumber(missing)} missing</div>
      </div>
      <div className="data-briefing__bar" aria-label={`${label}: ${percent}%`}>
        <span style={{ width: `${Math.max(2, percent)}%` }} />
      </div>
      <div className="text-right font-black">{percent}%</div>
    </div>
  );
}

function RankRows({ rows }: { rows: Array<{ key: string; count: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="mt-3 grid gap-1">
      {rows.map((row) => (
        <div key={row.key} className="data-briefing__rank-row">
          <span>{row.key}</span>
          <span className="data-briefing__bar">
            <span style={{ width: `${Math.max(3, (row.count / max) * 100)}%` }} />
          </span>
          <strong>{formatNumber(row.count)}</strong>
        </div>
      ))}
    </div>
  );
}
