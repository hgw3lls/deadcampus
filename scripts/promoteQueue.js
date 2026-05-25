#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const statusCodes = new Set(["ACTIVE-RISK", "CLOSURE-EVENT", "ASSET-TRANSFER", "PARCELIZED", "CLOUD", "SECURITY", "RUIN", "COUNTER-USE"]);

const stateRegions = {
  CT: "Northeast",
  ME: "Northeast",
  MA: "Northeast",
  NH: "Northeast",
  RI: "Northeast",
  VT: "Northeast",
  NJ: "Northeast",
  NY: "Northeast",
  PA: "Northeast",
  IL: "Midwest",
  IN: "Midwest",
  MI: "Midwest",
  OH: "Midwest",
  WI: "Midwest",
  IA: "Midwest",
  KS: "Midwest",
  MN: "Midwest",
  MO: "Midwest",
  NE: "Midwest",
  ND: "Midwest",
  SD: "Midwest",
  DE: "South",
  DC: "South",
  FL: "South",
  GA: "South",
  MD: "South",
  NC: "South",
  SC: "South",
  VA: "South",
  WV: "South",
  AL: "South",
  KY: "South",
  MS: "South",
  TN: "South",
  AR: "South",
  LA: "South",
  OK: "South",
  TX: "South",
  AZ: "West",
  CO: "West",
  ID: "West",
  MT: "West",
  NV: "West",
  NM: "West",
  UT: "West",
  WY: "West",
  AK: "West",
  CA: "West",
  HI: "West",
  OR: "West",
  WA: "West",
  PR: "Territory",
  GU: "Territory"
};

const canonicalPath = resolveRepoPath(argValue("--canonical", process.env.CANONICAL_DATA_PATH || "public/data/sites.json"));
const queuePath = resolveRepoPath(argValue("--queue", process.env.QUEUE_DATA_PATH || "public/data/queue.json"));
const logPath = resolveRepoPath(argValue("--log", process.env.PROMOTION_LOG_PATH || "public/data/promotion-log.json"));

main();

function main() {
  const canonical = loadJson(canonicalPath, null, true);
  const queue = loadJson(queuePath, [], false);
  const promotionLog = loadJson(logPath, [], false);

  if (!Array.isArray(canonical)) {
    throw new Error(`Canonical data must be an array: ${canonicalPath}`);
  }
  if (!Array.isArray(queue)) {
    throw new Error(`Queue data must be an array: ${queuePath}`);
  }
  if (!Array.isArray(promotionLog)) {
    throw new Error(`Promotion log must be an array: ${logPath}`);
  }

  const canonicalBefore = canonical.length;
  const remainingQueue = [];
  const promoted = [];
  const failed = [];
  let promotedNew = 0;
  let promotedMerged = 0;

  for (const queueRecord of queue) {
    const normalized = normalizeQueueRecord(queueRecord);
    const validationErrors = validateQueuedRecord(normalized);

    if (validationErrors.length) {
      failed.push({
        originalQueueId: normalized.originalQueueId,
        validationErrors
      });
      remainingQueue.push({ ...queueRecord, validationErrors });
      continue;
    }

    const duplicateIndex = findDuplicateIndex(canonical, normalized);
    const canonicalRecord = toCanonicalRecord(normalized, queueRecord);

    if (duplicateIndex >= 0) {
      const existing = canonical[duplicateIndex];
      canonical[duplicateIndex] = mergeCanonicalRecord(existing, canonicalRecord);
      promotedMerged += 1;
      promoted.push({
        action: "merged",
        id: canonical[duplicateIndex].id,
        matchedId: existing.id,
        originalQueueId: normalized.originalQueueId
      });
    } else {
      canonical.push(canonicalRecord);
      promotedNew += 1;
      promoted.push({
        action: "created",
        id: canonicalRecord.id,
        originalQueueId: normalized.originalQueueId
      });
    }
  }

  writeJson(canonicalPath, canonical);
  writeJson(queuePath, remainingQueue);

  const run = {
    runId: `promotion-${new Date().toISOString()}`,
    promotedAt: new Date().toISOString(),
    canonicalPath: path.relative(repoRoot, canonicalPath),
    queuePath: path.relative(repoRoot, queuePath),
    counts: {
      queueLoaded: queue.length,
      promotedNew,
      promotedMerged,
      failed: failed.length,
      canonicalBefore,
      canonicalAfter: canonical.length,
      queueRemaining: remainingQueue.length
    },
    promoted,
    failed
  };

  promotionLog.push(run);
  writeJson(logPath, promotionLog);

  console.log(
    JSON.stringify(
      {
        canonicalPath: path.relative(repoRoot, canonicalPath),
        queuePath: path.relative(repoRoot, queuePath),
        logPath: path.relative(repoRoot, logPath),
        ...run.counts
      },
      null,
      2
    )
  );
}

function validateQueuedRecord(record) {
  const errors = [];
  if (!record.name) errors.push("name or institution is required");
  if (!record.city) errors.push("city is required");
  if (!record.state) errors.push("state is required");
  if (!record.closureYear && !record.statusCode) errors.push("closureYear or statusCode is required");
  if (!record.sourceNotes && !record.sourceUrls.length && normalizeIdentity(record.confidence) !== "low") {
    errors.push('at least one source/sourceNote/sourceUrl is required unless confidence is "low"');
  }
  if (record.closureYear !== null && (!Number.isInteger(record.closureYear) || record.closureYear < 1600 || record.closureYear > new Date().getFullYear() + 10)) {
    errors.push(`closureYear is invalid: ${record.closureYear}`);
  }
  return errors;
}

function normalizeQueueRecord(record) {
  const name = readString(record, ["name", "institution", "schoolName", "School_Name", "Institution"]) || "";
  const city = readString(record, ["city", "City"]) || "";
  const state = normalizeState(readString(record, ["state", "State"]));
  const closureYear = readYear(record, ["closureYear", "closure_year", "Closed_Year", "Closure_Year", "closedYear"]);
  const statusCode = normalizeStatusCode(readString(record, ["statusCode", "status_code", "Status_Code", "status", "Status"]));
  const sourceUrls = readStringArray(record, ["sourceUrls", "sourceUrl", "source_url", "Source_URL", "source"]);
  const sourceNotes = readString(record, ["sourceNotes", "sourceNote", "source_notes", "notes", "Notes"]) || "";
  const afterlifeDescription = readString(record, ["afterlifeDescription", "afterlife", "afterlifeStatus", "Afterlife_Status", "reuseType", "Reuse_Type", "transformation"]);
  const buyer = readString(record, ["buyer", "buyerController", "Buyer_or_Controller", "buyer_or_controller"]);
  const owner = readString(record, ["owner", "controller"]);
  const institutionType = readString(record, ["institutionType", "campusType", "Campus_Type", "type"]);
  const sector = readString(record, ["sector", "Sector", "control"]);
  const confidence = normalizeConfidence(readString(record, ["confidence", "verification", "Verification"]) || (sourceUrls.length || sourceNotes ? "derived" : "low"));
  const id = readString(record, ["id"]) || stableSlug([name, city, state].filter(Boolean).join(" "));

  return {
    id,
    name,
    city,
    state,
    region: readString(record, ["region", "Region"]) || regionForState(state),
    latitude: readNumber(record, ["latitude", "lat", "Latitude"]),
    longitude: readNumber(record, ["longitude", "lng", "lon", "Longitude"]),
    institutionType,
    sector,
    closureYear,
    decade: decadeFor(closureYear),
    statusCode: statusCode || "CLOSURE-EVENT",
    afterlifeCategory: readString(record, ["afterlifeCategory", "afterlife_category"]) || inferAfterlifeCategory([afterlifeDescription, buyer, owner, statusCode].filter(Boolean).join(" ")),
    afterlifeDescription,
    buyer,
    owner,
    ownershipType: readString(record, ["ownershipType", "ownership_type"]) || (buyer || owner ? "controller-recorded" : null),
    sourceNotes,
    sourceUrls,
    relatedEntities: readStringArray(record, ["relatedEntities", "related_entities"]),
    confidence,
    promotedAt: new Date().toISOString(),
    originalQueueId: readString(record, ["originalQueueId", "queueId", "queue_id", "id"]) || id,
    address: readString(record, ["address", "Address"]),
    zipCode: readString(record, ["zipCode", "Zip_Code", "zip"]),
    morphology: readString(record, ["morphology", "Morphology"])
  };
}

function toCanonicalRecord(normalized, original) {
  const missingFields = computeMissingFields(normalized);
  return {
    id: normalized.id,
    dedupeKey: normalized.id,
    sourceSheet: "manual_queue",
    sourceSheets: ["manual_queue"],
    rowIndex: null,
    atlasScale: null,
    name: normalized.name,
    institution: normalized.name,
    schoolName: normalized.name,
    location: [normalized.city, normalized.state].filter(Boolean).join(", ") || null,
    address: normalized.address,
    city: normalized.city,
    state: normalized.state,
    zipCode: normalized.zipCode,
    region: normalized.region,
    closureYear: normalized.closureYear,
    closedDate: null,
    latitude: normalized.latitude,
    longitude: normalized.longitude,
    hasCoordinates: normalized.latitude !== null && normalized.longitude !== null,
    morphology: normalized.morphology,
    afterlifeStatus: normalized.afterlifeDescription || normalized.afterlifeCategory,
    buyerController: normalized.buyer || normalized.owner,
    salePrice: null,
    acreage: null,
    researchPriority: null,
    researchPriorityScore: missingFields.length * 10,
    sourceUrl: normalized.sourceUrls[0] || null,
    status: normalized.statusCode,
    statusCode: normalized.statusCode,
    reuseType: normalized.afterlifeCategory,
    campusType: normalized.institutionType,
    sector: normalized.sector,
    transformation: normalized.afterlifeDescription,
    verification: normalized.confidence,
    notes: normalized.sourceNotes,
    scale: null,
    opeid8: null,
    rootOpeid6: null,
    branchSuffix: null,
    isMainCampus: null,
    campusMarker: "site",
    missingFields,
    original,
    decade: normalized.decade,
    afterlifeCategory: normalized.afterlifeCategory,
    afterlifeDescription: normalized.afterlifeDescription,
    buyer: normalized.buyer,
    owner: normalized.owner,
    ownershipType: normalized.ownershipType,
    sourceNotes: normalized.sourceNotes,
    sourceUrls: normalized.sourceUrls,
    relatedEntities: normalized.relatedEntities,
    confidence: normalized.confidence,
    promotedAt: normalized.promotedAt,
    originalQueueId: normalized.originalQueueId
  };
}

function mergeCanonicalRecord(existing, incoming) {
  const merged = { ...existing };
  const appendOnly = new Set(["sourceNotes", "notes"]);

  for (const [key, value] of Object.entries(incoming)) {
    if (["id", "dedupeKey", "original"].includes(key)) continue;
    if (Array.isArray(value)) {
      merged[key] = unionArrays(merged[key], value);
      continue;
    }
    if (appendOnly.has(key)) {
      merged[key] = mergeTextNotes(merged[key], value);
      continue;
    }
    if (isEmptyValue(merged[key]) && !isEmptyValue(value)) {
      merged[key] = value;
      continue;
    }
    if (key === "confidence" || key === "verification") {
      merged[key] = strongerConfidence(merged[key], value);
    }
  }

  merged.sourceSheets = unionArrays(merged.sourceSheets, incoming.sourceSheets);
  merged.promotedQueueIds = unionArrays(merged.promotedQueueIds, [incoming.originalQueueId].filter(Boolean));
  merged.missingFields = computeMissingFields({
    name: merged.name || merged.institution || merged.schoolName,
    city: merged.city,
    state: merged.state,
    closureYear: merged.closureYear,
    statusCode: merged.statusCode,
    sourceNotes: merged.sourceNotes || merged.notes,
    sourceUrls: unionArrays(merged.sourceUrls, [merged.sourceUrl].filter(Boolean)),
    confidence: merged.confidence || merged.verification,
    buyer: merged.buyer || merged.buyerController,
    owner: merged.owner,
    afterlifeCategory: merged.afterlifeCategory || merged.reuseType,
    afterlifeDescription: merged.afterlifeDescription || merged.afterlifeStatus
  });

  return merged;
}

function findDuplicateIndex(canonical, normalized) {
  const exactIndex = canonical.findIndex((record) => record.id === normalized.id);
  if (exactIndex >= 0) return exactIndex;

  const targetIdentity = identityKey(normalized);
  return canonical.findIndex((record) => {
    if (identityKey(record) !== targetIdentity) return false;
    const existingYear = readYear(record, ["closureYear", "Closed_Year"]);
    return !existingYear || !normalized.closureYear || existingYear === normalized.closureYear;
  });
}

function identityKey(record) {
  return [record.name || record.institution || record.schoolName, record.city, record.state].map(normalizeIdentity).join("|");
}

function computeMissingFields(record) {
  const missing = [];
  if (!record.name) missing.push("name");
  if (!record.city) missing.push("city");
  if (!record.state) missing.push("state");
  if (!record.closureYear && !record.statusCode) missing.push("closureYear_or_statusCode");
  if (!record.afterlifeCategory && !record.afterlifeDescription) missing.push("afterlife");
  if (!record.buyer && !record.owner) missing.push("buyer_or_owner");
  if (!record.sourceNotes && !(record.sourceUrls && record.sourceUrls.length) && normalizeIdentity(record.confidence) !== "low") missing.push("source");
  return missing;
}

function inferAfterlifeCategory(value) {
  const normalized = normalizeIdentity(value);
  if (/cloud|data center|server|comput/.test(normalized)) return "cloud";
  if (/security|police|federal|defense|training|correction/.test(normalized)) return "security";
  if (/senior|assisted living|retirement|housing|dorm/.test(normalized)) return "housing";
  if (/health|hospital|clinic|medical/.test(normalized)) return "healthcare";
  if (/logistics|warehouse|distribution|fulfillment/.test(normalized)) return "logistics";
  if (/charter|civic|municipal|community|public school|k12|counter/.test(normalized)) return "counter-use";
  if (/ruin|abandon|vacant|demol/.test(normalized)) return "ruin";
  return "unknown";
}

function normalizeStatusCode(value) {
  if (!value) return null;
  const normalized = normalizeIdentity(value).replace(/\s+/g, "-").toUpperCase();
  if (statusCodes.has(normalized)) return normalized;
  if (/CLOUD|DATA/.test(normalized)) return "CLOUD";
  if (/SECURITY|POLICE|DEFENSE/.test(normalized)) return "SECURITY";
  if (/PARCEL|REAL-ESTATE|AUCTION/.test(normalized)) return "PARCELIZED";
  if (/ACTIVE|RISK/.test(normalized)) return "ACTIVE-RISK";
  if (/TRANSFER|SOLD|SALE/.test(normalized)) return "ASSET-TRANSFER";
  if (/RUIN|VACANT|ABANDON/.test(normalized)) return "RUIN";
  if (/COUNTER|CIVIC|COMMUNITY/.test(normalized)) return "COUNTER-USE";
  return null;
}

function normalizeConfidence(value) {
  const normalized = normalizeIdentity(value);
  if (!normalized) return "unknown";
  if (["high", "confirmed", "verified"].includes(normalized)) return "confirmed";
  if (["medium", "derived", "partial"].includes(normalized)) return "derived";
  if (["inferred"].includes(normalized)) return "inferred";
  if (["low", "unknown", "unverified"].includes(normalized)) return "low";
  return value;
}

function strongerConfidence(existing, incoming) {
  const rank = { unknown: 0, low: 1, inferred: 2, derived: 3, confirmed: 4, high: 4, verified: 4 };
  const existingKey = normalizeConfidence(existing);
  const incomingKey = normalizeConfidence(incoming);
  return (rank[incomingKey] ?? 0) > (rank[existingKey] ?? 0) ? incoming : existing;
}

function mergeTextNotes(existing, incoming) {
  if (isEmptyValue(incoming)) return existing || null;
  if (isEmptyValue(existing)) return incoming;
  const existingText = String(existing);
  const incomingText = String(incoming);
  if (existingText.includes(incomingText)) return existingText;
  return `${existingText}\n\n[PROMOTED QUEUE NOTE]\n${incomingText}`;
}

function readString(record, keys) {
  const value = readValue(record, keys);
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim();
}

function readNumber(record, keys) {
  const value = readValue(record, keys);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readYear(record, keys) {
  const value = readNumber(record, keys);
  return value === null ? null : Math.trunc(value);
}

function readStringArray(record, keys) {
  const value = readValue(record, keys);
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[;,]\s*|\n+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function readValue(record, keys) {
  if (!record || typeof record !== "object") return null;
  const direct = keys.find((key) => record[key] !== undefined && record[key] !== null);
  if (direct) return record[direct];
  const lookup = new Map(Object.keys(record).map((key) => [normalizeIdentity(key).replace(/\s+/g, "_"), record[key]]));
  const normalized = keys.map((key) => normalizeIdentity(key).replace(/\s+/g, "_")).find((key) => lookup.has(key));
  return normalized ? lookup.get(normalized) : null;
}

function normalizeState(value) {
  return value ? value.trim().toUpperCase() : "";
}

function regionForState(state) {
  return stateRegions[state] || "Unknown";
}

function decadeFor(year) {
  return year ? `${Math.floor(year / 10) * 10}s` : "Unknown";
}

function stableSlug(value) {
  return normalizeIdentity(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function normalizeIdentity(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function unionArrays(existing, incoming) {
  const values = [];
  for (const source of [existing, incoming]) {
    if (Array.isArray(source)) values.push(...source);
    else if (!isEmptyValue(source)) values.push(source);
  }
  return Array.from(new Set(values.map((value) => String(value)).filter(Boolean)));
}

function isEmptyValue(value) {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") {
    return ["unknown", "unresolved", "pending", "unclassified", "n/a", "na", "-"].includes(normalizeIdentity(value));
  }
  return false;
}

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function resolveRepoPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
}

function loadJson(filePath, fallback, required) {
  if (!fs.existsSync(filePath)) {
    if (required) throw new Error(`File not found: ${filePath}`);
    return fallback;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}
