# Dead Campus Atlas prototype

This folder turns the archive into a viable first public artifact:

- `dist/index.html` is the local static atlas prototype.
- `dist/data/canonical-atlas.json` is the generated public data spine.
- `dist/data/atlas-data.js` is the browser-ready data bundle used by the page.
- `tools/build_data.py` rebuilds the public data from the local archive files.
- `VIABILITY.md` records the editorial model and release bar.

The current public layer uses 34 confirmed curated campus records. The raw PEPS layer remains visible as a separate 11,408-record background dataset.

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

The data builder requires `openpyxl` because the source coordinates and curated rows live in `.xlsx` files.
