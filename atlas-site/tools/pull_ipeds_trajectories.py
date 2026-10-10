#!/usr/bin/env python3
"""Pull IPEDS fall enrollment and finance history for the public atlas sites.

Reads the UNITIDs recorded in curation/public-sites.json (by tools/match_ipeds.py),
queries the Urban Institute Education Data Portal one year at a time for all of
them together, and writes a long-form table:

    _DATA/ipeds_trajectories.csv   one row per site per year

tools/build_data.py folds this into each public site's ``trajectory`` array so
the page can show the decline curve before closure.

API: https://educationdata.urban.org/documentation/colleges.html
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_DIR.parent / "_DATA"
CURATION = PROJECT_DIR / "curation" / "public-sites.json"
OUT_CSV = DATA_ROOT / "ipeds_trajectories.csv"
PROBE_STATE = DATA_ROOT / "ipeds_trajectories_probe.json"
# Large, long-lived institutions: if the portal has published a year, these report in it.
PROBE_UNITS = "110635,166027,190150,243744,110662"
BASE = "https://educationdata.urban.org/api/v1/college-university/ipeds"
USER_AGENT = "DeadCampusAtlas/0.1 (archival research; python urllib)"

DEFAULT_START = 2000
DEFAULT_END = 2024
MISSING = {None, "", -1, -2, -3, "-1", "-2", "-3"}

# Finance fields kept, in output order. IPEDS reports these across GASB and
# FASB forms; the Urban portal harmonizes the names.
FINANCE_FIELDS = {
    "rev_total_current": "revenue",
    "exp_total_current": "expenses",
    "rev_tuition_fees_net": "tuitionNet",
    "assets": "assets",
    "liabilities": "liabilities",
    "longterm_debt": "longtermDebt",
    "endowment_end": "endowment",
    "net_position_end": "netPosition",
    "land_improvements": "landImprovements",
    "buildings": "buildings",
}

OUT_FIELDS = ["siteId", "unitid", "year", "enrollmentFall", *FINANCE_FIELDS.values()]


def get_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == 3:
                raise SystemExit(f"Failed after retries: {url}: {exc}")
            time.sleep(2 * (attempt + 1))
    return {}


def fetch_all(url: str) -> list[dict]:
    results: list[dict] = []
    while url:
        payload = get_json(url)
        results.extend(payload.get("results", []))
        url = payload.get("next") or ""
    return results


def clean_number(value: object) -> str:
    if value in MISSING:
        return ""
    try:
        number = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return ""
    return str(int(number)) if number.is_integer() else str(number)


def probe_portal(years: range) -> dict[str, dict[str, int]]:
    """How many rows the portal serves per year for a handful of institutions that always report.

    A year the portal has not published returns an error or no rows, so this says what is
    available without paying for the full pull.
    """
    found: dict[str, dict[str, int]] = {}
    for year in years:
        counts = {}
        for kind, url in (
            ("enrollment", f"{BASE}/fall-enrollment/{year}/99/?unitid={PROBE_UNITS}&race=99&sex=99&ftpt=99"),
            ("finance", f"{BASE}/finance/{year}/?unitid={PROBE_UNITS}"),
        ):
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
            try:
                with urllib.request.urlopen(request, timeout=60) as response:
                    counts[kind] = int(json.loads(response.read().decode("utf-8")).get("count") or 0)
            except (urllib.error.URLError, TimeoutError, ValueError):
                counts[kind] = 0
            time.sleep(0.3)
        found[str(year)] = counts
    return found


def newer_than_last_pull(found: dict[str, dict[str, int]]) -> list[str]:
    """Year/kind pairs where the portal now serves more rows than when the file was last built."""
    try:
        seen = json.loads(PROBE_STATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ["no record of a previous pull"]
    return [
        f"{year} {kind}: {count} (was {seen.get(year, {}).get(kind, 0)})"
        for year, counts in found.items()
        for kind, count in counts.items()
        if count > seen.get(year, {}).get(kind, 0)
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Pull IPEDS enrollment and finance history for public atlas sites.")
    parser.add_argument("--start", type=int, default=DEFAULT_START)
    parser.add_argument("--end", type=int, default=DEFAULT_END)
    parser.add_argument("--pause", type=float, default=0.5)
    parser.add_argument(
        "--if-newer",
        action="store_true",
        help="probe the portal first and pull (through the newest year it serves) only if it has data the last pull did not",
    )
    args = parser.parse_args()

    probed: dict[str, dict[str, int]] = {}
    if args.if_newer:
        probed = probe_portal(range(DEFAULT_END - 1, DEFAULT_END + 4))
        news = newer_than_last_pull(probed)
        summary = ", ".join(f"{y}: enrollment {c['enrollment']}, finance {c['finance']}" for y, c in probed.items())
        print(f"Portal probe ({len(PROBE_UNITS.split(','))} institutions): {summary}", file=sys.stderr)
        if not news:
            print("Nothing newer than the last pull; the trajectories file is unchanged.", file=sys.stderr)
            return
        print("Newer data: " + "; ".join(news), file=sys.stderr)
        served = [int(y) for y, c in probed.items() if c["enrollment"] or c["finance"]]
        args.end = max([args.end, *served])

    sites = json.loads(CURATION.read_text(encoding="utf-8"))["sites"]
    unitid_to_site = {}
    for site_id, entry in sites.items():
        unitid = (entry.get("ipeds") or {}).get("unitid")
        if unitid:
            unitid_to_site[int(unitid)] = site_id
    # The extended layer (coded sample and census) gets decline curves too.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import build_data  # noqa: E402

    for unitid, site_id in build_data.extended_id_map().items():
        unitid_to_site.setdefault(int(unitid), site_id)
    if not unitid_to_site:
        raise SystemExit("No UNITIDs in curation/public-sites.json; run tools/match_ipeds.py first")
    unitid_list = ",".join(str(u) for u in sorted(unitid_to_site))

    rows: dict[tuple[str, int], dict] = {}
    for year in range(args.start, args.end + 1):
        enrollment = fetch_all(
            f"{BASE}/fall-enrollment/{year}/99/?unitid={unitid_list}&race=99&sex=99&ftpt=99"
        )
        time.sleep(args.pause)
        finance = fetch_all(f"{BASE}/finance/{year}/?unitid={unitid_list}")
        time.sleep(args.pause)

        for record in enrollment:
            site_id = unitid_to_site.get(int(record["unitid"]))
            if not site_id:
                continue
            row = rows.setdefault((site_id, year), {"siteId": site_id, "unitid": record["unitid"], "year": year})
            row["enrollmentFall"] = clean_number(record.get("enrollment_fall"))
        for record in finance:
            site_id = unitid_to_site.get(int(record["unitid"]))
            if not site_id:
                continue
            row = rows.setdefault((site_id, year), {"siteId": site_id, "unitid": record["unitid"], "year": year})
            for source, target in FINANCE_FIELDS.items():
                row[target] = clean_number(record.get(source))
        print(f"{year}: enrollment {len(enrollment)}, finance {len(finance)}", file=sys.stderr, flush=True)

    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    ordered = [rows[key] for key in sorted(rows)]
    with OUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUT_FIELDS)
        writer.writeheader()
        for row in ordered:
            writer.writerow({field: row.get(field, "") for field in OUT_FIELDS})

    if not probed:
        probed = probe_portal(range(DEFAULT_END - 1, DEFAULT_END + 4))
    PROBE_STATE.write_text(json.dumps(probed, indent=1) + "\n", encoding="utf-8")

    covered = {row["siteId"] for row in ordered}
    print(f"\nWrote {OUT_CSV}: {len(ordered)} site-years for {len(covered)} of {len(unitid_to_site)} sites")
    for unitid, site_id in sorted(unitid_to_site.items(), key=lambda item: item[1]):
        years = sorted(year for (sid, year) in rows if sid == site_id)
        if years:
            print(f"  {site_id}: {years[0]}-{years[-1]} ({len(years)} years)")
        else:
            print(f"  {site_id}: no rows")


if __name__ == "__main__":
    main()
