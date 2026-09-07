# Dead Campus Atlas viability plan

Dead Campus Atlas is strongest when it is treated as an artistic archive with a data spine, not as a single flat spreadsheet. The viable product has three layers:

1. Public Atlas: one canonical record per selected campus, written for visitors.
2. Source Archive: raw PEPS, SHEEO, and manual evidence preserved without forcing it into one row.
3. Editorial Queue: missing coordinates, disputed claims, source gaps, and duplicates treated as production work.

## Current viable scope

The prototype in `dist/` uses the 34 confirmed curated campus records as the public layer and treats the 11,408 PEPS site records as the larger federal record mass. This gives the project a coherent public entry point without hiding the scale or incompleteness of the archive.

## Editorial rules

- A public campus page should represent one physical or institutional site.
- Raw PEPS rows should stay raw and remain available as evidence.
- Curated records should carry a source URL, verification state, and afterlife classification.
- Interpretive fields belong beside source fields, not inside them.
- `sourceUrl` should contain only URLs. Research notes should move to `sourceNote`.
- Typology labels should be normalized before publication.

## Next production steps

1. Consolidate the 78 non-PEPS queue rows into 34 canonical campus records.
2. Replace manual source notes with source URLs for the 14 curated/manual rows.
3. Add one short interpretive text block per campus: closure, transfer, afterlife.
4. Choose 50 campuses for the first public release.
5. Add image evidence or archival media per campus when available.
6. Create permanent IDs and stable citation URLs.
7. Decide publication mode: private proof, public web atlas, or exhibition kiosk.

## Public release bar

- Every public campus has coordinates.
- Every public afterlife claim has a source URL.
- Every campus has one normalized morphology.
- Raw and curated records are visibly separated.
- Visitors can search, filter, and understand why a campus is included within one screen.
