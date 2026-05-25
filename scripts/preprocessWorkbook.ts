import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

type Primitive = string | number | boolean | null;
type SourceRow = Record<string, Primitive>;

type SiteRecord = {
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
  statusCode: string;
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
  original: SourceRow;
};

type NodeRecord = {
  id: string;
  name: string;
  nodeType: string | null;
  sectorOrState: string | null;
  networkRole: string | null;
  sourceSheet: string;
  original: SourceRow;
};

type EdgeRecord = {
  id: string;
  source: string;
  target: string;
  relationship: string | null;
  morphology: string | null;
  salePrice: string | number | null;
  transformation: string | null;
  sourceSheet: string;
  original: SourceRow;
};

type EvidenceGraphNode = {
  id: string;
  type: "campus" | "buyer" | "state" | "year" | "morphology" | "status" | "rootOpeid" | "missingEvidence" | "source" | "external";
  label: string;
  sublabel: string | null;
  statusCode: string | null;
  morphology: string | null;
  score: number;
  size: number;
  sourceIds: string[];
};

type EvidenceGraphEdge = {
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

type EvidenceGraphCluster = {
  id: string;
  label: string;
  clusterType: "state" | "buyer" | "morphology" | "status" | "research";
  nodeIds: string[];
};

type EvidenceGraph = {
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

const repoRoot = process.cwd();
const preferredWorkbook = "/mnt/data/DEAD_CAMPUS_ATLAS_MASTER_WORKBOOK.xlsx";
const fallbackWorkbook = path.join(repoRoot, "DEAD_CAMPUS_ATLAS_MASTER_WORKBOOK.xlsx");
const workbookPath = process.argv[2] ?? (fs.existsSync(preferredWorkbook) ? preferredWorkbook : fallbackWorkbook);
const outputDir = path.join(repoRoot, "public", "data");

const siteSourceSheets = new Set([
  "peps_site_retreat_cleaned",
  "dead_campus_phase9_peps_normali",
  "dead_campus_atlas__PEPS_SITE_",
  "dead_campus_master_table_v1",
  "dead_campus_master_DeadCampus",
  "dead_campus_atlas__SPATIALIZE",
  "dead_campus_atlas__PHASE2_CLA",
  "dead_campus_atlas__CURATED_IC",
  "dead_campus_atlas__AFTERLIFE_",
  "dead_campus_atlas__REPLACEMEN"
]);

const knownHeaderNames = new Set([
  "atlas_scale",
  "closed_date",
  "closed_year",
  "closure_year",
  "opeid_8",
  "institution",
  "school_name",
  "city",
  "state",
  "address",
  "latitude",
  "longitude",
  "morphology",
  "afterlife_status",
  "reuse_type",
  "buyer_or_controller",
  "source_url",
  "source",
  "target",
  "relationship",
  "node_type"
]);

const statusCodes = [
  "ACTIVE-RISK",
  "CLOSURE-EVENT",
  "ASSET-TRANSFER",
  "PARCELIZED",
  "CLOUD",
  "SECURITY",
  "RUIN",
  "COUNTER-USE"
] as const;

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function keyName(value: unknown): string {
  return normalizeHeader(value).toLowerCase();
}

function text(value: Primitive | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const next = String(value).trim();
  return next.length ? next : null;
}

function normalizeIdentity(value: string | null): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cellToPrimitive(value: unknown): Primitive {
  if (value === undefined || value === null) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

function first(row: SourceRow, names: string[]): Primitive | undefined {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name)) {
      const value = row[name];
      if (value !== null && value !== "") {
        return value;
      }
    }
  }
  return undefined;
}

function numberFrom(value: Primitive | undefined): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const cleaned = String(value).replace(/[$,~\s]/g, "");
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function yearFrom(value: Primitive | undefined): number | null {
  const parsed = numberFrom(value);
  if (parsed !== null && parsed > 1800 && parsed < 2200) {
    return Math.trunc(parsed);
  }
  const match = String(value ?? "").match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

function boolFrom(value: Primitive | undefined): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const next = String(value).trim().toLowerCase();
  if (["true", "yes", "y", "1", "main", "main/root"].includes(next)) {
    return true;
  }
  if (["false", "no", "n", "0", "branch", "branch/satellite"].includes(next)) {
    return false;
  }
  return null;
}

function displayValue(value: Primitive | undefined): string | number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return value;
}

function detectHeaderRow(rows: unknown[][]): number {
  let bestIndex = 0;
  let bestScore = -1;
  rows.slice(0, 12).forEach((row, index) => {
    const normalized = row.map((cell) => keyName(cell));
    const score = normalized.filter((cell) => knownHeaderNames.has(cell)).length;
    if (score > bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return bestScore > 0 ? bestIndex : 0;
}

function rowsForSheet(workbook: XLSX.WorkBook, sheetName: string): { rows: SourceRow[]; header: string[]; title: string | null } {
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true
  });
  const headerIndex = detectHeaderRow(rawRows);
  const rawHeader = rawRows[headerIndex] ?? [];
  const header = rawHeader.map((cell, index) => normalizeHeader(cell) || `Column_${index + 1}`);
  const title = text(cellToPrimitive(rawRows[0]?.[0]));
  const rows: SourceRow[] = [];

  for (const rawRow of rawRows.slice(headerIndex + 1)) {
    const row: SourceRow = {};
    let filled = 0;
    header.forEach((key, index) => {
      const value = cellToPrimitive(rawRow[index]);
      row[key] = value;
      if (value !== null && value !== "") {
        filled += 1;
      }
    });
    if (filled > 0) {
      rows.push(row);
    }
  }

  return { rows, header, title };
}

function statusCodeFor(site: Pick<SiteRecord, "morphology" | "afterlifeStatus" | "reuseType" | "status" | "buyerController" | "transformation" | "notes">): string {
  const haystack = [
    site.morphology,
    site.afterlifeStatus,
    site.reuseType,
    site.status,
    site.buyerController,
    site.transformation,
    site.notes
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(security|federal|coast guard|training center|police|correction|detention|defense)/.test(haystack)) {
    return "SECURITY";
  }
  if (/(cloud|data center|data infrastructure|amazon data|hyperscale|server)/.test(haystack)) {
    return "CLOUD";
  }
  if (/(parcel|subdivid|auction|speculative|real estate|land bank|liquidation)/.test(haystack)) {
    return "PARCELIZED";
  }
  if (/(sold|sale|transfer|buyer|acquired|purchased|controller|ownership)/.test(haystack) || site.buyerController) {
    return "ASSET-TRANSFER";
  }
  if (/(ruin|vacant|abandoned|demolish|demolition|mothball|empty)/.test(haystack)) {
    return "RUIN";
  }
  if (/(community|counter|commons|tribal|public use|mutual aid|cooperative)/.test(haystack)) {
    return "COUNTER-USE";
  }
  if (/(risk|teach.?out|probation|monitor|active)/.test(haystack)) {
    return "ACTIVE-RISK";
  }
  return "CLOSURE-EVENT";
}

function missingFieldsFor(site: Omit<SiteRecord, "missingFields" | "researchPriorityScore" | "statusCode" | "campusMarker">): string[] {
  const missing: string[] = [];
  if (!site.hasCoordinates) missing.push("coordinates");
  if (!site.buyerController) missing.push("buyerController");
  if (!site.afterlifeStatus && !site.reuseType) missing.push("afterlifeStatus");
  if (!site.sourceUrl) missing.push("sourceUrl");
  if (!site.morphology) missing.push("morphology");
  if (!site.verification) missing.push("verification");
  if (!site.closureYear) missing.push("closureYear");
  return missing;
}

function priorityScore(missingFields: string[], site: Pick<SiteRecord, "researchPriority" | "atlasScale" | "sourceSheet" | "campusType" | "isMainCampus">): number {
  const weights: Record<string, number> = {
    coordinates: 24,
    buyerController: 18,
    afterlifeStatus: 18,
    sourceUrl: 12,
    morphology: 14,
    verification: 8,
    closureYear: 6
  };
  let score = missingFields.reduce((sum, field) => sum + (weights[field] ?? 5), 0);
  const priority = normalizeIdentity(site.researchPriority);
  if (priority.includes("iconic") || priority.includes("high")) score += 18;
  if (priority.includes("medium")) score += 8;
  if (normalizeIdentity(site.atlasScale).includes("spatial")) score += 10;
  if (normalizeIdentity(site.campusType).includes("main") || site.isMainCampus) score += 6;
  if (site.sourceSheet.toLowerCase().includes("peps")) score += 3;
  return Math.min(100, score);
}

function markerFor(site: Pick<SiteRecord, "sourceSheet" | "isMainCampus" | "campusType" | "researchPriority" | "atlasScale">): SiteRecord["campusMarker"] {
  const scope = normalizeIdentity([site.sourceSheet, site.campusType, site.researchPriority, site.atlasScale].filter(Boolean).join(" "));
  if (scope.includes("iconic") || scope.includes("spatialized")) return "curated";
  if (site.isMainCampus || scope.includes("main")) return "main";
  if (scope.includes("branch") || site.isMainCampus === false) return "branch";
  if (scope.includes("peps")) return "peps";
  return "site";
}

function siteFromRow(row: SourceRow, sourceSheet: string, rowIndex: number): SiteRecord | null {
  const institution = text(first(row, ["Institution", "ATLAS_INSTITUTION_NAME"]));
  const schoolName = text(first(row, ["School_Name", "Location"]));
  const name = institution ?? schoolName ?? text(first(row, ["Name"]));
  const state = text(first(row, ["State", "ATLAS_STATE"]));
  const city = text(first(row, ["City", "ATLAS_CITY"]));

  if (!name || (!state && !city && !first(row, ["OPEID_8", "ATLAS_OPEID_RAW"]))) {
    return null;
  }

  const latitude = numberFrom(first(row, ["Latitude", "Lat"]));
  const longitude = numberFrom(first(row, ["Longitude", "Lon", "Lng"]));
  const closureYear = yearFrom(first(row, ["Closed_Year", "Closure_Year", "ATLAS_CLOSURE_YEAR"]));
  const closedDate = text(first(row, ["Closed_Date", "Closure_Date"]));
  const afterlifeStatus = text(first(row, ["Afterlife_Status", "Reuse_Type"]));
  const reuseType = text(first(row, ["Reuse_Type", "Afterlife_Status"]));
  const morphology = text(first(row, ["Morphology", "ATLAS_PRELIMINARY_CLASS"]));
  const buyerController = text(first(row, ["Buyer_or_Controller", "Buyer_Controller", "Controller"]));
  const sourceUrl = text(first(row, ["Source_URL", "Source", "URL"]));
  const campusType = text(first(row, ["Campus_Type", "ATLAS_SITE_TYPE"]));
  const isMainCampus = boolFrom(first(row, ["Is_Main_Campus_OPEID00"]));

  const base = {
    id: "",
    dedupeKey: "",
    sourceSheet,
    sourceSheets: [sourceSheet],
    rowIndex,
    atlasScale: text(first(row, ["Atlas_Scale", "Atlas_Priority"])),
    name,
    institution,
    schoolName,
    location: text(first(row, ["Location"])),
    address: text(first(row, ["Address", "ATLAS_ADDRESS"])),
    city,
    state,
    zipCode: text(first(row, ["Zip_Code", "ZIP", "Postal_Code"])),
    region: text(first(row, ["Region"])),
    closureYear,
    closedDate,
    latitude,
    longitude,
    hasCoordinates: latitude !== null && longitude !== null,
    morphology,
    afterlifeStatus,
    buyerController,
    salePrice: displayValue(first(row, ["Sale_Price"])),
    acreage: displayValue(first(row, ["Acreage"])),
    researchPriority: text(first(row, ["Research_Priority", "Atlas_Priority"])),
    sourceUrl,
    status: text(first(row, ["Status"])),
    reuseType,
    campusType,
    sector: text(first(row, ["Sector"])),
    transformation: text(first(row, ["Transformation"])),
    verification: text(first(row, ["Verification"])),
    notes: text(first(row, ["Notes"])),
    scale: text(first(row, ["Scale"])),
    opeid8: text(first(row, ["OPEID_8", "ATLAS_OPEID_RAW"])),
    rootOpeid6: text(first(row, ["Root_OPEID_6", "ATLAS_OPEID_ROOT"])),
    branchSuffix: text(first(row, ["Branch_Suffix", "ATLAS_BRANCH_SUFFIX"])),
    isMainCampus,
    original: row
  };
  const missingFields = missingFieldsFor(base);
  const statusCode = statusCodeFor(base);
  const campusMarker = markerFor(base);
  const dedupeKey = base.opeid8
    ? `opeid:${base.opeid8}`
    : `site:${normalizeIdentity(name)}|${normalizeIdentity(city)}|${normalizeIdentity(state)}|${closureYear ?? ""}`;

  return {
    ...base,
    id: dedupeKey,
    dedupeKey,
    statusCode,
    campusMarker,
    missingFields,
    researchPriorityScore: priorityScore(missingFields, base)
  };
}

function mergeSite(existing: SiteRecord, incoming: SiteRecord): SiteRecord {
  const merged: SiteRecord = {
    ...existing,
    sourceSheets: Array.from(new Set([...existing.sourceSheets, ...incoming.sourceSheets])),
    original: { ...incoming.original, ...existing.original }
  };

  for (const key of Object.keys(incoming) as Array<keyof SiteRecord>) {
    if (["id", "dedupeKey", "sourceSheet", "sourceSheets", "original", "missingFields", "researchPriorityScore", "statusCode", "campusMarker"].includes(key)) {
      continue;
    }
    const current = merged[key];
    const next = incoming[key];
    if ((current === null || current === "" || current === undefined || current === false) && next !== null && next !== "" && next !== undefined) {
      (merged as Record<string, unknown>)[key] = next;
    }
  }

  merged.hasCoordinates = merged.latitude !== null && merged.longitude !== null;
  merged.missingFields = missingFieldsFor(merged);
  merged.researchPriorityScore = priorityScore(merged.missingFields, merged);
  merged.statusCode = statusCodeFor(merged);
  merged.campusMarker = markerFor(merged);
  return merged;
}

function countBy<T extends string | number>(items: T[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = String(item || "Unknown");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function topEntries(counts: Record<string, number>, limit = 12): Array<{ key: string; count: number }> {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

function plainSheetObjects(rows: SourceRow[]): SourceRow[] {
  return rows.map((row) => {
    const out: SourceRow = {};
    Object.entries(row).forEach(([key, value]) => {
      if (value !== null && value !== "") {
        out[key] = value;
      }
    });
    return out;
  });
}

function parseNodes(rows: SourceRow[], sourceSheet: string): NodeRecord[] {
  return rows
    .map((row, index) => {
      const name = text(first(row, ["Name", "Node", "Institution"]));
      if (!name) return null;
      return {
        id: normalizeIdentity(name) || `node-${index}`,
        name,
        nodeType: text(first(row, ["Node_Type", "Type"])),
        sectorOrState: text(first(row, ["Sector_or_State", "Sector", "State"])),
        networkRole: text(first(row, ["Network_Role", "Role"])),
        sourceSheet,
        original: row
      };
    })
    .filter(Boolean) as NodeRecord[];
}

function parseEdges(rows: SourceRow[], sourceSheet: string): EdgeRecord[] {
  return rows
    .map((row, index) => {
      const source = text(first(row, ["Source"]));
      const target = text(first(row, ["Target"]));
      if (!source || !target) return null;
      return {
        id: `${normalizeIdentity(source)}--${normalizeIdentity(target)}--${index}`,
        source,
        target,
        relationship: text(first(row, ["Relationship"])),
        morphology: text(first(row, ["Morphology"])),
        salePrice: first(row, ["Sale_Price"]) ?? null,
        transformation: text(first(row, ["Transformation"])),
        sourceSheet,
        original: row
      };
    })
    .filter(Boolean) as EdgeRecord[];
}

function hashId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function graphId(type: EvidenceGraphNode["type"], value: string): string {
  return `${type}:${hashId(`${type}:${normalizeIdentity(value) || value}`)}`;
}

function pushUniqueLimited(values: string[], next: string, limit = 80): void {
  if (!values.includes(next) && values.length < limit) {
    values.push(next);
  }
}

function buildEvidenceGraph(sites: SiteRecord[], networkNodes: NodeRecord[], networkEdges: EdgeRecord[]): EvidenceGraph {
  const nodeMap = new Map<string, EvidenceGraphNode>();
  const edgeMap = new Map<string, EvidenceGraphEdge>();
  const siteNodeByName = new Map<string, string>();

  const addNode = (node: EvidenceGraphNode): string => {
    const existing = nodeMap.get(node.id);
    if (!existing) {
      nodeMap.set(node.id, node);
      return node.id;
    }
    existing.size += node.size;
    existing.score = Math.max(existing.score, node.score);
    existing.statusCode = existing.statusCode ?? node.statusCode;
    existing.morphology = existing.morphology ?? node.morphology;
    node.sourceIds.forEach((sourceId) => pushUniqueLimited(existing.sourceIds, sourceId));
    return existing.id;
  };

  const addEdge = (edge: Omit<EvidenceGraphEdge, "id" | "weight">): void => {
    if (edge.source === edge.target) return;
    const key = `${edge.type}:${edge.source}->${edge.target}:${edge.reason}`;
    const existing = edgeMap.get(key);
    if (!existing) {
      edgeMap.set(key, { ...edge, id: `edge:${hashId(key)}`, weight: 1 });
      return;
    }
    existing.weight += 1;
    edge.sourceIds.forEach((sourceId) => pushUniqueLimited(existing.sourceIds, sourceId));
  };

  sites.forEach((site) => {
    const siteId = graphId("campus", site.id);
    siteNodeByName.set(normalizeIdentity(site.name), siteId);
    addNode({
      id: siteId,
      type: "campus",
      label: site.name,
      sublabel: [site.city, site.state, site.closureYear].filter(Boolean).join(" / ") || null,
      statusCode: site.statusCode,
      morphology: site.morphology,
      score: site.researchPriorityScore,
      size: 1,
      sourceIds: [site.id]
    });

    const relationSourceSheet = site.sourceSheets.join(" / ");

    if (site.state) {
      const stateId = addNode({
        id: graphId("state", site.state),
        type: "state",
        label: site.state,
        sublabel: "state retreat field",
        statusCode: null,
        morphology: null,
        score: 0,
        size: 1,
        sourceIds: [site.id]
      });
      addEdge({
        source: siteId,
        target: stateId,
        type: "located_in_state",
        confidence: "derived",
        reason: `Located in ${site.state}`,
        sourceSheet: relationSourceSheet,
        sourceIds: [site.id]
      });
    }

    if (site.closureYear) {
      const yearId = addNode({
        id: graphId("year", String(site.closureYear)),
        type: "year",
        label: String(site.closureYear),
        sublabel: "closure year",
        statusCode: null,
        morphology: null,
        score: 0,
        size: 1,
        sourceIds: [site.id]
      });
      addEdge({
        source: siteId,
        target: yearId,
        type: "closed_in_year",
        confidence: "derived",
        reason: `Closed in ${site.closureYear}`,
        sourceSheet: relationSourceSheet,
        sourceIds: [site.id]
      });
    }

    if (site.morphology) {
      const morphologyId = addNode({
        id: graphId("morphology", site.morphology),
        type: "morphology",
        label: site.morphology,
        sublabel: "morphology",
        statusCode: site.statusCode,
        morphology: site.morphology,
        score: 0,
        size: 1,
        sourceIds: [site.id]
      });
      addEdge({
        source: siteId,
        target: morphologyId,
        type: "classified_as",
        confidence: "derived",
        reason: `Classified as ${site.morphology}`,
        sourceSheet: relationSourceSheet,
        sourceIds: [site.id]
      });
    }

    const statusId = addNode({
      id: graphId("status", site.statusCode),
      type: "status",
      label: site.statusCode,
      sublabel: "computed status code",
      statusCode: site.statusCode,
      morphology: null,
      score: 0,
      size: 1,
      sourceIds: [site.id]
    });
    addEdge({
      source: siteId,
      target: statusId,
      type: "status_code",
      confidence: "inferred",
      reason: `Computed status code: ${site.statusCode}`,
      sourceSheet: "preprocessWorkbook.ts",
      sourceIds: [site.id]
    });

    if (site.buyerController) {
      const buyerId = addNode({
        id: graphId("buyer", site.buyerController),
        type: "buyer",
        label: site.buyerController,
        sublabel: "buyer / controller",
        statusCode: site.statusCode,
        morphology: site.morphology,
        score: 0,
        size: 1,
        sourceIds: [site.id]
      });
      addEdge({
        source: siteId,
        target: buyerId,
        type: "controlled_by",
        confidence: "confirmed",
        reason: `Buyer/controller: ${site.buyerController}`,
        sourceSheet: relationSourceSheet,
        sourceIds: [site.id]
      });
    }

    if (site.rootOpeid6) {
      const rootId = addNode({
        id: graphId("rootOpeid", site.rootOpeid6),
        type: "rootOpeid",
        label: `OPEID ${site.rootOpeid6}`,
        sublabel: "root system",
        statusCode: null,
        morphology: null,
        score: 0,
        size: 1,
        sourceIds: [site.id]
      });
      addEdge({
        source: siteId,
        target: rootId,
        type: "same_root_opeid",
        confidence: "derived",
        reason: `Same Root OPEID: ${site.rootOpeid6}`,
        sourceSheet: relationSourceSheet,
        sourceIds: [site.id]
      });
    }

    if (site.sourceUrl) {
      const sourceLabel = sourceLabelFor(site.sourceUrl);
      const sourceId = addNode({
        id: graphId("source", sourceLabel),
        type: "source",
        label: sourceLabel,
        sublabel: "source evidence",
        statusCode: null,
        morphology: null,
        score: 0,
        size: 1,
        sourceIds: [site.id]
      });
      addEdge({
        source: siteId,
        target: sourceId,
        type: "evidenced_by",
        confidence: "confirmed",
        reason: `Source URL host: ${sourceLabel}`,
        sourceSheet: relationSourceSheet,
        sourceIds: [site.id]
      });
    }

    site.missingFields.forEach((field) => {
      const missingId = addNode({
        id: graphId("missingEvidence", field),
        type: "missingEvidence",
        label: `MISSING ${field}`,
        sublabel: "evidence gap",
        statusCode: "ACTIVE-RISK",
        morphology: null,
        score: 0,
        size: 1,
        sourceIds: [site.id]
      });
      addEdge({
        source: siteId,
        target: missingId,
        type: "missing_evidence",
        confidence: "missing",
        reason: `Missing evidence field: ${field}`,
        sourceSheet: "research_queue.json",
        sourceIds: [site.id]
      });
    });
  });

  networkNodes.forEach((node) => {
    const normalizedName = normalizeIdentity(node.name);
    if (siteNodeByName.has(normalizedName)) return;
    addNode({
      id: graphId("external", node.name),
      type: node.nodeType === "Campus" ? "campus" : "external",
      label: node.name,
      sublabel: [node.nodeType, node.sectorOrState, node.networkRole].filter(Boolean).join(" / ") || null,
      statusCode: null,
      morphology: null,
      score: 0,
      size: 1,
      sourceIds: [node.id]
    });
  });

  networkEdges.forEach((edge) => {
    const source = siteNodeByName.get(normalizeIdentity(edge.source)) ?? graphId("external", edge.source);
    const target = siteNodeByName.get(normalizeIdentity(edge.target)) ?? graphId("external", edge.target);
    if (!nodeMap.has(source)) {
      addNode({
        id: source,
        type: "external",
        label: edge.source,
        sublabel: "external network node",
        statusCode: null,
        morphology: edge.morphology,
        score: 0,
        size: 1,
        sourceIds: [edge.id]
      });
    }
    if (!nodeMap.has(target)) {
      addNode({
        id: target,
        type: "external",
        label: edge.target,
        sublabel: "external network node",
        statusCode: null,
        morphology: edge.morphology,
        score: 0,
        size: 1,
        sourceIds: [edge.id]
      });
    }
    addEdge({
      source,
      target,
      type: "explicit_network",
      confidence: "confirmed",
      reason: [edge.relationship, edge.morphology, edge.transformation].filter(Boolean).join(" / ") || "Explicit ownership network edge",
      sourceSheet: edge.sourceSheet,
      sourceIds: [edge.id]
    });
  });

  const graphNodes = Array.from(nodeMap.values()).sort((a, b) => b.score - a.score || b.size - a.size || a.label.localeCompare(b.label));
  const graphEdges = Array.from(edgeMap.values()).sort((a, b) => b.weight - a.weight || a.type.localeCompare(b.type));

  const topNodeIdsByType = (type: EvidenceGraphNode["type"], limit: number) =>
    graphNodes
      .filter((node) => node.type === type)
      .sort((a, b) => b.size - a.size || b.score - a.score)
      .slice(0, limit)
      .map((node) => node.id);

  const clusters: EvidenceGraphCluster[] = [
    ...topNodeIdsByType("state", 8).map((nodeId) => ({
      id: `cluster:state:${nodeId}`,
      label: `State cluster: ${nodeMap.get(nodeId)?.label ?? nodeId}`,
      clusterType: "state" as const,
      nodeIds: [nodeId]
    })),
    ...topNodeIdsByType("buyer", 8).map((nodeId) => ({
      id: `cluster:buyer:${nodeId}`,
      label: `Controller cluster: ${nodeMap.get(nodeId)?.label ?? nodeId}`,
      clusterType: "buyer" as const,
      nodeIds: [nodeId]
    })),
    ...topNodeIdsByType("morphology", 8).map((nodeId) => ({
      id: `cluster:morphology:${nodeId}`,
      label: `Morphology cluster: ${nodeMap.get(nodeId)?.label ?? nodeId}`,
      clusterType: "morphology" as const,
      nodeIds: [nodeId]
    }))
  ];

  return {
    generatedAt: new Date().toISOString(),
    nodes: graphNodes,
    edges: graphEdges,
    clusters,
    stats: {
      nodeCount: graphNodes.length,
      edgeCount: graphEdges.length,
      campusCount: graphNodes.filter((node) => node.type === "campus").length,
      buyerCount: graphNodes.filter((node) => node.type === "buyer").length,
      missingEvidenceCount: graphEdges.filter((edge) => edge.type === "missing_evidence").length
    }
  };
}

function sourceLabelFor(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl.slice(0, 64);
  }
}

function writeJson(fileName: string, data: unknown, pretty = true): void {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, fileName), `${pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data)}\n`);
}

if (!fs.existsSync(workbookPath)) {
  throw new Error(`Workbook not found: ${workbookPath}`);
}

const workbook = XLSX.readFile(workbookPath, { cellDates: true });
const sitesByKey = new Map<string, SiteRecord>();
let nodes: NodeRecord[] = [];
let edges: EdgeRecord[] = [];
const sheetCatalog: Array<{ name: string; rows: number; columns: number; title: string | null; headers: string[] }> = [];
const summarySheets: Record<string, SourceRow[]> = {};

for (const sheetName of workbook.SheetNames) {
  const parsed = rowsForSheet(workbook, sheetName);
  sheetCatalog.push({
    name: sheetName,
    rows: parsed.rows.length,
    columns: parsed.header.length,
    title: parsed.title,
    headers: parsed.header
  });

  const lower = sheetName.toLowerCase();
  if (siteSourceSheets.has(sheetName)) {
    parsed.rows.forEach((row, index) => {
      const site = siteFromRow(row, sheetName, index + 2);
      if (!site) return;
      const existing = sitesByKey.get(site.dedupeKey);
      sitesByKey.set(site.dedupeKey, existing ? mergeSite(existing, site) : site);
    });
  }

  if (sheetName === "dead_campus_atlas__NODES") {
    nodes = parseNodes(parsed.rows, sheetName);
  }

  if (sheetName === "dead_campus_atlas__EDGES") {
    edges = parseEdges(parsed.rows, sheetName);
  }

  if (
    lower.includes("summary") ||
    lower.includes("count") ||
    lower.includes("timeline") ||
    lower.includes("territoria") ||
    lower.includes("regional") ||
    lower.includes("replacement") ||
    lower.includes("status_cod") ||
    lower.includes("morphology")
  ) {
    summarySheets[sheetName] = plainSheetObjects(parsed.rows);
  }
}

const sites = Array.from(sitesByKey.values()).sort((a, b) => {
  const yearA = a.closureYear ?? 9999;
  const yearB = b.closureYear ?? 9999;
  return yearA - yearB || a.name.localeCompare(b.name);
});

const closureYears = sites.map((site) => site.closureYear).filter((year): year is number => year !== null);
const closureByYear = countBy(closureYears);
const closureByDecade = countBy(closureYears.map((year) => `${Math.floor(year / 10) * 10}s`));
const stateCounts = countBy(sites.map((site) => site.state ?? "Unknown"));
const morphologyCounts = countBy(sites.map((site) => site.morphology ?? "Unclassified"));
const statusCounts = countBy(sites.map((site) => site.statusCode));
const sectorCounts = countBy(sites.map((site) => site.sector ?? "Unknown"));
const campusTypeCounts = countBy(sites.map((site) => site.campusType ?? "Unknown"));
const afterlifeCounts = countBy(sites.map((site) => site.afterlifeStatus ?? site.reuseType ?? "Unresolved"));
const sourceSheetCounts = countBy(sites.flatMap((site) => site.sourceSheets));
const researchPriorityCounts = countBy(
  sites.map((site) => {
    if (site.researchPriorityScore >= 70) return "High";
    if (site.researchPriorityScore >= 40) return "Medium";
    if (site.researchPriorityScore > 0) return "Low";
    return "Resolved";
  })
);

const researchQueue = sites
  .filter((site) => site.missingFields.length > 0)
  .map((site) => ({
    id: site.id,
    name: site.name,
    city: site.city,
    state: site.state,
    closureYear: site.closureYear,
    morphology: site.morphology,
    afterlifeStatus: site.afterlifeStatus,
    buyerController: site.buyerController,
    sourceUrl: site.sourceUrl,
    verification: site.verification,
    hasCoordinates: site.hasCoordinates,
    sourceSheet: site.sourceSheet,
    sourceSheets: site.sourceSheets,
    missingFields: site.missingFields,
    researchPriorityScore: site.researchPriorityScore,
    statusCode: site.statusCode
  }))
  .sort((a, b) => b.researchPriorityScore - a.researchPriorityScore || a.name.localeCompare(b.name));

const evidenceGraph = buildEvidenceGraph(sites, nodes, edges);

const summary = {
  generatedAt: new Date().toISOString(),
  workbookPath,
  workbookFile: path.basename(workbookPath),
  totalRecords: sites.length,
  coordinateCount: sites.filter((site) => site.hasCoordinates).length,
  missingCoordinateCount: sites.filter((site) => !site.hasCoordinates).length,
  unresolvedAfterlifeCount: sites.filter((site) => !site.afterlifeStatus && !site.reuseType).length,
  yearRange: {
    min: closureYears.length ? Math.min(...closureYears) : null,
    max: closureYears.length ? Math.max(...closureYears) : null
  },
  statusCodes,
  closureByYear,
  closureByDecade,
  countsByState: stateCounts,
  topStates: topEntries(stateCounts, 16),
  morphologyCounts,
  statusCounts,
  sectorCounts,
  campusTypeCounts,
  afterlifeCounts,
  sourceSheetCounts,
  researchPriorityCounts,
  sheetCatalog,
  phaseSheets: summarySheets
};

writeJson("sites.json", sites);
writeJson("summary.json", summary);
writeJson("nodes.json", nodes);
writeJson("edges.json", edges);
writeJson("research_queue.json", researchQueue);
writeJson("graph.json", evidenceGraph, false);

console.log(
  JSON.stringify(
    {
      workbookPath,
      sites: sites.length,
      nodes: nodes.length,
      edges: edges.length,
      graphNodes: evidenceGraph.nodes.length,
      graphEdges: evidenceGraph.edges.length,
      researchQueue: researchQueue.length,
      outputDir
    },
    null,
    2
  )
);
