# Dead Campus Atlas viability plan

Dead Campus Atlas is strongest when it is treated as an artistic archive with a data spine, not as a single flat spreadsheet. The viable product has three layers:

1. Public Atlas: one canonical record per selected campus, written for visitors.
2. Source Archive: raw PEPS, SHEEO, and manual evidence preserved without forcing it into one row.
3. Editorial Queue: missing coordinates, disputed claims, source gaps, and duplicates treated as production work.

## Current viable scope

The prototype in `dist/` uses the 34 confirmed curated campus records as the public layer and treats the full FSA/PEPS closed-school table as the larger federal record mass. The federal count changes with every weekly refresh (22,962 rows as of the 2026-09-06 report), so `_DATA/source_freshness.json` is the only place that number should live. This gives the project a coherent public entry point without hiding the scale or incompleteness of the archive.

## Editorial rules

- A public campus page should represent one physical or institutional site.
- Raw PEPS rows should stay raw and remain available as evidence.
- Curated records should carry a source URL, verification state, and afterlife classification.
- Interpretive fields belong beside source fields, not inside them.
- `sourceUrl` should contain only URLs. Research notes should move to `sourceNote`.
- Typology labels should be normalized before publication.
- Verification states should come from one short controlled vocabulary, used identically on curated records and on evidence rows.

## Next production steps

Ordered so that each step unblocks the ones after it. Reviewed 2026-10-09 against the generated bundle.

### Done

- Consolidate the 78 non-PEPS queue rows into 34 canonical campus records. `tools/build_data.py` groups them and keeps every source row in a per-record `evidence` array.
- Give every canonical record a `publicSummary`. All 34 have one, now kept in `curation/public-sites.json` rather than in Python.
- Permanent IDs. A campus id is its name slug plus state (`wells-college-ny`) and no longer embeds the closure year.
- Validator gates. `npm run validate` reports release gaps per site; `npm run validate:release` fails on them. The count check is a minimum, not a hard-coded 34. Verification values outside the vocabulary are structural errors.
- Verification vocabulary. `Confirmed`, `Disputed`, `Manual add`, `Curated`, `Non-closure sale`, `Pending`, applied to records and evidence rows by `build_data.py`, with the raw spelling kept in `verificationNote`.
- Citation URLs. `#campus/<id>` opens a dossier and is shown on each record; `#view/<tab>` opens a tab.
- Federal table loads on demand when the Abyss tab opens instead of blocking first paint.

### Next

1. Decide publication mode: private proof, public web atlas, or exhibition kiosk. `.openai/hosting.json` already points at a static deploy; confirm or replace that.
2. Fill the source URLs for the 10 public sites that have none, by adding them to `sourceUrls` in `curation/public-sites.json`: Presentation College, Finlandia University, Mount Ida College, Pine Manor College, Marlboro College, Burlington College, Concordia University Portland, College of New Rochelle, Southern Vermont College, St. Gregory's University. `npm run validate:release` passes once they are in.
3. Review the evidence-row verification states. 136 of 170 rows are `Pending`; decide which should be `Confirmed` or `Manual add` and record that in the queue CSV.
4. Restructure the 34 summaries into three parts per campus: closure, transfer, afterlife. Edit `summary` in the curation file.
5. Decide whether the first public release is the 34 or grows to 50. Growing means adding rows to the master table and curation entries for each, then raising `MINIMUM_PUBLIC_SITES` in `build_data.py`.
6. Add image evidence or archival media per campus: a `media` field in the curation file, an assets folder convention, and a validator rule first, then collection.

## Public release bar

- Every public campus has coordinates.
- Every public afterlife claim has a source URL, and the validator enforces it.
- Every public campus has a verification state from the controlled vocabulary.
- Every campus has one normalized morphology.
- Raw and curated records are visibly separated.
- Visitors can search, filter, and understand why a campus is included within one screen.
