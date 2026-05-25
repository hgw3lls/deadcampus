# Raw Data Holding Area

Generated client data currently lives in `public/data/*.json` and `public/data/graphs/*.json`.

Use this directory for future raw CSV/JSON source drops that should be preserved beside the generated outputs. Do not move the current generated JSON files here without also updating `lib/data.ts`, because the deployed app loads the existing paths directly.
