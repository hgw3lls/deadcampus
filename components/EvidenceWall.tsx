"use client";

import { useEffect, useMemo, useState } from "react";
import type { EvidenceGraph, EvidenceGraphEdge, EvidenceGraphNode, SiteRecord } from "@/lib/data";
import { STATUS_COLORS, formatNumber, normalizeIdentity } from "@/lib/data";

type EvidenceWallProps = {
  graph: EvidenceGraph;
  sites: SiteRecord[];
};

type WallPreset = "anomalies" | "security" | "cloud" | "parcelized" | "controllers" | "missing";

type PositionedNode = EvidenceGraphNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

const boardWidth = 1180;
const boardHeight = 720;

const presetLabels: Array<{ key: WallPreset; label: string }> = [
  { key: "anomalies", label: "Anomaly wall" },
  { key: "security", label: "Security conversion" },
  { key: "cloud", label: "Cloud infrastructure" },
  { key: "parcelized", label: "Parcelized real estate" },
  { key: "controllers", label: "Controller webs" },
  { key: "missing", label: "Evidence gaps" }
];

export function EvidenceWall({ graph, sites }: EvidenceWallProps) {
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState<WallPreset>("anomalies");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const nodesById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph.nodes]);
  const siteById = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);
  const edgesByNode = useMemo(() => {
    const map = new Map<string, EvidenceGraphEdge[]>();
    graph.edges.forEach((edge) => {
      map.set(edge.source, [...(map.get(edge.source) ?? []), edge]);
      map.set(edge.target, [...(map.get(edge.target) ?? []), edge]);
    });
    return map;
  }, [graph.edges]);

  const searchResults = useMemo(() => {
    const normalized = normalizeIdentity(query);
    if (!normalized) return [];
    return graph.nodes
      .filter((node) => normalizeIdentity([node.label, node.sublabel, node.type, node.morphology, node.statusCode].filter(Boolean).join(" ")).includes(normalized))
      .slice(0, 30);
  }, [graph.nodes, query]);

  useEffect(() => {
    if (selectedNodeId && nodesById.has(selectedNodeId)) return;
    const initial = seedNodesForPreset(graph.nodes, preset)[0] ?? graph.nodes[0];
    setSelectedNodeId(initial?.id ?? null);
  }, [graph.nodes, nodesById, preset, selectedNodeId]);

  const selectedNode = selectedNodeId ? nodesById.get(selectedNodeId) ?? null : null;

  const wall = useMemo(() => {
    const seedIds = selectedNode
      ? [selectedNode.id]
      : seedNodesForPreset(graph.nodes, preset)
          .slice(0, 10)
          .map((node) => node.id);
    return buildWallView(seedIds, graph.edges, nodesById, preset);
  }, [graph.edges, graph.nodes, nodesById, preset, selectedNode]);

  const selectedEdge = selectedEdgeId ? wall.edges.find((edge) => edge.id === selectedEdgeId) ?? null : null;
  const selectedSourceSites = selectedNode?.sourceIds.map((id) => siteById.get(id)).filter(Boolean) as SiteRecord[] | undefined;

  return (
    <section className="atlas-panel evidence-wall min-h-[calc(100vh-154px)] overflow-hidden">
      <div className="grid border-b border-atlas-ink lg:grid-cols-[1fr_360px]">
        <div className="p-4">
          <div className="atlas-label text-atlas-muted">Evidence wall / derived relationship graph</div>
          <h2 className="mt-1 text-3xl font-black uppercase leading-none md:text-5xl">Closure Conspiracy Index</h2>
          <p className="mt-2 max-w-4xl font-mono text-[11px] uppercase leading-4">
            Campuses, controllers, years, root OPEIDs, morphologies, status codes, source hosts, and missing-evidence fields are rendered as an investigative graph.
          </p>
        </div>
        <div className="grid grid-cols-3 border-t border-atlas-ink font-mono text-[10px] uppercase lg:border-l lg:border-t-0">
          <WallMetric label="Nodes" value={formatNumber(graph.stats.nodeCount)} />
          <WallMetric label="Edges" value={formatNumber(graph.stats.edgeCount)} />
          <WallMetric label="Gaps" value={formatNumber(graph.stats.missingEvidenceCount)} />
        </div>
      </div>

      <div className="grid min-h-[720px] lg:grid-cols-[260px_minmax(0,1fr)_330px]">
        <aside className="border-b border-atlas-ink bg-atlas-paper/90 p-3 lg:border-b-0 lg:border-r">
          <label className="block">
            <span className="atlas-label text-atlas-muted">Focus search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="campus, buyer, OPEID, state"
              className="mt-1 w-full border border-atlas-ink bg-atlas-paper px-2 py-2 font-mono text-xs outline-none"
            />
          </label>

          <div className="mt-3 grid gap-1">
            {presetLabels.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setPreset(item.key);
                  setSelectedEdgeId(null);
                  setSelectedNodeId(seedNodesForPreset(graph.nodes, item.key)[0]?.id ?? null);
                }}
                className={`border border-atlas-ink px-2 py-2 text-left font-mono text-[11px] uppercase ${
                  preset === item.key ? "bg-atlas-ink text-atlas-paper" : "bg-atlas-paper"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-3 border border-atlas-ink">
            <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-label">Search hits</div>
            <div className="scrollbar-thin max-h-[390px] overflow-auto divide-y divide-atlas-soft">
              {(searchResults.length ? searchResults : seedNodesForPreset(graph.nodes, preset).slice(0, 18)).map((node) => (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                  }}
                  className={`block w-full px-2 py-2 text-left font-mono text-[11px] uppercase ${
                    selectedNodeId === node.id ? "bg-atlas-ink text-atlas-paper" : "bg-atlas-paper"
                  }`}
                >
                  <div className="font-black">{node.label}</div>
                  <div className="text-[10px] opacity-70">{node.type} / {node.size} links / score {node.score}</div>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="scrollbar-thin overflow-auto bg-atlas-soft/70 p-3">
          <div className="evidence-board relative mx-auto" style={{ width: boardWidth, height: boardHeight }}>
            <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${boardWidth} ${boardHeight}`} aria-label="Evidence relationship lines">
              <defs>
                <filter id="thread-shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.1" floodColor="#111111" floodOpacity="0.28" />
                </filter>
              </defs>
              {wall.edges.map((edge) => {
                const source = wall.positions.get(edge.source);
                const target = wall.positions.get(edge.target);
                if (!source || !target) return null;
                return (
                  <g key={edge.id}>
                    <line
                      x1={source.x + source.width / 2}
                      y1={source.y + source.height / 2}
                      x2={target.x + target.width / 2}
                      y2={target.y + target.height / 2}
                      stroke={edgeColor(edge)}
                      strokeWidth={Math.min(6, 1 + edge.weight * 0.6)}
                      strokeDasharray={edge.confidence === "missing" ? "7 6" : edge.confidence === "inferred" ? "2 5" : undefined}
                      opacity={selectedEdgeId && selectedEdgeId !== edge.id ? 0.18 : 0.74}
                      filter="url(#thread-shadow)"
                      onClick={() => setSelectedEdgeId(edge.id)}
                      className="cursor-pointer"
                    />
                    <circle
                      cx={(source.x + target.x + source.width / 2 + target.width / 2) / 2}
                      cy={(source.y + target.y + source.height / 2 + target.height / 2) / 2}
                      r={selectedEdgeId === edge.id ? 5 : 3}
                      fill={edgeColor(edge)}
                      stroke="#111111"
                    />
                  </g>
                );
              })}
            </svg>

            {wall.nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => {
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                }}
                className={`evidence-card absolute text-left ${selectedNodeId === node.id ? "evidence-card--selected" : ""}`}
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  minHeight: node.height,
                  borderColor: colorForNode(node)
                }}
              >
                <div className="flex items-start justify-between gap-2 border-b border-atlas-ink pb-1">
                  <span className="font-mono text-[9px] uppercase text-atlas-muted">{node.type}</span>
                  <span className="font-mono text-[9px] uppercase">{node.size}x</span>
                </div>
                <div className="mt-2 font-mono text-[12px] font-black uppercase leading-4">{node.label}</div>
                {node.sublabel ? <div className="mt-1 font-mono text-[10px] uppercase leading-3 text-atlas-muted">{node.sublabel}</div> : null}
                <div className="mt-2 flex flex-wrap gap-1">
                  {node.statusCode ? <Stamp label={node.statusCode} color={STATUS_COLORS[node.statusCode]} /> : null}
                  {node.score >= 70 ? <Stamp label="HIGH PRIORITY" color="#b9851f" /> : null}
                </div>
              </button>
            ))}
          </div>
        </div>

        <aside className="border-t border-atlas-ink bg-atlas-paper/95 p-3 lg:border-l lg:border-t-0">
          <div className="atlas-label text-atlas-muted">Connection inspector</div>
          {selectedEdge ? <EdgeInspector edge={selectedEdge} nodesById={nodesById} /> : null}
          {selectedNode ? <NodeInspector node={selectedNode} edges={edgesByNode.get(selectedNode.id) ?? []} sites={selectedSourceSites ?? []} /> : null}
        </aside>
      </div>
    </section>
  );
}

function buildWallView(seedIds: string[], edges: EvidenceGraphEdge[], nodesById: Map<string, EvidenceGraphNode>, preset: WallPreset) {
  const selectedSeed = seedIds[0] ?? "";
  const nodeIds = new Set(seedIds);
  const firstDegree = edges
    .filter((edge) => seedIds.includes(edge.source) || seedIds.includes(edge.target))
    .sort(edgeSortForPreset(preset))
    .slice(0, 70);

  firstDegree.forEach((edge) => {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  });

  const secondDegreeSeeds = Array.from(nodeIds).slice(0, 18);
  const secondDegree = edges
    .filter((edge) => secondDegreeSeeds.includes(edge.source) || secondDegreeSeeds.includes(edge.target))
    .filter((edge) => !firstDegree.some((first) => first.id === edge.id))
    .sort(edgeSortForPreset(preset))
    .slice(0, 45);
  secondDegree.forEach((edge) => {
    if (nodeIds.size < 72) {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  });

  const viewEdges = [...firstDegree, ...secondDegree].filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)).slice(0, 110);
  const viewNodes = Array.from(nodeIds)
    .map((id) => nodesById.get(id))
    .filter(Boolean) as EvidenceGraphNode[];

  const ordered = viewNodes.sort((a, b) => {
    if (a.id === selectedSeed) return -1;
    if (b.id === selectedSeed) return 1;
    return b.score - a.score || b.size - a.size || a.label.localeCompare(b.label);
  });

  const positioned = ordered.slice(0, 72).map((node, index) => positionNode(node, index, ordered.length));
  const positions = new Map(positioned.map((node) => [node.id, node]));

  return { nodes: positioned, edges: viewEdges, positions };
}

function positionNode(node: EvidenceGraphNode, index: number, total: number): PositionedNode {
  const width = node.type === "campus" ? 190 : node.type === "buyer" ? 180 : 150;
  const height = node.type === "campus" ? 112 : 92;
  if (index === 0) {
    return { ...node, x: 496, y: 296, width: 210, height: 126 };
  }
  const ring = index <= 18 ? 1 : index <= 42 ? 2 : 3;
  const ringIndex = ring === 1 ? index - 1 : ring === 2 ? index - 19 : index - 43;
  const ringCount = ring === 1 ? Math.min(18, total - 1) : ring === 2 ? Math.min(24, total - 19) : Math.max(1, total - 43);
  const angle = (ringIndex / Math.max(1, ringCount)) * Math.PI * 2 - Math.PI / 2 + ring * 0.17;
  const radiusX = ring === 1 ? 270 : ring === 2 ? 430 : 545;
  const radiusY = ring === 1 ? 172 : ring === 2 ? 270 : 326;
  const jitter = deterministicJitter(node.id);
  const x = clamp(590 + Math.cos(angle) * radiusX - width / 2 + jitter.x, 18, boardWidth - width - 18);
  const y = clamp(360 + Math.sin(angle) * radiusY - height / 2 + jitter.y, 18, boardHeight - height - 18);
  return { ...node, x, y, width, height };
}

function seedNodesForPreset(nodes: EvidenceGraphNode[], preset: WallPreset): EvidenceGraphNode[] {
  const filtered = nodes.filter((node) => {
    if (preset === "security") return node.statusCode === "SECURITY" || normalizeIdentity(node.morphology).includes("security") || normalizeIdentity(node.label).includes("security");
    if (preset === "cloud") return node.statusCode === "CLOUD" || normalizeIdentity(node.morphology).includes("cloud") || normalizeIdentity(node.label).includes("cloud");
    if (preset === "parcelized") return node.statusCode === "PARCELIZED" || normalizeIdentity(node.morphology).includes("parcel") || normalizeIdentity(node.label).includes("parcel");
    if (preset === "controllers") return node.type === "buyer";
    if (preset === "missing") return node.type === "missingEvidence" || node.score >= 70;
    return node.type === "campus" && (node.score >= 70 || ["SECURITY", "CLOUD", "PARCELIZED"].includes(node.statusCode ?? ""));
  });
  return filtered.sort((a, b) => b.score - a.score || b.size - a.size || a.label.localeCompare(b.label));
}

function edgeSortForPreset(preset: WallPreset) {
  return (a: EvidenceGraphEdge, b: EvidenceGraphEdge) => {
    const edgeWeight = (edge: EvidenceGraphEdge) => {
      if (preset === "missing" && edge.type === "missing_evidence") return 1000 + edge.weight;
      if (preset === "controllers" && edge.type === "controlled_by") return 1000 + edge.weight;
      if (edge.type === "explicit_network") return 800 + edge.weight;
      return edge.weight;
    };
    return edgeWeight(b) - edgeWeight(a);
  };
}

function deterministicJitter(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return {
    x: ((hash % 41) - 20) * 0.9,
    y: (((hash >> 8) % 41) - 20) * 0.9
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function WallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-r border-atlas-ink p-3">
      <div className="text-atlas-muted">{label}</div>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  );
}

function Stamp({ label, color }: { label: string; color: string }) {
  return (
    <span className="border border-atlas-ink px-1 py-0.5 font-mono text-[9px] uppercase" style={{ color }}>
      {label}
    </span>
  );
}

function EdgeInspector({ edge, nodesById }: { edge: EvidenceGraphEdge; nodesById: Map<string, EvidenceGraphNode> }) {
  return (
    <div className="mt-3 border border-atlas-ink">
      <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-label">Selected thread</div>
      <div className="p-3 font-mono text-[11px] uppercase leading-4">
        <div className="font-black">{edge.type}</div>
        <div className="mt-2">{nodesById.get(edge.source)?.label ?? edge.source}</div>
        <div>→ {nodesById.get(edge.target)?.label ?? edge.target}</div>
        <div className="mt-2 text-atlas-muted">{edge.reason}</div>
        <div className="mt-2">Confidence: {edge.confidence}</div>
        <div>Weight: {edge.weight}</div>
      </div>
    </div>
  );
}

function NodeInspector({ node, edges, sites }: { node: EvidenceGraphNode; edges: EvidenceGraphEdge[]; sites: SiteRecord[] }) {
  return (
    <div className="mt-3 border border-atlas-ink">
      <div className="border-b border-atlas-ink bg-atlas-soft px-2 py-1 atlas-label">Selected card</div>
      <div className="p-3 font-mono text-[11px] uppercase leading-4">
        <div className="text-atlas-muted">{node.type}</div>
        <div className="mt-1 text-lg font-black leading-5">{node.label}</div>
        {node.sublabel ? <div className="mt-1 text-atlas-muted">{node.sublabel}</div> : null}
        <div className="mt-3 grid grid-cols-2 border border-atlas-ink">
          <div className="border-b border-r border-atlas-ink p-2">
            <div className="text-atlas-muted">Score</div>
            <div className="font-black">{node.score}</div>
          </div>
          <div className="border-b border-atlas-ink p-2">
            <div className="text-atlas-muted">Weight</div>
            <div className="font-black">{node.size}</div>
          </div>
          <div className="border-r border-atlas-ink p-2">
            <div className="text-atlas-muted">Edges</div>
            <div className="font-black">{edges.length}</div>
          </div>
          <div className="p-2">
            <div className="text-atlas-muted">Sources</div>
            <div className="font-black">{node.sourceIds.length}</div>
          </div>
        </div>
        {sites.length ? (
          <div className="mt-3 border border-atlas-ink">
            <div className="border-b border-atlas-ink px-2 py-1 atlas-label">Source campuses</div>
            <div className="max-h-[190px] overflow-auto divide-y divide-atlas-soft">
              {sites.slice(0, 8).map((site) => (
                <div key={site.id} className="px-2 py-2">
                  <div className="font-black">{site.name}</div>
                  <div className="text-atlas-muted">{[site.city, site.state, site.closureYear, site.morphology].filter(Boolean).join(" / ")}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function edgeColor(edge: EvidenceGraphEdge) {
  if (edge.confidence === "missing") return "#9d2b2b";
  if (edge.type === "controlled_by" || edge.type === "explicit_network") return "#111111";
  if (edge.type === "classified_as") return "#77667d";
  if (edge.type === "status_code") return "#607283";
  return "#6f625d";
}

function colorForNode(node: EvidenceGraphNode) {
  if (node.statusCode) return STATUS_COLORS[node.statusCode];
  if (node.type === "missingEvidence") return "#9d2b2b";
  if (node.type === "buyer") return "#111111";
  if (node.type === "rootOpeid") return "#77667d";
  if (node.type === "source") return "#607283";
  return "#2f2f2f";
}
