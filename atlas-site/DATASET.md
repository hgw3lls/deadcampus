# The atlas as one dataset

`dist/data/atlas-records.csv` holds everything the atlas knows in a single table: 31,134 records, 88 columns. The column guide is `dist/data/atlas-records.schema.json`. Both are rebuilt by `npm run build:data` and checked by `npm run validate`.

The curated campuses, the extended records, and the federal closure sites used to live in three files with three ids. They are now rows of one table with one id space.

## Two levels, one table

The layers describe different things, so the table keeps the difference visible instead of flattening it.

| `kind` | One row is | Rows |
| --- | --- | --- |
| `institution` | A college, or a curated campus | 8,121 |
| `site` | One federal closure record: a main campus, branch, annex, or extension | 23,013 |

A site row carries `parent_id`, the `record_id` of its institution. An institution row carries rollups of its sites (`federal_sites`, `federal_main_sites`, `federal_branch_sites`, first and last closure year). Count institutions or sites by filtering on `kind`. Never count the whole table as one kind of thing.

## Layers

The `layer` column says how much is known about an institution. A site is always `federal`; its `institution_layer` carries its institution's layer so no join is needed.

| `layer` | Institutions | Meaning |
| --- | --- | --- |
| `curated` | 34 | Written for visitors, every claim sourced, reviewed. Full verification and event sequences. |
| `extended` | 222 | Campus closed. Coded from public pages with an evidence URL per claim. Drawn on the map as extended records. |
| `coded` | 329 | Coded, but not drawn: still operating, merged with the campus continuing, not a closure, unresolved, or a duplicate of a curated campus. Also 155 for-profit exits coded for closure process that have no federal site row (`coding_tier` is `closure-process`, with no `outcome`). |
| `federal` | 7,536 | Known only from the federal closure file and the IPEDS directory. No fate coded. |

Federal sites by institution layer: 21,790 under federal-only institutions, 692 under extended, 480 under curated, 51 under coded. Institutions with no federal site row are mostly coded ones that closed before the federal file's coverage or reported under a parent.

## Record ids

| Record | Id |
| --- | --- |
| Curated campus | its page id, e.g. `wells-college-ny` |
| Extended campus | its page id, e.g. `dana-college-ne` |
| Coded, not drawn | `coded-<unitid>` |
| Federal-only, matched to IPEDS | `ipeds-<unitid>` |
| Federal-only, no IPEDS match | `opeid-<root opeid>` |
| Federal site | `fsa-NNNNN`, a stable id from `_DATA/fsa_site_ids.csv` (see below) |

Curated and extended ids are the same ids as the page's `#campus/<id>` URLs.

## How rows are tied together

1. **IPEDS UNITID.** A federal site is joined to its IPEDS institution by exact 8-digit OPEID, then root 6-digit OPEID, then the additional-location rule (leading digit 1 or 2 restored to 0). `ipeds_match` records which rule fired. 17,832 of 23,013 sites match.
2. **Same campus, second unit.** Marlboro College Graduate & Professional Studies (UNITID 440411) is a second IPEDS unit on the curated Marlboro campus. Its row is kept with `duplicate_of = marlboro-college-vt`, and its federal site rolls up to the curated record.
3. **No match.** Sites that match no IPEDS institution are grouped by root OPEID into an `opeid-` institution. 2,903 institutions have no UNITID. Most closed before 2000, when the IPEDS spine starts. Their institution name is the commonest non-generic site name; 9 institutions only have generic names such as "Branch Campus".

## Column groups

Identity, place, keys, federal, ipeds, rollup, fate, curated, trajectory. A column is empty where it does not apply. Curated-only columns (summary, verification, events, sale price, editorial note) are empty for every other layer, on purpose: those claims have only been reviewed for the 34.

`outcome` uses the same vocabulary everywhere (`closed-campus-reused`, `closed-campus-unknown`, `merged-campus-continues`, `merged-campus-closed`, `still-operating`, `not-a-closure`, `unresolved`). For curated rows it is derived from the dated events: reused if a completed ownership transfer is recorded, otherwise unknown. `coding_tier` says how the fate was established: `curated`, `sample` (the seeded random sample), or `census`.

## Closure process

Sixteen columns (`process_source`, `process_event`, `process_confidence`, `closure_announced`, `lead_time_days`, `abrupt_closure`, `teach_out`, `merger_attempt`, `merger_note`, `peps_merge`, `records_custody`, `accreditors`, `sheeo_note`, `sheeo_sources`, `sheeo_date_differs`, `sheeo_sites`) come from the SHEEO closed-college file and, where SHEEO has no row, from this project's coding of for-profit exits with the same scheme (`process_source` says which). SHEEO has 748 rows, one per OPEID, which is the grain of a federal closure site, so the values sit on site rows. An institution row carries its main site's values if the main site is in the file, otherwise its earliest closing site's, and `sheeo_sites` counts how many of its sites are in the file. 604 institutions have values. `lead_time_days` is empty where the announcement date is unknown or falls after the closure (20 rows). `sheeo_note` keeps the researchers' wording, including their working remarks.

The atlas-coded rows (`process_source` = Atlas coding) are for-profit degree-granting institutions that left IPEDS from 2010 to 2025 and have no OPEID in the SHEEO file. The coding unit there is the institution, so its values sit on the main federal site and roll up to the institution row. `process_event` records what the exit was: closure, consolidation (a unit folded into another of the same company), merger, still-operating, or unresolved. `abrupt_closure` is set only for a closure. All 876 institutions in that frame are coded: 536 closures, 172 consolidations, 141 unresolved, 16 still operating, and 11 mergers. 383 are low confidence, and 158 of the closures have no abrupt or orderly code because no source was found.

## Stable site ids

The federal file is sorted newest first, so a site's row number changes every week. Ids are therefore kept in `_DATA/fsa_site_ids.csv`, keyed by OPEID, closed date, name, location, and address. The registry is append-only: a site that disappears from the report keeps its id, a new site gets the next number, and an id is never reused. The ids already published were frozen as they were, so every earlier geocode and citation stayed valid. `tools/refresh_fsa_reports.py` assigns ids; `tools/geocode_peps.py` sends only sites with no geocode yet.

## Corrections and second passes

- `state_reported` holds the state as written in the federal file when `curation/federal-corrections.json` changed it. The file has four entries today. The build flags any new site that the Census geocoder places in a different state than the federal file reports, and the validator fails until it is corrected or dropped.
- `rechecked_on`, `recheck_verdict`, `recheck_changed`, and `recheck_note` record the second pass (`curation/afterlife-rechecks.json`). The first coding is kept in the afterlife-sample, census, and exits files; the recheck overlay replaces only the fields in `recheck_changed`. 220 institutions have been rechecked.

## What the table does not claim

- It is not a count of closed campuses. Federal rows are closure *sites* and include branches of institutions that still operate. Use `outcome` on institution rows for campus fate.
- Federal-only institutions have no fate. An empty `outcome` means not coded, not "no change".
- Coordinates come from three sources, named in `coordinate_source`: curated, the IPEDS directory, or the Census batch geocoder. 17,308 of 23,013 sites and 7,692 of 8,121 institutions have one. The Census geocoder matched 17,309; one match was withheld because it placed a Florida site in North Carolina.
- Trajectory columns exist for the curated and extended records, because enrollment and finance were pulled only for them.

## Use

```python
import csv
rows = list(csv.DictReader(open("atlas-records.csv", encoding="utf-8")))
institutions = [r for r in rows if r["kind"] == "institution"]
coded = [r for r in institutions if r["outcome"]]          # 430 institutions with a campus fate
sites_of = lambda rid: [r for r in rows if r["parent_id"] == rid]
```

On the page, the Method view shows the layer counts and a download link, and each federal row whose institution has a case file links to it.

## Rebuild

`tools/atlas_dataset.py` builds the table; `tools/build_data.py` calls it after the curated, extended, and federal layers exist and before the federal bundle is written, because the build stamps each federal site with its institution's page id (`record`). The build stops if ids collide, a site has no parent, site rows differ from the federal count, or a curated or extended record is missing from the table.
