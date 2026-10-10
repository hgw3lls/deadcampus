# Where the data is: closures, mergers, consolidation, afterlife

Research notes for the Dead Campus Atlas, compiled 2026-10-09. Every source below was checked on that date unless marked otherwise. The point is not a bibliography but a map of which source answers which question, and what each one is bad at.

Three questions drive the atlas, and no single source answers more than one of them well:

| Question | Best sources |
|---|---|
| Which institutions and campuses stopped operating, and when? | FSA/PEPS closed-school file, IPEDS directory files stacked across years, NCES Digest table 317.50 |
| Which ones were absorbed, merged, or consolidated rather than closed? | IPEDS `NEWID`, system-level consolidation pages, Higher Ed Dive and BestColleges trackers |
| What happened to the land and buildings afterwards? | Nothing national. Local news, feasibility studies, parcel records, WARN notices, bankruptcy dockets |

## 1. Federal data

### FSA closed-school files (PEPS)
Already the atlas's federal layer. The Weekly Closed School Search File is cumulative, posted every Sunday, and is the only federal source with campus-level rows, including branch and additional locations. The 2026-10-04 pull has 23,013 detail rows against an official reported total of 24,294; the gap is the file's foreign and undated rows.

- Weekly file: https://fsapartners.ed.gov/additional-resources/reports/weekly-closed-school-search-file
- Monthly reports: https://fsapartners.ed.gov/additional-resources/reports/monthly-closed-school-reports
- Weakness: every Title IV site counts, so cosmetology schools and branch offices dominate. There is no reason-for-closure, no successor, and no property outcome.

### IPEDS institutional characteristics header (HD) files
The annual `HD<year>` file carries the closure fields. Confirmed in the 2023 dictionary:

| Variable | Meaning |
|---|---|
| `CYACTIVE` | Active in current year. 1 = yes, 3 = "No, closed, combined, or out-of-scope" |
| `CLOSEDAT` | Date institution closed, mmddyyyy |
| `DEATHYR` | Year the institution left the universe |
| `NEWID` | UNITID of the institution it combined into, when applicable |
| `DFRCGID` | Comparison group, useful for finding peers of a closed school |

What HD2023 actually contains, from a direct count:

| Measure | Count |
|---|---|
| Institutions in file | 6,163 |
| `CYACTIVE` = 3 (inactive) | 104 |
| With a `CLOSEDAT` date | 77 |
| Of those, private for-profit | 60 |
| Of those, private nonprofit | 17 |
| With `NEWID` set (combined into another) | 48 |

The catch: each year's HD file only keeps institutions that were in the universe that year, so a closure from 2019 is not in HD2023. A closure history means stacking HD files from 2002 onward and diffing UNITIDs. That is exactly what the Federal Reserve paper below did.

- Complete data files: https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx
- Easier route, all years via API: Urban Institute Education Data Portal, `college-university/ipeds/directory`, which exposes `currently_active_ipeds`, `date_closed`, `year_deleted`, and `newid` per year, one request per year with no pagination. https://educationdata.urban.org/documentation/colleges.html

**Pulled 2026-10-09.** `npm run pull:ipeds` stacks 2000 through 2024 into `_DATA/ipeds_directory_spine.csv`, one row per UNITID:

| Status | Meaning | Institutions |
|---|---|---|
| active | Present in 2024 and flagged active | 5,928 |
| closed | Has a close date, no successor | 2,178 |
| combined | `newid` points at the absorbing institution | 1,028 |
| dropped | Left IPEDS with no close date | 4,683 |
| total | | 13,817 |

Of the closed, 1,099 were degree-granting; 316 were private nonprofit, 1,822 for-profit, 37 public. Public institutions almost never close in IPEDS; they combine (276 public combinations, Georgia and Connecticut among them).

The large "dropped" group is the main caveat. Nine of the atlas's 34 public campuses are "dropped," not "closed," in IPEDS: Mount Ida, Wheelock, Marlboro, Dowling, Atlantic Union, Marymount California, New Rochelle, Virginia Intermont, and St. Gregory's all left the universe without a close date, usually because the school stopped reporting before its final year. IPEDS confirms closure; its silence does not deny it. Two more, Saint Rose and Fontbonne, were still active in the 2024 file because they closed after it, and Urbana shows as combined into Franklin University.

`npm run pull:ipeds:trajectories` then pulled fall enrollment and finance for those 33 sites, 2000-2024: 671 site-years in `_DATA/ipeds_trajectories.csv`. Coverage thins in the final years because closing schools stop reporting: 31 sites reported enrollment for 2015, 19 for 2019, 6 for 2023. Finance drops faster than enrollment (28 in 2015, 5 in 2022, 1 in 2023), which is the missing-data problem the Fed paper describes.

`npm run pull:ipeds:affiliation` pulled religious affiliation for the 3,276 private nonprofits in the spine from the institutional-characteristics component, walking back up to twelve years for institutions whose closing-year rows are blank. Result: Catholic colleges are 13.4% of active nonprofit degree-granting institutions and 7.3% of those that left since 2000. See `NARRATIVES.md` 3.4.

`npm run match:ipeds` linked 33 of the 34 public sites to UNITIDs by exact name within state. The GWU Virginia campus is a branch, not an IPEDS institution, and is linked by hand to George Washington University's UNITID.
- Robert Kelchen's 2024 walkthrough of this method, with a spreadsheet of the 70 institutions that left IPEDS in 2023-24: https://robertkelchen.com/2024/09/03/how-many-colleges-really-close-each-year/ (spreadsheet: https://robertkelchen.com/wp-content/uploads/2024/09/closures_sep24.xlsx). He flags that "combined" includes paper consolidations like Connecticut's community colleges, so `NEWID` is a merger signal, not a closure signal.

### NCES Digest table 317.50
"Degree-granting postsecondary institutions that have closed, by control and level," 1969-70 through 2022-23. The long-run official count of degree-granting closures, and the only series going back to 1969.

| Academic year | Total | Public | Nonprofit | For-profit |
|---|---|---|---|---|
| 2020-21 | 32 | 1 | 14 | 17 |
| 2021-22 | 34 | 0 | 14 | 20 |
| 2022-23 | 33 | 0 | 12 | 21 |

- https://nces.ed.gov/programs/digest/d23/tables/dt23_317.50.asp
- Counts only, no institution names. Degree-granting and Title IV only, which is why it runs far below PEPS.

### College Scorecard
`CURROPER` flags whether FSA considers an institution currently operating. Closed and merged schools stay in the download with `CURROPER` = 0, and the flag was refreshed in the March and June 2026 releases. Useful for joining enrollment, cost, and outcomes onto closed schools by OPEID.

- https://collegescorecard.ed.gov/data/data-documentation/

### FSA financial distress signals
- Financial Responsibility Composite Scores for private institutions, scale -1.0 to 3.0, below 1.0 is "not financially responsible." Annual files on the FSA Data Center: https://studentaid.gov/data-center/school/composite-scores (page timed out on 2026-10-09; the data.gov mirror lists files from 2006-07 onward: https://catalog.data.gov/dataset/composite-scores-for-private-non-profit-and-proprietary-institutions)
- Heightened Cash Monitoring lists, quarterly, HCM1 and HCM2: https://catalog.data.gov/dataset/institutions-on-heightened-cash-monitoring
- Loan forgiveness reports including closed-school discharge counts and borrower defense, last modified May 2026: https://catalog.data.gov/dataset/loan-forgiveness-reports

These are leading indicators. The Fed paper found that federal metrics alone predicted closures poorly, mainly because distressed schools stop reporting.

## 2. Research datasets

### Kelchen, Ritter, and Webber, "Predicting College Closures and Financial Distress" (2024-25)
The most complete institution-level dataset built so far: dates of operation, setting, students, staff, and finances for 2002-2023, assembled from stacked IPEDS files. Machine-learning models of distress; a worst-case demographic-cliff scenario of 80 additional closures. The Philadelphia Fed page offers only the working paper PDF, not the data, so the dataset would have to be rebuilt from IPEDS or requested from the authors.

- Fed page: https://www.philadelphiafed.org/consumer-finance/education-finance/predicting-college-closures-and-financial-distress
- NBER version: https://www.nber.org/papers/w33216
- FEDS 2025-003: https://federalreserve.gov/econres/feds/files/2025003pap.pdf

### SHEEO and National Student Clearinghouse, "A Dream Derailed?" (2022, 2023)
Student-outcome studies of 467 closed institutions and 143,215 affected students, July 2004 to June 2020, matched against 1.3 million controls. Key numbers: about 70% of those students experienced an abrupt closure without a teach-out, and students who lost their college were 50% less likely to earn any credential. No institution list is published, but the method and the closure universe are documented, and SHEEO's analysis underlies the Hechinger tracker below.

- Project page: https://sheeo.org/college-closures/
- Closed College Context file (748 closures; announcement date, abrupt versus orderly, teach-out, mergers, records custody, notes): wired into the build on 2026-10-10 from `_DATA/dead_campus_phase1_source_files/`. See `NARRATIVES.md` 3.15. It reports 26% of closures abrupt, against the report's roughly 70% of affected students, because the abrupt closures were large.
- Report 1: https://sheeo.org/wp-content/uploads/2022/11/SHEEO_NSCRC_CollegeClosures_Report1.pdf
- Report 2: https://sheeo.org/wp-content/uploads/2023/04/SHEEO_CollegeClosures_Report2.pdf

### Ithaka S+R, "Public College and University Consolidations: Implications for Equity" (2021)
The main study of public-system consolidations, with cases from Georgia, Texas, and Wisconsin.

- https://sr.ithaka.org/wp-content/uploads/2021/08/SR-Research-Report-Public-College-University-Consolidations-Implications-for-Equity-083021.pdf

## 3. Journalistic trackers

These are the closest thing to a curated closures-and-mergers list for nonprofits and publics, which is the atlas's public layer. None offers a download; all would need scraping or hand entry.

| Tracker | Coverage | Status | Notes |
|---|---|---|---|
| Higher Ed Dive, "A look at trends in college consolidation since 2016" | Public and nonprofit closings, mergers, acquisitions, 2016 to present | Live, updated as news arrives | Excludes for-profits and public consolidations where campus footprints stayed. State map. https://www.highereddive.com/news/how-many-colleges-and-universities-have-closed-since-2016/539379/ |
| BestColleges, "Tracking College Closures and Mergers" | Nonprofit closures and mergers, March 2020 to 2027 announcements | Updated 2026-04-16 | 49 closures and 40 mergers in an 89-row table with state, type, year, enrollment, reason. Latest entries include 2027 mergers for Albany College of Pharmacy and Rosemont. https://www.bestcolleges.com/research/closed-colleges-list-statistics-major-closures/ |
| Hechinger Report, "Tracking college closures" | Degree-granting and non-degree closures, 2008-2023, from SHEEO analysis | Frozen, last updated December 2024 | 843 total including non-degree schools. Best for the 2008-2020 for-profit wave. https://hechingerreport.org/tracking-college-closures/ |
| Chronicle of Higher Education, college closures interactive | Unknown | Returned 403 on fetch | Paywalled; check manually. https://www.chronicle.com/interactives/college-closures |
| Bryan Alexander, closures-mergers-cuts surveys | Closures, mergers, and program cuts, with a crowdsourced spreadsheet | Running; summer 2026 survey posted 2026-06-30 | Best source for the "queen sacrifice" program-cut layer that precedes closure. https://bryanalexander.org/ |

Why the counts disagree: PEPS counts every Title IV site; NCES counts degree-granting institutions; Higher Ed Dive and BestColleges count nonprofits and publics only and date by announcement, not by last day of instruction. The atlas should record which definition each record satisfies.

## 4. Mergers and consolidation

There is no national merger database. The Azziz, Hentschke, Jacobs, and Jacobs book *Strategic Mergers in Higher Education* (Johns Hopkins, 2019) analyzed over 100 U.S. mergers since 2000 but does not publish the list. Sources that do exist:

- IPEDS `NEWID`, the only structured merge pointer. 48 institutions in HD2023 alone.
- University System of Georgia consolidation page, nine completed pairings since 2012, no dates on the page itself: https://www.usg.edu/consolidation/
- Vermont State University, formed July 2023 from Castleton, Northern Vermont University (Lyndon and Johnson), and Vermont Technical College; campuses stayed open: https://vermontstate.edu/news/on-anniversary-of-controversial-merger-vtsu-officials-say-theyve-turned-the-page/
- Connecticut State Community College, 12 colleges into one on July 1, 2023: https://ctmirror.org/2023/06/22/ct-state-community-college-merger-cscu/
- Minnesota North College, five colleges and six campuses merged: https://m.startribune.com/five-northeast-minnesota-colleges-merge/600156663/
- PASSHE, six universities into two under Act 50 of 2020, which bars outright closure: https://www.highereddive.com/news/flagging-pennsylvania-system-proposes-integrating-colleges/581838/
- University of Wisconsin branch campus closures, the one maintained list of public branch closures: https://en.wikipedia.org/wiki/Closures_of_the_University_of_Wisconsin_branch_campuses

Consolidation matters for the atlas because the campus often survives the institution. Georgia and Connecticut closed no campuses. Wisconsin closed campuses without closing institutions. These are different morphologies and PEPS cannot tell them apart.

## 5. Regulators and accreditors

State and accreditor pages are where closure becomes official and where teach-out and records-custodian details live.

- New York State Education Department, closures of degree-granting institutions, with closure dates and announced closures: https://www.nysed.gov/college-university-evaluation/closures-degree-granting-institutions (certificate error on fetch 2026-10-09; open in a browser). New York officials count 18 degree-granting closures or announcements since 2016.
- Massachusetts Department of Higher Education, Financial Assessment and Risk Monitoring under the 2019 law. Screenings are confidential unless a school is found at risk; Anna Maria College was flagged and then closed in 2026. Proposed changes announced 2026-09-29 would require 18-month student warnings: https://www.highereddive.com/news/massachusetts-beefs-up-closure-warnings-for-at-risk-colleges/831820/
- HLC institutional actions, posted within 30 days, and Public Disclosure Notices for sanctions, withdrawals, and resignations: https://www.hlcommission.org/for-students/accreditation-actions/ and https://www.hlcommission.org/k8ur
- MSCHE non-compliance and adverse actions, with downloadable letters per institution, plus commission meeting actions: https://www.msche.org/2024/03/18/march-2024-commission-meeting-actions/
- SACSCOC change-in-membership list, which records closures after the last credential is conferred: https://sacscoc.org/app/uploads/2024/12/Change-in-Membership.pdf
- ACCSC voluntary withdrawals and closures, rolling 12 months, for the career-school tier: https://www.accsc.org/Commission-Actions/Voluntary-Withdrawals.aspx
- NECHE public actions: not verified in this pass; check neche.org directly.
- State WARN notices date the layoffs and often precede the closure announcement, for example College of Saint Rose: https://dol.ny.gov/warn-college-saint-rose-capital-region-412024-notice-dated-2152024-amended-3222024

## 6. Financial records behind a closure

- IRS Form 990 for nonprofit colleges, searchable and API-accessible through ProPublica Nonprofit Explorer: https://projects.propublica.org/nonprofits/
- Municipal bond disclosures and defaults on EMMA, since many small colleges financed buildings with tax-exempt bonds: https://emma.msrb.org/
- Bankruptcy dockets on PACER for the Chapter 11 and Chapter 7 cases, which include the asset sale orders that settle who bought the campus. College of New Rochelle, Southern Vermont, and St. Gregory's all resolved this way.

## 7. Campus afterlife and real estate

No national dataset tracks what happens to a closed campus. The patterns reported in 2025-26 coverage are acquisition by another college, housing conversion, mixed-use town centers, workforce or K-12 reuse, and long vacancy under creditor disputes.

- Hechinger Report on housing conversions, including Fond du Lac and Waukesha: https://hechingerreport.org/?p=117978
- Governing on closed campuses and the housing shortage: https://www.governing.com/urban/closed-college-campuses-could-help-ease-the-housing-shortage
- Bisnow on developers and small-college closures: https://www.bisnow.com/news/national/adaptive-reuse/as-small-colleges-face-the-reaper-winners-and-losers-are-forming-134627
- Higher Ed Dive on Marylhurst's conversion to affordable housing: https://www.highereddive.com/news/marylhurst-closed-campus-reuse-affordable-efficient-housing/637112/
- NDSU thesis, adaptive reuse of Presentation College: https://library.ndsu.edu/ir/handle/10365/33835
- Local feasibility studies are the primary documents, for example Clinton Community College (2026): https://www.wamc.org/news/2026-08-19/final-feasibility-study-released-on-redevelopment-of-former-clinton-community-college-campus

For property-level truth, the sources are county assessor and recorder records, which name the grantee and sale price, and parcel aggregators such as Regrid. These are per-county and would be gathered campus by campus, which fits the atlas's curated layer rather than its federal layer.

## 8. Open structured data

- Wikipedia keeps "List of defunct colleges and universities in <state>" pages, which are the best candidate pool for growing the public layer from 34 toward 50. Example: https://en.wikipedia.org/wiki/List_of_defunct_colleges_and_universities_in_New_York_(state)
- Wikidata records dissolution dates (P576). A query run 2026-10-09 for U.S. items typed as university or college classes with a dissolution year of 2000 or later returned 70 items, so coverage is thin, but Wikidata QIDs are a good external key for permanent atlas IDs.

```sparql
SELECT ?org ?orgLabel ?d WHERE {
  VALUES ?cls { wd:Q3918 wd:Q189004 wd:Q38723 wd:Q1371037 wd:Q875538 }
  ?org wdt:P31 ?cls ; wdt:P17 wd:Q30 ; wdt:P576 ?d .
  FILTER(YEAR(?d) >= 2000)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
```

## 9. What to pull into the atlas next

In order of payoff for effort:

000. **Done 2026-10-10: every exit coded.** The 149 dropped and combined institutions not yet coded are in `curation/afterlife-exits.json`, so all 399 private nonprofit degree-granting exits from 2010-2024 are coded (30 curated, 100 sampled, 269 census). See `NARRATIVES.md` 3.13.
00. **Done 2026-10-10: census of closed private nonprofit colleges.** All 184 institutions IPEDS records as closed in 2010-2024 are coded in `curation/` (`public-sites.json` for 20, `afterlife-sample.json` for 44, `afterlife-census.json` for 120). 167 coded institutions with a closed campus form the extended layer on the site.
0. **Done 2026-10-09: pulled IPEDS enrollment and finance trajectories for the 34** into `_DATA/ipeds_trajectories.csv`; each dossier now shows its decline curve.
0. **Done 2026-10-09: geocoded the federal layer** with the Census batch geocoder into `_DATA/peps_geocoded.csv`: 17,267 of 22,346 domestic addresses matched (77.3%), 12,211 exact. Coordinates are merged into `federal-records.js`, which grew from 11.5 MB to 12.2 MB.
0. **Done 2026-10-10: refreshed both spines.** The FSA weekly report of 2026-10-04 added 51 sites (none retired, no id moved; ids now come from `_DATA/fsa_site_ids.csv`). The IPEDS directory for 2025 was pulled, extending the spine to 2000-2025: 92 new UNITIDs and 147 institutions changed status, 30 of them private nonprofit degree-granting. Those 27 not already coded were coded, which moved the census frame from 2010-2024 to 2010-2025.
1. **Done 2026-10-09: stacked IPEDS directory files 2000-2024 through the Urban Institute API** into `_DATA/ipeds_directory_spine.csv`, joinable to PEPS by OPEID. See section 1.
2. **Done 2026-10-09: public-layer records carry IPEDS UNITIDs and OPEIDs** in `curation/public-sites.json`. Wikidata QIDs are still open.
3. **Done 2026-10-10: joined the spine to PEPS by OPEID** (exact, root, then additional-location root). 17,783 of 22,962 sites match; `ipedsStatus`, `ipedsMatch`, `ipedsUnitid`, and `successor` ship in the federal bundle, which grew to 13.4 MB. See `NARRATIVES.md` 3.11.
4. **Hand-enter the BestColleges and Higher Ed Dive tracker rows into the editorial queue.** About 90 and 145 rows respectively. They are the nonprofit closures the public layer is about, and they carry reasons and merger partners. The spine's 316 closed nonprofits are the candidate pool to reconcile them against.
5. **Add a distress layer from composite scores and HCM.** Not for publication but for choosing which open campuses to watch.
6. **For each public campus, file the bankruptcy order, deed, or press release that names the buyer** as the source URL, in the pattern already used for the 34.

## Sources consulted but not cited above

- Cato Institute on why closure counts differ by source: https://www.cato.org/node/119292.md
- Higher Ed Dive on the Fed paper: https://www.highereddive.com/news/college-closures-demographic-cliff-forecast-philly-fed/734650/
- Chronicle on state consolidations: https://www.chronicle.com/article/more-states-are-looking-at-consolidating-their-public-colleges-does-it-work
- SDPB, Higher Ed Dive, VTDigger, and others already cited in `curation/public-sites.json`
