"use client";

import { useMemo, useState } from "react";
import type { EdgeRecord, NodeRecord } from "@/lib/data";
import { STATUS_COLORS, formatNumber, normalizeIdentity } from "@/lib/data";

type OwnershipNetworkProps = {
  nodes: NodeRecord[];
  edges: EdgeRecord[];
};

export function OwnershipNetwork({ nodes, edges }: OwnershipNetworkProps) {
  const [morphology, setMorphology] = useState("ALL");
  const [relationship, setRelationship] = useState("ALL");

  const morphologies = useMemo(
    () => Array.from(new Set(edges.map((edge) => edge.morphology ?? "Unknown"))).sort((a, b) => a.localeCompare(b)),
    [edges]
  );
  const relationships = useMemo(
    () => Array.from(new Set(edges.map((edge) => edge.relationship ?? "Unknown"))).sort((a, b) => a.localeCompare(b)),
    [edges]
  );

  const filteredEdges = useMemo(
    () =>
      edges.filter((edge) => {
        if (morphology !== "ALL" && (edge.morphology ?? "Unknown") !== morphology) return false;
        if (relationship !== "ALL" && (edge.relationship ?? "Unknown") !== relationship) return false;
        return true;
      }),
    [edges, morphology, relationship]
  );

  const graph = useMemo(() => buildGraph(nodes, filteredEdges), [filteredEdges, nodes]);

  return (
    <section className="atlas-panel p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-atlas-ink pb-3">
        <div>
          <div className="atlas-label text-atlas-muted">Ownership network</div>
          <h2 className="text-lg font-black uppercase">Transfers, controllers, and reuse paths</h2>
        </div>
        <div className="flex gap-2">
          <select
            value={morphology}
            onChange={(event) => setMorphology(event.target.value)}
            className="border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs"
          >
            <option value="ALL">ALL MORPHOLOGIES</option>
            {morphologies.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select
            value={relationship}
            onChange={(event) => setRelationship(event.target.value)}
            className="border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs"
          >
            <option value="ALL">ALL RELATIONSHIPS</option>
            {relationships.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_260px]">
        <div className="min-h-[360px] border border-atlas-ink bg-atlas-soft">
          <svg viewBox="0 0 760 360" className="h-full min-h-[360px] w-full" role="img" aria-label="Ownership network graph">
            <rect x="0" y="0" width="760" height="360" fill="#d8d5cb" />
            <g>
              {graph.edges.map((edge) => {
                const source = graph.points.get(normalizeIdentity(edge.source));
                const target = graph.points.get(normalizeIdentity(edge.target));
                if (!source || !target) return null;
                return (
                  <line
                    key={edge.id}
                    x1={source.x}
                    y1={source.y}
                    x2={target.x}
                    y2={target.y}
                    stroke={colorForMorphology(edge.morphology)}
                    strokeWidth="1.4"
                    opacity="0.82"
                  />
                );
              })}
            </g>
            <g>
              {graph.nodes.map((node) => {
                const point = graph.points.get(normalizeIdentity(node.name));
                if (!point) return null;
                return (
                  <g key={node.id}>
                    <circle cx={point.x} cy={point.y} r={node.nodeType === "Campus" ? 6 : 4.5} fill="#f2f0e9" stroke="#111111" strokeWidth="1.5" />
                    <text x={point.x + 8} y={point.y + 3} fontSize="9" fontFamily="monospace" fill="#111111">
                      {node.name.slice(0, 34)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="border border-atlas-ink">
          <div className="grid grid-cols-2 border-b border-atlas-ink font-mono text-xs uppercase">
            <div className="border-r border-atlas-ink p-2">
              <div className="text-atlas-muted">Nodes</div>
              <div className="text-xl font-black">{formatNumber(graph.nodes.length)}</div>
            </div>
            <div className="p-2">
              <div className="text-atlas-muted">Edges</div>
              <div className="text-xl font-black">{formatNumber(filteredEdges.length)}</div>
            </div>
          </div>
          <div className="scrollbar-thin max-h-[290px] overflow-auto divide-y divide-atlas-ink">
            {filteredEdges.map((edge) => (
              <div key={edge.id} className="p-2 font-mono text-[11px]">
                <div className="font-black uppercase">{edge.relationship ?? "relationship"}</div>
                <div>{edge.source}</div>
                <div className="text-atlas-muted">→ {edge.target}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function buildGraph(nodes: NodeRecord[], edges: EdgeRecord[]) {
  const usedNames = new Set<string>();
  edges.forEach((edge) => {
    usedNames.add(normalizeIdentity(edge.source));
    usedNames.add(normalizeIdentity(edge.target));
  });
  const edgeOnlyNodes = Array.from(usedNames)
    .filter((name) => !nodes.some((node) => normalizeIdentity(node.name) === name))
    .map((name) => ({ id: name, name, nodeType: "Controller", sectorOrState: null, networkRole: null, sourceSheet: "edges", original: {} }));
  const graphNodes = [...nodes.filter((node) => usedNames.has(normalizeIdentity(node.name))), ...edgeOnlyNodes];
  const points = new Map<string, { x: number; y: number }>();
  const centerX = 375;
  const centerY = 180;
  const radiusX = 290;
  const radiusY = 126;

  graphNodes.forEach((node, index) => {
    const angle = (index / Math.max(1, graphNodes.length)) * Math.PI * 2 - Math.PI / 2;
    const isCampus = node.nodeType === "Campus";
    points.set(normalizeIdentity(node.name), {
      x: centerX + Math.cos(angle) * (isCampus ? radiusX * 0.74 : radiusX),
      y: centerY + Math.sin(angle) * (isCampus ? radiusY * 0.74 : radiusY)
    });
  });

  return { nodes: graphNodes, edges, points };
}

function colorForMorphology(morphology: string | null) {
  const normalized = normalizeIdentity(morphology);
  if (normalized.includes("security")) return STATUS_COLORS.SECURITY;
  if (normalized.includes("cloud")) return STATUS_COLORS.CLOUD;
  if (normalized.includes("parcel") || normalized.includes("speculative")) return STATUS_COLORS.PARCELIZED;
  if (normalized.includes("ruin")) return STATUS_COLORS.RUIN;
  if (normalized.includes("counter")) return STATUS_COLORS["COUNTER-USE"];
  return STATUS_COLORS["ASSET-TRANSFER"];
}
