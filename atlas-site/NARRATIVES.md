# From theory to data-narratives

A plan for linking the atlas's theoretical frame to its data, written 2026-10-09. The frame is set out in the Phase 7 blueprint and the Phase 4, 5, 6, 10, and 12 workbooks: territorial withdrawal of educational infrastructure under neoliberalism, a replacement economy, a status-code system, a replacement matrix, six territorial belts, ten publication spreads, and seven research questions. The problem this plan addresses is that those claims and the data sit in separate files. The theory reads as assertion and the data reads as inventory.

The rule for everything below: a thesis enters the public site only as a testable claim with a base rate, a data test, current evidence, counter-evidence, and a status of supported, mixed, or untested.

## 1. Robustness

### 1.1 Base rates, not anecdotes
The overlay sheets say hospital systems absorb educational land. The evidence is two campuses in 34. The IPEDS spine holds 316 closed and 491 dropped private nonprofit degree-granting institutions since 2000. Afterlife-coding a sample of those by buyer sector is what makes the claim a number.

- Unit of work: one spine row, coded with original system, buyer sector, replacement system, and a source URL.
- Target: 100 coded nonprofit closures, stratified by exit year and region, before any sector claim goes public.
- Where they live: a new `curation/afterlife-sample.json`, same shape as the public-site entries, so the same validator and build apply.

### 1.2 One vocabulary
Three overlapping vocabularies describe the same thing: the status codes in the blueprint (ACTIVE-RISK, CLOSURE-EVENT, ASSET-TRANSFER, PARCELIZED, CLOUD, SECURITY, RUIN, COUNTER-USE), the morphology in the build (Absorbed, Parcelized, Speculative, Health, and so on), and free-text afterlife. The Phase 6 replacement matrix has the right shape and should become the canonical one:

| Field | Meaning | Controlled? |
|---|---|---|
| `originalSystem` | What the campus was: liberal arts, Catholic, eco-college, for-profit, research | yes |
| `buyerSector` | Who took it: hospital system, elite university, public authority, REIT, developer, federal agency, K-12, religious, Indigenous, none | yes |
| `replacementSystem` | What it became: care, cloud, security, housing, K-12, land bank, fragments, ruin | yes |
| `morphology` | The atlas's visual class, derived from the three above | derived |
| status codes | The event sequence, see 1.3 | derived from events |

Morphology stays as the map's color key but is derived, not hand-entered.

### 1.3 Campuses as event sequences
A closure is a sequence, not a row. The status-code system is already a timeline: ACTIVE-RISK, CLOSURE-EVENT, ASSET-TRANSFER, then PARCELIZED, CLOUD, SECURITY, RUIN, or COUNTER-USE. Each public site now carries an `events` array in the curation file: a date (year, month, or day precision), a type from that vocabulary, a label, and a source URL. The build derives time in limbo (closure to first transfer) and the validator checks types, dates, and URLs.

This is the single change that makes most narratives computable. Southern Vermont closed in spring 2019 and sold in December 2020. Virginia Intermont closed in 2014 and has no transfer event. Both are now one query.

### 1.4 Geocode the federal layer
Phase 10 and 12 both name this as the next technical step. The Census Bureau batch geocoder is free and takes 10,000 addresses per request. PEPS rows carry street addresses. Until this is done, none of the overlay theses can be tested, because they are all spatial.

### 1.5 Source per claim
The 34 now have at least one source URL per record. The next bar is one per field: buyer, price, and transfer date are separate claims and can be separately wrong. The event array gets this for free, since each event carries its own source.

## 2. Making the theory visible

### 2.1 A Readings view
A fourth tab beside Archive, Abyss, and Method. One panel per research question or publication spread, each with:

- the claim, in the project's own words
- the data test, stated so someone else could run it
- current evidence, as numbers from the build
- counter-evidence
- status: supported, mixed, untested

Rendered in the audit language the visual grammar asks for. The point is that the site is honest about which parts are still conjecture.

### 2.2 The replacement matrix as a figure
A flow from `originalSystem` to `buyerSector` to `replacementSystem`, built from data, so the replacement economy is something a visitor sees rather than a phrase they are told.

### 2.3 The status-code distribution over the Abyss
The queue already codes 11,414 closure events against 35 asset transfers, 31 parcelizations, 3 cloud, 3 security. The ratio is the argument of the Abyss: almost nothing in the federal layer has a known afterlife.

## 3. Data-narratives

Each narrative names the thesis it serves, what the data already shows, and what it still needs.

### 3.1 Closure is a deficit curve
Thesis: institutional collapse is slow then sudden; enrollment is the visible symptom, finance the cause.
Evidence now: 29 of 33 matched campuses ran deficits in three or more of their last five reported years; median enrollment decline from peak was 42%. Green Mountain lost only 19% of its students and still ran five straight deficits. Fontbonne lost 89%.
Needs: nothing. The dossier already renders the curve.

### 3.2 Public institutions do not die, they combine
Thesis: the campus survives the institution; consolidation is a territorial strategy, not a closure.
Evidence now: 37 public closures against 276 public combinations in the spine. Georgia's nine consolidations and Connecticut's twelve-into-one closed no campuses. Wisconsin closed branch campuses without closing institutions.
Needs: a combined-institution view in the Abyss, keyed on `newid`.

### 3.3 The Abyss is for-profit
Thesis: distributed for-profit education behaved like franchise retail and collapsed like it.
Evidence now: 1,822 for-profit closures against 316 nonprofit; the 2016 spike of 447 closures tracks the ITT collapse.
Needs: branch-campus share of PEPS closures by year, which the site-type field already supports.

### 3.4 Catholic retreat geography
Thesis: Catholic campus closures are part of a wider religious institutional withdrawal.
Test: among private nonprofit degree-granting institutions, is the Catholic share of those that left IPEDS higher than the Catholic share of those still active? `npm run pull:ipeds:affiliation` runs it from the IPEDS religious-affiliation field.
Result (2026-10-09): not supported on base rate. Catholic colleges are 13.4% of the 1,680 active nonprofits but 7.3% of the 822 that left IPEDS since 2000, and 10.3% of the 214 outright closures. Sixty Catholic exits in all. The absolute count is real and the Rust Belt cluster is real, but Catholic colleges are under-represented among exits, not over-represented. The Readings panel marks this mixed.
Needs: diocesan property data to test the "wider religious retreat" half of the claim, which closure rates cannot answer.

### 3.5 Time in limbo
Thesis: ruin is a duration, not a type; the gap between closure and transfer is where speculation happens.
Result (2026-10-09): 15 campuses are dated to the month on both ends. The median wait for a completed ownership change is 8 months. Virginia Intermont is the longest at 31 months (closed May 2014, sold at auction December 2016, burned December 2024), followed by Cazenovia at 30 and Concordia Portland at 27. Two campuses, Mount Ida and Burlington College, sold or agreed to sell before they closed. The thesis holds as a spread, not a typical case: the 8-month median says most campuses find a buyer quickly, and the long tail is where the "ruin" type lives.
Caveat: the 15 are the campuses with press coverage dense enough to date, which skews toward quick, visible sales. Fourteen more have a completed transfer but only a year for the closure, four have no completed transfer on record (Wells, Fontbonne, Wheelock, and Becker, whose purchase date I could not verify), and Marygrove's handover is dated only to 2018.
Needs: month-level closure dates for the remaining campuses, from accreditor actions and board minutes.

### 3.8 Who takes the land
Thesis: the replacement economy has identifiable buyers.
Result: Universities took 7 of 34 campuses (4 elite or private, 3 public). Private owners and real-estate capital took 7. Hospital systems took 2. The remaining 18 are spread over a dozen sectors including a federal agency, a cloud company, an arts organization, and a charter network. Universities and private capital tie; the hospital thesis rests on two cases and stays untested until it is compared against a hospital-acquisition layer.
Needs: the same coding applied to the afterlife sample from the spine, so the shares become rates.

### 3.10 An exit is not a death
Thesis (implicit in every count so far): when an institution leaves the federal directory, its campus died.
Test: a seeded stratified sample of 100 of the 369 private nonprofit degree-granting institutions that left IPEDS in 2010-2024, each hand-coded with sources. The sample was drawn before the 2025 directory existed and is not redrawn; its estimates use each record's current coding after the second pass (3.14).
Result (2026-10-09): 64 of 100 (95% interval 54 to 73%) were confirmed campus closures. Ten merged and the campus continued, sixteen are still operating, seven were administrative reclassifications, and three could not be resolved. Among the 36 sampled "dropped" institutions, 15 were still operating. IPEDS "dropped" is the largest status in the spine at 4,683 and is the least reliable as a death signal.
Consequence: every figure in this project that counts IPEDS exits as closures, including the retreat-intensity ranking in 3.9 and the federal totals, overstates closures by about a third for this population. The for-profit and non-degree exits that make up most of the federal layer were not sampled, so the correction cannot be extended to them.
Who took the closed campuses (24 with an identified buyer): religious bodies 25%, private owners and developers 17%, other private colleges 12%, K-12 and charter schools 12%, the rest one each across seven sectors. Hospital systems took none; the interval is 0 to 15%. More than half of confirmed closures have no buyer found at all, which is itself the finding the Abyss implies: the afterlife is mostly unrecorded.
Audit: every identified buyer, plus 6 of the 23 operating or not-a-closure cases and 4 of the 36 closed-unknown cases, was re-checked against its cited page before publication. Six records were corrected or downgraded. Two moved from "closed, campus reused" to "closed, campus unknown" (a co-tenant mistaken for a buyer, and a sale agreement that had not closed), which left the 64% confirmed-closure share unchanged. The unaudited 56 are mostly unresolved or closed-unknown cases with no buyer claim.

### 3.13 Every exit, counted
Thesis: an institution that leaves the federal directory has died.
Test: no sample this time. All 427 private nonprofit degree-granting institutions that left IPEDS in 2010-2025, each coded for what happened to its campus: 31 curated, 100 sampled, 296 coded in the census passes.
Result (2026-10-10): 254 (59%) were confirmed campus closures. Another 34 merged with the campus continuing, 110 (26%) are still operating or were never closures, and 29 could not be resolved. The sample's estimate of 64% (54 to 73%) was close.
The three IPEDS statuses behave very differently. Of the 190 institutions marked closed (those with a close date), 89% were campus closures and only 7 turned out not to have closed. Of 78 marked combined, 32% were: most were administrative folds, 28 not closures at all and 19 mergers where the campus kept operating. Of 159 marked dropped, 38% were; 67 were still operating, many as independents that simply stopped reporting. The status, not the exit, carries the information.
Consequence: counts that treat every exit as a closure overstate closures by about two thirds in this population. The correction applies to nonprofits only; the for-profit and non-degree exits that dominate the federal layer were not coded.
Who held the 79 closed campuses with an identified holder across the coded set (excluding the curated 34): religious bodies 23%, private owners and developers 16%, civic nonprofits and other private colleges 10% each, multiple buyers and K-12 and charter schools 9% each. Hospital systems took two. Adding the 31 curated campuses with a completed transfer, hospital systems took four of 110 identified holders.
Caveats: records marked low confidence rest on directory pages or inference, and 29 institutions are unresolved. A coded institution that shares a campus with a curated one (Marlboro College Graduate and Professional Studies) is counted once on the map and in buyer shares. The 2025 directory added 27 exits to the frame that the 2010-2024 version missed.

### 3.12 The afterlife is mostly unrecorded
Thesis: closed campuses are being absorbed into a replacement economy.
Test: a census, not a sample. Every private nonprofit degree-granting institution IPEDS records as closed in 2010-2025, 190 in all, coded for what happened to its campus: 21 curated, 44 from the random sample, 125 coded in the census pass.
Result (2026-10-10): a new holder or user of the campus was found for 76 (40%). For 93 (49%) the closure is documented but the campus fate was not found. Nine merged with the campus continuing, seven turned out not to have closed, and five could not be resolved.
Who took the 70 campuses with an identified buyer: religious bodies 19%, private owners and developers 16%, multiple buyers 10%, K-12 and charter schools 10%, real-estate capital 9%, civic nonprofits 7%. Hospital systems took 3 (4%).
Two consequences. First, the replacement economy the blueprint describes is a thin documented layer over a mostly silent one: the confident reading applies to about two fifths of closures. Second, the buyers are less corporate than the thesis implies. Churches, schools, and other colleges are the commonest successors; speculative capital is a minority.
Reliability: where IPEDS gives a close date it is a good signal, since only 7 of the 190 turned out not to have closed. The unreliable group is institutions that simply stopped reporting.
Audit: in the sample every identified buyer was re-checked against its page and two were recoded (see 3.10). The second pass in 3.14 then re-opened 220 coded records, including the weakest and every record with a fate marked unknown, and moved 7 closed-campus-unknown records to campus reused or not a closure. Records that remain unknown were re-searched and are dated 2026-10-10 in their notes.
Caveats: absence of a source is not absence of an afterlife. The population is nonprofits; for-profit and non-degree closures, the bulk of the federal layer, were not coded.

### 3.11 Franchise retreat, not institutional death
Thesis (Phase 7 and Phase 12): distributed for-profit education behaved like franchise retail and collapsed like it.
Test: join every federal closure site to its IPEDS institution by OPEID, then read the institution's 2000-2025 status.
Result (2026-10-10): 17,832 of 23,013 sites (77%) match. Two thirds of them, 11,579, belong to an institution that was still reporting in 2025. Of 16,201 matched branch and annex sites, 11,507 (71%) do. Only 72 matched main-campus sites sit under a still-reporting institution, and 973 of the 1,631 are institutions that closed. The federal layer is mostly the shedding of branches by institutions that survived.
The match needed two repairs. Additional locations carry a root OPEID whose leading digit was changed to 1 or 2, so the join restores the leading zero; that recovered 1,594 sites, almost all under active parents. The 5,181 sites that still do not match are overwhelmingly pre-2000 closures: 4,528 closed before the IPEDS window opens.
Caveats: "still reporting" is a statement about the parent, not about the site. The join cannot say how far a parent shrank. The franchise-retail comparison itself still needs a retail layer.

### 3.14 A second pass over the coded records
Thesis (method): a coding is a claim, and the weakest ones should be re-read by someone who did not make them.
Test: select every coded institution with a reason a reader can see in the data (low confidence, a single source or only Wikipedia, a campus fate marked unknown, a closure date far from the IPEDS exit, an IPEDS status that contradicts the coded outcome, or no resolution), and have an independent reviewer re-open the cited pages, find a different source where one exists, and look for developments since the first coding.
Result (2026-10-10): 220 records were rechecked. 64 were confirmed as coded, 107 were revised, and 49 remain unresolved. 19 changed outcome: 7 campuses moved from fate unknown to a named holder (6) or to not a closure (1), 4 unresolved records became still operating, and 8 others moved among unresolved, unknown, reused, and merged. 81 changed confidence, 13 of them downward. The sample estimate of 64% (54 to 73%) did not change.
Rules that kept the pass honest: a revised record keeps its first coding alongside the revision; a confidence upgrade needs a new page and, for high, two independent hosts that are not IPEDS-derived directories (two requested upgrades were held back); every claim still carries a page the reviewer read.
Limits: the web-search budget ran out partway, so most "campus fate not found" results mean "not found in pages that could be fetched", not "no sale happened". Reviewers named the property-record lookups (county assessor and recorder) that would resolve most of the remaining unknowns. An independent check of the new evidence found that 199 of 250 cited pages contain the claim's key terms; most of the rest are directory pages or sites that block automated readers.

### 3.15 How closures happened
Thesis: closures arrive without warning, and the students are left.
Test: join the SHEEO closed-college file, 748 closures that researchers coded for announcement date, abrupt versus orderly, teach-out plan, merger attempts, and where student records went, to the federal closure sites by OPEID. Every row matched a site, and 747 agree on the closed date.
Result (2026-10-10): 190 of 740 coded closures (26%) were abrupt and 550 orderly. The split is by sector: 37% of 476 for-profit closures were abrupt, 7% of 195 nonprofit, none of 68 public. Among the 460 with a dated announcement the median notice was 128 days, and 145 gave under 30. Abrupt closures gave a median of 2 days; orderly ones gave 253. A teach-out plan is recorded for 423 of the 748.
Timing: abrupt closures cluster in a few years, not evenly. 2018 has 60 of 147 coded closures abrupt, 2014 to 2016 about a third each, 2017 about one in ten, 2019 about one in five. That pattern follows the collapses of a few large chains, not a steady rate.
What it does not show: the 26% counts closures, not students. SHEEO's own report finds about 70% of affected students went through an abrupt closure without a teach-out, because the abrupt closures were the big ones. This file has no enrollment per closure, so the student-weighted figure cannot be reproduced here. "Orderly" also means a plan existed, not that students were unharmed.
Fate: only 9 of the 80 coded institutions in the atlas with an abrupt flag closed abruptly, so notice cannot be tested against what happened to the campus. The coded set is nonprofit and abrupt closures are mostly for-profit. The notes in the file almost never name who bought a facility: none of the 36 unknown-fate or unresolved site rows that overlap does.
Coverage: closures dated 2004 to 2020, mostly 2014 to 2019, so this describes the last cycle of closures, not the whole federal layer.

### 3.16 The same questions for for-profit exits
Thesis: the SHEEO result, that closure is abrupt mainly in the for-profit sector, holds for the for-profit exits SHEEO did not code.
Test: apply SHEEO's scheme (announcement date, abrupt or orderly, teach-out, merger, records custody) to the for-profit degree-granting institutions that left IPEDS from 2010 to 2025 and have no OPEID in the SHEEO file. 876 institutions fall in that frame, all coded, and one decision comes first for each: was the exit a closure at all.
Result (2026-10-10): of the 876, 625 are closures, 193 are consolidations of a unit into another unit of the same company, 34 still operate, 16 are mergers, and 8 remain unresolved. A first pass left 141 unresolved; a second pass read each school's archived website and the regulator notices that referenced it and resolved 133 of them. The IPEDS status predicts the event sharply: 140 of the 144 "combined" for-profit units are consolidations or mergers rather than closures, 530 of the 581 "closed" units are closures, and the "dropped" units split into 91 closures, 28 still operating, 23 consolidations, 5 mergers, and 4 unresolved. That last split is the finding: more than a third of for-profit units that merely stopped reporting were not closures. Of 407 closures with a recorded type, 210 (52%) were abrupt.
That figure is one chain. ITT Technical Institute is 127 of the 378 and 125 of those were abrupt: ITT shut every campus on September 6, 2016. Without ITT, 85 of 280 (30%) were abrupt, and most of those are other collapses: Brightwood (23, Education Corporation of America, December 2018), Vatterott (11 chain-wide on December 17, 2018) and a scatter of single-campus shutdowns. University of Phoenix, Brown Mackie, and Westwood units closed in announced waves with teach-outs.
What it adds to 3.15: abruptness in the for-profit sector is concentrated in a handful of corporate failures, not a steady rate, so campus counts overstate how often a given closure was abrupt. A closure can also be a consolidation with no student displaced, which SHEEO's file does not distinguish.
Quality: 217 records are high confidence, 371 medium, and 288 low. The second pass leaned on archived copies of the schools' own sites, which supplied closure notices, teach-out partners, and records custodians that press and regulators did not, but which also leave many closures dated only to the weeks when a campus page vanished. 45 of the second-pass resolutions are low confidence and are inferred from a site going dark; they are marked as such in their notes. 218 closures have no abrupt or orderly code. The records marked "closure" for University of Phoenix state units are judgment calls: the institution continued online while ground campuses closed.
Scale: this is campus units, not students. ITT alone is a fifth of the closures coded.

### 3.9 Retreat intensity by state
Thesis: educational retreat is territorial, not uniform.
Result: of degree-granting institutions present since 2000, 54% of Florida's have left IPEDS, 50% of Indiana's, 48% of Colorado's and 47% of Minnesota's, against 30% in New York, 23% in Massachusetts and 20% in North Carolina. The ranking largely tracks for-profit sector mix, so it measures where the for-profit wave landed more than where nonprofit campuses died.
Needs: split by control, and population or enrollment denominators.

### 3.6 The website dies first
Thesis: digital withdrawal precedes and outlasts physical withdrawal.
Test: Wayback Machine snapshot timelines per domain, compared with IPEDS close dates. Marlboro's site has captures from 1997 through 2021 and none after.
Needs: one CDX query per campus.

### 3.7 Untested until geocoded
Dead campus and dead mall, campus to cloud corridors, senior housing conversion, logistics geography, and population aging all require the PEPS layer to have coordinates and an external GIS layer to compare against. They stay marked untested in the Readings view until then.

## 4. Order of work

1. Event timeline schema and seed for the 34. Done 2026-10-09.
2. Catholic affiliation test. Done 2026-10-09; results in `_DATA/ipeds_catholic_test.json` and section 3.4.
3. Readings panel. Done 2026-10-09 as a panel in the Method view, computed at build time from the spine, the Catholic test, the trajectories, and the queue. Six readings have evidence; five overlay theses are marked untested.
4. Replacement-matrix fields in the curation file, morphology derived. Done 2026-10-09: all 34 carry the three fields from controlled lists, the validator checks them, and the dossier shows the flow.
5. Geocode PEPS through the Census batch geocoder. Done 2026-10-09: 17,267 of 22,346 domestic addresses matched (77.3%), 12,211 exactly. The remaining 5,079 are mostly rural routes, PO boxes, and addresses that no longer exist.
6. Event dates for the 24 campuses that had year-only closure events. Done 2026-10-09: closure and transfer events with sources for all 24. Every one of the 34 campuses now carries a sourced event sequence, and 33 have two or more events.
7. National retreat map. Done 2026-10-09 in the Abyss view; see the README.
8. Afterlife sample of 100 nonprofit exits from the spine. Done 2026-10-09; see 3.10.
9. Wayback timelines for the 34.
10. Load one external GIS layer (hospital locations, data centers, or dead malls) to turn an untested overlay into a test.
