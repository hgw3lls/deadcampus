#!/usr/bin/env python3
"""Build public atlas data from the local archive sources."""

from __future__ import annotations

import csv
import hashlib
import json
import posixpath
import re
import zipfile
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from xml.etree import ElementTree

import atlas_dataset


ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = Path(__file__).resolve().parents[1] / "dist" / "data"
OUT_JS = DATA_DIR / "atlas-data.js"
OUT_JSON = DATA_DIR / "canonical-atlas.json"
OUT_FEDERAL_JS = DATA_DIR / "federal-records.js"
OUT_EXTENDED_JS = DATA_DIR / "extended-records.js"
OUT_RECORDS_CSV = DATA_DIR / "atlas-records.csv"
OUT_RECORDS_SCHEMA = DATA_DIR / "atlas-records.schema.json"
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
TRAJECTORIES_CSV = ROOT / "_DATA" / "ipeds_trajectories.csv"
SPINE_SUMMARY = ROOT / "_DATA" / "ipeds_directory_summary.json"
CATHOLIC_TEST = ROOT / "_DATA" / "ipeds_catholic_test.json"
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

# Status-code event types from the Phase 7 blueprint. Each public site carries
# a dated event sequence in the curation file; the build derives time in limbo.
EVENT_TYPES = [
    "ACTIVE-RISK",
    "CLOSURE-EVENT",
    "ASSET-TRANSFER",
    "PARCELIZED",
    "CLOUD",
    "SECURITY",
    "RUIN",
    "COUNTER-USE",
]
TRANSFER_TYPES = {"ASSET-TRANSFER", "PARCELIZED", "CLOUD", "SECURITY", "COUNTER-USE"}

# Replacement matrix (Phase 6): what the campus was, who took the land, what it
# became. Morphology is derived from the replacement system, not entered by hand.
ORIGINAL_SYSTEMS = [
    "Liberal arts college",
    "Catholic college",
    "Other religious college",
    "Eco / experimental college",
    "Professional / career college",
    "Regional private college",
    "For-profit-linked college",
    "Research / technology campus",
]
BUYER_SECTORS = [
    "Federal / security state",
    "Hospital / health system",
    "Elite / private university",
    "Other private college or university",
    "Public university",
    "Public authority / municipality",
    "Real estate capital",
    "Private owner / developer",
    "REIT / senior housing",
    "K-12 / charter",
    "Religious / mission",
    "Civic / nonprofit",
    "Arts organization",
    "Indigenous education",
    "Cloud / platform capital",
    "Corporate",
    "Fragmented / multiple buyers",
    "Absentee owner",
]
MORPHOLOGY_FROM_REPLACEMENT = {
    "Security infrastructure": "Security",
    "Health / care system": "Health",
    "University absorption": "Absorbed",
    "Parcel fragments": "Parcelized",
    "Speculative land": "Speculative",
    "Senior or emergency housing": "Housing",
    "K-12 schooling": "K12",
    "Religious K-12 schooling": "Religious/K12",
    "Arts / music reuse": "Arts reuse",
    "Educational reuse": "Educational reuse",
    "Corporate holding": "Corporate",
    "Cloud infrastructure": "Cloud",
    "Ruin / neglect": "Ruin",
}
REPLACEMENT_SYSTEMS = list(MORPHOLOGY_FROM_REPLACEMENT)

# What happened to an institution drawn in the afterlife sample. A sampled
# institution is not necessarily dead: IPEDS "dropped" includes schools that
# kept operating but stopped reporting or were reclassified.
SAMPLE_OUTCOMES = [
    "closed-campus-reused",
    "closed-campus-unknown",
    "merged-campus-continues",
    "merged-campus-closed",
    "still-operating",
    "not-a-closure",
    "unresolved",
]
GEOCODED_CSV = ROOT / "_DATA" / "peps_geocoded.csv"
AFTERLIFE_SAMPLE = Path(__file__).resolve().parents[1] / "curation" / "afterlife-sample.json"
AFTERLIFE_CENSUS = Path(__file__).resolve().parents[1] / "curation" / "afterlife-census.json"
AFTERLIFE_EXITS = Path(__file__).resolve().parents[1] / "curation" / "afterlife-exits.json"
AFTERLIFE_RECHECKS = Path(__file__).resolve().parents[1] / "curation" / "afterlife-rechecks.json"
CLOSED_OUTCOMES = {"closed-campus-reused", "closed-campus-unknown", "merged-campus-closed"}
# Coded institutions that share a campus with a curated record. They stay in the census counts
# (they are a distinct IPEDS institution) but are not drawn again on the map or counted as a
# second buyer of the same land.
SAME_CAMPUS_AS_CURATED = {440411: "marlboro-college-vt"}
SPINE_CSV = ROOT / "_DATA" / "ipeds_directory_spine.csv"


def _ipeds_years() -> tuple[int, int]:
    """First and last IPEDS directory year in the spine, from its summary file."""
    try:
        first, last = json.loads(SPINE_SUMMARY.read_text(encoding="utf-8"))["yearsPulled"]
        return int(first), int(last)
    except (OSError, KeyError, ValueError, TypeError):
        return 2000, 2024


IPEDS_START, IPEDS_END = _ipeds_years()
# The coded frame is every private nonprofit degree-granting institution that left IPEDS
# from FRAME_START to the last directory year. A closure dated after that year enters the
# frame when the next directory year is pulled.
FRAME_START, FRAME_END = 2010, IPEDS_END
FRAME_LABEL = f"{FRAME_START}-{FRAME_END}"

# Fields every public site must satisfy before release. Each gate names the
# field it checks so the validator and the page can report the same gaps.
RELEASE_GATES = ["coordinates", "closureYear", "morphology", "sourceUrl", "verification", "summary", "matrix"]


def load_curation() -> dict:
    if not CURATION_FILE.exists():
        return {}
    payload = json.loads(CURATION_FILE.read_text(encoding="utf-8"))
    return payload.get("sites", {})


GENERIC_SOURCE_PATTERNS = ("closedschoolsearchreq.xlsx",)

RECHECK_FIELDS = (
    "outcome", "closureDate", "campusFate", "buyerName", "buyerSector", "replacementSystem",
    "originalSystem", "transferDate", "confidence", "notes",
)


def load_rechecks() -> dict[int, dict]:
    """Second-pass results by UNITID, from tools/merge_rechecks.py."""
    if not AFTERLIFE_RECHECKS.exists():
        return {}
    payload = json.loads(AFTERLIFE_RECHECKS.read_text(encoding="utf-8"))
    return {int(unitid): entry for unitid, entry in payload.get("records", {}).items()}


def load_coded_records(apply_rechecks: bool = True) -> list[dict]:
    """Every hand-coded institution, from the random sample and from the census, with its tier.

    A recheck overlays the first coding: its revised fields replace the originals, its
    new evidence is appended, and the record keeps the verdict and the previous values.
    """
    rechecks = load_rechecks() if apply_rechecks else {}
    records: list[dict] = []
    for path, tier in ((AFTERLIFE_SAMPLE, "sample"), (AFTERLIFE_CENSUS, "census"), (AFTERLIFE_EXITS, "census")):
        if path.exists():
            for record in json.loads(path.read_text(encoding="utf-8")).get("records", []):
                unitid = int(record["unitid"])
                extra = {"duplicateOf": SAME_CAMPUS_AS_CURATED[unitid]} if unitid in SAME_CAMPUS_AS_CURATED else {}
                merged = {**record, "tier": tier, **extra}
                check = rechecks.get(unitid)
                if check:
                    previous = {key: record.get(key) for key in check.get("changed", [])}
                    merged.update({key: check["revised"][key] for key in check.get("changed", []) if key in check["revised"]})
                    seen = {e.get("url") for e in merged.get("evidence") or []}
                    merged["evidence"] = list(merged.get("evidence") or []) + [
                        e for e in check.get("newEvidence", []) if e.get("url") not in seen
                    ]
                    merged["recheck"] = {
                        "checkedOn": check.get("checkedOn"), "verdict": check.get("verdict"),
                        "changed": check.get("changed", []), "previous": previous, "note": check.get("note"),
                    }
                records.append(merged)
    return records


def extended_id_map() -> dict[int, str]:
    """Stable id per coded campus-closed institution: name slug plus state, with the UNITID on a collision."""
    chosen = sorted(
        (r for r in load_coded_records() if r.get("outcome") in CLOSED_OUTCOMES and not r.get("duplicateOf")),
        key=lambda r: int(r["unitid"]),
    )
    ids: dict[int, str] = {}
    taken: set[str] = set()
    for record in chosen:
        base = site_id(clean_text(record["name"]), clean_text(record.get("state") or ""))
        candidate = base if base not in taken else f"{base}-{record['unitid']}"
        taken.add(candidate)
        ids[int(record["unitid"])] = candidate
    return ids


def build_extended_sites(trajectories: dict[str, list[dict]], curated_ids: set[str]) -> list[dict]:
    """The extended layer: coded institutions whose campus closed, placed by IPEDS coordinates.

    These are not curated records. They are the random sample and the census, coded from
    public sources with an evidence URL per claim, and they are marked as such everywhere.
    """
    spine = {int(r["unitid"]): r for r in csv_rows(SPINE_CSV)} if SPINE_CSV.exists() else {}
    ids = extended_id_map()
    out: list[dict] = []
    for record in load_coded_records():
        unitid = int(record["unitid"])
        if unitid not in ids:
            continue
        row = spine.get(unitid, {})

        def number(key: str) -> float | None:
            try:
                value = float(row.get(key, ""))
            except (TypeError, ValueError):
                return None
            return value if value not in (-1.0, -2.0, -3.0) else None

        year = clean_year(record.get("closureDate")) or record.get("exitYear")
        replacement = record.get("replacementSystem") or ""
        site = {
            "id": ids[unitid],
            "unitid": unitid,
            "tier": record["tier"],
            "name": clean_text(record["name"]),
            "city": clean_text(record.get("city")),
            "state": clean_text(record.get("state")),
            "latitude": number("latitude"),
            "longitude": number("longitude"),
            "closureYear": year,
            "closureDate": record.get("closureDate"),
            "transferDate": record.get("transferDate"),
            "outcome": record["outcome"],
            "campusFate": record.get("campusFate"),
            "buyerName": record.get("buyerName"),
            "buyerSector": record.get("buyerSector"),
            "replacementSystem": replacement,
            "originalSystem": record.get("originalSystem"),
            "morphology": MORPHOLOGY_FROM_REPLACEMENT.get(replacement, ""),
            "zone": MORPHOLOGY_ZONE.get(MORPHOLOGY_FROM_REPLACEMENT.get(replacement, ""), "")
            or BUYER_ZONE.get(record.get("buyerSector") or "", ""),
            "confidence": record.get("confidence"),
            "notes": record.get("notes"),
            "evidence": record.get("evidence") or [],
            "recheck": (
                {k: record["recheck"].get(k) for k in ("verdict", "checkedOn", "changed", "note")}
                if record.get("recheck") else None
            ),
            "ipeds": {"unitid": unitid, "status": row.get("status") or record.get("ipedsStatus"), "lastYear": int(row["last_year"]) if row.get("last_year") else None},
        }
        full = trajectories.get(site["id"], [])
        site["trajectorySummary"] = trajectory_summary(full)
        # The page only draws the last ten years and the four fields below, so ship no more.
        site["trajectory"] = [
            {key: point.get(key) for key in ("year", "enrollment", "revenue", "expenses")} for point in full[-12:]
        ]
        out.append(site)
    out.sort(key=lambda s: (s["closureYear"] or 9999, s["name"]))
    # A coded institution that is also curated stays in the curated layer only.
    return [s for s in out if s["id"] not in curated_ids]


# Zone on the territory map. A replacement system decides it; failing that, an unambiguous
# buyer sector does. Religious bodies and public authorities have no single zone.
MORPHOLOGY_ZONE = {
    "Security": "SECURITY", "Cloud": "CLOUD", "Absorbed": "ABSORBED", "Health": "HEALTH", "Housing": "HOUSING",
    "Parcelized": "PARCELIZED", "Speculative": "SPECULATIVE", "Corporate": "SPECULATIVE", "K12": "K12",
    "Religious/K12": "K12", "Educational reuse": "COUNTER-USE", "Arts reuse": "COUNTER-USE", "Ruin": "RUIN",
}
BUYER_ZONE = {
    "Federal / security state": "SECURITY", "Hospital / health system": "HEALTH",
    "Elite / private university": "ABSORBED", "Other private college or university": "ABSORBED",
    "Public university": "ABSORBED", "Real estate capital": "SPECULATIVE", "Private owner / developer": "SPECULATIVE",
    "REIT / senior housing": "HOUSING", "K-12 / charter": "K12", "Cloud / platform capital": "CLOUD",
    "Arts organization": "COUNTER-USE", "Indigenous education": "COUNTER-USE", "Civic / nonprofit": "COUNTER-USE",
    "Absentee owner": "RUIN", "Corporate": "SPECULATIVE",
}


def build_census_summary(curated: list[dict], statuses: tuple[str, ...] = ("closed",)) -> dict:
    """Outcome and buyer shares across every private nonprofit degree-granting institution that
    left IPEDS with one of `statuses`, FRAME_START-FRAME_END."""
    if not SPINE_CSV.exists():
        return {}

    def exit_year(row: dict) -> int:
        return int(row.get("year_closed") or row.get("year_deleted") or (int(row["last_year"]) + 1))

    population = {
        int(r["unitid"]): r
        for r in csv_rows(SPINE_CSV)
        if r["control_label"] == "Private nonprofit"
        and r["degree_granting"] == "1"
        and r["status"] in statuses
        and FRAME_START <= exit_year(r) <= FRAME_END
    }
    coded: dict[int, dict] = {}
    for record in load_coded_records():
        if int(record["unitid"]) in population:
            coded[int(record["unitid"])] = {
                "outcome": record["outcome"],
                "buyerSector": None if record.get("duplicateOf") else record.get("buyerSector"),
                "tier": record["tier"],
            }
    for site in curated:
        unitid = (site.get("ipeds") or {}).get("unitid")
        if unitid and int(unitid) in population:
            done = any(e.get("type") in TRANSFER_TYPES and e.get("ownershipChange", True) is not False for e in site.get("events", []))
            coded[int(unitid)] = {
                "outcome": "closed-campus-reused" if done else "closed-campus-unknown",
                "buyerSector": (site.get("matrix") or {}).get("buyerSector") if done else None,
                "tier": "curated",
            }
    outcomes = Counter(v["outcome"] for v in coded.values())
    transfers = [v for v in coded.values() if v["outcome"] in ("closed-campus-reused", "merged-campus-closed") and v.get("buyerSector")]
    sectors = Counter(v["buyerSector"] for v in transfers)
    return {
        "population": len(population),
        "coded": len(coded),
        "complete": len(coded) >= len(population),
        "byTier": dict(Counter(v["tier"] for v in coded.values())),
        "outcomes": dict(outcomes),
        "knownBuyers": len(transfers),
        "buyerSectors": [{"label": k, "count": c, "sharePct": round(100 * c / len(transfers))} for k, c in sectors.most_common()] if transfers else [],
    }


def load_trajectories() -> dict[str, list[dict]]:
    """IPEDS enrollment and finance by site id and year, from tools/pull_ipeds_trajectories.py."""
    if not TRAJECTORIES_CSV.exists():
        return {}
    by_site: dict[str, list[dict]] = defaultdict(list)
    for row in csv_rows(TRAJECTORIES_CSV):
        def num(key: str) -> int | None:
            text = clean_text(row.get(key))
            return int(float(text)) if text else None

        by_site[row["siteId"]].append(
            {
                "year": int(row["year"]),
                "enrollment": num("enrollmentFall"),
                "revenue": num("revenue"),
                "expenses": num("expenses"),
                "tuitionNet": num("tuitionNet"),
                "netPosition": num("netPosition"),
                "longtermDebt": num("longtermDebt"),
                "endowment": num("endowment"),
            }
        )
    for rows in by_site.values():
        rows.sort(key=lambda r: r["year"])
    return by_site


def trajectory_summary(points: list[dict]) -> dict:
    """Peak and final enrollment, and how many of the last five reported years ran a deficit."""
    enrolled = [p for p in points if p.get("enrollment")]
    if not enrolled:
        return {}
    peak = max(enrolled, key=lambda p: p["enrollment"])
    last = enrolled[-1]
    decline = round(100 * (1 - last["enrollment"] / peak["enrollment"])) if peak["enrollment"] else None
    recent = [p for p in points if p.get("revenue") and p.get("expenses")][-5:]
    deficits = sum(1 for p in recent if p["expenses"] > p["revenue"])
    return {
        "peakYear": peak["year"],
        "peakEnrollment": peak["enrollment"],
        "lastYear": last["year"],
        "lastEnrollment": last["enrollment"],
        "declinePct": decline,
        "deficitYearsOfLastFive": deficits,
        "financeYearsOfLastFive": len(recent),
    }


def event_date_parts(value: object) -> tuple[int, int | None, int | None] | None:
    """Parse YYYY, YYYY-MM, or YYYY-MM-DD; return (year, month, day) with None for missing parts."""
    text = clean_text(value)
    match = re.fullmatch(r"(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?", text)
    if not match:
        return None
    year, month, day = match.groups()
    return int(year), int(month) if month else None, int(day) if day else None


def limbo_days(events: list[dict]) -> int | None:
    """Days from the closure event to the first transfer event, when both have month precision."""
    from datetime import date

    def as_date(event: dict) -> date | None:
        parts = event_date_parts(event.get("date"))
        if not parts or parts[1] is None:
            return None
        return date(parts[0], parts[1], parts[2] or 1)

    closure = next((as_date(e) for e in events if e.get("type") == "CLOSURE-EVENT"), None)
    transfers = sorted(
        d
        for d in (
            as_date(e)
            for e in events
            if e.get("type") in TRANSFER_TYPES and e.get("ownershipChange", True) is not False
        )
        if d
    )
    if closure is None or not transfers:
        return None
    return (transfers[0] - closure).days


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
    matrix = site.get("matrix") or {}
    if not all(matrix.get(key) for key in ("originalSystem", "buyerSector", "replacementSystem")):
        gaps.append("matrix")
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
    trajectories = load_trajectories()

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
        # The federal closed-school workbook lists every closure and supports none in particular.
        specific = [u for u in source_urls if not any(g in u for g in GENERIC_SOURCE_PATTERNS)]
        if specific:
            source_urls = specific

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
                "_DATA/ipeds_trajectories.csv",
            ],
        }
        matrix = curated.get("matrix") or {}
        site["matrix"] = {
            "originalSystem": clean_text(matrix.get("originalSystem")),
            "buyerSector": clean_text(matrix.get("buyerSector")),
            "replacementSystem": clean_text(matrix.get("replacementSystem")),
        }
        derived = MORPHOLOGY_FROM_REPLACEMENT.get(site["matrix"]["replacementSystem"])
        if derived and derived != site["morphology"]:
            print(f"  morphology {site['morphology']!r} -> {derived!r} (derived from replacement system): {name}")
            site["morphology"] = derived
        if curated.get("editorialNote"):
            site["editorialNote"] = clean_text(curated["editorialNote"])
        site["events"] = sorted(curated.get("events", []), key=lambda e: clean_text(e.get("date")))
        site["limboDays"] = limbo_days(site["events"])
        site["ipeds"] = curated.get("ipeds") or {}
        site["trajectory"] = trajectories.get(public_id, [])
        site["trajectorySummary"] = trajectory_summary(site["trajectory"])
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


def load_geocodes() -> dict[str, tuple[float, float]]:
    """Census batch-geocoder results by federal record id, from tools/geocode_peps.py."""
    if not GEOCODED_CSV.exists():
        return {}
    found: dict[str, tuple[float, float]] = {}
    for row in csv_rows(GEOCODED_CSV):
        if row.get("match") == "Match" and row.get("latitude") and row.get("longitude"):
            found[row["id"]] = (round(float(row["latitude"]), 4), round(float(row["longitude"]), 4))
    return found


FEDERAL_CORRECTIONS = Path(__file__).resolve().parents[1] / "curation" / "federal-corrections.json"


def load_federal_corrections() -> dict[str, dict]:
    if not FEDERAL_CORRECTIONS.exists():
        return {}
    return json.loads(FEDERAL_CORRECTIONS.read_text(encoding="utf-8")).get("records", {})


def geocoded_states() -> dict[str, str]:
    """State the Census geocoder placed each matched site in, by site id."""
    found: dict[str, str] = {}
    if not GEOCODED_CSV.exists():
        return found
    for row in csv_rows(GEOCODED_CSV):
        parts = [p.strip() for p in (row.get("matched_address") or "").split(",")]
        if row.get("match") == "Match" and len(parts) >= 3 and len(parts[-2]) == 2:
            found[row["id"]] = parts[-2]
    return found


def load_ipeds_index() -> dict[str, list[dict]]:
    """IPEDS spine rows by 6-digit root OPEID, for joining federal closure sites to their institution."""
    if not SPINE_CSV.exists():
        return {}
    index: dict[str, list[dict]] = defaultdict(list)
    for row in csv_rows(SPINE_CSV):
        opeid = clean_text(row.get("opeid"))
        if len(opeid) == 8 and opeid.isdigit():
            index[opeid[:6]].append(row)
    return index


def join_ipeds(root6: str, opeid8: str, index: dict[str, list[dict]]) -> tuple[dict | None, str]:
    """Match a federal site to its IPEDS institution.

    A site matches on its root OPEID. Additional locations carry a root whose
    leading digit was changed to 1 or 2, so a second pass restores the leading 0.
    Where several UNITIDs share a root, an exact 8-digit match wins, then the one
    that reported most recently.
    """
    tiers = [(root6, "root")]
    if root6[:1] in ("1", "2") and len(root6) == 6:
        tiers.append(("0" + root6[1:], "location"))
    for key, how in tiers:
        candidates = index.get(key)
        if candidates:
            exact = [c for c in candidates if clean_text(c.get("opeid")) == opeid8]
            pool = exact or candidates
            best = max(pool, key=lambda c: (int(c.get("last_year") or 0), c.get("status") == "active"))
            return best, ("opeid" if exact and how == "root" else how)
    return None, ""


SHEEO_CSV = ROOT / "_DATA" / "dead_campus_phase1_source_files" / "sheeo_closed_college_context_cleaned.csv"
SHEEO_SOURCE_URL = "https://sheeo.org/wp-content/uploads/2022/11/SHEEO_Closed_College_Context.xlsx"
SHEEO_NEGATION = re.compile(r"^\W*(no|none|n/?a|not|there (were|was) no)\b", re.I)


def _sheeo_date(value: str):
    text = clean_text(value)
    for fmt in ("%Y-%m-%d %H:%M:%S", "%m/%d/%Y", "%Y-%m-%d", "%Y%m%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _sheeo_sector(value: str) -> str:
    text = clean_text(value).lower()
    if "nonprofit" in text or "non-profit" in text:
        return "Private nonprofit"
    if "profit" in text or text == "proprietary":
        return "Private for-profit"
    if text == "public":
        return "Public"
    return ""


def _teach_out(value: str) -> str:
    text = clean_text(value).lower()
    if not text:
        return ""
    if text.startswith("yes") or "taught out" in text:
        return "yes"
    if text.startswith("no") or "no arrangements" in text:
        return "no"
    if text.startswith("n/a") or text.startswith("n a"):
        return "n/a (abrupt)"
    if text.startswith("unclear"):
        return "unclear"
    return ""


def load_sheeo() -> dict[str, dict]:
    """SHEEO Closed College Context: how each of 748 closures happened, keyed by 8-digit OPEID.

    One row is one OPEID, which is the same grain as a federal closure site. The file records
    when a closure was announced, whether it was abrupt or orderly, teach-out and merger
    arrangements, and where student records went. Researcher notes are kept as written.
    """
    if not SHEEO_CSV.exists():
        return {}
    found: dict[str, dict] = {}
    for row in csv_rows(SHEEO_CSV):
        opeid = clean_text(row.get("OPEID")).zfill(8)
        closed = _sheeo_date(row.get("Date Closed", ""))
        announced = _sheeo_date(row.get("Date Closure Announced", ""))
        lead = None
        after = False
        if closed and announced:
            delta = (closed - announced).days
            lead, after = (delta, False) if delta >= 0 else (None, True)
        flag = clean_text(row.get("Abrupt (1) vs Orderly (0)"))
        merger = clean_text(row.get("Attempted or Executed Merger"))
        retention = clean_text(row.get("Record Retention Agreement"))
        merge_date = _sheeo_date(row.get("Merge Date (in PEPS)", ""))
        urls: list[str] = []
        for key in ("Source(s)", "Source(s).1", "Source(s).2", "Source(s).3", "Source(s).4", "Source(s).5"):
            for url in re.findall(r"https?://[^\s)\]]+", row.get(key) or ""):
                url = url.rstrip(".,;")
                if url not in urls:
                    urls.append(url)
        found[opeid] = {
            "opeid": opeid,
            "name": clean_text(row.get("School Name")),
            "sector": _sheeo_sector(row.get("Sector", "")),
            "closed": closed.isoformat() if closed else None,
            "announced": announced.isoformat() if announced else None,
            "leadDays": lead,
            "announcedAfterClosure": after,
            "abrupt": {"1": True, "0": False}.get(flag),
            "teachOut": _teach_out(row.get("Teach-Out Plan in Place", "")),
            "merger": (None if not merger else not SHEEO_NEGATION.match(merger)),
            "mergerNote": merger[:400],
            "pepsMerge": clean_text(row.get("Merged/Consolidated (in PEPS)")) or None,
            "pepsMergeDate": merge_date.isoformat() if merge_date else None,
            "records": ("yes" if retention.lower().startswith("yes") else "no" if retention.lower() == "no" else ("other" if retention else None)),
            "recordsNote": retention[:240],
            "accreditors": [clean_text(row.get(k)) for k in ("Accrediting Agency 1 (in PEPS)", "Accrediting Agency 2 (in PEPS)", "Accrediting Agency 3 (in PEPS)") if clean_text(row.get(k))],
            "note": clean_text(row.get("Notes"))[:700],
            "sources": urls[:6],
        }
    return found


def sheeo_for_site(record: dict, sheeo: dict[str, dict]) -> dict | None:
    """The compact closure-process fields shipped on a federal site."""
    entry = sheeo.get(record.get("opeid", ""))
    if not entry:
        return None
    compact: dict = {}
    for key in ("announced", "leadDays", "abrupt", "teachOut", "records"):
        value = entry.get(key)
        if value not in (None, ""):
            compact[key] = value
    if entry.get("merger") is True or entry.get("pepsMerge"):
        compact["merged"] = entry.get("pepsMerge") or "attempted"
    if entry.get("closed") and record.get("closureDate"):
        federal = _sheeo_date(record["closureDate"])
        if federal and federal.isoformat() != entry["closed"]:
            compact["dateDiffers"] = entry["closed"]
    return compact


CLOSURE_PROCESS_FORPROFIT = Path(__file__).resolve().parents[1] / "curation" / "closure-process-forprofit.json"
TEACH_OUT_LABEL = {"n/a": "n/a (abrupt)"}


def load_atlas_process() -> dict[int, dict]:
    """For-profit exits coded with the SHEEO scheme by this project (tools/merge_closure_process.py)."""
    if not CLOSURE_PROCESS_FORPROFIT.exists():
        return {}
    payload = json.loads(CLOSURE_PROCESS_FORPROFIT.read_text(encoding="utf-8"))
    return {int(unitid): record for unitid, record in payload.get("records", {}).items()}


def attach_atlas_process(federal_records: list[dict], atlas: dict[int, dict], sheeo: dict[str, dict]) -> tuple[dict[str, dict], list[int]]:
    """Place each atlas-coded institution on its main federal site and return full entries by OPEID.

    The institution is the unit of coding, so the values sit on its main site (or its earliest
    site) and roll up from there, the same way SHEEO's site-grain rows roll up to an institution.
    Returns (entries including SHEEO's, UNITIDs of coded institutions with no federal site).
    """
    entries = dict(sheeo)
    by_unit: dict[int, list[dict]] = defaultdict(list)
    for record in federal_records:
        if record.get("ipedsUnitid"):
            by_unit[int(record["ipedsUnitid"])].append(record)
    unplaced: list[int] = []
    for unitid, coded in atlas.items():
        sites = by_unit.get(unitid, [])
        if not sites:
            unplaced.append(unitid)
            continue
        main = [s for s in sites if s.get("siteType") == "Main/Root"]
        site = (main or sorted(sites, key=lambda s: s.get("closureYear") or 9999))[0]
        if site.get("sheeo"):
            continue  # SHEEO already coded this site
        closed = _sheeo_date(coded.get("closed") or "") or _sheeo_date(site.get("closureDate") or "")
        announced = _sheeo_date(coded.get("announced") or "")
        lead = (closed - announced).days if closed and announced and (closed - announced).days >= 0 else None
        merger = coded.get("merger")
        evidence = coded.get("evidence") or []
        compact: dict = {"src": "atlas", "event": coded["event"]}
        if coded.get("announced"):
            compact["announced"] = coded["announced"]
        if lead is not None:
            compact["leadDays"] = lead
        if coded.get("abrupt") is not None:
            compact["abrupt"] = coded["abrupt"]
        if coded.get("teachOut"):
            compact["teachOut"] = TEACH_OUT_LABEL.get(coded["teachOut"], coded["teachOut"])
        if coded.get("records") and coded["records"] != "unknown":
            compact["records"] = coded["records"]
        if merger in ("attempted", "executed"):
            compact["merged"] = merger
        site["sheeo"] = compact
        entries[site["opeid"]] = {
            "opeid": site["opeid"], "name": coded.get("name"), "sector": "Private for-profit",
            "closed": closed.isoformat() if closed else None,
            "announced": coded.get("announced"), "leadDays": lead, "announcedAfterClosure": False,
            "abrupt": coded.get("abrupt"), "teachOut": TEACH_OUT_LABEL.get(coded.get("teachOut") or "", coded.get("teachOut") or ""),
            "merger": None if merger is None else merger != "none", "mergerNote": coded.get("mergerNote") or "",
            "pepsMerge": None, "pepsMergeDate": None, "records": coded.get("records"),
            "recordsNote": coded.get("recordsNote") or "", "accreditors": [],
            "note": coded.get("notes") or "", "sources": [e["url"] for e in evidence if e.get("url")][:6],
            "source": "Atlas coding", "event": coded["event"], "confidence": coded.get("confidence"),
        }
    return entries, unplaced


def build_atlas_process_summary(atlas: dict[int, dict], unplaced: list[int]) -> dict:
    if not atlas:
        return {}
    closures = [r for r in atlas.values() if r["event"] == "closure"]
    flagged = [r for r in closures if r.get("abrupt") is not None]
    abrupt = [r for r in flagged if r["abrupt"]]
    return {
        "coded": len(atlas),
        "unplaced": len(unplaced),
        "events": dict(Counter(r["event"] for r in atlas.values())),
        "closures": len(closures),
        "withAbruptFlag": len(flagged),
        "abrupt": len(abrupt),
        "abruptSharePct": round(100 * len(abrupt) / len(flagged)) if flagged else 0,
        "confidence": dict(Counter(r.get("confidence") for r in atlas.values())),
    }


def build_sheeo_summary(sheeo: dict[str, dict], federal_records: list[dict]) -> dict:
    """How closures happened, from the SHEEO file: abrupt versus orderly, notice given, teach-outs."""
    if not sheeo:
        return {}
    import statistics

    rows = list(sheeo.values())
    flagged = [r for r in rows if r["abrupt"] is not None]
    abrupt = [r for r in flagged if r["abrupt"]]

    def group(label: str) -> dict:
        part = [r for r in flagged if r["sector"] == label]
        hits = [r for r in part if r["abrupt"]]
        return {"label": label, "n": len(part), "abrupt": len(hits), "sharePct": round(100 * len(hits) / len(part)) if part else 0}

    notices = [r["leadDays"] for r in rows if r["leadDays"] is not None]
    by_sector_notice = {}
    for label in ("Private for-profit", "Private nonprofit", "Public"):
        values = sorted(r["leadDays"] for r in rows if r["sector"] == label and r["leadDays"] is not None)
        by_sector_notice[label] = {"n": len(values), "medianDays": int(statistics.median(values)) if values else None}
    years = sorted(int(r["closed"][:4]) for r in rows if r.get("closed"))
    federal_ids = {r.get("opeid") for r in federal_records}
    return {
        "source": "SHEEO Closed College Context (N=748)",
        "sourceUrl": SHEEO_SOURCE_URL,
        "rows": len(rows),
        "matchedToFederal": sum(1 for r in rows if r["opeid"] in federal_ids),
        "withAbruptFlag": len(flagged),
        "abrupt": len(abrupt),
        "orderly": len(flagged) - len(abrupt),
        "abruptSharePct": round(100 * len(abrupt) / len(flagged)) if flagged else 0,
        "bySector": [group(label) for label in ("Private for-profit", "Private nonprofit", "Public")],
        "notice": {
            "n": len(notices),
            "medianDays": int(statistics.median(notices)) if notices else None,
            "under30": sum(1 for v in notices if v < 30),
            "bySector": by_sector_notice,
        },
        "teachOut": dict(Counter(r["teachOut"] or "not recorded" for r in rows)),
        "mergerAttempted": sum(1 for r in rows if r["merger"]),
        "pepsMerged": sum(1 for r in rows if r["pepsMerge"]),
        "closedYears": [years[0], years[-1]] if years else [],
        "yearsWithMostClosures": [y for y, _ in Counter(years).most_common(3)],
    }


def closure_process_for_unit(unitid: int | None, by_unit: dict[int, list[dict]]) -> dict | None:
    """Closure-process fields for an institution: its main site if recorded, else its earliest site."""
    if not unitid:
        return None
    sites = [s for s in by_unit.get(int(unitid), []) if s.get("sheeo")]
    if not sites:
        return None
    main = [s for s in sites if s.get("siteType") == "Main/Root"]
    pick = (main or sorted(sites, key=lambda s: s.get("closureYear") or 9999))[0]
    return {**pick["sheeo"], "sites": len(sites), "siteId": pick["id"]}


FEDERAL_AUDIT: dict[str, list[str]] = {"stateMismatchUnresolved": []}


def build_federal_records() -> list[dict]:
    rows = csv_rows(ROOT / "_DATA" / "dead_campus_phase9_peps_normalized.csv")
    geocodes = load_geocodes()
    corrections = load_federal_corrections()
    matched_states = geocoded_states()
    sheeo = load_sheeo()
    FEDERAL_AUDIT["stateMismatchUnresolved"] = []
    ipeds_index = load_ipeds_index()
    records = []
    for index, row in enumerate(rows, start=1):
        records.append(
            {
                "id": clean_text(row.get("ATLAS_RECORD_ID")) or f"fsa-{index:05d}",
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
        coords = geocodes.get(records[-1]["id"])
        correction = corrections.get(records[-1]["id"], {})
        if coords and not correction.get("dropCoordinates"):
            records[-1]["latitude"], records[-1]["longitude"] = coords
        if correction.get("state") and correction["state"] != records[-1]["state"]:
            records[-1]["stateReported"] = records[-1]["state"]
            records[-1]["state"] = correction["state"]
        matched_state = matched_states.get(records[-1]["id"])
        if matched_state and matched_state != records[-1]["state"] and not records[-1]["country"] and not correction:
            FEDERAL_AUDIT["stateMismatchUnresolved"].append(records[-1]["id"])
        closure = sheeo_for_site(records[-1], sheeo)
        if closure is not None:
            records[-1]["sheeo"] = closure
        if ipeds_index:
            root6 = records[-1]["rootOpeid"].zfill(6) if records[-1]["rootOpeid"].isdigit() else records[-1]["rootOpeid"]
            opeid8 = records[-1]["opeid"].zfill(8) if records[-1]["opeid"].isdigit() else records[-1]["opeid"]
            match, how = join_ipeds(root6, opeid8, ipeds_index)
            if match:
                records[-1]["ipedsStatus"] = match["status"]
                records[-1]["ipedsMatch"] = how
                records[-1]["ipedsUnitid"] = int(match["unitid"])
                if match["status"] == "combined" and match.get("newid_name"):
                    records[-1]["successor"] = match["newid_name"]
    return records


def build_ipeds_join_summary(records: list[dict]) -> dict:
    """What the federal closure sites are attached to in IPEDS."""
    matched = [r for r in records if r.get("ipedsStatus")]
    by_status = Counter(r["ipedsStatus"] for r in matched)
    by_type: dict[str, Counter] = defaultdict(Counter)
    for record in matched:
        by_type[record.get("siteType") or "Unclassified"][record["ipedsStatus"]] += 1
    branch = by_type.get("Branch/Satellite", Counter())
    unmatched = [r for r in records if not r.get("ipedsStatus")]
    old_unmatched = sum(1 for r in unmatched if (r.get("closureYear") or 9999) < 2000)
    return {
        "total": len(records),
        "matched": len(matched),
        "unmatched": len(unmatched),
        "unmatchedBefore2000": old_unmatched,
        "byMethod": dict(Counter(r["ipedsMatch"] for r in matched)),
        "byStatus": dict(by_status),
        "byType": {key: dict(value) for key, value in by_type.items()},
        "branchRows": sum(branch.values()),
        "branchOfActive": branch.get("active", 0),
    }


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


def wilson(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    """Wilson score interval for a proportion, as percentages."""
    if n == 0:
        return (0.0, 0.0)
    p = successes / n
    denominator = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / denominator
    margin = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5) / denominator
    return (round(100 * max(0.0, centre - margin)), round(100 * min(1.0, centre + margin)))


def build_afterlife_summary() -> dict:
    """Weighted outcome and buyer shares from the coded stratified sample, with intervals."""
    if not AFTERLIFE_SAMPLE.exists():
        return {}
    sample = json.loads(AFTERLIFE_SAMPLE.read_text(encoding="utf-8"))
    rechecks = load_rechecks()
    records = []
    for record in sample.get("records", []):
        check = rechecks.get(int(record["unitid"]))
        if check:
            # The estimate uses each record's best current coding, so a second pass counts.
            record = {**record, **{k: check["revised"][k] for k in check.get("changed", []) if k in check["revised"]}}
        records.append(record)
    if not records:
        return {}
    strata = sample.get("strata", {})
    weights = {
        key: value["population"] / value["sampled"] for key, value in strata.items() if value.get("sampled")
    }
    total_weight = sum(weights.get(r["stratum"], 1.0) for r in records)

    def share(rows: list[dict]) -> int:
        return round(100 * sum(weights.get(r["stratum"], 1.0) for r in rows) / total_weight) if total_weight else 0

    def row(label: str, rows: list[dict], n: int) -> dict:
        low, high = wilson(len(rows), n)
        return {"label": label, "count": len(rows), "sharePct": share(rows), "ciLow": low, "ciHigh": high}

    n = len(records)
    outcome_rows = [
        row(outcome, [r for r in records if r["outcome"] == outcome], n)
        for outcome in SAMPLE_OUTCOMES
        if any(r["outcome"] == outcome for r in records)
    ]
    campus_closed = [r for r in records if r["outcome"] in ("closed-campus-reused", "closed-campus-unknown", "merged-campus-closed")]
    known_buyer = [r for r in records if r.get("buyerSector") and r["outcome"] in ("closed-campus-reused", "merged-campus-closed", "merged-campus-continues")]
    sector_counts = Counter(r["buyerSector"] for r in known_buyer)
    sector_rows = [
        {
            "label": label,
            "count": count,
            "sharePct": round(100 * count / len(known_buyer)),
            "ciLow": wilson(count, len(known_buyer))[0],
            "ciHigh": wilson(count, len(known_buyer))[1],
        }
        for label, count in sector_counts.most_common()
    ]
    # Land transfers only: the campus closed and someone else took it. Mergers in
    # which the campus continues are institutional absorptions, counted separately.
    transfers = [r for r in known_buyer if r["outcome"] in ("closed-campus-reused", "merged-campus-closed")]
    transfer_counts = Counter(r["buyerSector"] for r in transfers)
    transfer_rows = [
        {
            "label": label,
            "count": count,
            "sharePct": round(100 * count / len(transfers)),
            "ciLow": wilson(count, len(transfers))[0],
            "ciHigh": wilson(count, len(transfers))[1],
        }
        for label, count in transfer_counts.most_common()
    ]
    return {
        "n": n,
        "frameSize": sample.get("frameSize"),
        "seed": sample.get("seed"),
        "outcomes": outcome_rows,
        "campusClosed": row("campus-closed", campus_closed, n),
        "knownBuyer": len(known_buyer),
        "buyerSectors": sector_rows,
        "knownTransfers": len(transfers),
        "transferSectors": transfer_rows,
        "mergersCampusContinues": sum(1 for r in known_buyer if r["outcome"] == "merged-campus-continues"),
        "confidence": dict(Counter(r["confidence"] for r in records)),
    }


def formatted(value: int) -> str:
    return f"{value:,}"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def build_readings(sites: list[dict], queue_audit: dict, afterlife: dict | None = None, ipeds_join: dict | None = None, census: dict | None = None, exits: dict | None = None, sheeo_summary: dict | None = None) -> list[dict]:
    """The theoretical claims as testable readings, each with evidence from the data and a status.

    Status values: supported, mixed, untested. Numbers are computed at build time
    so the Method view never shows a figure the data does not back.
    """
    spine = load_json(SPINE_SUMMARY)
    catholic = load_json(CATHOLIC_TEST)
    readings: list[dict] = []

    summaries = [s["trajectorySummary"] for s in sites if s.get("trajectorySummary")]
    if summaries:
        declines = sorted(s["declinePct"] for s in summaries if s.get("declinePct") is not None)
        deficit_heavy = sum(1 for s in summaries if s.get("deficitYearsOfLastFive", 0) >= 3)
        readings.append(
            {
                "id": "deficit-curve",
                "claim": "Closure is a deficit curve, not an enrollment cliff.",
                "test": "Peak-to-last fall enrollment and deficit years in the last five reported years, from IPEDS, for each public campus.",
                "evidence": f"{deficit_heavy} of {len(summaries)} campuses ran deficits in three or more of their last five reported years; median enrollment decline from peak was {declines[len(declines) // 2]}%.",
                "counter": "Reporting stops before the final year, so the last reported deficit understates the end.",
                "status": "supported",
            }
        )

    by_status = spine.get("byStatus", {})
    if by_status:
        closed_control = spine.get("closedByControl", {})
        combined_control = spine.get("combinedByControl", {})
        readings.append(
            {
                "id": "public-combine",
                "claim": "Public institutions do not die, they combine. The campus survives the institution.",
                "test": f"IPEDS directory {IPEDS_START}-{IPEDS_END}: public institutions with a close date versus public institutions whose UNITID points at an absorbing institution.",
                "evidence": f"{closed_control.get('Public', 0)} public closures against {combined_control.get('Public', 0)} public combinations.",
                "counter": "A combination can be a paper consolidation with no change on the ground, and some combined campuses later close.",
                "status": "supported",
            }
        )
        readings.append(
            {
                "id": "for-profit-abyss",
                "claim": "The federal closure mass is for-profit. Distributed for-profit education collapsed like franchise retail.",
                "test": f"IPEDS closures by control, {IPEDS_START}-{IPEDS_END}, and exits by year.",
                "evidence": f"{closed_control.get('Private for-profit', 0):,} for-profit closures against {closed_control.get('Private nonprofit', 0):,} nonprofit; "
                + (f"{spine['exitsByYear'].get('2016', {}).get('closed', 0)} closures in 2016 alone." if spine.get("exitsByYear") else ""),
                "counter": "Branch-campus share by year is not yet separated out, so the franchise comparison is still a reading, not a measurement.",
                "status": "mixed",
            }
        )

    if ipeds_join and ipeds_join.get("matched"):
        matched = ipeds_join["matched"]
        active = ipeds_join["byStatus"].get("active", 0)
        branch_total = ipeds_join["branchRows"]
        branch_active = ipeds_join["branchOfActive"]
        main_total = sum(ipeds_join["byType"].get("Main/Root", {}).values())
        main_closed = ipeds_join["byType"].get("Main/Root", {}).get("closed", 0)
        share = round(100 * branch_active / branch_total) if branch_total else 0
        readings.append(
            {
                "id": "branch-retreat",
                "claim": "Most federal closure sites are branches of institutions that kept operating: franchise retreat, not institutional death.",
                "test": f"Join each federal closure site to its IPEDS institution by OPEID (exact, then root, then additional-location root) and read that institution's {IPEDS_START}-{IPEDS_END} status. Supported if half or more of matched branch sites belong to an institution still reporting in {IPEDS_END}.",
                "evidence": (
                    f"{formatted(matched)} of {formatted(ipeds_join['total'])} sites match an IPEDS institution; {formatted(active)} ({round(100 * active / matched)}%) belong to one still reporting in {IPEDS_END}. "
                    f"Of {formatted(branch_total)} matched branch and annex sites, {formatted(branch_active)} ({share}%) do. Of {formatted(main_total)} matched main-campus sites, {formatted(main_closed)} are institutions that closed."
                ),
                "counter": (
                    f"{formatted(ipeds_join['unmatched'])} sites do not match, and {formatted(ipeds_join['unmatchedBefore2000'])} of those closed before 2000, outside the IPEDS window, so the result describes closures since 2000. "
                    f"Active means the parent still reported to IPEDS in {IPEDS_END}, not that this site is open; the site closed. A parent that shed most of its branches may have shrunk badly without closing."
                ),
                "status": "supported" if share >= 50 else "mixed",
            }
        )
        for reading in readings:
            if reading["id"] == "for-profit-abyss":
                reading["counter"] = "Branch share is measured in the branch-retreat reading; the comparison with franchise retail is still a reading, not a measurement."

    groups = catholic.get("groups", {})
    if groups.get("active") and groups.get("left"):
        active_share = groups["active"]["catholicSharePct"]
        left_share = groups["left"]["catholicSharePct"]
        closed_share = groups.get("closed", {}).get("catholicSharePct")
        readings.append(
            {
                "id": "catholic-retreat",
                "claim": "Catholic campus closures are part of a wider religious institutional retreat.",
                "test": "Catholic share of private nonprofit degree-granting institutions that left IPEDS since 2000, against the Catholic share of those still active.",
                "evidence": f"Catholic colleges are {active_share}% of active nonprofits but {left_share}% of those that left ({closed_share}% of outright closures): {groups['left']['catholic']} Catholic exits in all.",
                "counter": "Catholic closures are many in absolute terms, but Catholic colleges are not over-represented among exits. The retreat reading needs diocesan property data, not closure rates alone.",
                "status": "unsupported" if (left_share or 0) < (active_share or 0) else "supported",
            }
        )

    limbo = [s for s in sites if isinstance(s.get("limboDays"), int)]
    if limbo:
        waited = sorted(s["limboDays"] for s in limbo if s["limboDays"] >= 0)
        pre_sold = [s for s in limbo if s["limboDays"] < 0]
        longest = max(limbo, key=lambda s: s["limboDays"])
        median_months = round(waited[len(waited) // 2] / 30.4) if waited else None
        readings.append(
            {
                "id": "time-in-limbo",
                "claim": "Ruin is a duration, not a type. The gap between closure and transfer is where speculation happens.",
                "test": "Days from the closure event to the first completed ownership change, where both are dated to the month.",
                "evidence": f"{len(limbo)} campuses are dated closely enough: the median wait for a buyer is {median_months} months, the longest is {longest['name']} at {round(longest['limboDays'] / 30.4)} months, and {len(pre_sold)} sold or agreed to sell before closing.",
                "counter": f"{len(sites) - len(limbo)} campuses still have year-only dates, and the fifteen measured are the ones with press coverage, which skews toward quick, visible sales.",
                "status": "mixed",
            }
        )

    matrix_sites = [s for s in sites if (s.get("matrix") or {}).get("buyerSector")]
    if matrix_sites:
        sector_counts = Counter(s["matrix"]["buyerSector"] for s in matrix_sites)
        universities = sector_counts.get("Elite / private university", 0) + sector_counts.get("Public university", 0)
        hospitals = sector_counts.get("Hospital / health system", 0)
        private = sector_counts.get("Private owner / developer", 0) + sector_counts.get("Real estate capital", 0)
        total = len(matrix_sites)
        readings.append(
            {
                "id": "who-takes-the-land",
                "claim": "Universities and private capital divide most dead campuses between them.",
                "test": "Buyer sector of each public campus from the replacement matrix.",
                "evidence": f"Universities took {universities} of {total} campuses and private owners and real-estate capital {private}, together {round(100 * (universities + private) / total)}%; hospital systems took {hospitals}, and the remainder is spread over {len([k for k in sector_counts if k not in ("Elite / private university", "Public university", "Private owner / developer", "Real estate capital", "Hospital / health system")])} other sectors.",
                "counter": "The public layer is the 34 iconic records, chosen for interest rather than sampled, so these are counts of a curated set, not rates. Universities and private capital tie.",
                "status": "mixed",
            }
        )
        readings.append(
            {
                "id": "hospital-replacement",
                "claim": "Hospital systems are replacing educational systems territorially.",
                "test": "Share of closed campuses whose buyer is a hospital or health system.",
                "evidence": f"{hospitals} of {total} campuses ({round(100 * hospitals / total)}%): Notre Dame College to Akron Children's Hospital and Southern Vermont College to Southwestern Vermont Health Care.",
                "counter": "Two cases cannot establish a pattern, and no hospital-acquisition layer has been compared against the federal closure sites.",
                "status": "untested",
            }
        )

    spine_rows = csv_rows(SPINE_CSV) if SPINE_CSV.exists() else []
    if spine_rows:
        by_state: dict[str, list[int]] = defaultdict(lambda: [0, 0])
        for row in spine_rows:
            if row.get("degree_granting") != "1" or not row.get("state"):
                continue
            by_state[row["state"]][0] += 1
            by_state[row["state"]][1] += int(row.get("status") != "active")
        ranked = sorted(
            ((state, left, total) for state, (total, left) in by_state.items() if total >= 100),
            key=lambda item: -item[1] / item[2],
        )
        if ranked:
            top = ", ".join(f"{s} {round(100 * l / n)}%" for s, l, n in ranked[:4])
            bottom = ", ".join(f"{s} {round(100 * l / n)}%" for s, l, n in ranked[-3:])
            readings.append(
                {
                    "id": "retreat-intensity",
                    "claim": "Educational retreat is not evenly spread: some states have lost far more of their institutions.",
                    "test": "Share of degree-granting institutions present since 2000 that have left IPEDS, by state, for states with at least 100 institutions.",
                    "evidence": f"Highest: {top}. Lowest: {bottom}.",
                    "counter": "States with many for-profit and cosmetology schools churn more, so the ranking mostly measures sector mix. Population and enrollment denominators are not applied.",
                    "status": "supported",
                }
            )

    status_counts = {row["label"]: row["count"] for row in queue_audit.get("statusCounts", [])}
    if status_counts:
        known = sum(v for k, v in status_counts.items() if k != "CLOSURE-EVENT")
        readings.append(
            {
                "id": "abyss-unknown",
                "claim": "Almost nothing in the federal layer has a known afterlife.",
                "test": "Status codes across the editorial queue.",
                "evidence": f"{status_counts.get('CLOSURE-EVENT', 0):,} closure events against {known} records with any afterlife code.",
                "counter": "The queue codes afterlife only where someone has looked, so this measures editorial reach as much as the world.",
                "status": "supported",
            }
        )

    geocoded = len(load_geocodes())
    geocode_note = (
        f"The federal layer is geocoded ({geocoded:,} sites matched by the Census batch geocoder), but no external layer is loaded to compare it with."
        if geocoded
        else "The federal layer is not yet geocoded."
    )
    for overlay in ["Dead campus and dead mall", "Campus to cloud corridors", "Senior housing conversion", "Logistics geography", "Population aging"]:
        readings.append(
            {
                "id": slug(overlay),
                "claim": f"{overlay}: dead campuses share a spatial system with a parallel infrastructure.",
                "test": "Spatial overlap between geocoded PEPS closure sites and an external GIS layer.",
                "evidence": geocode_note,
                "counter": "",
                "status": "untested",
            }
        )

    if afterlife and afterlife.get("n"):
        by_id = {r["id"]: r for r in readings}
        n = afterlife["n"]
        outcomes = {row["label"]: row for row in afterlife["outcomes"]}
        closed = afterlife["campusClosed"]
        operating = outcomes.get("still-operating", {"count": 0})["count"] + outcomes.get("not-a-closure", {"count": 0})["count"]
        merged_on = outcomes.get("merged-campus-continues", {"count": 0})["count"]
        status = "supported" if closed["sharePct"] >= 75 else "mixed" if closed["sharePct"] >= 40 else "unsupported"
        readings.insert(
            0,
            {
                "id": "exit-is-not-death",
                "claim": "Leaving IPEDS means a campus died.",
                "test": f"Hand-coded outcomes for a seeded stratified sample of {n} private nonprofit degree-granting institutions that left IPEDS in 2010-2024 (frame of {afterlife['frameSize']}). Status is supported at 75% or more confirmed campus closures, mixed at 40% or more, unsupported below.",
                "evidence": f"{closed['count']} of {n} ({closed['sharePct']}%, 95% interval {closed['ciLow']}-{closed['ciHigh']}%) were confirmed campus closures; {merged_on} merged and the campus continues; {operating} are still operating or were never closures; {outcomes.get('unresolved', {'count': 0})['count']} could not be resolved.",
                "counter": "Counting every IPEDS exit of a private nonprofit degree-granting institution as a closure overstates closures by about a third. The sample covers only that population; for-profit and non-degree exits, which make up most of the federal layer, were not sampled.",
                "status": status,
            },
        )
        if "retreat-intensity" in by_id:
            by_id["retreat-intensity"]["counter"] += (
                " The coded afterlife sample found that about a third of private nonprofit IPEDS exits are not campus closures, so these shares overstate closures."
            )
        if afterlife.get("knownTransfers", 0) >= 10:
            sectors = afterlife["transferSectors"]
            n_transfer = afterlife["knownTransfers"]
            top = "; ".join(f"{s['label']} {s['sharePct']}% ({s['ciLow']}-{s['ciHigh']}%)" for s in sectors[:4])
            if "who-takes-the-land" in by_id:
                reading = by_id["who-takes-the-land"]
                reading["claim"] = "Developers and investors take dead campuses less often than other colleges and religious bodies do."
                reading["test"] = "Buyer sector of each campus in the replacement matrix, and of the coded sample's closed campuses where a buyer was identified."
                reading["evidence"] = (
                    f"Sample, {n_transfer} closed campuses with an identified buyer: {top}. "
                    f"A further {afterlife['mergersCampusContinues']} institutions merged and the campus continued. "
                    f"Of the 34 curated campuses, universities took 7, private owners and real-estate capital 7, hospital systems 2."
                )
                reading["counter"] = (
                    f"Identified buyers skew toward campuses with press coverage, and {round(100 * outcomes.get('closed-campus-unknown', {'count': 0})['count'] / max(1, closed['count']))}% of the sample's confirmed closures have no buyer found. "
                    "The 34 curated campuses are chosen for interest, not sampled, so their counts are not rates."
                )
                reading["status"] = "mixed"
            hospital = next((s for s in sectors if s["label"] == "Hospital / health system"), None)
            count = hospital["count"] if hospital else 0
            low, high = wilson(count, n_transfer)
            pct = round(100 * count / n_transfer)
            if "hospital-replacement" in by_id:
                reading = by_id["hospital-replacement"]
                reading["test"] = "Share of closed campuses with an identified buyer whose buyer is a hospital or health system, from the coded sample. Supported if the interval's lower bound is 15% or more; mixed if the estimate is 5% or more; unsupported below."
                reading["evidence"] = f"{count} of {n_transfer} identified buyers ({pct}%, 95% interval {low}-{high}%); two of the 34 curated campuses went to hospital systems."
                reading["counter"] = (
                    f"The interval cannot rule out a rate as high as {high}%. "
                    "Identified buyers skew toward campuses with press coverage, and no hospital-acquisition layer has been compared against the federal closure sites."
                )
                reading["status"] = "supported" if low >= 15 else "mixed" if pct >= 5 else "unsupported"
    if census and census.get("population"):
        by_id = {r["id"]: r for r in readings}
        pop = census["population"]
        coded = census["coded"]
        o = census["outcomes"]
        reused = o.get("closed-campus-reused", 0)
        mclosed = o.get("merged-campus-closed", 0)
        unknown = o.get("closed-campus-unknown", 0)
        found = reused + mclosed
        status_word = "complete" if census["complete"] else f"{coded} of {pop} coded"
        readings.insert(
            0,
            {
                "id": "afterlife-unrecorded",
                "claim": "The afterlife of a closed college is mostly unrecorded.",
                "test": f"Every private nonprofit degree-granting institution IPEDS records as closed in {FRAME_LABEL} ({pop}; census {status_word}), each coded for what happened to its campus from public sources.",
                "evidence": (
                    f"Of {coded} coded closures, a new holder or user of the campus was found for {found} ({round(100 * found / coded)}%); "
                    f"for {unknown} ({round(100 * unknown / coded)}%) the closure is documented but the campus fate was not found."
                    + (f" Still operating or not a closure: {o.get('still-operating', 0) + o.get('not-a-closure', 0)}; merged with the campus continuing: {o.get('merged-campus-continues', 0)}." if (o.get('still-operating', 0) + o.get('not-a-closure', 0) + o.get('merged-campus-continues', 0)) else "")
                ),
                "counter": "Absence of a source is not absence of an afterlife: small campuses get little press, and the search was limited to what public pages state. The count is a floor on what is knowable, not a measure of what happened.",
                "status": "supported" if coded and unknown / coded >= 0.5 else "mixed",
            },
        )
        if census["complete"] and census.get("knownBuyers", 0) >= 10 and "hospital-replacement" in by_id:
            sectors = census["buyerSectors"]
            hosp = next((s for s in sectors if s["label"] == "Hospital / health system"), None)
            count = hosp["count"] if hosp else 0
            n = census["knownBuyers"]
            pct = round(100 * count / n)
            reading = by_id["hospital-replacement"]
            reading["test"] = f"Share of closed campuses with an identified buyer whose buyer is a hospital or health system, across the full census of closed private nonprofit colleges {FRAME_LABEL}. Supported at 15% or more; mixed at 5% or more; unsupported below."
            reading["evidence"] = f"{count} of {n} identified buyers ({pct}%) across all {pop} closures; the sample-based estimate was in the same range."
            reading["counter"] = "Identified buyers skew toward campuses with press coverage, and no hospital-acquisition layer has been compared against the closure sites."
            reading["status"] = "supported" if pct >= 15 else "mixed" if pct >= 5 else "unsupported"
        if census["complete"] and census.get("knownBuyers", 0) >= 10 and "who-takes-the-land" in by_id:
            sectors = census["buyerSectors"]
            top = "; ".join(f"{s['label']} {s['sharePct']}%" for s in sectors[:4])
            reading = by_id["who-takes-the-land"]
            reading["claim"] = (
                f"No single buyer dominates closed campuses: religious bodies and private owners lead, at about {sectors[0]['sharePct']}% each of identified buyers."
                if len(sectors) > 1 and abs(sectors[0]["count"] - sectors[1]["count"]) <= 1
                else f"{sectors[0]['label']} take the most closed campuses, {sectors[0]['sharePct']}% of identified buyers."
            )
            reading["test"] = f"Buyer sector of every closed private nonprofit college in {FRAME_LABEL} with an identified holder of the campus, across the full census and the curated records."
            reading["evidence"] = f"Census of {pop} closures, {census['knownBuyers']} with an identified buyer: {top}. Across the 34 curated campuses, universities took 7, private owners and real-estate capital 7, hospital systems 2."
            reading["counter"] = "Identified buyers skew toward campuses with press coverage, and most closures have no buyer found, so the shares describe the documented minority."
            reading["status"] = "mixed"
        if census.get("complete") and "exit-is-not-death" in by_id:
            gone = o.get("still-operating", 0) + o.get("not-a-closure", 0)
            by_id["exit-is-not-death"]["counter"] += (
                f" Where IPEDS gives a close date, the signal is reliable: only {gone} of {pop} institutions it records as closed turned out not to have closed. The unreliability sits in institutions that simply stopped reporting."
            )
    if exits and exits.get("complete") and exits.get("population"):
        by_id = {r["id"]: r for r in readings}
        n = exits["population"]
        o = exits["outcomes"]
        closed = o.get("closed-campus-reused", 0) + o.get("closed-campus-unknown", 0) + o.get("merged-campus-closed", 0)
        cont = o.get("merged-campus-continues", 0)
        operating = o.get("still-operating", 0) + o.get("not-a-closure", 0)
        unresolved = o.get("unresolved", 0)
        share = round(100 * closed / n)
        if "exit-is-not-death" in by_id:
            reading = by_id["exit-is-not-death"]
            reading["test"] = f"Every private nonprofit degree-granting institution that left IPEDS in {FRAME_LABEL} ({n}, the full population, not a sample), each coded for what happened to its campus. Supported at 75% or more confirmed campus closures; mixed at 40% or more; unsupported below."
            reading["evidence"] = (
                f"{closed} of {n} ({share}%) were confirmed campus closures; {cont} merged and the campus continues; "
                f"{operating} are still operating or were never closures; {unresolved} could not be resolved."
            )
            reading["counter"] = (
                f"{round(100 * (n - closed) / n)}% of exits were not campus closures, so counting every IPEDS exit of a private nonprofit degree-granting institution as a closure overstates closures by about "
                f"{round(100 * (n - closed) / max(1, closed))}%. The population is nonprofits only; for-profit and non-degree exits, which make up most of the federal layer, were not coded."
            )
            reading["status"] = "supported" if share >= 75 else "mixed" if share >= 40 else "unsupported"
    if sheeo_summary and sheeo_summary.get("withAbruptFlag"):
        total = sheeo_summary["withAbruptFlag"]
        share = sheeo_summary["abruptSharePct"]
        sectors = {g["label"]: g for g in sheeo_summary["bySector"]}
        notice = sheeo_summary["notice"]
        fp, np_, pub = sectors["Private for-profit"], sectors["Private nonprofit"], sectors["Public"]
        atlas = sheeo_summary.get("atlas") or {}
        status = "supported" if share >= 50 else "mixed" if share >= 25 else "unsupported"
        readings.append(
            {
                "id": "abrupt-closure",
                "claim": "Closures arrive without warning, and the students are left.",
                "test": f"Share of {total:,} closures in the SHEEO closed-college file that researchers coded abrupt rather than orderly. Supported at 50% or more; mixed at 25% or more; unsupported below.",
                "evidence": (
                    f"{sheeo_summary['abrupt']} of {total} ({share}%) were abrupt. By sector: for-profit {fp['sharePct']}% of {fp['n']}, "
                    f"nonprofit {np_['sharePct']}% of {np_['n']}, public {pub['sharePct']}% of {pub['n']}. "
                    f"Among the {notice['n']} with a dated announcement, the median notice was {notice['medianDays']} days and {notice['under30']} gave under 30."
                    + (
                        f" The atlas applied the same scheme to {atlas['coded']} more for-profit exits: {atlas['closures']} were closures, "
                        f"{atlas['abrupt']} of {atlas['withAbruptFlag']} coded ones abrupt ({atlas['abruptSharePct']}%); the rest were consolidations, mergers, or not closures."
                        if atlas.get("coded") else ""
                    )
                ),
                "counter": (
                    "Orderly means a teach-out or notice existed, not that students were unharmed. The file covers about "
                    f"{sheeo_summary['closedYears'][0]} to {sheeo_summary['closedYears'][1]} and is mostly for-profit "
                    f"({fp['n']} of {total}), so the nonprofit and public figures rest on {np_['n']} and {pub['n']} closures."
                ),
                "status": status,
            }
        )

    return readings


def load_source_freshness() -> dict:
    if not SOURCE_FRESHNESS.exists():
        return {}
    return json.loads(SOURCE_FRESHNESS.read_text(encoding="utf-8"))


def content_digest(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()[:10]


def stamp_page_assets() -> None:
    """Append a content digest to the stylesheet and scripts index.html loads eagerly."""
    html_path = DATA_DIR.parent / "index.html"
    if not html_path.exists():
        return
    text = html_path.read_text(encoding="utf-8")
    for name in ("styles.css", "data/atlas-data.js", "app.js"):
        source = DATA_DIR.parent / name
        if not source.exists():
            continue
        digest = hashlib.sha1(source.read_bytes()).hexdigest()[:10]
        text = re.sub(
            rf'((?:href|src)=")({re.escape(name)})(?:\?v=[0-9a-f]+)?(")',
            rf"\g<1>\g<2>?v={digest}\g<3>",
            text,
        )
    html_path.write_text(text, encoding="utf-8")


def main() -> None:
    sites = build_public_sites()
    morphologies = sorted({site["morphology"] for site in sites if site["morphology"]})
    source_freshness = load_source_freshness()
    federal_records = build_federal_records()
    afterlife_summary = build_afterlife_summary()
    ipeds_join = build_ipeds_join_summary(federal_records)
    extended_sites = build_extended_sites(load_trajectories(), {s["id"] for s in sites})
    census_summary = build_census_summary(sites)
    exits_summary = build_census_summary(sites, ("closed", "dropped", "combined"))
    sheeo = load_sheeo()
    sheeo_summary = build_sheeo_summary(sheeo, federal_records)
    atlas_process = load_atlas_process()
    process_entries, atlas_unplaced = attach_atlas_process(federal_records, atlas_process, sheeo)
    atlas_summary = build_atlas_process_summary(atlas_process, atlas_unplaced)
    if sheeo_summary:
        sheeo_summary["atlas"] = atlas_summary
    federal_by_unit: dict[int, list[dict]] = defaultdict(list)
    for record in federal_records:
        if record.get("ipedsUnitid"):
            federal_by_unit[int(record["ipedsUnitid"])].append(record)
    for site in [*sites, *extended_sites]:
        unitid = site.get("unitid") or (site.get("ipeds") or {}).get("unitid")
        process = closure_process_for_unit(unitid, federal_by_unit)
        if process:
            site["closureProcess"] = process
    # One table for all three layers. This also stamps each federal site with its
    # institution's page id, so it must run before the federal bundle is written.
    spine = {int(r["unitid"]): r for r in csv_rows(SPINE_CSV)} if SPINE_CSV.exists() else {}
    record_rows = atlas_dataset.build_records(
        sites,
        extended_sites,
        load_coded_records(),
        federal_records,
        spine,
        TRANSFER_TYPES,
        lambda morphology, buyer: MORPHOLOGY_ZONE.get(morphology or "", "") or BUYER_ZONE.get(buyer or "", ""),
        process_entries,
        {u: atlas_process[u] for u in atlas_unplaced},
    )
    dataset_summary = atlas_dataset.summarize(record_rows)
    dataset_problems = atlas_dataset.validate_records(
        record_rows, len(federal_records), [s["id"] for s in sites], [s["id"] for s in extended_sites]
    )
    if dataset_problems:
        raise SystemExit("Unified dataset is inconsistent:\n  " + "\n  ".join(dataset_problems))
    OUT_RECORDS_CSV.parent.mkdir(parents=True, exist_ok=True)
    atlas_dataset.write_csv(record_rows, OUT_RECORDS_CSV)
    OUT_RECORDS_SCHEMA.write_text(json.dumps(atlas_dataset.schema(), indent=2) + "\n", encoding="utf-8")
    dataset_summary["bytes"] = OUT_RECORDS_CSV.stat().st_size
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
            "_DATA/ipeds_directory_spine.csv",
            "_DATA/ipeds_trajectories.csv",
        ],
        "federalRecordCount": len(federal_records),
        "ipedsYears": [IPEDS_START, IPEDS_END],
        "dataset": dataset_summary,
        "sheeo": sheeo_summary,
        "federalAudit": {
            "corrections": len(load_federal_corrections()),
            "stateMismatchUnresolved": FEDERAL_AUDIT["stateMismatchUnresolved"],
        },
        "publicSites": sites,
        "typology": {key: TYPOLOGY.get(key, {"tone": "#4f4a45", "description": ""}) for key in morphologies},
        "verificationVocabulary": list(VERIFICATION_VOCABULARY),
        "eventTypes": EVENT_TYPES,
        "sampleOutcomes": SAMPLE_OUTCOMES,
        "matrixVocabulary": {
            "originalSystem": ORIGINAL_SYSTEMS,
            "buyerSector": BUYER_SECTORS,
            "replacementSystem": REPLACEMENT_SYSTEMS,
        },
        "releaseBar": build_release_bar(sites),
        "abyss": {**build_abyss_summary(source_freshness), "ipedsJoin": ipeds_join},
        "queueAudit": build_queue_audit(),
        "afterlifeSample": afterlife_summary,
        "extendedSites": extended_sites,
        "census": census_summary,
        "exitsCensus": exits_summary,
        "readings": build_readings(sites, build_queue_audit(), afterlife_summary, ipeds_join, census_summary, exits_summary, sheeo_summary),
        "sourceFreshness": source_freshness,
    }
    OUT_JS.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # The page loads the curated layer eagerly and the extended records lazily, both compact.
    # canonical-atlas.json above keeps everything, readable, for anyone using the data directly.
    extended_text = "window.DEAD_CAMPUS_EXTENDED = " + json.dumps(payload["extendedSites"], ensure_ascii=False, separators=(",", ":")) + ";\n"
    federal_text = "window.DEAD_CAMPUS_FEDERAL_RECORDS = " + json.dumps(federal_records, ensure_ascii=False, separators=(",", ":")) + ";\n"
    OUT_EXTENDED_JS.write_text(extended_text, encoding="utf-8")
    OUT_FEDERAL_JS.write_text(federal_text, encoding="utf-8")
    page_payload = {key: value for key, value in payload.items() if key != "extendedSites"}
    page_payload["extendedCount"] = len(payload["extendedSites"])
    # Content digests, so a browser never pairs a new script with a stale data bundle.
    page_payload["assetVersions"] = {
        "extended": content_digest(extended_text),
        "federal": content_digest(federal_text),
        "records": content_digest(OUT_RECORDS_CSV.read_text(encoding="utf-8")),
    }
    OUT_JS.write_text(
        "window.DEAD_CAMPUS_ATLAS = " + json.dumps(page_payload, ensure_ascii=False, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    stamp_page_assets()
    bar = payload["releaseBar"]
    print(f"Wrote {OUT_JSON}")
    print(f"Public sites: {bar['publicSites']} ({bar['releaseReady']} release-ready)")
    for gate, count in bar["gapCounts"].items():
        if count:
            print(f"  gap {gate}: {count}")
    print(f"Wrote {OUT_JS}")
    print(f"Wrote {OUT_FEDERAL_JS}")
    print(f"Wrote {OUT_RECORDS_CSV}: {dataset_summary['records']} records "
          f"({dataset_summary['institutions']} institutions, {dataset_summary['sites']} sites)")


if __name__ == "__main__":
    main()
