#!/usr/bin/env python3
"""Geocode the PEPS closed-school sites with the U.S. Census Bureau batch geocoder.

Phase 10 and Phase 12 both name this as the next step: none of the spatial
overlays (dead malls, cloud corridors, senior housing, logistics) can be tested
until the federal layer has coordinates.

Input:  _DATA/dead_campus_phase9_peps_normalized.csv (street address, city, state, zip)
Output: _DATA/peps_geocoded.csv  (id, match, match_type, longitude, latitude, matched_address)
Cache:  _DATA/geocode/chunk_<n>.csv, so an interrupted run resumes.

The record id is the site's stable id (ATLAS_RECORD_ID, from tools/fsa_ids.py), the same
id build_data.py gives each federal record, so the two files join directly. Only sites
with no result yet are sent to the geocoder, so a weekly refresh geocodes just the new
closures; use --retry-unmatched to send the earlier No_Match sites again.

API: https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html
Addresses are public federal school-site addresses (Title IV institutions).
The batch endpoint accepts at most 10,000 records per file.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import subprocess
import sys
import time
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_DIR.parent / "_DATA"
SOURCE = DATA_ROOT / "dead_campus_phase9_peps_normalized.csv"
OUT_CSV = DATA_ROOT / "peps_geocoded.csv"
CACHE_DIR = DATA_ROOT / "geocode"
ENDPOINT = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch"
BENCHMARK = "Public_AR_Current"
CHUNK = 5000  # under the 10,000 limit; smaller chunks time out less


def clean(value: str | None) -> str:
    return " ".join((value or "").replace('"', " ").split())


def load_addresses() -> list[tuple[str, str, str, str, str]]:
    rows = []
    with SOURCE.open(encoding="utf-8") as handle:
        for index, row in enumerate(csv.DictReader(handle), start=1):
            street = clean(row.get("ATLAS_ADDRESS"))
            city = clean(row.get("ATLAS_CITY"))
            state = clean(row.get("ATLAS_STATE"))
            zip_code = clean(row.get("Zip_Code"))[:5]
            record_id = (row.get("ATLAS_RECORD_ID") or "").strip() or f"fsa-{index:05d}"
            if street and city and state:
                rows.append((record_id, street, city, state, zip_code))
    return rows


def geocode_chunk(rows: list[tuple[str, str, str, str, str]], cache: Path, attempts: int = 4) -> None:
    if cache.exists():
        return
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    for record in rows:
        writer.writerow(record)
    payload = CACHE_DIR / f"{cache.stem}_input.csv"
    payload.write_text(buffer.getvalue(), encoding="utf-8")
    for attempt in range(attempts):
        result = subprocess.run(
            [
                "curl", "-s", "-S", "--max-time", "900",
                "--form", f"addressFile=@{payload}",
                "--form", f"benchmark={BENCHMARK}",
                ENDPOINT,
            ],
            capture_output=True,
            text=True,
        )
        body = result.stdout
        if result.returncode == 0 and body.count("\n") >= len(rows) * 0.9:
            cache.write_text(body, encoding="utf-8")
            payload.unlink(missing_ok=True)
            return
        print(f"  attempt {attempt + 1} failed ({result.returncode}): {result.stderr[:200] or body[:200]}", file=sys.stderr)
        time.sleep(10 * (attempt + 1))
    raise SystemExit(f"Giving up on {cache.name}")


OUT_FIELDS = ["id", "match", "match_type", "longitude", "latitude", "matched_address"]


def load_existing() -> dict[str, list[str]]:
    """Results already on disk, by site id."""
    if not OUT_CSV.exists():
        return {}
    with OUT_CSV.open(newline="", encoding="utf-8") as handle:
        return {row["id"]: [row.get(field, "") for field in OUT_FIELDS] for row in csv.DictReader(handle)}


def parse_batch_row(row: list[str]) -> list[str]:
    is_match = len(row) > 2 and row[2] == "Match"
    longitude = latitude = ""
    if is_match and len(row) > 5 and "," in row[5]:
        longitude, latitude = row[5].split(",", 1)
    return [
        row[0],
        "Match" if is_match else "No_Match",
        row[3] if is_match and len(row) > 3 else "",
        longitude,
        latitude,
        row[4] if is_match and len(row) > 4 else "",
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description="Geocode PEPS sites with the Census batch geocoder.")
    parser.add_argument("--chunk", type=int, default=CHUNK)
    parser.add_argument("--retry-unmatched", action="store_true", help="Send earlier No_Match sites to the geocoder again.")
    args = parser.parse_args()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    addresses = load_addresses()
    results = load_existing()
    if args.retry_unmatched:
        results = {key: value for key, value in results.items() if value[1] == "Match"}
    pending = [record for record in addresses if record[0] not in results]
    print(f"{len(addresses):,} addresses, {len(results):,} already geocoded, {len(pending):,} to send", file=sys.stderr, flush=True)

    # Batches are cached by content, so an interrupted run resumes and a stale cache is never reused.
    for start in range(0, len(pending), args.chunk):
        batch = pending[start : start + args.chunk]
        digest = hashlib.sha256("\n".join("|".join(record) for record in batch).encode("utf-8")).hexdigest()[:12]
        cache = CACHE_DIR / f"batch_{digest}.csv"
        geocode_chunk(batch, cache)
        for row in csv.reader(cache.read_text(encoding="utf-8").splitlines()):
            if row:
                results[row[0]] = parse_batch_row(row)
        print(f"batch {start // args.chunk + 1}: done", file=sys.stderr, flush=True)

    wanted = {record[0] for record in addresses}
    ordered = [results[record[0]] for record in addresses if record[0] in results]
    with OUT_CSV.open("w", newline="", encoding="utf-8") as out:
        writer = csv.writer(out)
        writer.writerow(OUT_FIELDS)
        writer.writerows(ordered)
    matched = sum(1 for row in ordered if row[1] == "Match")
    exact = sum(1 for row in ordered if row[2] == "Exact")
    total = len(ordered)
    print(f"\nWrote {OUT_CSV}")
    print(f"Geocoded {matched:,} of {total:,} addresses ({100 * matched / max(total, 1):.1f}%), {exact:,} exact")
    missing = len(wanted - {row[0] for row in ordered})
    if missing:
        print(f"{missing:,} sites have no result", file=sys.stderr)


if __name__ == "__main__":
    main()
