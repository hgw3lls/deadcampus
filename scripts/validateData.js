#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const canonicalPath = resolveRepoPath(argValue("--canonical", process.env.CANONICAL_DATA_PATH || "public/data/sites.json"));
const strict = process.argv.includes("--strict") || process.env.STRICT_DATA_VALIDATION === "true";
const statusCodes = new Set(["ACTIVE-RISK", "CLOSURE-EVENT", "ASSET-TRANSFER", "PARCELIZED", "CLOUD", "SECURITY", "RUIN", "COUNTER-USE"]);

main();

function main() {
  if (!fs.existsSync(canonicalPath)) {
    throw new Error(`Canonical data file not found: ${canonicalPath}`);
  }

  const records = JSON.parse(fs.readFileSync(canonicalPath, "utf8"));
  if (!Array.isArray(records)) {
    throw new Error(`Canonical data must be an array: ${canonicalPath}`);
  }

  const report = {
    canonicalPath: path.relative(repoRoot, canonicalPath),
    records: records.length,
    seriousErrors: [],
    warnings: {
      missingRequiredFields: [],
      missingSourceNotes: [],
      invalidStatusCodes: []
    },
    duplicateIds: [],
    invalidYears: []
  };

  const ids = new Map();
  records.forEach((record, index) => {
    const id = readString(record, ["id"]);
    if (!id) {
      report.seriousErrors.push({ index, error: "missing id" });
    } else {
      ids.set(id, [...(ids.get(id) || []), index]);
    }

    const requiredMissing = missingRequiredFields(record);
    if (requiredMissing.length) {
      report.warnings.missingRequiredFields.push({ index, id: id || null, missing: requiredMissing });
      if (strict) {
        report.seriousErrors.push({ index, id: id || null, error: `missing required fields: ${requiredMissing.join(", ")}` });
      }
    }

    const year = readYear(record, ["closureYear", "Closed_Year", "closure_year"]);
    if (year !== null && (!Number.isInteger(year) || year < 1600 || year > new Date().getFullYear() + 10)) {
      report.invalidYears.push({ index, id: id || null, closureYear: year });
      report.seriousErrors.push({ index, id: id || null, error: `invalid closureYear: ${year}` });
    }

    const statusCode = readString(record, ["statusCode", "status_code", "Status_Code"]);
    if (statusCode && !statusCodes.has(statusCode)) {
      report.warnings.invalidStatusCodes.push({ index, id: id || null, statusCode });
      report.seriousErrors.push({ index, id: id || null, error: `invalid statusCode: ${statusCode}` });
    }

    if (!hasSource(record)) {
      report.warnings.missingSourceNotes.push({ index, id: id || null, name: readString(record, ["name", "institution", "schoolName"]) });
    }
  });

  report.duplicateIds = Array.from(ids.entries())
    .filter(([, indexes]) => indexes.length > 1)
    .map(([id, indexes]) => ({ id, indexes }));

  report.duplicateIds.forEach((duplicate) => {
    report.seriousErrors.push({ id: duplicate.id, error: `duplicate id at indexes: ${duplicate.indexes.join(", ")}` });
  });

  const summary = {
    canonicalPath: report.canonicalPath,
    records: report.records,
    seriousErrorCount: report.seriousErrors.length,
    duplicateIdCount: report.duplicateIds.length,
    invalidYearCount: report.invalidYears.length,
    missingRequiredFieldCount: report.warnings.missingRequiredFields.length,
    missingSourceNoteCount: report.warnings.missingSourceNotes.length,
    invalidStatusCodeCount: report.warnings.invalidStatusCodes.length,
    strict
  };

  console.log(JSON.stringify(summary, null, 2));

  if (report.seriousErrors.length) {
    console.error("\nSerious data errors:");
    console.error(JSON.stringify(report.seriousErrors.slice(0, 25), null, 2));
    process.exitCode = 1;
  }

  if (report.warnings.missingRequiredFields.length && !strict) {
    console.warn(`\nWarning: ${report.warnings.missingRequiredFields.length} records are missing one or more required fields. Run with --strict to fail on these.`);
    console.warn(JSON.stringify(report.warnings.missingRequiredFields.slice(0, 10), null, 2));
  }

  if (report.warnings.missingSourceNotes.length) {
    console.warn(`\nWarning: ${report.warnings.missingSourceNotes.length} records have no source/sourceNote/sourceUrl field.`);
    console.warn(JSON.stringify(report.warnings.missingSourceNotes.slice(0, 10), null, 2));
  }
}

function missingRequiredFields(record) {
  const missing = [];
  if (!readString(record, ["name", "institution", "schoolName", "School_Name", "Institution"])) missing.push("name_or_institution");
  if (!readString(record, ["city", "City"])) missing.push("city");
  if (!readString(record, ["state", "State"])) missing.push("state");
  if (!readYear(record, ["closureYear", "closure_year", "Closed_Year", "Closure_Year"]) && !readString(record, ["statusCode", "status_code", "Status_Code", "status", "Status"])) {
    missing.push("closureYear_or_statusCode");
  }
  return missing;
}

function hasSource(record) {
  if (readString(record, ["sourceNotes", "sourceNote", "sourceUrl", "source", "source_url", "Source_URL", "notes", "Notes"])) return true;
  const sourceUrls = readValue(record, ["sourceUrls"]);
  return Array.isArray(sourceUrls) && sourceUrls.length > 0;
}

function readString(record, keys) {
  const value = readValue(record, keys);
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim();
}

function readYear(record, keys) {
  const value = readValue(record, keys);
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
}

function readValue(record, keys) {
  if (!record || typeof record !== "object") return null;
  const direct = keys.find((key) => record[key] !== undefined && record[key] !== null);
  if (direct) return record[direct];
  const lookup = new Map(Object.keys(record).map((key) => [normalizeIdentity(key).replace(/\s+/g, "_"), record[key]]));
  const normalized = keys.map((key) => normalizeIdentity(key).replace(/\s+/g, "_")).find((key) => lookup.has(key));
  return normalized ? lookup.get(normalized) : null;
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

function argValue(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function resolveRepoPath(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
}
