#!/usr/bin/env python3
"""The Dead Campus Atlas as one dataset.

The atlas has three layers that were built separately: 34 curated campus records,
the extended records (institutions whose campus closed, coded from public pages), and
the federal closure sites. They are not the same kind of thing, so a single flat list
would mislead. This module puts them in ONE table with two explicit levels:

    kind = institution   one row per institution (or curated campus)
    kind = site          one row per federal closure site, parent_id -> its institution

Every curated, extended, coded, and federal-only institution is an institution row.
Every federal site is a site row. Filter on `kind` to count either without double
counting, or read the whole table as one dataset. The `layer` column says how much is
known about an institution: curated > extended > coded > federal.

build_records() returns the rows; write_csv() and schema() produce the published files.
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

LAYER_ORDER = ["curated", "extended", "coded", "federal"]

# name, group, description. Order is the column order of the CSV.
COLUMNS: list[tuple[str, str, str]] = [
    ("record_id", "identity", "Stable id. Curated and extended records keep their page ids; sites use fsa-NNNNN; others use ipeds-<unitid>, opeid-<root>, or coded-<unitid>."),
    ("kind", "identity", "institution or site."),
    ("parent_id", "identity", "For a site, the record_id of its institution. Empty for institutions."),
    ("layer", "identity", "Richest layer an institution belongs to: curated, extended, coded, or federal. A site is always federal."),
    ("institution_layer", "identity", "For a site, the layer of its institution, so sites can be filtered without a join."),
    ("name", "identity", "Institution or site name."),
    ("city", "place", "City."),
    ("state", "place", "State or territory code."),
    ("state_reported", "place", "State as written in the federal file, where curation/federal-corrections.json changed it."),
    ("country", "place", "Country, where the federal file records a foreign location. Empty for U.S. records."),
    ("zip", "place", "ZIP code (sites)."),
    ("address", "place", "Street address (sites)."),
    ("latitude", "place", "Latitude. Sites: Census batch geocoder. Institutions: curated coordinates or IPEDS."),
    ("longitude", "place", "Longitude."),
    ("coordinate_source", "place", "census-geocoder, ipeds, or curated."),
    ("unitid", "keys", "IPEDS UNITID."),
    ("opeid", "keys", "8-digit OPEID of the site."),
    ("root_opeid", "keys", "6-digit root OPEID, the institution-level federal key."),
    ("branch_suffix", "keys", "Two-digit OPEID branch suffix (sites)."),
    ("site_type", "federal", "Main/Root or Branch/Satellite (sites)."),
    ("federal_classification", "federal", "Atlas preliminary class from the federal file (sites)."),
    ("federal_source_url", "federal", "Source page of the federal report (sites)."),
    ("ipeds_match", "federal", "How a site was joined to IPEDS: opeid, root, location, or empty."),
    ("control", "ipeds", "Sector: Public, Private nonprofit, Private for-profit."),
    ("degree_granting", "ipeds", "1 if degree-granting."),
    ("ipeds_status", "ipeds", "active, closed, combined, dropped, or empty when not in IPEDS 2000-2024."),
    ("ipeds_first_year", "ipeds", "First year in the IPEDS directory."),
    ("ipeds_last_year", "ipeds", "Last year in the IPEDS directory."),
    ("successor_name", "ipeds", "For a combined institution, the institution it was combined into."),
    ("federal_sites", "rollup", "Institution: number of federal closure sites."),
    ("federal_main_sites", "rollup", "Institution: main/root sites."),
    ("federal_branch_sites", "rollup", "Institution: branch and annex sites."),
    ("federal_first_closure_year", "rollup", "Institution: earliest federal closure year."),
    ("federal_last_closure_year", "rollup", "Institution: latest federal closure year."),
    ("coding_tier", "fate", "curated, sample, or census: how the fate was established."),
    ("outcome", "fate", "closed-campus-reused, closed-campus-unknown, merged-campus-continues, merged-campus-closed, still-operating, not-a-closure, unresolved."),
    ("closure_date", "fate", "Closure date. Sites: federal report. Institutions: coded or curated."),
    ("closure_year", "fate", "Closure year."),
    ("transfer_date", "fate", "Date the campus changed hands, where established."),
    ("campus_fate", "fate", "One sentence on what happened to the campus."),
    ("buyer_name", "fate", "Who holds or operates the campus now."),
    ("buyer_sector", "fate", "Controlled vocabulary of buyer sectors."),
    ("replacement_system", "fate", "Controlled vocabulary of replacement systems."),
    ("original_system", "fate", "Controlled vocabulary of original systems."),
    ("morphology", "fate", "Morphology class, derived from the replacement system."),
    ("zone", "fate", "Replacement zone on the territory map."),
    ("confidence", "fate", "high, medium, or low."),
    ("coding_notes", "fate", "Caveats from the coder."),
    ("evidence_count", "fate", "Number of evidence pages."),
    ("evidence_urls", "fate", "Evidence page URLs, separated by ' | '."),
    ("rechecked_on", "fate", "Date of the second-pass check, where one was done."),
    ("recheck_verdict", "fate", "confirmed (first coding stands), revised (fields changed), or unresolved."),
    ("recheck_changed", "fate", "Fields the second pass changed, separated by ' | '."),
    ("recheck_note", "fate", "What the second pass checked and found."),
    ("duplicate_of", "fate", "record_id of a curated record sharing this institution's campus."),
    ("summary", "curated", "Visitor-facing summary (curated only)."),
    ("verification", "curated", "Verification state from the controlled vocabulary (curated only)."),
    ("atlas_priority", "curated", "Iconic or Important (curated only)."),
    ("scale", "curated", "Scale, e.g. acreage (curated only)."),
    ("buyer_type", "curated", "Buyer type (curated only)."),
    ("sale_price", "curated", "Reported sale price (curated only)."),
    ("transformation", "curated", "Interpretive transformation line (curated only)."),
    ("events", "curated", "Dated status events: 'date TYPE: label', separated by ' | ' (curated only)."),
    ("limbo_days", "curated", "Days from closure to first completed transfer (curated only)."),
    ("editorial_note", "curated", "Editorial note where a source cuts against the classification (curated only)."),
    ("source_urls", "curated", "Curated source URLs, separated by ' | ' (curated only)."),
    ("process_source", "process", "SHEEO, or Atlas coding where this project applied the SHEEO scheme to a for-profit exit the file does not cover."),
    ("process_event", "process", "closure, consolidation, merger, still-operating, or unresolved. SHEEO rows are all closures."),
    ("process_confidence", "process", "Confidence of an Atlas coding: high, medium, or low. Empty for SHEEO rows."),
    ("closure_announced", "process", "Date the closure was announced, from the SHEEO closed-college file."),
    ("lead_time_days", "process", "Days from announcement to closure. Empty where the announcement date is unknown or falls after the closure."),
    ("abrupt_closure", "process", "SHEEO coding: 1 abrupt, 0 orderly. Empty where not coded."),
    ("teach_out", "process", "Teach-out plan in place: yes, no, unclear, or n/a (abrupt)."),
    ("merger_attempt", "process", "1 if SHEEO records an attempted or executed merger, 0 if it records none."),
    ("merger_note", "process", "SHEEO text on the merger or acquisition, as written."),
    ("peps_merge", "process", "Merge or consolidation designation in the federal file."),
    ("records_custody", "process", "Where student records went, from SHEEO: yes, no, or other."),
    ("accreditors", "process", "Accrediting agencies in the federal file, separated by ' | '."),
    ("sheeo_note", "process", "Researcher note from the SHEEO file, as written. Researcher names and working remarks are left in."),
    ("sheeo_sources", "process", "Source URLs listed in the SHEEO file, separated by ' | '."),
    ("sheeo_date_differs", "process", "SHEEO closed date, where it differs from the federal closed date."),
    ("sheeo_sites", "process", "Institution: number of its federal sites that appear in the SHEEO file."),
    ("peak_year", "trajectory", "Year of peak fall enrollment."),
    ("peak_enrollment", "trajectory", "Peak fall enrollment."),
    ("last_enrollment_year", "trajectory", "Last year enrollment was reported."),
    ("last_enrollment", "trajectory", "Enrollment in the last reported year."),
    ("decline_pct", "trajectory", "Percent decline from peak to last reported year."),
    ("deficit_years_of_last_five", "trajectory", "Years in the last five reported with expenses above revenue."),
]
COLUMN_NAMES = [name for name, _, _ in COLUMNS]


# Federal site names that say what the site is, not who it belonged to.
GENERIC_NAMES = {
    "branch", "branch campus", "branch location", "branch campus location", "classroom facility",
    "main campus", "additional location", "extension", "extension site", "satellite", "satellite campus",
}


def institution_name(members: list[dict], spine_row: dict | None) -> str:
    """Name an institution known only from its federal sites.

    The IPEDS directory name wins. Otherwise use the commonest name among its sites that
    is not a generic label such as "Branch Campus", preferring the main site's name.
    """
    named = (spine_row or {}).get("name")
    if named:
        return named

    def tidy(value: str) -> str:
        return re.sub(r"\s+", " ", (value or "")).strip(" -")

    main = [tidy(m.get("name")) for m in members if m.get("siteType") == "Main/Root"]
    pool = [tidy(m.get("name")) for m in members]
    for candidates in (main, pool):
        usable = [n for n in candidates if n and n.lower() not in GENERIC_NAMES]
        if usable:
            return Counter(usable).most_common(1)[0][0]
    return tidy(members[0].get("name")) or "Unnamed federal site"


def _clean(value):
    return "" if value is None else value


def _pipe(values) -> str:
    return " | ".join(str(v) for v in values if v)


def _events_text(events) -> str:
    return _pipe(f"{e.get('date', '')} {e.get('type', '')}: {e.get('label', '')}" for e in events or [])


def _recheck(check: dict | None) -> dict:
    if not check:
        return {}
    return {
        "rechecked_on": check.get("checkedOn"),
        "recheck_verdict": check.get("verdict"),
        "recheck_changed": _pipe(check.get("changed") or []),
        "recheck_note": check.get("note"),
    }


def _iso(value: str | None) -> str | None:
    """MM/DD/YYYY from the federal file to ISO, so it compares with SHEEO dates."""
    from datetime import datetime

    try:
        return datetime.strptime(str(value), "%m/%d/%Y").date().isoformat()
    except ValueError:
        return None


def _process(entry: dict | None, federal_date: str | None = None) -> dict:
    """SHEEO closure-process columns for one federal site's entry."""
    if not entry:
        return {}
    merger = entry.get("merger")
    differs = ""
    if entry.get("closed") and federal_date and entry["closed"] != federal_date:
        differs = entry["closed"]
    return {
        "process_source": entry.get("source") or "SHEEO",
        "process_event": entry.get("event") or "closure",
        "process_confidence": entry.get("confidence"),
        "closure_announced": entry.get("announced"),
        "lead_time_days": entry.get("leadDays"),
        "abrupt_closure": None if entry.get("abrupt") is None else int(bool(entry["abrupt"])),
        "teach_out": entry.get("teachOut"),
        "merger_attempt": None if merger is None else int(bool(merger)),
        "merger_note": entry.get("mergerNote"),
        "peps_merge": entry.get("pepsMerge"),
        "records_custody": entry.get("records"),
        "accreditors": _pipe(entry.get("accreditors") or []),
        "sheeo_note": entry.get("note"),
        "sheeo_sources": _pipe(entry.get("sources") or []),
        "sheeo_date_differs": differs,
    }


def _trajectory(summary: dict) -> dict:
    summary = summary or {}
    return {
        "peak_year": summary.get("peakYear"),
        "peak_enrollment": summary.get("peakEnrollment"),
        "last_enrollment_year": summary.get("lastYear"),
        "last_enrollment": summary.get("lastEnrollment"),
        "decline_pct": summary.get("declinePct"),
        "deficit_years_of_last_five": summary.get("deficitYearsOfLastFive"),
    }


def _ipeds_row(spine_row: dict | None) -> dict:
    if not spine_row:
        return {}
    return {
        "control": spine_row.get("control_label") or "",
        "degree_granting": spine_row.get("degree_granting") or "",
        "ipeds_status": spine_row.get("status") or "",
        "ipeds_first_year": spine_row.get("first_year") or "",
        "ipeds_last_year": spine_row.get("last_year") or "",
        "successor_name": spine_row.get("newid_name") or "",
    }


def _coords(row: dict | None):
    if not row:
        return None, None
    try:
        lat, lon = float(row.get("latitude", "")), float(row.get("longitude", ""))
    except (TypeError, ValueError):
        return None, None
    if lat in (-1.0, -2.0, -3.0) or lon in (-1.0, -2.0, -3.0):
        return None, None
    return lat, lon


def build_records(
    curated: list[dict],
    extended: list[dict],
    coded: list[dict],
    federal: list[dict],
    spine: dict[int, dict],
    transfer_types: set[str],
    zone_of,
    sheeo: dict[str, dict] | None = None,
    process_only: dict[int, dict] | None = None,
) -> list[dict]:
    """Return every record, institutions first and then sites.

    Side effect: each federal site dict whose institution is a curated or extended
    record gets a ``record`` key holding that institution's page id, so the federal
    table can link to the case file.
    """
    rows: list[dict] = []
    unit_to_record: dict[int, str] = {}

    # 1. Curated institutions.
    for site in curated:
        unitid = (site.get("ipeds") or {}).get("unitid")
        rid = site["id"]
        if unitid:
            unit_to_record[int(unitid)] = rid
        ipeds = _ipeds_row(spine.get(int(unitid))) if unitid else {}
        events = site.get("events") or []
        matrix = site.get("matrix") or {}
        row = {
            "record_id": rid, "kind": "institution", "layer": "curated", "name": site["name"],
            "city": site.get("city"), "state": site.get("state"),
            "latitude": site.get("latitude"), "longitude": site.get("longitude"), "coordinate_source": "curated",
            "unitid": unitid, "control": ipeds.get("control") or site.get("sector"),
            "coding_tier": "curated", "closure_year": site.get("closureYear"),
            "campus_fate": site.get("publicSummary"), "buyer_name": site.get("buyerController"),
            "buyer_sector": matrix.get("buyerSector"), "replacement_system": matrix.get("replacementSystem"),
            "original_system": matrix.get("originalSystem"), "morphology": site.get("morphology"),
            "zone": zone_of(site.get("morphology"), matrix.get("buyerSector")),
            "evidence_count": len(site.get("sourceUrls") or []),
            "evidence_urls": _pipe(site.get("sourceUrls") or []),
            "summary": site.get("publicSummary"), "verification": site.get("verification"),
            "atlas_priority": site.get("atlasPriority"), "scale": site.get("scale"),
            "buyer_type": site.get("buyerType"), "sale_price": site.get("salePrice"),
            "transformation": site.get("transformation"), "events": _events_text(events),
            "limbo_days": site.get("limboDays"), "editorial_note": site.get("editorialNote"),
            "source_urls": _pipe(site.get("sourceUrls") or []),
            **{k: v for k, v in ipeds.items() if k != "control"}, **_trajectory(site.get("trajectorySummary")),
        }
        closure = next((e for e in events if e.get("type") == "CLOSURE-EVENT"), None)
        row["closure_date"] = closure["date"] if closure else ""
        done = next((e for e in events if e.get("type") in transfer_types and e.get("ownershipChange", True) is not False), None)
        row["transfer_date"] = done["date"] if done else ""
        row["outcome"] = "closed-campus-reused" if done else "closed-campus-unknown"
        rows.append(row)

    # 2. Extended institutions (campus closed, coded).
    for site in extended:
        unit_to_record[int(site["unitid"])] = site["id"]
        ipeds = _ipeds_row(spine.get(int(site["unitid"])))
        rows.append({
            "record_id": site["id"], "kind": "institution", "layer": "extended", "name": site["name"],
            "city": site.get("city"), "state": site.get("state"),
            "latitude": site.get("latitude"), "longitude": site.get("longitude"), "coordinate_source": "ipeds",
            "unitid": site["unitid"], "coding_tier": site.get("tier"), "outcome": site.get("outcome"),
            "closure_date": site.get("closureDate"), "closure_year": site.get("closureYear"),
            "transfer_date": site.get("transferDate"), "campus_fate": site.get("campusFate"),
            "buyer_name": site.get("buyerName"), "buyer_sector": site.get("buyerSector"),
            "replacement_system": site.get("replacementSystem"), "original_system": site.get("originalSystem"),
            "morphology": site.get("morphology"), "zone": site.get("zone"), "confidence": site.get("confidence"),
            "coding_notes": site.get("notes"), "evidence_count": len(site.get("evidence") or []),
            "evidence_urls": _pipe(e.get("url") for e in site.get("evidence") or []),
            **_recheck(site.get("recheck")),
            **ipeds, **_trajectory(site.get("trajectorySummary")),
        })

    # 3. Coded institutions that are not on the map (still operating, merged, unresolved, duplicate).
    for record in coded:
        unitid = int(record["unitid"])
        if unitid in unit_to_record:
            continue
        rid = f"coded-{unitid}"
        unit_to_record[unitid] = rid
        srow = spine.get(unitid)
        lat, lon = _coords(srow)
        rows.append({
            "record_id": rid, "kind": "institution", "layer": "coded", "name": record["name"],
            "city": record.get("city"), "state": record.get("state"), "latitude": lat, "longitude": lon,
            "coordinate_source": "ipeds" if lat is not None else "", "unitid": unitid,
            "coding_tier": record.get("tier"), "outcome": record.get("outcome"),
            "closure_date": record.get("closureDate"), "closure_year": (str(record.get("closureDate") or "")[:4] or record.get("exitYear")),
            "transfer_date": record.get("transferDate"), "campus_fate": record.get("campusFate"),
            "buyer_name": record.get("buyerName"), "buyer_sector": record.get("buyerSector"),
            "replacement_system": record.get("replacementSystem"), "original_system": record.get("originalSystem"),
            "confidence": record.get("confidence"), "coding_notes": record.get("notes"),
            "evidence_count": len(record.get("evidence") or []),
            "evidence_urls": _pipe(e.get("url") for e in record.get("evidence") or []),
            "duplicate_of": record.get("duplicateOf"), **_recheck(record.get("recheck")), **_ipeds_row(srow),
        })
        # A second IPEDS unit on a curated campus: its federal sites roll up to the curated record.
        if record.get("duplicateOf"):
            unit_to_record[unitid] = record["duplicateOf"]

    # 4. Federal-only institutions: group the remaining federal sites by IPEDS unit or root OPEID.
    groups: dict[str, list[dict]] = defaultdict(list)
    site_parent: dict[str, str] = {}
    for site in federal:
        unitid = site.get("ipedsUnitid")
        if unitid and int(unitid) in unit_to_record:
            site_parent[site["id"]] = unit_to_record[int(unitid)]
            continue
        if unitid:
            key = f"ipeds-{int(unitid)}"
        else:
            key = f"opeid-{site.get('rootOpeid') or site['id']}"
        groups[key].append(site)
        site_parent[site["id"]] = key
    for key, members in groups.items():
        main = next((m for m in members if m.get("siteType") == "Main/Root"), None)
        first = main or members[0]
        unitid = first.get("ipedsUnitid")
        srow = spine.get(int(unitid)) if unitid else None
        name = institution_name(members, srow)
        lat, lon = _coords(srow)
        if lat is None:
            geo = next((m for m in members if m.get("latitude") is not None), None)
            lat, lon = (geo.get("latitude"), geo.get("longitude")) if geo else (None, None)
        rows.append({
            "record_id": key, "kind": "institution", "layer": "federal", "name": name,
            "city": (srow or {}).get("city") or first.get("city"), "state": (srow or {}).get("state") or first.get("state"),
            "country": first.get("country"),
            "latitude": lat, "longitude": lon, "coordinate_source": ("ipeds" if srow and _coords(srow)[0] is not None else "census-geocoder" if lat is not None else ""),
            "unitid": unitid, "root_opeid": first.get("rootOpeid"), **_ipeds_row(srow),
        })
        if unitid:
            unit_to_record[int(unitid)] = key

    # 4b. Institutions coded for closure process that have no federal site: the IPEDS record is
    # their only anchor, so they enter as institution rows of their own.
    for unitid, coded in sorted((process_only or {}).items()):
        if unitid in unit_to_record:
            continue
        srow = spine.get(unitid)
        lat, lon = _coords(srow)
        rid = f"coded-{unitid}"
        unit_to_record[unitid] = rid
        evidence = [e.get("url") for e in coded.get("evidence") or [] if e.get("url")]
        entry = {
            "source": "Atlas coding", "event": coded.get("event"), "confidence": coded.get("confidence"),
            "announced": coded.get("announced"), "closed": coded.get("closed"), "leadDays": None,
            "abrupt": coded.get("abrupt"), "teachOut": "n/a (abrupt)" if coded.get("teachOut") == "n/a" else coded.get("teachOut"),
            "merger": None if coded.get("merger") is None else coded.get("merger") != "none",
            "mergerNote": coded.get("mergerNote"), "records": coded.get("records"), "note": coded.get("notes"),
            "sources": evidence[:6], "accreditors": [],
        }
        rows.append({
            "record_id": rid, "kind": "institution", "layer": "coded", "name": (srow or {}).get("name") or coded.get("name"),
            "city": (srow or {}).get("city"), "state": (srow or {}).get("state"), "latitude": lat, "longitude": lon,
            "coordinate_source": "ipeds" if lat is not None else "", "unitid": unitid, "coding_tier": "closure-process",
            "closure_date": coded.get("closed"), "evidence_count": len(evidence), "evidence_urls": _pipe(evidence),
            "confidence": coded.get("confidence"), "coding_notes": coded.get("notes"),
            **_ipeds_row(srow), **_process(entry),
        })

    # 5. Rollups onto every institution, then the site rows.
    by_parent: dict[str, list[dict]] = defaultdict(list)
    for site in federal:
        by_parent[site_parent[site["id"]]].append(site)
    layer_of = {r["record_id"]: r["layer"] for r in rows}
    sheeo = sheeo or {}
    for row in rows:
        members = by_parent.get(row["record_id"], [])
        covered = [m for m in members if m.get("opeid") in sheeo]
        if covered:
            main = [m for m in covered if m.get("siteType") == "Main/Root"]
            pick = (main or sorted(covered, key=lambda m: m.get("closureYear") or 9999))[0]
            row.update(_process(sheeo[pick["opeid"]]))
            row["sheeo_sites"] = len(covered)
        years = [m.get("closureYear") for m in members if m.get("closureYear")]
        row["federal_sites"] = len(members)
        row["federal_main_sites"] = sum(1 for m in members if m.get("siteType") == "Main/Root")
        row["federal_branch_sites"] = sum(1 for m in members if m.get("siteType") != "Main/Root")
        row["federal_first_closure_year"] = min(years) if years else ""
        row["federal_last_closure_year"] = max(years) if years else ""
    for site in federal:
        parent = site_parent[site["id"]]
        has_coords = site.get("latitude") is not None
        rows.append({
            "record_id": site["id"], "kind": "site", "parent_id": parent, "layer": "federal",
            "institution_layer": layer_of.get(parent, "federal"), "name": site.get("name"),
            "city": site.get("city"), "state": site.get("state"), "country": site.get("country"),
            "state_reported": site.get("stateReported"), "zip": site.get("zip"), "address": site.get("address"),
            "latitude": site.get("latitude"), "longitude": site.get("longitude"),
            "coordinate_source": "census-geocoder" if has_coords else "",
            "unitid": site.get("ipedsUnitid"), "opeid": site.get("opeid"), "root_opeid": site.get("rootOpeid"),
            "branch_suffix": site.get("branchSuffix"), "site_type": site.get("siteType"),
            "federal_classification": site.get("classification"), "federal_source_url": site.get("sourceUrl"),
            "ipeds_match": site.get("ipedsMatch"), "ipeds_status": site.get("ipedsStatus"),
            "successor_name": site.get("successor"), "closure_date": site.get("closureDate"),
            "closure_year": site.get("closureYear"),
            **_process(sheeo.get(site.get("opeid")), _iso(site.get("closureDate"))),
        })
    for site in federal:
        parent = site_parent[site["id"]]
        if layer_of.get(parent) in {"curated", "extended"}:
            site["record"] = parent
    return rows


def write_csv(rows: list[dict], path: Path) -> None:
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=COLUMN_NAMES, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({name: _clean(row.get(name)) for name in COLUMN_NAMES})


def summarize(rows: list[dict]) -> dict:
    institutions = [r for r in rows if r["kind"] == "institution"]
    sites = [r for r in rows if r["kind"] == "site"]
    by_layer = Counter(r["layer"] for r in institutions)
    return {
        "records": len(rows),
        "institutions": len(institutions),
        "sites": len(sites),
        "institutionsByLayer": {layer: by_layer.get(layer, 0) for layer in LAYER_ORDER},
        "sitesByInstitutionLayer": dict(Counter(r["institution_layer"] for r in sites)),
        "institutionsWithFate": sum(1 for r in institutions if r.get("outcome")),
        "institutionsWithFederalSites": sum(1 for r in institutions if r.get("federal_sites")),
        "columns": len(COLUMN_NAMES),
        "file": "data/atlas-records.csv",
        "schema": "data/atlas-records.schema.json",
    }


def schema() -> dict:
    return {
        "name": "Dead Campus Atlas records",
        "description": "Curated campuses, coded institutions, and federal closure sites as one table with two levels (kind = institution | site).",
        "primaryKey": "record_id",
        "foreignKeys": [{"column": "parent_id", "references": "record_id", "when": "kind = site"}],
        "layers": {
            "curated": "Hand-written, reviewed campus records.",
            "extended": "Institutions whose campus closed, coded from public pages with evidence URLs.",
            "coded": "Institutions coded but not drawn: still operating, merged with the campus continuing, not a closure, or unresolved.",
            "federal": "Federal closure sites, and institutions known only from them.",
        },
        "columns": [{"name": n, "group": g, "description": d} for n, g, d in COLUMNS],
    }


def validate_records(rows: list[dict], expected_sites: int, curated_ids: list[str], extended_ids: list[str]) -> list[str]:
    """Structural checks. Returns a list of problems; empty means the table is sound."""
    problems = []
    ids = [r["record_id"] for r in rows]
    if len(ids) != len(set(ids)):
        problems.append("record_id is not unique")
    id_set = set(ids)
    kinds = Counter(r["kind"] for r in rows)
    if kinds.get("site", 0) != expected_sites:
        problems.append(f"site rows {kinds.get('site', 0)} != federal records {expected_sites}")
    for r in rows:
        if r["kind"] == "site" and r.get("parent_id") not in id_set:
            problems.append(f"site {r['record_id']} has no parent row")
            break
    layers = {r["record_id"]: r["layer"] for r in rows if r["kind"] == "institution"}
    for rid in curated_ids:
        if layers.get(rid) != "curated":
            problems.append(f"curated {rid} missing or not curated")
    for rid in extended_ids:
        if layers.get(rid) != "extended":
            problems.append(f"extended {rid} missing or not extended")
    sums = sum(r.get("federal_sites") or 0 for r in rows if r["kind"] == "institution")
    if sums != expected_sites:
        problems.append(f"institution rollups sum to {sums}, not {expected_sites}")
    return problems[:10]
