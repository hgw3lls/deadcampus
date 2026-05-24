# Dead Campus Atlas Dashboard

Interactive research dashboard for the `DEAD_CAMPUS_ATLAS_MASTER_WORKBOOK.xlsx` workbook.

## Stack

- Next.js, React, TypeScript
- Tailwind CSS
- Leaflet map rendering
- Recharts timeline
- SheetJS workbook preprocessing
- Static JSON data in `public/data`

## Data Flow

Run the preprocessing script whenever the workbook changes:

```bash
npm run preprocess
```

The script reads `/mnt/data/DEAD_CAMPUS_ATLAS_MASTER_WORKBOOK.xlsx` when available and falls back to the repo-local `DEAD_CAMPUS_ATLAS_MASTER_WORKBOOK.xlsx`.

Generated outputs:

- `public/data/sites.json`
- `public/data/summary.json`
- `public/data/nodes.json`
- `public/data/edges.json`
- `public/data/research_queue.json`

The normalizer preserves original workbook fields under each record's `original` object, adds `sourceSheet` and `sourceSheets`, deduplicates by `OPEID_8` where available, and otherwise uses normalized name, city, state, and closure year. Existing latitude and longitude are preserved. Missing coordinates are left unresolved unless a future geocoding layer is added.

## Development

```bash
npm install
npm run preprocess
npm run dev
```

Open the local URL printed by Next.js.

## GitHub Pages

This repo includes `.github/workflows/pages.yml`. In GitHub, set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.

The workflow runs:

```bash
npm ci
npm run preprocess
GITHUB_PAGES=true npm run build
```

It deploys the static `out` directory with the correct `/deadcampus` base path for `https://hgw3lls.github.io/deadcampus/`.
