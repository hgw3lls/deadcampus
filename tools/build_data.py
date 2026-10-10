#!/usr/bin/env python3
"""Build public atlas data from the local archive sources."""

from __future__ import annotations

import csv
import json
import posixpath
import re
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(__file__).resolve().parents[1] / "dist" / "data"
OUT_JS = DATA_DIR / "atlas-data.js"
OUT_JSON = DATA_DIR / "canonical-atlas.json"
OUT_FEDERAL_JS = DATA_DIR / "federal-records.js"
SOURCE_FRESHNESS = ROOT / "_DATA" / "source_freshness.json"

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "office_rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg_rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


TYPOLOGY = {
    "Absorbed": {
        "tone": "#355c7d",
        "description": "A closed campus taken into a larger educational system.",
    },
    "Parcelized": {
        "tone": "#a44732",
        "description": "A campus divided across buyers, agencies, or redevelopment parcels.",
    },
    "Speculative": {
        "tone": "#8a6f2d",
        "description": "Land held, marketed, auctioned, or repositioned as real estate.",
    },
    "Security": {
        "tone": "#4b4f37",
        "description": "Educational land converted to state, training, or security use.",
    },
    "Health": {
        "tone": "#2f6654",
        "description": "Institutional land reused by medical, hospital, or care systems.",
    },
    "Housing": {
        "tone": "#7a3f61",
        "description": "Campus property converted to residential or senior living use.",
    },
    "Educational reuse": {
        "tone": "#4d6b3c",
        "description": "The site remains educational under a new owner, mission, or scale.",
    },
    "K12": {
        "tone": "#b15f28",
        "description": "Higher education property converted to primary or secondary schooling.",
    },
    "Religious/K12": {
        "tone": "#6f4a7b",
        "description": "A mixed religious and school reuse of former college land.",
    },
    "Arts reuse": {
        "tone": "#286b74",
        "description": "Campus property reused by arts, music, or cultural programs.",
    },
    "Corporate": {
        "tone": "#574c41",
        "description": "Campus land or infrastructure absorbed into corporate use.",
    },
    "Cloud": {
        "tone": "#1f6875",
        "description": "Physical campus infrastructure converted into data infrastructure.",
    },
    "Ruin": {
        "tone": "#5c5650",
        "description": "The site remains abandoned, decayed, or unresolved.",
    },
}


CURATION_FILE = Path(__file__).resolve().parents[1] / "curation" / "public-sites.json"
MINIMUM_PUBLIC_SITES = 34

# Controlled vocabulary for verification states. Keys are canonical labels;
# values are the raw spellings found in the archive that map onto them.
VERIFICATION_VOCABULARY = {
    "Confirmed": ["confirmed"],
    "Disputed": ["sale disputed", "disputed"],
    "Manual add": ["post-2020 manual add", "manual add", "manual"],
    "Curated": ["curated from sale/auction reporting", "curated"],
    "Non-closure sale": ["non-closure asset sale", "non-closure sale"],
    "Pending": ["", "pending", "unverified"],
}
VERIFICATION_ALIASES = {
    alias: label for label, aliases in VERIFICATION_VOCABULARY.items() for alias in aliases
}

# Fields every public site must satisfy before release. Each gate names the
# field it checks so the validator and the page can report the same gaps.
RELEASE_GATES = ["coordinates", "closureYear", "morphology", "sourceUrl", "verification", "summary"]


def load_curation() -> dict:
    if not CURATION_FILE.exists():
        return {}
    payload = json.loads(CURATION_FILE.read_text(encoding="utf-8"))
    return payload.get("sites", {})


def canonical_verification(value: object) -> str:
    text = clean_text(value).lower()
    if text in VERIFICATION_ALIASES:
        return VERIFICATION_ALIASES[text]
    return clean_text(value)


def site_id(name: str, state: str) -> str:
    """Permanent public id: name slug plus state. Never embeds mutable fields."""
    return f"{slug(name)}-{state.lower()}"


def release_gaps(site: dict) -> list[str]:
    gaps = []
    if site.get("latitude") is None or site.get("longitude") is None:
        gaps.append("coordinates")
    if not site.get("closureYear"):
        gaps.append("closureYear")
    if site.get("morphology") not in TYPOLOGY:
        gaps.append("morphology")
    if not site.get("sourceUrls"):
        gaps.append("sourceUrl")
    if site.get("verification") not in VERIFICATION_VOCABULARY or site.get("verification") == "Pending":
        gaps.append("verification")
    if not site.get("publicSummary"):
        gaps.append("summary")
    return gaps


def column_index(cell_reference: str) -> int:
    letters = re.sub(r"[^A-Z]", "", cell_reference.upper())
    value = 0
    for letter in letters:
        value = value * 26 + ord(letter) - ord("A") + 1
    return value - 1


def workbook_sheet_path(workbook: zipfile.ZipFile, sheet_name: str, path: Path) -> str:
    workbook_root = ElementTree.fromstring(workbook.read("xl/workbook.xml"))
    rels_root = ElementTree.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))
    rels = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels_root.findall("pkg_rel:Relationship", NS)
    }

    for sheet in workbook_root.findall("main:sheets/main:sheet", NS):
        if sheet.attrib.get("name") != sheet_name:
            continue
        rel_id = sheet.attrib[f"{{{NS['office_rel']}}}id"]
        target = rels[rel_id]
        if target.startswith("/"):
            return target.lstrip("/")
        return posixpath.normpath(posixpath.join("xl", target))
    raise SystemExit(f"Missing sheet {sheet_name!r} in {path}")


def shared_strings(workbook: zipfile.ZipFile) -> list[str]:
    try:
        root = ElementTree.fromstring(workbook.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    output = []
    for item in root.findall("main:si", NS):
        output.append("".join(text.text or "" for text in item.findall(".//main:t", NS)))
    return output


def cell_value(cell: ElementTree.Element, strings: list[str]) -> object:
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(text.text or "" for text in cell.findall(".//main:t", NS))

    value = cell.find("main:v", NS)
    if value is None or value.text is None:
        return ""

    if cell_type == "s":
        return strings[int(value.text)]
    if cell_type == "b":
        return value.text == "1"
    if cell_type in {"str", "e"}:
        return value.text

    try:
        number = float(value.text)
    except ValueError:
        return value.text
    return int(number) if number.is_integer() else number


def rows_from_sheet(path: Path, sheet_name: str) -> list[dict]:
    with zipfile.ZipFile(path) as workbook:
        strings = shared_strings(workbook)
        sheet_root = ElementTree.fromstring(workbook.read(workbook_sheet_path(workbook, sheet_name, path)))

    rows = []
    for row in sheet_root.findall(".//main:sheetData/main:row", NS):
        values: list[object] = []
        for cell in row.findall("main:c", NS):
            index = column_index(cell.attrib.get("r", "A"))
            while len(values) <= index:
                values.append("")
            values[index] = cell_value(cell, strings)
        rows.append(values)

    headers = [str(value).strip() if value is not None else "" for value in rows[0]]
    output = []
    for row in rows[1:]:
        item = {}
        for index, header in enumerate(headers):
            if not header:
                continue
            item[header] = row[index] if index < len(row) else None
        if any(value not in (None, "") for value in item.values()):
            output.append(item)
    return output


def csv_rows(path: Path) -> list[dict]:
    with path.open(newline="", encoding="utf-8-sig") as file:
        return list(csv.DictReader(file))


def norm(value: object) -> str:
    text = str(value or "").lower()
    text = text.replace("&", " and ")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def slug(value: str) -> str:
    text = norm(value)
    return re.sub(r"\s+", "-", text).strip("-")


def clean_year(value: object) -> int | None:
    if value in (None, ""):
        return None
    match = re.search(r"\d{4}", str(value))
    return int(match.group(0)) if match else None


def clean_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def canonical_morphology(value: object) -> str:
    raw = clean_text(value)
    if not raw:
        return ""
    fixed = raw.replace("_", " ").title()
    aliases = {
        "Arts Reuse": "Arts reuse",
        "Educational Reuse": "Educational reuse",
        "Branch / Satellite Retreat": "BRANCH / SATELLITE RETREAT",
        "Main / Root Closure": "MAIN / ROOT CLOSURE",
        "Distributed Site / Annex": "DISTRIBUTED SITE / ANNEX",
        "For-Profit System Collapse": "FOR-PROFIT SYSTEM COLLAPSE",
        "K12": "K12",
    }
    return aliases.get(fixed, fixed)


def is_url(value: object) -> bool:
    text = clean_text(value)
    return text.startswith("http://") or text.startswith("https://")


def choose(*values: object) -> str:
    for value in values:
        text = clean_text(value)
        if text:
            return text
    return ""


def build_public_sites() -> list[dict]:
    master = rows_from_sheet(ROOT / "_DATA" / "dead_campus_master_table_v1.xlsx", "DeadCampusAtlas")
    phase2 = rows_from_sheet(ROOT / "_DATA" / "dead_campus_atlas_phase2.xlsx", "PHASE2_CLASSIFIED")
    spatial = rows_from_sheet(
        ROOT / "_DATA" / "dead_campus_atlas_phase3_spatialization.xlsx",
        "SPATIALIZED_CAMPUSES",
    )
    forensics = rows_from_sheet(
        ROOT / "_DATA" / "dead_campus_atlas_phase4_afterlife_forensics.xlsx",
        "AFTERLIFE_FORENSICS",
    )
    queue = csv_rows(ROOT / "dead-campus-queue-filtered.csv")
    curation = load_curation()

    phase2_by_key = {(norm(r.get("Institution")), clean_text(r.get("State")).upper()): r for r in phase2}
    spatial_by_key = {(norm(r.get("Institution")), clean_text(r.get("State")).upper()): r for r in spatial}
    forensics_by_key = {(norm(r.get("Institution")), clean_text(r.get("State")).upper()): r for r in forensics}

    queue_by_key: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for line, row in enumerate(queue, start=2):
        row["_line"] = line
        queue_by_key[(norm(row.get("name")), clean_text(row.get("state")).upper())].append(row)

    sites = []
    seen_ids: set[str] = set()
    for index, row in enumerate(master, start=1):
        state = clean_text(row.get("State")).upper()
        key = (norm(row.get("Institution")), state)
        p2 = phase2_by_key.get(key, {})
        sp = spatial_by_key.get(key, {})
        af = forensics_by_key.get(key, {})
        queue_rows = queue_by_key.get(key, [])
        year = clean_year(choose(row.get("Closure_Year"), p2.get("Closure_Year"), sp.get("Closure_Year")))
        name = choose(row.get("Institution"), p2.get("Institution"), sp.get("Institution"))
        morphology = canonical_morphology(choose(row.get("Morphology"), p2.get("Morphology"), sp.get("Morphology")))
        public_id = site_id(name, state)
        if public_id in seen_ids:
            raise SystemExit(f"Duplicate public site id: {public_id}")
        seen_ids.add(public_id)
        curated = curation.get(public_id, {})

        evidence = []
        for q in queue_rows:
            raw_verification = clean_text(q.get("verification"))
            evidence.append(
                {
                    "line": q.get("_line"),
                    "sourceSheet": clean_text(q.get("sourceSheet")),
                    "verification": canonical_verification(raw_verification),
                    "verificationNote": raw_verification,
                    "sourceUrl": clean_text(q.get("sourceUrl")) if is_url(q.get("sourceUrl")) else "",
                    "sourceNote": "" if is_url(q.get("sourceUrl")) else clean_text(q.get("sourceUrl")),
                    "missingFields": clean_text(q.get("missingFields")),
                }
            )
        source_urls: list[str] = []
        for url in [*curated.get("sourceUrls", []), *(e["sourceUrl"] for e in evidence)]:
            if is_url(url) and url not in source_urls:
                source_urls.append(url)

        site = {
            "id": public_id,
            "recordNumber": index,
            "name": name,
            "city": choose(sp.get("City")),
            "state": state,
            "region": choose(sp.get("Region"), p2.get("Region")),
            "closureYear": year,
            "sector": choose(row.get("Sector"), sp.get("Sector"), p2.get("Sector")),
            "campusType": choose(row.get("Campus_Type"), sp.get("Campus_Type"), p2.get("Campus_Type")),
            "status": choose(row.get("Status")),
            "reuseType": choose(row.get("Reuse_Type"), af.get("Afterlife")),
            "buyerController": choose(
                row.get("Buyer_or_Controller"),
                sp.get("Buyer_or_Controller"),
                p2.get("Buyer_or_Controller"),
                af.get("Buyer"),
            ),
            "buyerType": choose(af.get("Buyer_Type")),
            "morphology": morphology,
            "scale": choose(row.get("Scale")),
            "notes": choose(row.get("Notes")),
            "verification": canonical_verification(choose(row.get("Verification"), "Confirmed")),
            "transformation": choose(sp.get("Transformation"), p2.get("Transformation"), af.get("Transformation_Logic")),
            "atlasPriority": choose(sp.get("Atlas_Priority"), p2.get("Atlas_Priority"), af.get("Atlas_Importance")),
            "salePrice": choose(af.get("Sale_Price")),
            "afterlife": choose(af.get("Afterlife"), row.get("Reuse_Type")),
            "latitude": sp.get("Latitude") if sp.get("Latitude") not in ("", None) else None,
            "longitude": sp.get("Longitude") if sp.get("Longitude") not in ("", None) else None,
            "publicSummary": clean_text(curated.get("summary")),
            "sourceUrls": source_urls,
            "evidence": evidence,
            "sourceFiles": [
                "_DATA/dead_campus_master_table_v1.xlsx",
                "_DATA/dead_campus_atlas_phase2.xlsx",
                "_DATA/dead_campus_atlas_phase3_spatialization.xlsx",
                "_DATA/dead_campus_atlas_phase4_afterlife_forensics.xlsx",
                "dead-campus-queue-filtered.csv",
                "atlas-site/curation/public-sites.json",
            ],
        }
        overrides = dict(curated.get("overrides", {}))
        if "verification" in overrides:
            overrides["verification"] = canonical_verification(overrides["verification"])
        site.update(overrides)
        site["releaseGaps"] = release_gaps(site)
        site["releaseReady"] = not site["releaseGaps"]
        sites.append(site)
    return sites


def build_release_bar(sites: list[dict]) -> dict:
    gap_counts = {gate: sum(1 for site in sites if gate in site["releaseGaps"]) for gate in RELEASE_GATES}
    return {
        "gates": RELEASE_GATES,
        "publicSites": len(sites),
        "minimumPublicSites": MINIMUM_PUBLIC_SITES,
        "releaseReady": sum(1 for site in sites if site["releaseReady"]),
        "gapCounts": gap_counts,
        "sitesWithGaps": [
            {"id": site["id"], "name": site["name"], "gaps": site["releaseGaps"]}
            for site in sites
            if site["releaseGaps"]
        ],
    }


def build_abyss_summary(source_freshness: dict) -> dict:
    rows = csv_rows(ROOT / "_DATA" / "dead_campus_phase9_peps_normalized.csv")
    class_counts = Counter(clean_text(r.get("ATLAS_PRELIMINARY_CLASS")) or "Unclassified" for r in rows)
    site_type_counts = Counter(clean_text(r.get("ATLAS_SITE_TYPE")) or "Unclassified" for r in rows)
    state_counts = Counter(clean_text(r.get("ATLAS_STATE")) or "Foreign/unknown" for r in rows)
    year_counts = Counter(str(clean_year(r.get("ATLAS_CLOSURE_YEAR")) or "Unknown") for r in rows)
    federal_source = source_freshness.get("fsaClosedSchoolSearch", {})

    def ordered_counts(counter: Counter, numeric: bool = False) -> list[dict]:
        if numeric:
            keys = sorted(counter, key=lambda item: int(item) if item.isdigit() else 9999)
        else:
            keys = sorted(counter, key=lambda item: (-counter[item], item))
        return [{"label": key, "count": int(counter[key])} for key in keys]

    return {
        "totalRecords": len(rows),
        "sourceUrl": federal_source.get("sourceUrl") or "https://fsapartners.ed.gov/additional-resources/reports/weekly-closed-school-search-file",
        "yearRange": [
            min(clean_year(r.get("ATLAS_CLOSURE_YEAR")) for r in rows if clean_year(r.get("ATLAS_CLOSURE_YEAR"))),
            max(clean_year(r.get("ATLAS_CLOSURE_YEAR")) for r in rows if clean_year(r.get("ATLAS_CLOSURE_YEAR"))),
        ],
        "siteTypeCounts": ordered_counts(site_type_counts),
        "classCounts": ordered_counts(class_counts),
        "stateCounts": ordered_counts(state_counts)[:20],
        "timeline": ordered_counts(year_counts, numeric=True),
        "missing": {
            "state": sum(1 for r in rows if not clean_text(r.get("ATLAS_STATE"))),
            "morphology": sum(1 for r in rows if not clean_text(r.get("Morphology"))),
            "afterlifeStatus": sum(1 for r in rows if not clean_text(r.get("Afterlife_Status"))),
        },
    }


def build_federal_records() -> list[dict]:
    rows = csv_rows(ROOT / "_DATA" / "dead_campus_phase9_peps_normalized.csv")
    records = []
    for index, row in enumerate(rows, start=1):
        records.append(
            {
                "id": f"fsa-{index:05d}",
                "opeid": clean_text(row.get("ATLAS_OPEID_RAW") or row.get("OPEID_8")),
                "rootOpeid": clean_text(row.get("ATLAS_OPEID_ROOT") or row.get("Root_OPEID_6")),
                "branchSuffix": clean_text(row.get("ATLAS_BRANCH_SUFFIX") or row.get("Branch_Suffix")),
                "name": clean_text(row.get("ATLAS_INSTITUTION_NAME") or row.get("School_Name")),
                "location": clean_text(row.get("Location")),
                "address": clean_text(row.get("ATLAS_ADDRESS") or row.get("Address")),
                "city": clean_text(row.get("ATLAS_CITY") or row.get("City")),
                "state": clean_text(row.get("ATLAS_STATE") or row.get("State")),
                "zip": clean_text(row.get("Zip_Code")),
                "country": clean_text(row.get("Country_Foreign")),
                "closureDate": clean_text(row.get("Closed_Date")),
                "closureYear": clean_year(row.get("ATLAS_CLOSURE_YEAR") or row.get("Closed_Year")),
                "siteType": clean_text(row.get("ATLAS_SITE_TYPE")),
                "classification": clean_text(row.get("ATLAS_PRELIMINARY_CLASS")),
                "sourceUrl": clean_text(row.get("Source_URL")),
            }
        )
    return records


def build_queue_audit() -> dict:
    rows = csv_rows(ROOT / "dead-campus-queue-filtered.csv")
    blank_counts = {}
    for field in [
        "closureYear",
        "state",
        "city",
        "sourceUrl",
        "verification",
        "buyerController",
        "afterlifeStatus",
    ]:
        blank_counts[field] = sum(1 for r in rows if not clean_text(r.get(field)))

    non_url_source = sum(1 for r in rows if clean_text(r.get("sourceUrl")) and not is_url(r.get("sourceUrl")))
    non_peps = [r for r in rows if clean_text(r.get("sourceSheet")) != "dead_campus_atlas__PEPS_SITE_"]
    duplicate_groups: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in non_peps:
        duplicate_groups[(norm(row.get("name")), clean_text(row.get("state")).upper())].append(row)
    duplicate_group_count = sum(1 for values in duplicate_groups.values() if len(values) > 1)
    duplicate_row_count = sum(len(values) for values in duplicate_groups.values() if len(values) > 1)

    return {
        "totalQueueRows": len(rows),
        "blankCounts": blank_counts,
        "nonUrlSourceUrlRows": non_url_source,
        "nonPepsRows": len(non_peps),
        "nonPepsDuplicateGroups": duplicate_group_count,
        "nonPepsDuplicateRows": duplicate_row_count,
        "statusCounts": [
            {"label": label, "count": int(count)}
            for label, count in Counter(clean_text(r.get("statusCode")) for r in rows).most_common()
        ],
    }


def load_source_freshness() -> dict:
    if not SOURCE_FRESHNESS.exists():
        return {}
    return json.loads(SOURCE_FRESHNESS.read_text(encoding="utf-8"))


def main() -> None:
    sites = build_public_sites()
    morphologies = sorted({site["morphology"] for site in sites if site["morphology"]})
    source_freshness = load_source_freshness()
    federal_records = build_federal_records()
    payload = {
        "generatedFrom": [
            "dead-campus-queue-filtered.csv",
            "_DATA/dead_campus_master_table_v1.xlsx",
            "_DATA/dead_campus_atlas_phase2.xlsx",
            "_DATA/dead_campus_atlas_phase3_spatialization.xlsx",
            "_DATA/dead_campus_atlas_phase4_afterlife_forensics.xlsx",
            "_DATA/dead_campus_phase9_peps_normalized.csv",
            "_DATA/source_freshness.json",
            "atlas-site/curation/public-sites.json",
        ],
        "federalRecordCount": len(federal_records),
        "publicSites": sites,
        "typology": {key: TYPOLOGY.get(key, {"tone": "#4f4a45", "description": ""}) for key in morphologies},
        "verificationVocabulary": list(VERIFICATION_VOCABULARY),
        "releaseBar": build_release_bar(sites),
        "abyss": build_abyss_summary(source_freshness),
        "queueAudit": build_queue_audit(),
        "sourceFreshness": source_freshness,
    }
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    OUT_JS.write_text(
        "window.DEAD_CAMPUS_ATLAS = "
        + json.dumps(payload, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    OUT_FEDERAL_JS.write_text(
        "window.DEAD_CAMPUS_FEDERAL_RECORDS = "
        + json.dumps(federal_records, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    bar = payload["releaseBar"]
    print(f"Wrote {OUT_JSON}")
    print(f"Public sites: {bar['publicSites']} ({bar['releaseReady']} release-ready)")
    for gate, count in bar["gapCounts"].items():
        if count:
            print(f"  gap {gate}: {count}")
    print(f"Wrote {OUT_JS}")
    print(f"Wrote {OUT_FEDERAL_JS}")


if __name__ == "__main__":
    main()
