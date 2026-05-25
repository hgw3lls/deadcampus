# Dead Campus Atlas / Terminal Education

Forensic-poetic atlas and research dashboard for U.S. educational infrastructure collapse: campus closures, institutional retreat, real-estate transfer, parcelization, cloud/security conversion, and replacement economies of educational land.

## Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS plus atlas CSS modules in `src/styles`
- Leaflet for map rendering
- Recharts for timeline charts
- SheetJS / `xlsx` preprocessing
- Static JSON data loaded from `public/data`
- GitHub Pages static export

## Route Structure

- `/` - Overview: thesis, key stats, national map preview, text intervention, route index
- `/explorer` - Atlas Explorer: map, timeline, matrix, ownership network, state/status/table views, evidence wall
- `/dossiers` - Searchable campus/institution dossier system
- `/fieldwork` - Methodology, fieldwork checklist, upload placeholder, research queue
- `/replacement-economy` - Campus afterlife categories and replacement matrix
- `/texts` - Manifestos, closure notices, field notes, status glossary, micro-captions
- `/about` - Source registry, data method, limitations, route map, deployment notes

## Project Structure

- `app/` - Next routes and global app files
- `components/layout/` - `SiteShell`, `AtlasNav`, `SectionHeader`, `AtlasPanel`
- `components/editorial/` - text panels, intervention layers, status glossary, caption ticker
- `components/` - existing map, timeline, network, matrix, research queue, evidence wall, dossier components
- `src/data/` - hand-authored data contracts, text content, status codes, replacement categories, regions, source registry
- `src/lib/` - normalized campus data loader and React data hook
- `src/styles/` - CSS tokens, layout, typography, component, and explorer layers
- `lib/data.ts` - existing generated JSON client loader and workbook-derived types
- `scripts/preprocessWorkbook.ts` - workbook to JSON preprocessing
- `public/data/` - generated static JSON consumed by the deployed site
- `public/data/raw/` - holding area for future raw CSV/JSON drops

## Data Flow

Run preprocessing whenever the workbook changes:

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
- `public/data/graph_index.json`
- `public/data/graphs/*.json`

Do not hand-edit generated JSON. Add raw source drops to `public/data/raw/` or extend the workbook, then regenerate.

## Normalized Campus Records

Route components should target the normalized shape produced by `src/lib/loadCampusData.ts`:

```ts
{
  id,
  name,
  city,
  state,
  region,
  latitude,
  longitude,
  institutionType,
  sector,
  closureYear,
  decade,
  statusCode,
  afterlifeCategory,
  afterlifeDescription,
  buyer,
  owner,
  ownershipType,
  sourceNotes,
  sourceUrls,
  relatedEntities,
  confidence
}
```

The generated workbook records remain preserved under `sourceRecord` for drill-down and future migrations.

## Adding Campus Records

Preferred path:

1. Add/update rows in `DEAD_CAMPUS_ATLAS_MASTER_WORKBOOK.xlsx`.
2. Run `npm run preprocess`.
3. Check `public/data/sites.json` and `public/data/research_queue.json`.
4. Run `npm run build`.

For future CSV/JSON imports, place raw files in `public/data/raw/` and add an adapter in `src/lib/loadCampusData.ts` or a neighboring loader.

## Data Workflow

There are three queue-like files with different purposes:

- `public/data/sites.json` - canonical dataset used by the site.
- `public/data/queue.json` - staging queue for uncertain/new records that are not canonical yet.
- `public/data/research_queue.json` - generated research-gap queue derived from canonical records; do not use it as the promotion staging file.

Promotion workflow:

1. Add uncertain/new records to `public/data/queue.json`.
2. Run:

```bash
npm run promote:queue
```

3. Review `public/data/promotion-log.json`.
4. Run:

```bash
npm run validate:data
```

5. Commit canonical data, queue, and log:

- `public/data/sites.json`
- `public/data/queue.json`
- `public/data/promotion-log.json`

Queued records can be promoted when they have:

- `name` or `institution`
- `city`
- `state`
- `closureYear` or `statusCode`
- at least one `source`, `sourceNote`, `sourceUrl`, or `sourceNotes`, unless `confidence` is `low`

`scripts/promoteQueue.js` normalizes field names, generates a stable slug id when missing, deduplicates against canonical records by id and normalized name/city/state, merges missing fields into duplicates, removes promoted records from the queue, leaves failed records with `validationErrors`, and appends a run entry to `public/data/promotion-log.json`.

`scripts/validateData.js` checks canonical records for duplicate ids, invalid years, invalid status codes, missing required fields, and missing source notes. Missing required/source fields are warnings by default because legacy workbook records still contain gaps. Use strict validation when you want those warnings to fail:

```bash
node scripts/validateData.js --strict
```

## Adding Text Interventions

Edit `src/data/atlasTexts.ts`.

Each entry supports:

```ts
{
  id,
  title,
  category,
  body,
  tags
}
```

Supported categories:

- `intro_manifesto`
- `closure_fragments`
- `status_code_texts`
- `fieldwork_notes`
- `replacement_economy`
- `map_interstitials`
- `micro_captions`

Use `TextIntervention`, `AtlasTextPanel`, or `InterventionLayer` to place text inside routes.

## Adding Visualization Modes

The primary scaffold is `components/AtlasExplorer.tsx`.

Current tabs:

- Map
- Timeline
- Matrix
- Network
- State / Region
- Status Code
- Table
- Fieldwork

Add future modes by extending the `ExplorerView` union, adding a `ViewButton`, and creating a corresponding view component. Keep the table mode as the reliable fallback for all data.

## Development

```bash
npm install
npm run preprocess
npm run dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

## Build

```bash
npm run build
```

GitHub Pages build:

```bash
GITHUB_PAGES=true npm run build
```

## GitHub Pages Deployment

The workflow in `.github/workflows/pages.yml` deploys the static `out` directory. In GitHub, set:

**Settings -> Pages -> Build and deployment -> Source -> GitHub Actions**

The workflow uses the `/deadcampus` base path for:

`https://hgw3lls.github.io/deadcampus/`

## Notes

- The site is intentionally brutalist, dense, and archival.
- Avoid glossy cards, stock icon aesthetics, sentimental ruin language, or generic SaaS dashboard copy.
- The research queue is part of the method: missing coordinates, ownership chains, and verification gaps should remain visible.
