# Dead Campus Atlas prototype

This folder turns the archive into a viable first public artifact:

- `dist/index.html` is the local static atlas prototype.
- `dist/data/canonical-atlas.json` is the generated public data spine.
- `dist/data/atlas-data.js` is the browser-ready data bundle used by the page.
- `dist/data/federal-records.js` is the browser-ready PEPS/FSA detail table.
- `curation/public-sites.json` is the editorial layer: visitor summaries, curated source URLs, and field overrides, keyed by permanent campus id. Edit this file rather than the build script.
- `tools/build_data.py` rebuilds the public data from the local archive files and the curation file.
- `VIABILITY.md` records the editorial model and release bar.

The current public map layer uses 34 confirmed curated campus records. The Abyss tab exposes the separate raw PEPS/FSA federal layer as a searchable table generated from the latest refreshed report. The federal table is loaded only when the Abyss tab is opened, so the first paint does not wait for the 11 MB file.

Each campus has a permanent id made of its name slug and state, for example `wells-college-ny`. The page exposes it as a citation URL of the form `index.html#campus/wells-college-ny`; `#view/abyss` and `#view/method` open the other tabs.

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
