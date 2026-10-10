#!/usr/bin/env python3
"""Pull religious affiliation for every institution in the IPEDS spine and run
the Catholic-retreat test.

The Phase 12 research question asks whether Catholic campus closures are part
of a broader religious retreat. The first thing to know is the base rate: do
Catholic colleges close at a higher rate than their share of private nonprofit
institutions? This script pulls the IPEDS institutional-characteristics
component (which carries ``religious_affiliation``) for each private nonprofit
institution in the spine, in the last year it reported, joins it to the
directory spine, and writes:

    _DATA/ipeds/characteristics_last_year.json.gz   raw cache, one row per UNITID
    _DATA/ipeds_affiliation.csv                  unitid, last year, affiliation
    _DATA/ipeds_catholic_test.json               the test results

IPEDS religious affiliation code 30 is Roman Catholic.
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
OUT_CSV = DATA_ROOT / "ipeds_affiliation.csv"
OUT_JSON = DATA_ROOT / "ipeds_catholic_test.json"
API = "https://educationdata.urban.org/api/v1/college-university/ipeds/institutional-characteristics/{year}/"
USER_AGENT = "DeadCampusAtlas/0.1 (archival research; python urllib)"

DEFAULT_START = 2000
DEFAULT_END = 2024
MISSING = {None, "", -1, -2, -3, "-1", "-2", "-3"}
CATHOLIC = 30
KEEP = ("unitid", "year", "inst_affiliation", "religious_affiliation", "inst_control", "degree_granting")


def get_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(request, timeout=300) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError) as exc:
            if attempt == 3:
                raise SystemExit(f"Failed after retries: {url}: {exc}")
            time.sleep(3 * (attempt + 1))
    return {}


def fetch_batch(year: int, unitids: list[int]) -> list[dict]:
    """Institutional characteristics for a set of UNITIDs in one year, all pages."""
    url: str | None = API.format(year=year) + "?unitid=" + ",".join(str(u) for u in unitids)
    results: list[dict] = []
    while url:
        payload = get_json(url)
        results.extend({key: row.get(key) for key in KEEP} for row in payload.get("results", []))
        url = payload.get("next")
    return results


def load_cache() -> dict[int, dict]:
    cache = CACHE_DIR / "characteristics_last_year.json.gz"
    if not cache.exists():
        return {}
    with gzip.open(cache, "rt", encoding="utf-8") as handle:
        return {int(k): v for k, v in json.load(handle).items()}


def save_cache(latest: dict[int, dict]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache = CACHE_DIR / "characteristics_last_year.json.gz"
    with gzip.open(cache, "wt", encoding="utf-8") as handle:
        json.dump({str(k): v for k, v in latest.items()}, handle)


def to_int(value: object) -> int | None:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Pull IPEDS religious affiliation and run the Catholic-retreat test.")
    parser.add_argument("--start", type=int, default=DEFAULT_START)
    parser.add_argument("--end", type=int, default=DEFAULT_END)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--pause", type=float, default=0.5)
    args = parser.parse_args()

    if not SPINE_CSV.exists():
        raise SystemExit(f"Missing {SPINE_CSV}; run tools/pull_ipeds_directory.py first")

    spine = list(csv.DictReader(SPINE_CSV.open(encoding="utf-8")))
    # Pull each institution's affiliation in the last year it reported. Private
    # nonprofits only: that is the population the Catholic test compares within,
    # and it keeps the pull to a few dozen batched requests.
    targets = [r for r in spine if r["control_label"] == "Private nonprofit"]
    latest = {} if args.refresh else load_cache()

    def resolved(unitid: int) -> bool:
        """Affiliation is known when the institution is typed independent (3) or
        religious (4) with a religion code. -2 on religion for an independent
        institution means 'not applicable', not missing."""
        row = latest.get(unitid)
        if not row:
            return False
        inst_type = to_int(row.get("inst_affiliation"))
        if inst_type == 3:
            return True
        return inst_type == 4 and to_int(row.get("religious_affiliation")) not in MISSING

    # Institutions in their closing year usually have no characteristics row, or
    # one with affiliation blank, so walk back a year at a time until a value
    # appears (or we give up after max_back years).
    max_back = 12
    batch_size = 150
    for back in range(max_back + 1):
        by_year: dict[int, list[int]] = defaultdict(list)
        for row in targets:
            unitid = int(row["unitid"])
            if resolved(unitid):
                continue
            year = min(int(row["last_year"]), args.end) - back
            if year < args.start:
                continue
            by_year[year].append(unitid)
        pending = sum(len(v) for v in by_year.values())
        if not pending:
            break
        print(f"pass {back}: {pending:,} institutions unresolved", file=sys.stderr, flush=True)
        for year in sorted(by_year):
            unitids = by_year[year]
            for index in range(0, len(unitids), batch_size):
                batch = unitids[index : index + batch_size]
                for row in fetch_batch(year, batch):
                    unitid = to_int(row.get("unitid"))
                    if unitid is None:
                        continue
                    if to_int(row.get("inst_affiliation")) in (3, 4) or unitid not in latest:
                        latest[unitid] = {"year": year, **row}
                time.sleep(args.pause)
    save_cache(latest)

    with OUT_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["unitid", "last_year", "inst_affiliation", "religious_affiliation", "catholic"])
        for unitid in sorted(latest):
            row = latest[unitid]
            affiliation = to_int(row.get("religious_affiliation"))
            writer.writerow(
                [
                    unitid,
                    row["year"],
                    row.get("inst_affiliation") if row.get("inst_affiliation") not in MISSING else "",
                    affiliation if affiliation not in MISSING else "",
                    1 if affiliation == CATHOLIC else 0,
                ]
            )

    # The test: among private nonprofit degree-granting institutions, compare the
    # Catholic share of those that left IPEDS with the Catholic share of those still active.
    nonprofit = [r for r in spine if r["control_label"] == "Private nonprofit" and r["degree_granting"] == "1"]
    groups: dict[str, Counter] = defaultdict(Counter)
    by_exit_year: dict[str, Counter] = defaultdict(Counter)
    for row in nonprofit:
        unitid = int(row["unitid"])
        affiliation = to_int((latest.get(unitid) or {}).get("religious_affiliation"))
        is_catholic = affiliation == CATHOLIC
        has_affiliation = affiliation not in MISSING
        key = "active" if row["status"] == "active" else "left"
        if resolved(unitid):
            groups[key + "Resolved"]["total"] += 1
            groups[key + "Resolved"]["catholic"] += int(is_catholic)
        groups[key]["total"] += 1
        groups[key]["catholic"] += int(is_catholic)
        groups[key]["religious"] += int(has_affiliation)
        groups[key]["unresolved"] += int(not resolved(unitid))
        if key == "left":
            groups[row["status"]]["total"] += 1
            groups[row["status"]]["catholic"] += int(is_catholic)
        if key == "left":
            exit_year = row["year_closed"] or row["year_deleted"] or str(int(row["last_year"]) + 1)
            by_exit_year[str(exit_year)]["total"] += 1
            by_exit_year[str(exit_year)]["catholic"] += int(is_catholic)

    def share(counter: Counter, key: str) -> float | None:
        return round(100 * counter[key] / counter["total"], 1) if counter["total"] else None

    result = {
        "question": "Do Catholic colleges leave IPEDS at a higher rate than their share of private nonprofit degree-granting institutions?",
        "method": "Latest reported religious_affiliation per UNITID (code 30 = Roman Catholic) joined to the directory spine; 'left' = closed, combined, or dropped.",
        "pulledAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "yearsPulled": [args.start, args.end],
        "nonprofitDegreeGranting": len(nonprofit),
        "groups": {
            name: {
                "institutions": counter["total"],
                "catholic": counter["catholic"],
                "catholicSharePct": share(counter, "catholic"),
                "anyReligiousAffiliationPct": share(counter, "religious") if "religious" in counter else None,
                "unresolvedAffiliation": counter["unresolved"] if "unresolved" in counter else None,
            }
            for name, counter in groups.items()
        },
        "catholicShareByExitYear": {
            year: {"left": counter["total"], "catholic": counter["catholic"], "catholicSharePct": share(counter, "catholic")}
            for year, counter in sorted(by_exit_year.items())
            if args.start <= int(year) <= args.end + 1
        },
    }
    active_share = result["groups"].get("activeResolved", {}).get("catholicSharePct")
    left_share = result["groups"].get("leftResolved", {}).get("catholicSharePct")
    if active_share is not None and left_share is not None:
        result["ratioLeftToActive"] = round(left_share / active_share, 2) if active_share else None
    OUT_JSON.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    print(f"\nWrote {OUT_CSV} ({len(latest):,} institutions)")
    print(f"Wrote {OUT_JSON}")
    for name in ("active", "activeResolved", "left", "leftResolved", "closed", "combined", "dropped"):
        group = result["groups"].get(name)
        if group:
            print(f"  {name:9} {group['institutions']:5,} nonprofit degree-granting, Catholic {group['catholic']:4,} ({group['catholicSharePct']}%)")
    if "ratioLeftToActive" in result:
        print(f"  ratio of Catholic share, left : active = {result['ratioLeftToActive']}")


if __name__ == "__main__":
    main()
