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
- IPEDS spine. `npm run pull:ipeds` stacks the 2000-2024 directory files into `_DATA/ipeds_directory_spine.csv` with closed, combined, and dropped status per institution; `npm run match:ipeds` links 33 of the 34 public sites to UNITIDs and the GWU branch to its parent. `DATA_SOURCES.md` records what the spine shows.
- IPEDS trajectories. `npm run pull:ipeds:trajectories` pulls enrollment and finance 2000-2024 for the 33 matched curated sites and all 222 extended records (4,199 site-years); the dossier shows peak and final enrollment and deficit years. The portal has no 2025 enrollment or finance yet (2024 itself holds only 8 enrollment rows), so the series ends at 2024.
- Event sequences. Each public site carries dated status-code events with sources; ten have month-dated transfer sequences, and the build derives time in limbo.
- Replacement matrix. Every public site carries `originalSystem`, `buyerSector`, and `replacementSystem` from controlled lists; morphology is derived from the replacement system and the validator checks the vocabulary.
- Page weight. The eager data file is 246 KB (was 1.2 MB). The extended records are a lazy 563 KB bundle, and every asset URL carries a content digest.
- Closure process extended to for-profit exits. All 876 for-profit degree-granting exits SHEEO did not code are coded with its scheme: 630 closures, 194 consolidations, 35 still operating, 16 mergers, 1 unresolved. A second pass on the first pass's 141 unresolved resolved 133 using archived school sites and regulator notices, and a last pass settled 7 of the final 8 against the federal closed-school file. See `NARRATIVES.md` 3.16.
- Closure process wired in. The SHEEO closed-college file (748 closures) is joined to federal sites by OPEID: abrupt versus orderly, notice, teach-out, mergers, in the dataset, the federal table, case files, and a Readings test. See `NARRATIVES.md` 3.15.
- Stable site ids and a refresh that does not break them. `_DATA/fsa_site_ids.csv` is append-only; the 2026-10-04 FSA report added 51 sites without moving one id, and geocoding sends only new sites.
- IPEDS 2025 pulled and the census frame extended to 2010-2025: 27 new exits coded, 190 closed and 427 exits in all, each coded.
- Curated records fact-checked against their sources. All 34 were reviewed; corrections, new events, and prices are in `curation/CHANGELOG.md`. Four classifications that no longer matched the facts (College of New Rochelle, Dowling, Green Mountain, Wells) were corrected or flagged.
- Second pass over 220 coded records. 64 confirmed, 107 revised, 49 still unresolved; the original coding is kept in an overlay. See `NARRATIVES.md` 3.14.
- Federal data corrections. Four mistyped states and one wrong geocode are fixed in `curation/federal-corrections.json`, and the build fails on a new mismatch.
- One dataset. The curated 34, the extended 222, the coded-not-drawn 329, and the 23,013 federal sites are one table, `dist/data/atlas-records.csv`, with institution and site levels, a layer column, and a parent link. The validator checks ids, parents, and counts; federal rows link to their case files. See `DATASET.md`.
- Every exit coded. All 399 private nonprofit degree-granting institutions that left IPEDS in 2010-2024 are coded for campus fate, 222 closed campuses are on the map as extended records, and the share of exits that were real closures is an exact count (60%), not an estimate.
- Beyond the 34. A census of all 184 closed private nonprofit colleges 2010-2024 is coded; 167 closed campuses appear as the extended layer, marked as coded rather than curated, with the curated 34 unchanged. Promoting an extended record to curated means adding it to `curation/public-sites.json` with a summary, event sequence, and review.
- PEPS to IPEDS join. 77% of federal closure sites carry their institution's IPEDS fate; the Abyss table shows it and filters on it, and the branch-retreat reading reports that 73% of matched branch sites belong to institutions still operating.
- Interface redesign. The Terminal Education handoff (direction 2a) is implemented as the page shell, with the replacement-zone map, record index, case file split into evidence and reading, state bubbles, queue, decade chart, and the readings, bound to the generated data. Mobile layout included.
- Afterlife sample. 100 institutions drawn at random from the IPEDS exits and coded with sources; buyer shares and the share of exits that are real closures now carry intervals in the Readings panel.
- National retreat map. The Abyss view animates the 17,267 geocoded closure sites by year, with main campuses, branches, and the curated rings, and a hover readout. This is the first spread of the Phase 7 blueprint.
- Geocoded federal layer. `npm run geocode:peps` matches 77% of PEPS addresses through the Census batch geocoder; coordinates ship in the federal bundle.
- Sourced event sequences for all 34 campuses; 15 are dated closely enough to measure time in limbo.
- Readings panel. The Method view lists each thesis with its test, evidence, counter-evidence, and status, computed at build time. `NARRATIVES.md` is the plan behind it.
- Catholic-retreat test. `npm run pull:ipeds:affiliation`; result recorded in `NARRATIVES.md`.
- Source URLs for all 34 public sites. The 10 that had none now carry verified news or institutional citations in `curation/public-sites.json`, and `npm run validate:release` passes.

### Next

1. Decide publication mode: private proof, public web atlas, or exhibition kiosk. `.openai/hosting.json` already points at a static deploy; confirm or replace that.
2. Review the evidence-row verification states. 136 of 170 rows are `Pending`; decide which should be `Confirmed` or `Manual add` and record that in the queue CSV.
3. Restructure the 34 summaries into three parts per campus: closure, transfer, afterlife. Edit `summary` in the curation file.
4. Decide whether the first public release is the 34 or grows to 50. Growing means adding rows to the master table and curation entries for each, then raising `MINIMUM_PUBLIC_SITES` in `build_data.py`.
5. Firm up the 37 low-confidence second-pass resolutions and the 222 closures with no abrupt or orderly code, with regulator closed-school lists (IBHE, BPPE, SCHEV, TWC) read in a browser session, and resolve the last unresolved exit (Educational Technical College-Bayamón, which needs the Puerto Rico Consejo de Educación or ACCSC action history).
6. Look up county assessor and recorder records for the 124 coded campuses whose fate is unknown and the addresses reviewers named in the recheck notes. This is the step the web-search budget prevented.
7. Revisit the four curated classifications marked provisional in their editorial notes (Wells, Alderson Broaddus, Southern Vermont, Green Mountain) when their sales or openings resolve.
8. Add image evidence or archival media per campus: a `media` field in the curation file, an assets folder convention, and a validator rule first, then collection.

## Public release bar

- Every public campus has coordinates.
- Every public afterlife claim has a source URL, and the validator enforces it.
- Every public campus has a verification state from the controlled vocabulary.
- Every campus has one normalized morphology.
- Raw and curated records are visibly separated.
- Visitors can search, filter, and understand why a campus is included within one screen.
