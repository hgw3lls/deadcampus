# Dead Campus Atlas prototype

This folder turns the archive into a viable first public artifact:

- `dist/index.html` is the local static atlas prototype.
- `dist/data/canonical-atlas.json` is the generated public data spine.
- `dist/data/atlas-data.js` is the browser-ready data bundle used by the page.
- `dist/data/federal-records.js` is the browser-ready PEPS/FSA detail table.
- `dist/data/atlas-records.csv` is the whole atlas as one table: curated, extended, coded, and federal records, with a column guide beside it. See `DATASET.md`.
- `curation/public-sites.json` is the editorial layer: visitor summaries, curated source URLs, and field overrides, keyed by permanent campus id. Edit this file rather than the build script.
- `tools/build_data.py` rebuilds the public data from the local archive files and the curation file.
- `VIABILITY.md` records the editorial model and release bar.
- `NARRATIVES.md` plans how the theoretical frame becomes testable claims and data-narratives.
- `DATA_SOURCES.md` maps the external data on closures, mergers, and campus afterlife, and what to ingest next.

The whole atlas is also one table, `dist/data/atlas-records.csv` (`DATASET.md`). The current public map layer uses 34 confirmed curated campus records. The Abyss tab exposes the separate raw PEPS/FSA federal layer as a searchable table generated from the latest refreshed report. The federal table is loaded only when the Abyss tab is opened, so the first paint does not wait for the 13 MB file.

Each campus has a permanent id made of its name slug and state, for example `wells-college-ny`. The page exposes it as a citation URL of the form `index.html#campus/wells-college-ny`; `#view/abyss` and `#view/method` open the other tabs.

## Interface

The page follows the Terminal Education design handoff, direction 2a "Sector T.E-09", as one scrolling dossier: a header with offices nav and sector stamp, a seal-and-mission hero, an interactive territory map beside the record index, a case file, the Abyss, a queue / Exhibit A / method row, and the readings. The map places the curated campuses by longitude and latitude and draws a flow from each to its replacement zone (security, cloud, absorbed, health, housing, parcelized, speculative, K-12, counter-use, ruin). Click a zone or an axis segment to filter; click a node or an index row to open its case file. The case file keeps *Evidence (sourced)* visibly apart from *Reading (interpretive)*.

- Hash routes: `#campus/<id>` opens a case file; `#view/<atlas|records|abyss|queue|timeline|method|readings>` scrolls to a section.
- The map pans by drag, zooms with Ctrl or Cmd plus scroll (a trackpad pinch also works) or after focusing the map, and takes arrow keys, plus, minus, and zero. Plain scroll stays page scroll on purpose, which differs from the prototype.
- First load is the stylesheet (37 KB), the curated data (246 KB), and the script (73 KB). The extended records (563 KB) load in a separate bundle once the page is idle, or at once when you switch the index to Extended or All, follow a link to one, or turn the layer on.
- `npm run build:data` stamps `styles.css`, `app.js`, and the data bundle in `index.html` with a content digest, and gives the lazy bundles their digests through the data file, so a stale browser cache can never pair a new script with old data. Run it after editing `app.js` or `styles.css`, not only after data changes.
- The 13 MB federal bundle loads when the Abyss nears the viewport, when the haze layer is switched on, or when its search is used.
- Fonts (Old Standard TT, Barlow Condensed, IBM Plex Mono) are self-hosted from `dist/fonts` as latin-subset woff2 under the SIL Open Font License, so the page makes no third-party requests at all. Characters outside the latin subset, such as arrows, fall back to system fonts.
- `dist/assets/phase10-map.png` is no longer displayed but is still required by `tools/validate_site.py`.

## Local preview

From this folder:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:5173/
```

## Validation

```bash
npm run validate
```

This checks the bundle's structure and prints any release gaps (a public site without a source URL, for example) without failing. To make the release bar a hard gate:

```bash
npm run validate:release
```

## Data refresh

Federal closed-school data can be refreshed after the official FSA reports post:

```bash
npm run update
```

That command runs the built-in updater script, which asks the official FSA Partner Connect reports API for the newest Weekly Closed School Search File, downloads the workbook package, rejects stale report dates by default, rebuilds the browser bundle, validates the site, and prints a short freshness summary. `npm run refresh` uses the same updater for compatibility. It normalizes the school-detail rows into:

- `_DATA/peps_site_retreat_cleaned.csv`
- `_DATA/dead_campus_phase9_peps_normalized.csv`
- `_DATA/source_freshness.json`

Then it rebuilds and validates the public bundle. FSA says the weekly closed-school search file is cumulative and posted every Sunday before midnight, while monthly reports are posted the first business day of the month for the previous month. If network access is blocked, use the local workbook path for a parser-only check:

```bash
npm run refresh:fsa:local
```

## Closure process

`_DATA/dead_campus_phase1_source_files/sheeo_closed_college_context_cleaned.csv` (SHEEO, 748 closures) is joined to federal sites by OPEID in `tools/build_data.py`. The federal table shows each matched site as abrupt or orderly with notice and teach-out, and filters on it; case files show it for curated and extended campuses; the Readings panel tests "closures arrive without warning". The full text, notes, and source URLs are in the dataset CSV (`DATASET.md`).

## Stable ids, corrections, and rechecks

Federal site ids come from `_DATA/fsa_site_ids.csv`, not from row order, so a weekly refresh never moves an id. After `npm run update`, `npm run geocode:peps` geocodes only the new sites. `curation/federal-corrections.json` holds individual fixes to federal rows (a mistyped state, a wrong geocode) and the build refuses to publish a new state mismatch silently.

Coded institutions can be rechecked: `npm run recheck:draw` selects the weakest records (low confidence, one source, unknown campus fate, contradicting IPEDS status) into `_DATA/afterlife_batches/recheck_NN_input.json`; reviewers write `recheck_NN_result.json`; `npm run recheck:merge` validates them into `curation/afterlife-rechecks.json`, an overlay that keeps the first coding. `curation/CHANGELOG.md` lists the 2026-10-10 fact-check edits to the 34 curated records.

## IPEDS closure and merger spine

```bash
npm run pull:ipeds
```

This pulls one IPEDS directory file per year (2000 to 2024 by default) from the Urban Institute Education Data Portal, caches each year under `_DATA/ipeds/`, and collapses the stack into `_DATA/ipeds_directory_spine.csv`: one row per UNITID with first and last year seen, close date, the year it left IPEDS, and the UNITID it was combined into. Each institution is classified as `active`, `closed`, `combined`, or `dropped` (left IPEDS with no close date, usually loss of Title IV participation). `_DATA/ipeds_directory_summary.json` holds the counts. Cached years are reused; pass `--refresh` to re-download.

```bash
npm run match:ipeds
```

This matches the public atlas sites to spine rows by name and state and writes the UNITID and OPEID into `curation/public-sites.json` for exact matches, with a review file for the rest.

```bash
npm run pull:ipeds:trajectories
```

This pulls fall enrollment and finance (revenue, expenses, net tuition, net position, long-term debt, endowment) for every public site with a UNITID, 2000 to 2024, into `_DATA/ipeds_trajectories.csv`. The build folds it into each site as `trajectory` and `trajectorySummary`, and the dossier shows the decline curve.

```bash
npm run pull:ipeds:affiliation
```

This pulls religious affiliation for every institution in the spine and runs the Catholic-retreat test (Catholic share of nonprofits that left IPEDS versus those still active) into `_DATA/ipeds_catholic_test.json`.

```bash
npm run geocode:peps
```

This geocodes the federal layer with the U.S. Census Bureau batch geocoder (no key needed, 5,000 addresses per request, cached under `_DATA/geocode/`) into `_DATA/peps_geocoded.csv`. The build merges the matches into `federal-records.js` as `latitude` and `longitude`, rounded to four decimals. The Abyss view draws them as the national retreat map: a canvas with no tiles or third-party scripts, a year slider and play control, main campuses as dark squares, branches as pale haze, the selected year in red, and the curated campuses as rings. Alaska, Hawaii, and Puerto Rico sit in insets below the map.

```bash
npm run sample:draw
npm run sample:merge
```

The afterlife sample turns "who takes the land" from counts of 34 hand-picked campuses into rates. `sample:draw` takes a seeded, stratified random sample of 100 from the 369 private nonprofit degree-granting institutions that left IPEDS in 2010-2024 (excluding the public layer), strata being exit status by five-year band, and splits it into batches of ten under `_DATA/afterlife_batches/`. Each batch is coded by hand or by an agent into a `batch_NN_result.json` using the controlled vocabularies, with an evidence URL for every claim. `sample:merge` validates the results against the vocabularies and the frame and writes `curation/afterlife-sample.json`; the build turns it into weighted shares with Wilson intervals that feed the Readings panel. `buyerSector` in the sample means the sector of the party that holds or operates the campus after the exit, and is left null when the institution still operates there and only leases space out.

```bash
npm run census:draw
npm run census:merge
```

The census goes beyond the 34 curated campuses. `census:draw` lists every private nonprofit degree-granting institution that IPEDS records as closed in 2010-2024 and that is neither curated nor in the random sample (120 of the 184), and splits them into batches. Each is coded the same way as the sample, with evidence URLs, and `census:merge` validates the results into `curation/afterlife-census.json`. With the 20 curated and 44 sampled closures, that is a complete census of the population, so the shares computed from it are exact, not estimated.

The same two steps (`npm run exits:draw`, `npm run exits:merge`) cover the other half of the population: the 149 institutions IPEDS records as dropped or combined that were neither curated nor sampled. With them, all 399 private nonprofit degree-granting institutions that left IPEDS in 2010-2024 are coded, so "what share of exits were real closures" is an exact count.

The page shows these as the **extended layer**: every coded institution whose campus closed (210 at the last build), placed by its IPEDS coordinates, as small hollow squares on the map, switchable in the index between Curated, Extended, and All. Extended records are labelled as coded from public sources, not curated or edited, and carry their confidence and coding notes. Run `npm run pull:ipeds:trajectories` after a merge so they get decline curves.

Each public site also carries a `matrix` in the curation file: `originalSystem`, `buyerSector`, and `replacementSystem`, each from a controlled list in `tools/build_data.py`. Morphology is derived from the replacement system, so it cannot drift from the matrix. An optional `editorialNote` records where a source cuts against the recorded classification.

Each public site can also carry an `events` array in the curation file: `{"date": "YYYY[-MM[-DD]]", "type": "<status code>", "label": "...", "sourceUrl": "..."}`. Types come from the blueprint's status-code system (`ACTIVE-RISK`, `CLOSURE-EVENT`, `ASSET-TRANSFER`, `PARCELIZED`, `CLOUD`, `SECURITY`, `RUIN`, `COUNTER-USE`). The build derives days in limbo from closure to first transfer, the validator checks types and dates, and the dossier renders the sequence. Set `"ownershipChange": false` on an event that is an agreement, a vote, or a temporary use rather than a completed change of ownership; those events appear in the sequence but do not count toward time in limbo.

For the same local cached update plus rebuild and validation, run:

```bash
npm run update:local
```

The root wrapper also works and passes through flags:

```bash
./update.sh --local
./update.sh --source-url URL
```

Use `python3 tools/refresh_fsa_reports.py --source-url URL` or `./update.sh --source-url URL` for an explicit workbook/archive URL. The live refresh refuses reports older than 45 days unless `--allow-stale` is passed; the legacy ED workbook fallback is only used when `--allow-legacy-fallback` is explicit.

The data builder reads the project `.xlsx` files with the Python standard library, so no extra Python packages are required.
The archive map uses local JavaScript over the local atlas map image, so it does not request third-party map scripts, styles, or tiles.
