#!/usr/bin/env python3
"""Pull IPEDS directory files through the Urban Institute Education Data Portal
and build an institution-level closure and merger spine.

Each IPEDS year only carries the institutions in that year's universe, so a
closure history needs every year stacked and diffed by UNITID. This script:

1. Downloads one directory file per year (cached as gzip JSON in _DATA/ipeds/).
2. Collapses the stack into one row per UNITID with first/last year seen,
   the latest close date, the year it left IPEDS, and the UNITID it was
   combined into, if any.
3. Classifies each institution as active, closed, combined, or dropped.
4. Writes _DATA/ipeds_directory_spine.csv and _DATA/ipeds_directory_summary.json.

API: https://educationdata.urban.org/documentation/colleges.html
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_DIR.parent / "_DATA"
CACHE_DIR = DATA_ROOT / "ipeds"
SPINE_CSV = DATA_ROOT / "ipeds_directory_spine.csv"
SUMMARY_JSON = DATA_ROOT / "ipeds_directory_summary.json"
API = "https://educationdata.urban.org/api/v1/college-university/ipeds/directory/{year}/"
USER_AGENT = "DeadCampusAtlas/0.1 (archival research; python urllib)"

DEFAULT_START = 2000
DEFAULT_END = 2024

# IPEDS sentinel for "not applicable" is -2; some fields use -1 or -3 for missing.
MISSING = {None, "", -1, -2, -3, "-1", "-2", "-3"}

CONTROL_LABELS = {1: "Public", 2: "Private nonprofit", 3: "Private for-profit"}
LEVEL_LABELS = {1: "4-year or above", 2: "2-year", 3: "Less than 2-year", 4: "4-year or above"}
STATUS_ORDER = ["active", "closed", "combined", "dropped"]

SPINE_FIELDS = [
    "unitid",
    "opeid",
    "name",
    "alias",
    "city",
    "state",
    "zip",
    "county",
    "latitude",
    "longitude",
    "control",
    "control_label",
    "level",
    "level_label",
    "category",
    "degree_granting",
    "sector",
    "system_name",
    "carnegie_basic_2021",
    "hbcu",
    "tribal",
    "first_year",
    "last_year",
    "years_present",
    "status",
    "date_closed",
    "year_closed",
    "year_deleted",
    "newid",
    "newid_name",
    "newid_state",
    "last_active_flag",
]


def present(value: object) -> bool:
    return value not in MISSING


def fetch_year(year: int, refresh: bool, pause: float) -> list[dict]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache = CACHE_DIR / f"directory_{year}.json.gz"
    if cache.exists() and not refresh:
        with gzip.open(cache, "rt", encoding="utf-8") as handle:
            return json.load(handle)

    url = API.format(year=year)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    results: list[dict] = []
    page_url: str | None = url
    while page_url:
        for attempt in range(4):
            try:
                with urllib.request.urlopen(page_url, timeout=180) as response:
                    payload = json.loads(response.read().decode("utf-8"))
                break
            except (urllib.error.URLError, TimeoutError) as exc:
                if attempt == 3:
                    raise SystemExit(f"{year}: failed after retries: {exc}")
                time.sleep(2 * (attempt + 1))
        results.extend(payload.get("results", []))
        page_url = payload.get("next")
        if page_url:
            request = urllib.request.Request(page_url, headers={"User-Agent": USER_AGENT})
    with gzip.open(cache, "wt", encoding="utf-8") as handle:
        json.dump(results, handle)
    time.sleep(pause)
    return results


def to_int(value: object) -> int | None:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def parse_close_year(date_closed: object) -> int | None:
    text = str(date_closed or "").strip()
    if not present(text):
        return None
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m%d%Y"):
        try:
            return datetime.strptime(text, fmt).year
        except ValueError:
            continue
    digits = "".join(ch for ch in text if ch.isdigit())
    if len(digits) >= 8:
        return int(digits[-4:])
    return None


def build_spine(by_year: dict[int, list[dict]], end_year: int) -> list[dict]:
    history: dict[int, list[dict]] = defaultdict(list)
    for year in sorted(by_year):
        for row in by_year[year]:
            unitid = to_int(row.get("unitid"))
            if unitid is None:
                continue
            history[unitid].append(row)

    names_by_unitid = {
        unitid: (rows[-1].get("inst_name") or "", rows[-1].get("state_abbr") or "")
        for unitid, rows in history.items()
    }

    spine = []
    for unitid, rows in history.items():
        rows.sort(key=lambda r: to_int(r.get("year")) or 0)
        latest = rows[-1]
        years = [to_int(r.get("year")) for r in rows]
        first_year, last_year = min(years), max(years)

        date_closed = next((r.get("date_closed") for r in reversed(rows) if present(r.get("date_closed"))), "")
        year_deleted = next((to_int(r.get("year_deleted")) for r in reversed(rows) if present(r.get("year_deleted"))), None)
        newid = next((to_int(r.get("newid")) for r in reversed(rows) if present(r.get("newid"))), None)
        if newid == unitid:
            newid = None
        last_active = to_int(latest.get("currently_active_ipeds"))

        if newid is not None:
            status = "combined"
        elif present(date_closed):
            status = "closed"
        elif last_year >= end_year and last_active in (1, None):
            status = "active"
        else:
            status = "dropped"

        control = to_int(latest.get("inst_control"))
        level = to_int(latest.get("institution_level"))
        newid_name, newid_state = names_by_unitid.get(newid, ("", "")) if newid else ("", "")

        spine.append(
            {
                "unitid": unitid,
                "opeid": str(latest.get("opeid") or "").strip(),
                "name": latest.get("inst_name") or "",
                "alias": latest.get("inst_alias") if present(latest.get("inst_alias")) else "",
                "city": latest.get("city") or "",
                "state": latest.get("state_abbr") or "",
                "zip": latest.get("zip") or "",
                "county": latest.get("county_name") if present(latest.get("county_name")) else "",
                "latitude": latest.get("latitude") if present(latest.get("latitude")) else "",
                "longitude": latest.get("longitude") if present(latest.get("longitude")) else "",
                "control": control if control is not None else "",
                "control_label": CONTROL_LABELS.get(control, ""),
                "level": level if level is not None else "",
                "level_label": LEVEL_LABELS.get(level, ""),
                "category": latest.get("inst_category") if present(latest.get("inst_category")) else "",
                "degree_granting": latest.get("degree_granting") if present(latest.get("degree_granting")) else "",
                "sector": latest.get("sector") if present(latest.get("sector")) else "",
                "system_name": latest.get("inst_system_name") if present(latest.get("inst_system_name")) else "",
                "carnegie_basic_2021": latest.get("cc_basic_2021") if present(latest.get("cc_basic_2021")) else "",
                "hbcu": latest.get("hbcu") if present(latest.get("hbcu")) else "",
                "tribal": latest.get("tribal_college") if present(latest.get("tribal_college")) else "",
                "first_year": first_year,
                "last_year": last_year,
                "years_present": len(rows),
                "status": status,
                "date_closed": date_closed if present(date_closed) else "",
                "year_closed": parse_close_year(date_closed) or "",
                "year_deleted": year_deleted if year_deleted is not None else "",
                "newid": newid if newid is not None else "",
                "newid_name": newid_name,
                "newid_state": newid_state,
                "last_active_flag": last_active if last_active is not None else "",
            }
        )
    spine.sort(key=lambda r: (r["state"], r["name"]))
    return spine


def summarize(spine: list[dict], start_year: int, end_year: int) -> dict:
    by_status = Counter(r["status"] for r in spine)
    exits_by_year: dict[int, Counter] = defaultdict(Counter)
    for row in spine:
        if row["status"] in ("closed", "combined", "dropped"):
            exit_year = row["year_closed"] or row["year_deleted"] or (row["last_year"] + 1)
            exits_by_year[int(exit_year)][row["status"]] += 1
    closed_by_control = Counter(r["control_label"] or "Unknown" for r in spine if r["status"] == "closed")
    combined_by_control = Counter(r["control_label"] or "Unknown" for r in spine if r["status"] == "combined")
    closed_degree_granting = sum(1 for r in spine if r["status"] == "closed" and str(r["degree_granting"]) == "1")
    closed_by_state = Counter(r["state"] for r in spine if r["status"] == "closed")
    return {
        "source": "Urban Institute Education Data Portal, IPEDS directory",
        "api": API,
        "yearsPulled": [start_year, end_year],
        "pulledAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "institutions": len(spine),
        "byStatus": {status: by_status.get(status, 0) for status in STATUS_ORDER},
        "closedDegreeGranting": closed_degree_granting,
        "closedByControl": dict(closed_by_control.most_common()),
        "combinedByControl": dict(combined_by_control.most_common()),
        "closedByStateTop": dict(closed_by_state.most_common(15)),
        "exitsByYear": {
            str(year): {status: exits_by_year[year].get(status, 0) for status in ("closed", "combined", "dropped")}
            for year in sorted(exits_by_year)
            if start_year <= year <= end_year + 1
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Pull IPEDS directory years and build a closure/merger spine.")
    parser.add_argument("--start", type=int, default=DEFAULT_START)
    parser.add_argument("--end", type=int, default=DEFAULT_END)
    parser.add_argument("--refresh", action="store_true", help="Re-download years even if cached.")
    parser.add_argument("--pause", type=float, default=0.5, help="Seconds to wait between API calls.")
    args = parser.parse_args()

    by_year: dict[int, list[dict]] = {}
    for year in range(args.start, args.end + 1):
        rows = fetch_year(year, args.refresh, args.pause)
        by_year[year] = rows
        print(f"{year}: {len(rows):,} institutions", file=sys.stderr, flush=True)

    spine = build_spine(by_year, args.end)
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    with SPINE_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=SPINE_FIELDS)
        writer.writeheader()
        writer.writerows(spine)
    summary = summarize(spine, args.start, args.end)
    SUMMARY_JSON.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")

    print(f"\nWrote {SPINE_CSV} ({len(spine):,} institutions)")
    print(f"Wrote {SUMMARY_JSON}")
    print("Status:", ", ".join(f"{k} {v:,}" for k, v in summary["byStatus"].items()))
    print(f"Closed, degree-granting: {summary['closedDegreeGranting']:,}")
    print("Closed by control:", summary["closedByControl"])
    print("Combined by control:", summary["combinedByControl"])


if __name__ == "__main__":
    main()
