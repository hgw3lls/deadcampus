#!/usr/bin/env python3
"""Refresh federal closed-school data and rebuild the PEPS atlas spine."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import posixpath
import re
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone, timedelta
from pathlib import Path
from xml.etree import ElementTree

import fsa_ids


ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = ROOT / "_DATA"
SOURCE_DIR = DATA_ROOT / "dead_campus_phase1_source_files"
SNAPSHOT_DIR = DATA_ROOT / "fsa_snapshots"
RAW_WORKBOOK = SOURCE_DIR / "closedschoolsearchreq.xlsx"
CLEAN_CSV = DATA_ROOT / "peps_site_retreat_cleaned.csv"
NORMALIZED_CSV = DATA_ROOT / "dead_campus_phase9_peps_normalized.csv"
FRESHNESS_JSON = DATA_ROOT / "source_freshness.json"

WEEKLY_REPORT_PAGE = "https://fsapartners.ed.gov/additional-resources/reports/weekly-closed-school-search-file"
MONTHLY_REPORT_PAGE = "https://fsapartners.ed.gov/additional-resources/reports/monthly-closed-school-reports"
REPORT_API_BASE = "https://user-api.fsapartners.ed.gov"
WEEKLY_REPORT_SEARCH_API = f"{REPORT_API_BASE}/reports/search/weekly-closed-school"
REPORT_DOWNLOAD_API = f"{REPORT_API_BASE}/reports/download"
LEGACY_WEEKLY_WORKBOOK = "https://www.ed.gov/sites/ed/files/offices/OSFAP/PEPS/docs/closedschoolsearchreq.xlsx"
DEFAULT_MAX_STALE_DAYS = 45

BASE_FIELDS = [
    "Atlas_Scale",
    "Closed_Date",
    "Closed_Year",
    "OPEID_8",
    "Root_OPEID_6",
    "Branch_Suffix",
    "Is_Main_Campus_OPEID00",
    "School_Name",
    "Location",
    "Address",
    "City",
    "State",
    "Zip_Code",
    "Country_Foreign",
    "Afterlife_Status",
    "Morphology",
    "Buyer_or_Controller",
    "Sale_Price",
    "Acreage",
    "Research_Priority",
    "Source_URL",
]

NORMALIZED_FIELDS = BASE_FIELDS + [
    "ATLAS_OPEID_RAW",
    "ATLAS_OPEID_ROOT",
    "ATLAS_BRANCH_SUFFIX",
    "ATLAS_SITE_TYPE",
    "ATLAS_CLOSURE_YEAR",
    "ATLAS_INSTITUTION_NAME",
    "ATLAS_STATE",
    "ATLAS_CITY",
    "ATLAS_ADDRESS",
    "ATLAS_PRELIMINARY_CLASS",
    "ATLAS_RECORD_ID",
]

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "office_rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkg_rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}


def clean_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def fetch_url(url: str) -> bytes:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "DeadCampusAtlas/0.1 (+local archival refresh)",
            "Accept": "text/html,application/xhtml+xml,application/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
        },
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def post_json(url: str, payload: object = None) -> object:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "User-Agent": "DeadCampusAtlas/0.1 (+local archival refresh)",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.loads(response.read().decode("utf-8"))


def post_bytes(url: str, payload: object) -> bytes:
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "User-Agent": "DeadCampusAtlas/0.1 (+local archival refresh)",
            "Accept": "application/zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,*/*",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def discover_weekly_workbook_url(page_html: bytes) -> str | None:
    text = page_html.decode("utf-8", "ignore")
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', text, re.I)
    candidates = []
    for href in hrefs:
        absolute = urllib.parse.urljoin(WEEKLY_REPORT_PAGE, href)
        lower = absolute.lower()
        if lower.endswith((".xlsx", ".xls", ".csv")) and "closed" in lower:
            candidates.append(absolute)
    return candidates[0] if candidates else None


def is_xlsx_package(payload: bytes) -> bool:
    try:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            return "xl/workbook.xml" in archive.namelist()
    except zipfile.BadZipFile:
        return False


def extract_workbook_payload(payload: bytes) -> tuple[bytes, str]:
    if is_xlsx_package(payload):
        return payload, "download.xlsx"
    try:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            candidates = [
                name
                for name in archive.namelist()
                if name.lower().endswith(".xlsx") and not name.startswith("__MACOSX/")
            ]
            if not candidates:
                raise SystemExit("FSA download did not contain an XLSX workbook")
            name = sorted(candidates)[0]
            return archive.read(name), posixpath.basename(name)
    except zipfile.BadZipFile as exc:
        raise SystemExit("FSA download was neither an XLSX workbook nor a zip containing one") from exc


def download_current_weekly_report(discovery: dict) -> tuple[bytes, str, dict]:
    discovery["weeklyApiUrl"] = WEEKLY_REPORT_SEARCH_API
    discovery["downloadApiUrl"] = REPORT_DOWNLOAD_API
    reports = post_json(WEEKLY_REPORT_SEARCH_API, None)
    discovery["weeklyApiChecked"] = True
    discovery["weeklyApiRecords"] = len(reports) if isinstance(reports, list) else None
    if not isinstance(reports, list) or not reports:
        raise SystemExit("FSA weekly report API returned no report metadata")

    report = reports[0]
    doc_type = clean_text(report.get("docType"))
    doc_storage_id = clean_text(report.get("docStorageId"))
    if not doc_type or not doc_storage_id:
        raise SystemExit("FSA weekly report metadata was missing docType or docStorageId")

    discovery["reportDocType"] = doc_type
    discovery["reportDocStorageId"] = doc_storage_id
    discovery["reportProcDate"] = clean_text(report.get("procDate"))

    archive = post_bytes(REPORT_DOWNLOAD_API, {"docType": doc_type, "docStorageId": doc_storage_id})
    discovery["downloadedArchiveSha256"] = sha256_bytes(archive)
    workbook_bytes, workbook_name = extract_workbook_payload(archive)
    discovery["downloadedWorkbookName"] = workbook_name
    return workbook_bytes, WEEKLY_REPORT_PAGE, discovery


def download_weekly_workbook(source_url: str | None = None, allow_legacy_fallback: bool = False) -> tuple[bytes, str, dict]:
    discovery = {
        "weeklyReportPage": WEEKLY_REPORT_PAGE,
        "monthlyReportPage": MONTHLY_REPORT_PAGE,
        "weeklyPageChecked": False,
        "monthlyPageChecked": False,
        "weeklyApiChecked": False,
        "discoveredWeeklyWorkbookUrl": "",
        "monthlyPageHash": "",
        "legacyFallbackAllowed": allow_legacy_fallback,
    }

    if source_url:
        payload = fetch_url(source_url)
        workbook_bytes, workbook_name = extract_workbook_payload(payload)
        discovery["explicitSourceWorkbookName"] = workbook_name
        return workbook_bytes, source_url, discovery

    try:
        return download_current_weekly_report(discovery)
    except (urllib.error.URLError, json.JSONDecodeError, SystemExit) as exc:
        discovery["weeklyApiError"] = str(exc)

    try:
        weekly_page = fetch_url(WEEKLY_REPORT_PAGE)
        discovery["weeklyPageChecked"] = True
        discovered = discover_weekly_workbook_url(weekly_page)
        discovery["discoveredWeeklyWorkbookUrl"] = discovered or ""
        if discovered:
            payload = fetch_url(discovered)
            workbook_bytes, workbook_name = extract_workbook_payload(payload)
            discovery["discoveredWeeklyWorkbookName"] = workbook_name
            return workbook_bytes, discovered, discovery
    except urllib.error.URLError as exc:
        discovery["weeklyPageError"] = str(exc)

    try:
        monthly_page = fetch_url(MONTHLY_REPORT_PAGE)
        discovery["monthlyPageChecked"] = True
        discovery["monthlyPageHash"] = sha256_bytes(monthly_page)
    except urllib.error.URLError as exc:
        discovery["monthlyPageError"] = str(exc)

    if allow_legacy_fallback:
        discovery["legacyFallbackUsed"] = True
        return fetch_url(LEGACY_WEEKLY_WORKBOOK), LEGACY_WEEKLY_WORKBOOK, discovery

    raise SystemExit(
        "Could not fetch the current FSA weekly closed-school report. "
        "Use --use-local for the last cached workbook, --source-url for an explicit file, "
        "or --allow-legacy-fallback if you intentionally want the old ED workbook."
    )


def column_index(cell_reference: str) -> int:
    letters = re.sub(r"[^A-Z]", "", cell_reference.upper())
    value = 0
    for letter in letters:
        value = value * 26 + ord(letter) - ord("A") + 1
    return value - 1


def workbook_sheet_path(workbook: zipfile.ZipFile, sheet_name: str | None = None) -> str:
    workbook_root = ElementTree.fromstring(workbook.read("xl/workbook.xml"))
    rels_root = ElementTree.fromstring(workbook.read("xl/_rels/workbook.xml.rels"))
    rels = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels_root.findall("pkg_rel:Relationship", NS)
    }
    sheets = workbook_root.findall("main:sheets/main:sheet", NS)
    chosen = None
    if sheet_name:
        for sheet in sheets:
            if sheet.attrib.get("name") == sheet_name:
                chosen = sheet
                break
    else:
        chosen = sheets[0] if sheets else None
    if chosen is None:
        raise SystemExit(f"Missing sheet {sheet_name!r}")
    rel_id = chosen.attrib[f"{{{NS['office_rel']}}}id"]
    target = rels[rel_id]
    if target.startswith("/"):
        return target.lstrip("/")
    return posixpath.normpath(posixpath.join("xl", target))


def shared_strings(workbook: zipfile.ZipFile) -> list[str]:
    try:
        root = ElementTree.fromstring(workbook.read("xl/sharedStrings.xml"))
    except KeyError:
        return []
    return ["".join(text.text or "" for text in item.findall(".//main:t", NS)) for item in root.findall("main:si", NS)]


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


def workbook_rows(path: Path) -> list[list[object]]:
    with zipfile.ZipFile(path) as workbook:
        strings = shared_strings(workbook)
        sheet_root = ElementTree.fromstring(workbook.read(workbook_sheet_path(workbook)))
    rows = []
    for row in sheet_root.findall(".//main:sheetData/main:row", NS):
        values: list[object] = []
        for cell in row.findall("main:c", NS):
            index = column_index(cell.attrib.get("r", "A"))
            while len(values) <= index:
                values.append("")
            values[index] = cell_value(cell, strings)
        rows.append(values)
    return rows


def excel_date(value: object) -> tuple[str, int | None]:
    text = clean_text(value)
    if not text:
        return "", None
    if re.fullmatch(r"\d+(\.0+)?", text):
        date = datetime(1899, 12, 30) + timedelta(days=int(float(text)))
        return f"{date:%Y-%m-%d} 00:00:00", date.year
    match = re.search(r"(\d{4})", text)
    return text, int(match.group(1)) if match else None


def parse_report_datetime(value: str) -> datetime | None:
    text = clean_text(value)
    if not text:
        return None
    candidates = [
        text,
        text.replace("Z", "+00:00"),
        text[:10],
    ]
    for candidate in candidates:
        try:
            parsed = datetime.fromisoformat(candidate)
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    for fmt in ("%m/%d/%Y", "%m-%d-%Y"):
        try:
            return datetime.strptime(text[:10], fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            pass
    return None


def validate_report_freshness(metadata: dict, discovery: dict, max_stale_days: int, allow_stale: bool) -> None:
    date_value = clean_text(discovery.get("reportProcDate")) or clean_text(metadata.get("reportedDate"))
    reported = parse_report_datetime(date_value)
    if reported is None:
        message = "Could not parse the FSA report date; refusing to mark the federal layer fresh."
        if allow_stale:
            discovery["freshnessWarning"] = message
            return
        raise SystemExit(message)

    age_days = (datetime.now(timezone.utc).date() - reported.date()).days
    discovery["reportedAgeDays"] = age_days
    if age_days > max_stale_days:
        message = (
            f"FSA report date {reported.date().isoformat()} is {age_days} days old, "
            f"which is beyond the {max_stale_days}-day freshness limit."
        )
        if allow_stale:
            discovery["freshnessWarning"] = message
            return
        raise SystemExit(message)


def local_source_url() -> str:
    source = load_existing_freshness().get("fsaClosedSchoolSearch", {}).get("sourceUrl")
    if source:
        return source
    return LEGACY_WEEKLY_WORKBOOK


def load_existing_freshness() -> dict:
    if not FRESHNESS_JSON.exists():
        return {}
    try:
        return json.loads(FRESHNESS_JSON.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def seed_local_discovery(discovery: dict) -> dict:
    existing = load_existing_freshness()
    previous_source = existing.get("fsaClosedSchoolSearch", {})
    discovery.update(existing.get("fsaReports", {}))
    discovery["localMode"] = True
    local_fields = {
        "downloadApiUrl": previous_source.get("downloadUrl", ""),
        "reportDocType": previous_source.get("reportDocType", ""),
        "reportDocStorageId": previous_source.get("reportDocStorageId", ""),
        "reportProcDate": previous_source.get("reportProcDate", ""),
        "downloadedWorkbookName": previous_source.get("downloadedWorkbookName", ""),
        "downloadedArchiveSha256": previous_source.get("downloadedArchiveSha256", ""),
    }
    for key, value in local_fields.items():
        if value and not discovery.get(key):
            discovery[key] = value
    return discovery


def row_key(row: dict) -> tuple[str, str, str, str, str]:
    return (
        clean_text(row.get("OPEID_8")),
        clean_text(row.get("Closed_Date")),
        clean_text(row.get("School_Name")).upper(),
        clean_text(row.get("Location")).upper(),
        clean_text(row.get("Address")).upper(),
    )


def previous_rows(path: Path) -> dict[tuple[str, str, str, str, str], dict]:
    if not path.exists():
        return {}
    with path.open(newline="", encoding="utf-8-sig") as file:
        return {row_key(row): row for row in csv.DictReader(file)}


def site_type(branch_suffix: str) -> str:
    return "Main/Root" if branch_suffix == "00" else "Branch/Satellite"


def preliminary_class(atlas_site_type: str) -> str:
    return "MAIN / ROOT CLOSURE" if atlas_site_type == "Main/Root" else "BRANCH / SATELLITE RETREAT"


def normalize_workbook(path: Path, source_url: str) -> tuple[list[dict], dict]:
    rows = workbook_rows(path)
    metadata = {
        "reportedDate": "",
        "domesticCount": None,
        "foreignCount": None,
        "reportedTotal": None,
        "detailRowCount": None,
    }
    header_index = None
    headers = []
    for index, row in enumerate(rows):
        clean = [clean_text(value) for value in row]
        if clean[:1] in (["DATE"], ["REPORT DATE"]) and len(clean) > 1:
            metadata["reportedDate"], _ = excel_date(clean[1])
        if clean[:1] == ["DOMESTIC"] and len(clean) > 1:
            metadata["domesticCount"] = int(float(clean[1]))
        if clean[:1] == ["FOREIGN"] and len(clean) > 1:
            metadata["foreignCount"] = int(float(clean[1]))
        if clean[:1] == ["TOTAL"] and len(clean) > 1:
            metadata["reportedTotal"] = int(float(clean[1]))
        if clean[:2] == ["CLOSED DATE", "OPEID"]:
            header_index = index
            headers = clean
            break
    if header_index is None:
        raise SystemExit("Could not find CLOSED DATE/OPEID header row in weekly workbook")

    previous = previous_rows(NORMALIZED_CSV)
    normalized = []
    expected_total = metadata.get("reportedTotal")
    for raw in rows[header_index + 1 :]:
        if expected_total is not None and len(normalized) >= expected_total:
            break
        clean = [clean_text(value) for value in raw]
        if any(value.upper() == "CLOSED SCHOOLS DATA DISTRIBUTION" for value in clean):
            break
        if clean[:4] == ["YEAR", "Domestic", "Foreign", "Total"]:
            break
        if not any(clean_text(value) for value in raw):
            continue
        item = {header: raw[index] if index < len(raw) else "" for index, header in enumerate(headers) if header}
        closed_date, closed_year = excel_date(item.get("CLOSED DATE"))
        opeid_digits = re.sub(r"\D", "", clean_text(item.get("OPEID")))
        if not closed_date or not closed_year or not opeid_digits or not clean_text(item.get("SCHOOL NAME")):
            continue
        opeid = opeid_digits.zfill(8)
        root = opeid[:6]
        suffix = opeid[6:8]
        base = {
            "Atlas_Scale": "PEPS_SITE_RETREAT",
            "Closed_Date": closed_date,
            "Closed_Year": str(closed_year or ""),
            "OPEID_8": opeid,
            "Root_OPEID_6": root,
            "Branch_Suffix": suffix,
            "Is_Main_Campus_OPEID00": "True" if suffix == "00" else "False",
            "School_Name": clean_text(item.get("SCHOOL NAME")),
            "Location": clean_text(item.get("LOCATION")),
            "Address": clean_text(item.get("ADDRESS")),
            "City": clean_text(item.get("CITY")),
            "State": clean_text(item.get("STATE")).upper(),
            "Zip_Code": clean_text(item.get("ZIP CODE")),
            "Country_Foreign": clean_text(item.get("COUNTRY (FOREIGN)")),
            "Afterlife_Status": "",
            "Morphology": "",
            "Buyer_or_Controller": "",
            "Sale_Price": "",
            "Acreage": "",
            "Research_Priority": "",
            "Source_URL": source_url,
        }
        old = previous.get(row_key(base), {})
        atlas_type = clean_text(old.get("ATLAS_SITE_TYPE")) or site_type(suffix)
        merged = {
            **base,
            "Afterlife_Status": clean_text(old.get("Afterlife_Status")),
            "Morphology": clean_text(old.get("Morphology")),
            "Buyer_or_Controller": clean_text(old.get("Buyer_or_Controller")),
            "Sale_Price": clean_text(old.get("Sale_Price")),
            "Acreage": clean_text(old.get("Acreage")),
            "Research_Priority": clean_text(old.get("Research_Priority")),
            "ATLAS_OPEID_RAW": opeid,
            "ATLAS_OPEID_ROOT": root,
            "ATLAS_BRANCH_SUFFIX": suffix,
            "ATLAS_SITE_TYPE": atlas_type,
            "ATLAS_CLOSURE_YEAR": str(closed_year or ""),
            "ATLAS_INSTITUTION_NAME": base["School_Name"],
            "ATLAS_STATE": base["State"],
            "ATLAS_CITY": base["City"],
            "ATLAS_ADDRESS": base["Address"],
            "ATLAS_PRELIMINARY_CLASS": clean_text(old.get("ATLAS_PRELIMINARY_CLASS")) or preliminary_class(atlas_type),
        }
        normalized.append(merged)
    metadata["detailRowCount"] = len(normalized)
    return normalized, metadata


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in fields})


def write_outputs(workbook_bytes: bytes, source_url: str, rows: list[dict], metadata: dict, discovery: dict) -> dict:
    digest = sha256_bytes(workbook_bytes)
    fetched_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    latest_year = max((int(row["Closed_Year"]) for row in rows if clean_text(row.get("Closed_Year")).isdigit()), default=None)
    source_freshness = {
        "fsaClosedSchoolSearch": {
            "sourceUrl": source_url,
            "reportPage": WEEKLY_REPORT_PAGE,
            "downloadUrl": discovery.get("downloadApiUrl", ""),
            "reportDocType": discovery.get("reportDocType", ""),
            "reportDocStorageId": discovery.get("reportDocStorageId", ""),
            "reportProcDate": discovery.get("reportProcDate", ""),
            "downloadedWorkbookName": discovery.get("downloadedWorkbookName", ""),
            "downloadedArchiveSha256": discovery.get("downloadedArchiveSha256", ""),
            "fetchedAt": fetched_at,
            "sha256": digest,
            "reportedDate": metadata.get("reportedDate", ""),
            "reportedAgeDays": discovery.get("reportedAgeDays"),
            "reportedTotal": metadata.get("reportedTotal"),
            "detailRows": metadata.get("detailRowCount"),
            "domesticCount": metadata.get("domesticCount"),
            "foreignCount": metadata.get("foreignCount"),
            "normalizedRows": len(rows),
            "latestClosureYear": latest_year,
        },
        "fsaReports": discovery,
    }

    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    RAW_WORKBOOK.write_bytes(workbook_bytes)
    SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)
    snapshot_name = f"closed_school_search_{fetched_at[:10]}_{digest[:12]}.xlsx"
    snapshot_path = SNAPSHOT_DIR / snapshot_name
    if not snapshot_path.exists():
        snapshot_path.write_bytes(workbook_bytes)
    write_csv(CLEAN_CSV, rows, BASE_FIELDS)
    write_csv(NORMALIZED_CSV, rows, NORMALIZED_FIELDS)
    FRESHNESS_JSON.write_text(json.dumps(source_freshness, indent=2) + "\n", encoding="utf-8")
    return source_freshness


def main() -> None:
    parser = argparse.ArgumentParser(description="Refresh FSA closed-school data for Dead Campus Atlas.")
    parser.add_argument("--source-url", help="Explicit weekly workbook URL to download.")
    parser.add_argument("--use-local", action="store_true", help="Normalize the existing local workbook instead of downloading.")
    parser.add_argument("--dry-run", action="store_true", help="Parse and report without writing files.")
    parser.add_argument("--allow-stale", action="store_true", help="Allow reports older than the freshness limit.")
    parser.add_argument("--allow-legacy-fallback", action="store_true", help="Use the legacy ED workbook if the current FSA API/page cannot be fetched.")
    parser.add_argument("--max-stale-days", type=int, default=DEFAULT_MAX_STALE_DAYS, help=f"Maximum age for downloaded reports before failing. Default: {DEFAULT_MAX_STALE_DAYS}.")
    args = parser.parse_args()

    discovery: dict = {
        "weeklyReportPage": WEEKLY_REPORT_PAGE,
        "monthlyReportPage": MONTHLY_REPORT_PAGE,
        "weeklyPageChecked": False,
        "monthlyPageChecked": False,
    }
    if args.use_local:
        workbook_bytes = RAW_WORKBOOK.read_bytes()
        source_url = local_source_url()
        discovery = seed_local_discovery(discovery)
    else:
        workbook_bytes, source_url, discovery = download_weekly_workbook(args.source_url, args.allow_legacy_fallback)

    with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as temp:
        temp.write(workbook_bytes)
        temp_path = Path(temp.name)
    try:
        rows, metadata = normalize_workbook(temp_path, source_url)
    finally:
        temp_path.unlink(missing_ok=True)

    # Row order changes every week (newest first), so ids come from the registry, not the row number.
    registry = fsa_ids.load()
    if not registry:
        raise SystemExit("No _DATA/fsa_site_ids.csv; run `python3 tools/fsa_ids.py --bootstrap` once before refreshing.")
    known_ids = set(registry.values())
    for row, record_id in zip(rows, fsa_ids.assign(rows, registry)):
        row["ATLAS_RECORD_ID"] = record_id
    present_ids = {row["ATLAS_RECORD_ID"] for row in rows}
    new_sites = len(present_ids - known_ids)
    vanished = len(known_ids - present_ids)

    validate_report_freshness(
        metadata,
        discovery,
        args.max_stale_days,
        args.allow_stale or args.use_local,
    )

    summary = {
        "sourceUrl": source_url,
        "reportProcDate": discovery.get("reportProcDate", ""),
        "reportedDate": metadata.get("reportedDate", ""),
        "reportedAgeDays": discovery.get("reportedAgeDays"),
        "reportedTotal": metadata.get("reportedTotal"),
        "detailRows": metadata.get("detailRowCount"),
        "normalizedRows": len(rows),
        "downloadedWorkbookName": discovery.get("downloadedWorkbookName", ""),
        "sha256": sha256_bytes(workbook_bytes),
    }
    if args.dry_run:
        print(json.dumps({"dryRun": True, **summary}, indent=2))
        return

    freshness = write_outputs(workbook_bytes, source_url, rows, metadata, discovery)
    fsa_ids.save(registry)
    print(f"Site ids: {new_sites:,} new, {vanished:,} no longer in the report (ids retired, not reused)")
    print(json.dumps({"dryRun": False, **summary, "freshnessFile": str(FRESHNESS_JSON)}, indent=2))
    print(f"Wrote {RAW_WORKBOOK}")
    print(f"Wrote {CLEAN_CSV}")
    print(f"Wrote {NORMALIZED_CSV}")
    print(f"Wrote {FRESHNESS_JSON}")
    latest = freshness["fsaClosedSchoolSearch"].get("latestClosureYear")
    if latest:
        print(f"Latest closure year in federal layer: {latest}")


if __name__ == "__main__":
    main()
