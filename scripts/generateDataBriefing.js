const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sitesPath = path.join(root, "public/data/sites.json");
const summaryPath = path.join(root, "public/data/summary.json");
const queuePath = path.join(root, "public/data/research_queue.json");
const outputPath = path.join(root, "public/data/data_briefing.json");

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function countBy(items, getKey) {
  const counts = new Map();
  items.forEach((item) => {
    const key = getKey(item) || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function pct(count, total) {
  if (!total) return 0;
  return Number(((count / total) * 100).toFixed(1));
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function decadeFor(year) {
  if (!Number.isFinite(year)) return "Unknown";
  return `${Math.floor(year / 10) * 10}s`;
}

const sites = readJson(sitesPath, []);
const summary = readJson(summaryPath, {});
const queue = readJson(queuePath, []);
const total = sites.length;

const withCoordinates = sites.filter((site) => site.latitude !== null && site.longitude !== null).length;
const withState = sites.filter((site) => hasValue(site.state) && site.state !== "Unknown").length;
const withAfterlife = sites.filter((site) => hasValue(site.afterlifeStatus) || hasValue(site.reuseType)).length;
const withBuyer = sites.filter((site) => hasValue(site.buyerController)).length;
const withSourceUrl = sites.filter((site) => hasValue(site.sourceUrl)).length;
const withSourceNote = sites.filter((site) => hasValue(site.notes) || hasValue(site.sourceUrl)).length;
const withMorphology = sites.filter((site) => hasValue(site.morphology)).length;
const withVerification = sites.filter((site) => hasValue(site.verification)).length;

const briefing = {
  generatedAt: new Date().toISOString(),
  source: {
    canonicalPath: "public/data/sites.json",
    summaryPath: "public/data/summary.json",
    queuePath: "public/data/research_queue.json",
    workbookFile: summary.workbookFile ?? "DEAD_CAMPUS_ATLAS_MASTER_WORKBOOK.xlsx"
  },
  totals: {
    records: total,
    mappedRecords: withCoordinates,
    researchQueueRecords: queue.length,
    yearMin: summary.yearRange?.min ?? null,
    yearMax: summary.yearRange?.max ?? null
  },
  coverage: {
    coordinates: { count: withCoordinates, missing: total - withCoordinates, percent: pct(withCoordinates, total) },
    state: { count: withState, missing: total - withState, percent: pct(withState, total) },
    afterlife: { count: withAfterlife, missing: total - withAfterlife, percent: pct(withAfterlife, total) },
    buyerController: { count: withBuyer, missing: total - withBuyer, percent: pct(withBuyer, total) },
    sourceUrl: { count: withSourceUrl, missing: total - withSourceUrl, percent: pct(withSourceUrl, total) },
    sourceNoteOrUrl: { count: withSourceNote, missing: total - withSourceNote, percent: pct(withSourceNote, total) },
    morphology: { count: withMorphology, missing: total - withMorphology, percent: pct(withMorphology, total) },
    verification: { count: withVerification, missing: total - withVerification, percent: pct(withVerification, total) }
  },
  topStates: countBy(sites, (site) => site.state).slice(0, 12),
  decadeCounts: countBy(sites, (site) => decadeFor(site.closureYear)).filter((row) => row.key !== "Unknown"),
  statusCounts: countBy(sites, (site) => site.statusCode),
  sourceSheetCounts: countBy(sites, (site) => site.sourceSheet).slice(0, 12),
  researchPriorities: countBy(queue, (item) => {
    if (item.researchPriorityScore >= 70) return "High";
    if (item.researchPriorityScore >= 40) return "Medium";
    if (item.researchPriorityScore > 0) return "Low";
    return "Resolved";
  }),
  recommendedNextWork: [
    {
      id: "coordinates",
      label: "Spatialize high-priority records",
      count: total - withCoordinates,
      rationale: "The atlas is visually map-led, but most PEPS-scale records do not yet have coordinates."
    },
    {
      id: "afterlife",
      label: "Resolve afterlife status",
      count: total - withAfterlife,
      rationale: "Replacement economy analysis becomes stronger when reuse, buyer, controller, or ruin status is known."
    },
    {
      id: "buyer-controller",
      label: "Add buyer/controller chains",
      count: total - withBuyer,
      rationale: "Ownership data turns closure records into an infrastructure-transfer atlas."
    },
    {
      id: "sources",
      label: "Attach source URLs or notes",
      count: total - withSourceNote,
      rationale: "Source coverage is the difference between a poetic interface and a defensible research archive."
    }
  ],
  plainLanguageSummary: [
    `The atlas currently contains ${total.toLocaleString("en-US")} canonical records spanning ${summary.yearRange?.min ?? "unknown"}-${summary.yearRange?.max ?? "unknown"}.`,
    `${withCoordinates.toLocaleString("en-US")} records have coordinates; the rest are still staging candidates for spatialization.`,
    `${withAfterlife.toLocaleString("en-US")} records have afterlife or reuse fields, so replacement-economy analysis should be treated as strongest for curated cases and weakest for bulk PEPS records.`,
    `${queue.length.toLocaleString("en-US")} records remain in the research queue because they are missing one or more core fields.`
  ]
};

fs.writeFileSync(outputPath, `${JSON.stringify(briefing, null, 2)}\n`);
console.log(JSON.stringify({ outputPath: path.relative(root, outputPath), records: total, queue: queue.length }, null, 2));
