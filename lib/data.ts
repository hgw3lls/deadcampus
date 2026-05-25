export type StatusCode =
  | "ACTIVE-RISK"
  | "CLOSURE-EVENT"
  | "ASSET-TRANSFER"
  | "PARCELIZED"
  | "CLOUD"
  | "SECURITY"
  | "RUIN"
  | "COUNTER-USE";

export type SiteRecord = {
  id: string;
  dedupeKey: string;
  sourceSheet: string;
  sourceSheets: string[];
  rowIndex: number;
  atlasScale: string | null;
  name: string;
  institution: string | null;
  schoolName: string | null;
  location: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  region: string | null;
  closureYear: number | null;
  closedDate: string | null;
  latitude: number | null;
  longitude: number | null;
  hasCoordinates: boolean;
  morphology: string | null;
  afterlifeStatus: string | null;
  buyerController: string | null;
  salePrice: string | number | null;
  acreage: string | number | null;
  researchPriority: string | null;
  researchPriorityScore: number;
  sourceUrl: string | null;
  status: string | null;
  statusCode: StatusCode;
  reuseType: string | null;
  campusType: string | null;
  sector: string | null;
  transformation: string | null;
  verification: string | null;
  notes: string | null;
  scale: string | null;
  opeid8: string | null;
  rootOpeid6: string | null;
  branchSuffix: string | null;
  isMainCampus: boolean | null;
  campusMarker: "main" | "branch" | "peps" | "curated" | "site";
  missingFields: string[];
  original: Record<string, string | number | boolean | null>;
};

export type NodeRecord = {
  id: string;
  name: string;
  nodeType: string | null;
  sectorOrState: string | null;
  networkRole: string | null;
  sourceSheet: string;
  original: Record<string, string | number | boolean | null>;
};

export type EdgeRecord = {
  id: string;
  source: string;
  target: string;
  relationship: string | null;
  morphology: string | null;
  salePrice: string | number | null;
  transformation: string | null;
  sourceSheet: string;
  original: Record<string, string | number | boolean | null>;
};

export type ResearchQueueRecord = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  closureYear: number | null;
  morphology: string | null;
  afterlifeStatus: string | null;
  buyerController: string | null;
  sourceUrl: string | null;
  verification: string | null;
  hasCoordinates: boolean;
  sourceSheet: string;
  sourceSheets: string[];
  missingFields: string[];
  researchPriorityScore: number;
  statusCode: StatusCode;
};

export type EvidenceGraphNode = {
  id: string;
  type: "campus" | "buyer" | "state" | "year" | "morphology" | "status" | "rootOpeid" | "missingEvidence" | "source" | "external";
  label: string;
  sublabel: string | null;
  statusCode: StatusCode | null;
  morphology: string | null;
  score: number;
  size: number;
  sourceIds: string[];
};

export type EvidenceGraphEdge = {
  id: string;
  source: string;
  target: string;
  type:
    | "closed_in_year"
    | "same_root_opeid"
    | "located_in_state"
    | "classified_as"
    | "status_code"
    | "controlled_by"
    | "missing_evidence"
    | "evidenced_by"
    | "explicit_network";
  confidence: "confirmed" | "derived" | "inferred" | "missing";
  reason: string;
  sourceSheet: string;
  weight: number;
  sourceIds: string[];
};

export type EvidenceGraphCluster = {
  id: string;
  label: string;
  clusterType: "state" | "buyer" | "morphology" | "status" | "research";
  nodeIds: string[];
};

export type EvidenceGraph = {
  generatedAt: string;
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
  clusters: EvidenceGraphCluster[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    campusCount: number;
    buyerCount: number;
    missingEvidenceCount: number;
  };
};

export type SummaryData = {
  generatedAt: string;
  workbookPath: string;
  workbookFile: string;
  totalRecords: number;
  coordinateCount: number;
  missingCoordinateCount: number;
  unresolvedAfterlifeCount: number;
  yearRange: { min: number | null; max: number | null };
  closureByYear: Record<string, number>;
  closureByDecade: Record<string, number>;
  countsByState: Record<string, number>;
  topStates: Array<{ key: string; count: number }>;
  morphologyCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  sectorCounts: Record<string, number>;
  campusTypeCounts: Record<string, number>;
  afterlifeCounts: Record<string, number>;
  sourceSheetCounts: Record<string, number>;
  researchPriorityCounts: Record<string, number>;
  phaseSheets: Record<string, Array<Record<string, string | number | boolean | null>>>;
};

export type AtlasData = {
  sites: SiteRecord[];
  summary: SummaryData;
  nodes: NodeRecord[];
  edges: EdgeRecord[];
  researchQueue: ResearchQueueRecord[];
};

export type FilterState = {
  query: string;
  yearMin: number | null;
  yearMax: number | null;
  state: string;
  morphology: string;
  sector: string;
  campusType: string;
  afterlifeStatus: string;
  statusCode: string;
  researchPriority: string;
  coordinatesOnly: boolean;
};

export type FilterOptions = {
  states: string[];
  morphologies: string[];
  sectors: string[];
  campusTypes: string[];
  afterlifeStatuses: string[];
  statusCodes: string[];
  researchPriorityBands: string[];
};

export const STATUS_COLORS: Record<StatusCode, string> = {
  "ACTIVE-RISK": "#b9851f",
  "CLOSURE-EVENT": "#111111",
  "ASSET-TRANSFER": "#607283",
  PARCELIZED: "#77667d",
  CLOUD: "#4fb2c4",
  SECURITY: "#9d2b2b",
  RUIN: "#3c3c3c",
  "COUNTER-USE": "#3f7f4a"
};

export const STATUS_LABELS: Array<{ key: StatusCode; label: string }> = [
  { key: "ACTIVE-RISK", label: "ACTIVE-RISK" },
  { key: "CLOSURE-EVENT", label: "CLOSURE-EVENT" },
  { key: "ASSET-TRANSFER", label: "ASSET-TRANSFER" },
  { key: "PARCELIZED", label: "PARCELIZED" },
  { key: "CLOUD", label: "CLOUD" },
  { key: "SECURITY", label: "SECURITY" },
  { key: "RUIN", label: "RUIN" },
  { key: "COUNTER-USE", label: "COUNTER-USE" }
];

export const DEFAULT_FILTERS: FilterState = {
  query: "",
  yearMin: null,
  yearMax: null,
  state: "ALL",
  morphology: "ALL",
  sector: "ALL",
  campusType: "ALL",
  afterlifeStatus: "ALL",
  statusCode: "ALL",
  researchPriority: "ALL",
  coordinatesOnly: false
};

const DATA_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const dataUrl = (path: string) => `${DATA_BASE_PATH}${path}`;

export async function loadAtlasData(): Promise<AtlasData> {
  const [sites, summary, nodes, edges, researchQueue] = await Promise.all([
    fetch(dataUrl("/data/sites.json")).then((response) => response.json() as Promise<SiteRecord[]>),
    fetch(dataUrl("/data/summary.json")).then((response) => response.json() as Promise<SummaryData>),
    fetch(dataUrl("/data/nodes.json")).then((response) => response.json() as Promise<NodeRecord[]>),
    fetch(dataUrl("/data/edges.json")).then((response) => response.json() as Promise<EdgeRecord[]>),
    fetch(dataUrl("/data/research_queue.json")).then((response) => response.json() as Promise<ResearchQueueRecord[]>)
  ]);

  return { sites, summary, nodes, edges, researchQueue };
}

export async function loadEvidenceGraph(): Promise<EvidenceGraph> {
  return fetch(dataUrl("/data/graph.json")).then((response) => response.json() as Promise<EvidenceGraph>);
}

export function normalizeIdentity(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function priorityBand(score: number): "High" | "Medium" | "Low" | "Resolved" {
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  if (score > 0) return "Low";
  return "Resolved";
}

export function filterSites(sites: SiteRecord[], filters: FilterState): SiteRecord[] {
  const query = normalizeIdentity(filters.query);

  return sites.filter((site) => {
    if (query) {
      const haystack = normalizeIdentity(
        [
          site.name,
          site.schoolName,
          site.institution,
          site.city,
          site.state,
          site.address,
          site.buyerController,
          site.transformation,
          site.notes,
          site.opeid8
        ]
          .filter(Boolean)
          .join(" ")
      );
      if (!haystack.includes(query)) return false;
    }
    if (filters.yearMin !== null && (site.closureYear === null || site.closureYear < filters.yearMin)) return false;
    if (filters.yearMax !== null && (site.closureYear === null || site.closureYear > filters.yearMax)) return false;
    if (filters.state !== "ALL" && site.state !== filters.state) return false;
    if (filters.morphology !== "ALL" && (site.morphology ?? "Unclassified") !== filters.morphology) return false;
    if (filters.sector !== "ALL" && (site.sector ?? "Unknown") !== filters.sector) return false;
    if (filters.campusType !== "ALL" && (site.campusType ?? "Unknown") !== filters.campusType) return false;
    if (filters.afterlifeStatus !== "ALL" && (site.afterlifeStatus ?? site.reuseType ?? "Unresolved") !== filters.afterlifeStatus) return false;
    if (filters.statusCode !== "ALL" && site.statusCode !== filters.statusCode) return false;
    if (filters.researchPriority !== "ALL" && priorityBand(site.researchPriorityScore) !== filters.researchPriority) return false;
    if (filters.coordinatesOnly && !site.hasCoordinates) return false;
    return true;
  });
}

export function getFilterOptions(sites: SiteRecord[]): FilterOptions {
  const unique = (values: Array<string | null | undefined>) =>
    Array.from(new Set(values.map((value) => value ?? "Unknown").filter(Boolean))).sort((a, b) => a.localeCompare(b));

  return {
    states: unique(sites.map((site) => site.state)),
    morphologies: unique(sites.map((site) => site.morphology ?? "Unclassified")),
    sectors: unique(sites.map((site) => site.sector ?? "Unknown")),
    campusTypes: unique(sites.map((site) => site.campusType ?? "Unknown")),
    afterlifeStatuses: unique(sites.map((site) => site.afterlifeStatus ?? site.reuseType ?? "Unresolved")),
    statusCodes: STATUS_LABELS.map((status) => status.key),
    researchPriorityBands: ["High", "Medium", "Low", "Resolved"]
  };
}

export function countBy<T>(items: T[], getKey: (item: T) => string | null | undefined): Array<{ key: string; count: number }> {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item) || "Unknown";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

export function timelineRows(sites: SiteRecord[]): Array<{ year: number; count: number; decade: string }> {
  const counts = sites.reduce<Record<number, number>>((acc, site) => {
    if (site.closureYear !== null) {
      acc[site.closureYear] = (acc[site.closureYear] ?? 0) + 1;
    }
    return acc;
  }, {});
  const years = Object.keys(counts).map(Number);
  if (!years.length) return [];
  const min = Math.min(...years);
  const max = Math.max(...years);
  const rows: Array<{ year: number; count: number; decade: string }> = [];
  for (let year = min; year <= max; year += 1) {
    rows.push({ year, count: counts[year] ?? 0, decade: `${Math.floor(year / 10) * 10}s` });
  }
  return rows;
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function compactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatMaybe(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") return formatNumber(value);
  return String(value);
}

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return "";
  const headers = Array.from(rows.reduce<Set<string>>((acc, row) => {
    Object.keys(row).forEach((key) => acc.add(key));
    return acc;
  }, new Set()));
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = Array.isArray(value) ? value.join("; ") : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
