"use client";

import { Brush, Bar, BarChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SiteRecord } from "@/lib/data";
import { timelineRows } from "@/lib/data";
import { useMemo } from "react";

type TimelineChartProps = {
  sites: SiteRecord[];
  onYearRangeChange: (min: number | null, max: number | null) => void;
};

export function TimelineChart({ sites, onYearRangeChange }: TimelineChartProps) {
  const rows = useMemo(() => timelineRows(sites), [sites]);

  return (
    <section className="atlas-panel min-h-[320px] p-3">
      <div className="mb-3 flex items-start justify-between gap-4 border-b border-atlas-ink pb-3">
        <div>
          <div className="atlas-label text-atlas-muted">Timeline view</div>
          <h2 className="text-lg font-black uppercase">Closures by year and decade</h2>
        </div>
        <div className="font-mono text-[11px] uppercase text-atlas-muted">Brush the lower band to constrain the atlas.</div>
      </div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#111111" strokeDasharray="1 5" opacity={0.32} />
            <XAxis dataKey="year" tick={{ fontSize: 10, fill: "#111111", fontFamily: "monospace" }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: "#111111", fontFamily: "monospace" }} width={44} />
            <Tooltip
              contentStyle={{
                background: "#f2f0e9",
                border: "1px solid #111111",
                borderRadius: 0,
                fontFamily: "monospace",
                fontSize: 11
              }}
              labelFormatter={(value) => `YEAR ${value}`}
            />
            <ReferenceArea x1={1986} x2={1992} fill="#607283" fillOpacity={0.13} />
            <ReferenceArea x1={2008} x2={2013} fill="#77667d" fillOpacity={0.13} />
            <ReferenceArea x1={2016} x2={2024} fill="#9d2b2b" fillOpacity={0.1} />
            <Bar dataKey="count" fill="#111111" isAnimationActive={false} />
            <Brush
              dataKey="year"
              height={28}
              travellerWidth={8}
              stroke="#111111"
              fill="#d8d5cb"
              onChange={(range) => {
                if (range.startIndex === undefined || range.endIndex === undefined) return;
                const start = rows[range.startIndex]?.year ?? null;
                const end = rows[range.endIndex]?.year ?? null;
                onYearRangeChange(start, end);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 grid grid-cols-3 border border-atlas-ink font-mono text-[11px] uppercase">
        <div className="border-r border-atlas-ink p-2">1986-1992 / federal closure baseline</div>
        <div className="border-r border-atlas-ink p-2">2008-2013 / recessionary retreat</div>
        <div className="p-2">2016-2024 / accelerated institutional collapse</div>
      </div>
    </section>
  );
}
