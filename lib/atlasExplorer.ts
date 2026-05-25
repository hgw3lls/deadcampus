import type { SiteRecord, StatusCode } from "@/lib/data";
import { normalizeIdentity } from "@/lib/data";

export type RawDeadCampusRow = Record<string, unknown>;

export type AtlasExplorerSite = {
  id: string;
  accession: string;
  name: string;
  institution: string | null;
  city: string | null;
  state: string | null;
  closureYear: number | null;
  decade: string;
  sector: string | null;
  control: string | null;
  institutionType: string | null;
  statusCode: StatusCode;
  afterlife: string | null;
  buyer: string | null;
  owner: string | null;
  source: string | null;
  latitude: number | null;
  longitude: number | null;
  originalFunction: string;
  afterlifeFunction: string;
  sourceRecord: SiteRecord | RawDeadCampusRow;
};

export type AtlasExplorerFilters = {
  state: string;
  decade: string;
  statusCode: string;
  afterlife: string;
  institutionType: string;
};

export type ReplacementEconomyCell = {
  originalFunction: string;
  afterlifeFunction: string;
  count: number;
  siteIds: string[];
};

export type OwnershipLink = {
  id: string;
  source: string;
  target: string;
  relationship: "sale" | "control" | "reuse" | "unknown";
  statusCode: StatusCode;
  siteId: string;
};

const statusCodes: StatusCode[] = ["ACTIVE-RISK", "CLOSURE-EVENT", "ASSET-TRANSFER", "PARCELIZED", "CLOUD", "SECURITY", "RUIN", "COUNTER-USE"];

export const defaultAtlasExplorerFilters: AtlasExplorerFilters = {
  state: "ALL",
  decade: "ALL",
  statusCode: "ALL",
  afterlife: "ALL",
  institutionType: "ALL"
};

export const explorerOriginalFunctions = ["liberal arts", "research", "student housing", "theology", "campus", "branch system"];

export const explorerAfterlifeFunctions = ["cloud", "security", "senior housing", "logistics", "healthcare", "charter/civic reuse", "parcelized real estate"];

export const fieldworkChecklist = [
  "campus signage",
  "administrative residue",
  "spatial evidence",
  "promotional media",
  "government traces",
  "audio"
];

export function normalizeAtlasExplorerSites(rows: Array<SiteRecord | RawDeadCampusRow>): AtlasExplorerSite[] {
  return rows.map((row, index) => normalizeAtlasExplorerSite(row, index));
}

export function normalizeAtlasExplorerSite(row: SiteRecord | RawDeadCampusRow, index: number): AtlasExplorerSite {
  if (isSiteRecord(row)) {
    const sourceText = [row.morphology, row.afterlifeStatus, row.reuseType, row.transformation, row.buyerController, row.notes, row.sector, row.campusType]
      .filter(Boolean)
      .join(" ");
    return {
      id: row.id,
      accession: row.opeid8 ?? `DCA-${String(index + 1).padStart(6, "0")}`,
      name: row.name,
      institution: row.institution,
      city: row.city,
      state: row.state,
      closureYear: row.closureYear,
      decade: decadeFor(row.closureYear),
      sector: row.sector,
      control: row.original.Control as string | null,
      institutionType: row.campusType ?? row.sector,
      statusCode: row.statusCode,
      afterlife: row.afterlifeStatus ?? row.reuseType ?? row.transformation,
      buyer: row.buyerController,
      owner: row.buyerController,
      source: row.sourceUrl,
      latitude: row.latitude,
      longitude: row.longitude,
      originalFunction: originalFunctionFor(sourceText),
      afterlifeFunction: afterlifeFunctionFor(sourceText, row.statusCode),
      sourceRecord: row
    };
  }

  const name = readString(row, ["name", "school_name", "institution", "School_Name", "Institution"]) ?? `Unidentified campus ${index + 1}`;
  const closureYear = readNumber(row, ["closure_year", "closed_year", "Closed_Year", "Closure_Year", "closureYear"]);
  const statusCode = readStatusCode(row, ["status_code", "status", "Status", "Status_Code"]);
  const afterlife = readString(row, ["afterlife", "afterlife_status", "reuse_type", "Afterlife_Status", "Reuse_Type", "transformation"]);
  const institutionType = readString(row, ["institution_type", "campus_type", "type", "Campus_Type", "Sector"]);
  const buyer = readString(row, ["buyer", "buyer_or_controller", "owner", "Buyer_or_Controller", "Owner"]);
  const sourceText = [
    name,
    institutionType,
    afterlife,
    buyer,
    readString(row, ["morphology", "Morphology"]),
    readString(row, ["notes", "Notes"])
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: readString(row, ["id", "opeid8", "OPEID_8"]) ?? `sample-${index + 1}`,
    accession: readString(row, ["opeid8", "OPEID_8", "accession"]) ?? `DCA-${String(index + 1).padStart(6, "0")}`,
    name,
    institution: readString(row, ["institution", "Institution"]),
    city: readString(row, ["city", "City"]),
    state: readString(row, ["state", "State"]),
    closureYear,
    decade: decadeFor(closureYear),
    sector: readString(row, ["sector", "Sector"]),
    control: readString(row, ["control", "Control"]),
    institutionType,
    statusCode,
    afterlife,
    buyer,
    owner: readString(row, ["owner", "Owner"]) ?? buyer,
    source: readString(row, ["source", "source_url", "Source_URL"]),
    latitude: readNumber(row, ["latitude", "lat", "Latitude"]),
    longitude: readNumber(row, ["longitude", "lon", "lng", "Longitude"]),
    originalFunction: originalFunctionFor(sourceText),
    afterlifeFunction: afterlifeFunctionFor(sourceText, statusCode),
    sourceRecord: row
  };
}

export function filterAtlasExplorerSites(sites: AtlasExplorerSite[], filters: AtlasExplorerFilters): AtlasExplorerSite[] {
  return sites.filter((site) => {
    if (filters.state !== "ALL" && (site.state ?? "Unknown") !== filters.state) return false;
    if (filters.decade !== "ALL" && site.decade !== filters.decade) return false;
    if (filters.statusCode !== "ALL" && site.statusCode !== filters.statusCode) return false;
    if (filters.afterlife !== "ALL" && (site.afterlifeFunction !== filters.afterlife && (site.afterlife ?? "Unknown") !== filters.afterlife)) return false;
    if (filters.institutionType !== "ALL" && (site.institutionType ?? "Unknown") !== filters.institutionType) return false;
    return true;
  });
}

export function buildReplacementEconomyCells(sites: AtlasExplorerSite[]): ReplacementEconomyCell[] {
  return explorerOriginalFunctions.flatMap((originalFunction) =>
    explorerAfterlifeFunctions.map((afterlifeFunction) => {
      const matchingSites = sites.filter((site) => site.originalFunction === originalFunction && site.afterlifeFunction === afterlifeFunction);
      return {
        originalFunction,
        afterlifeFunction,
        count: matchingSites.length,
        siteIds: matchingSites.map((site) => site.id)
      };
    })
  );
}

export function buildOwnershipLinks(sites: AtlasExplorerSite[]): OwnershipLink[] {
  return sites
    .filter((site) => site.buyer || site.owner || site.afterlife)
    .slice(0, 220)
    .map((site) => {
      const target = site.buyer ?? site.owner ?? site.afterlife ?? "unresolved controller";
      return {
        id: `${site.id}-${normalizeIdentity(target)}`,
        source: site.name,
        target,
        relationship: site.buyer || site.owner ? "control" : site.afterlife ? "reuse" : "unknown",
        statusCode: site.statusCode,
        siteId: site.id
      };
    });
}

export function uniqueExplorerOptions(sites: AtlasExplorerSite[], key: keyof AtlasExplorerSite): string[] {
  return Array.from(new Set(sites.map((site) => String(site[key] ?? "Unknown")).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function isSiteRecord(row: SiteRecord | RawDeadCampusRow): row is SiteRecord {
  return typeof row === "object" && row !== null && "dedupeKey" in row && "sourceSheets" in row;
}

function readString(row: RawDeadCampusRow, keys: string[]): string | null {
  const value = readValue(row, keys);
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function readNumber(row: RawDeadCampusRow, keys: string[]): number | null {
  const value = readValue(row, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readStatusCode(row: RawDeadCampusRow, keys: string[]): StatusCode {
  const value = normalizeIdentity(readString(row, keys));
  const match = statusCodes.find((code) => normalizeIdentity(code) === value);
  return match ?? "CLOSURE-EVENT";
}

function readValue(row: RawDeadCampusRow, keys: string[]): unknown {
  const direct = keys.find((key) => row[key] !== undefined && row[key] !== null);
  if (direct) return row[direct];

  const normalizedLookup = new Map(Object.keys(row).map((key) => [fieldKey(key), row[key]]));
  const normalized = keys.map(fieldKey).find((key) => normalizedLookup.has(key));
  return normalized ? normalizedLookup.get(normalized) : null;
}

function fieldKey(value: string): string {
  return normalizeIdentity(value).replace(/\s+/g, "_");
}

function decadeFor(year: number | null): string {
  if (!year) return "Unknown";
  return `${Math.floor(year / 10) * 10}s`;
}

function originalFunctionFor(value: string): string {
  const normalized = normalizeIdentity(value);
  if (/theolog|seminary|monastery/.test(normalized)) return "theology";
  if (/research|laboratory|lab|science|medical/.test(normalized)) return "research";
  if (/dorm|student housing|residence hall/.test(normalized)) return "student housing";
  if (/branch|satellite|extension/.test(normalized)) return "branch system";
  if (/liberal arts|college|humanities|arts/.test(normalized)) return "liberal arts";
  return "campus";
}

function afterlifeFunctionFor(value: string, statusCode: StatusCode): string {
  const normalized = normalizeIdentity(value);
  if (statusCode === "CLOUD" || /cloud|data center|server|comput/.test(normalized)) return "cloud";
  if (statusCode === "SECURITY" || /security|police|federal|defense|training|correction/.test(normalized)) return "security";
  if (/senior|assisted living|retirement|elder/.test(normalized)) return "senior housing";
  if (/logistics|warehouse|distribution|fulfillment/.test(normalized)) return "logistics";
  if (/health|hospital|clinic|medical/.test(normalized)) return "healthcare";
  if (/charter|civic|municipal|community|public school|k12/.test(normalized)) return "charter/civic reuse";
  if (statusCode === "PARCELIZED" || /parcel|auction|real estate|subdivid|land bank|lease/.test(normalized)) return "parcelized real estate";
  return "parcelized real estate";
}
