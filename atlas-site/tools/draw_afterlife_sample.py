#!/usr/bin/env python3
"""Draw the stratified afterlife sample from the IPEDS directory spine.

Why: every claim about who takes the land rests on the 34 curated campuses,
which were chosen for interest, so they are counts, not rates. This draws a
seeded random sample of the wider population, which a person or agent then
codes by hand. Rates computed from it can carry weights and uncertainty.

Frame: private nonprofit degree-granting institutions that left IPEDS between
2010 and 2024 (closed, combined, or dropped), excluding the public-layer sites.
Strata: exit status x five-year exit band. Allocation is proportional with
largest-remainder rounding. The seed is fixed so the draw is reproducible.

Writes:
    _DATA/afterlife_sample_frame.csv     the sample, one row per institution
    _DATA/afterlife_sample_strata.json   stratum sizes, for weighting
    _DATA/afterlife_batches/batch_NN_input.json   ten institutions per batch
"""

from __future__ import annotations

import argparse
import csv
import json
import random
from collections import Counter, defaultdict
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_DIR.parent / "_DATA"
SPINE_CSV = DATA_ROOT / "ipeds_directory_spine.csv"
CURATION = PROJECT_DIR / "curation" / "public-sites.json"
FRAME_CSV = DATA_ROOT / "afterlife_sample_frame.csv"
STRATA_JSON = DATA_ROOT / "afterlife_sample_strata.json"
BATCH_DIR = DATA_ROOT / "afterlife_batches"
SEED = 20261009
BANDS = [(2010, 2014), (2015, 2019), (2020, 2024)]

FIELDS = [
    "unitid", "opeid", "name", "city", "state", "status", "first_year", "last_year",
    "exit_year", "date_closed", "newid", "newid_name", "stratum", "batch",
]


def exit_year(row: dict) -> int:
    return int(row["year_closed"] or row["year_deleted"] or (int(row["last_year"]) + 1))


def band_of(year: int) -> str | None:
    for low, high in BANDS:
        if low <= year <= high:
            return f"{low}-{high}"
    return None


def allocate(sizes: dict[str, int], total: int) -> dict[str, int]:
    """Proportional allocation with largest-remainder rounding, at least 1 per non-empty stratum."""
    population = sum(sizes.values())
    raw = {key: total * size / population for key, size in sizes.items()}
    alloc = {key: max(1, int(value)) if sizes[key] else 0 for key, value in raw.items()}
    remainder = sorted(raw, key=lambda key: raw[key] - int(raw[key]), reverse=True)
    index = 0
    while sum(alloc.values()) < total:
        alloc[remainder[index % len(remainder)]] += 1
        index += 1
    while sum(alloc.values()) > total:
        largest = max(alloc, key=lambda key: alloc[key])
        alloc[largest] -= 1
    return alloc


def main() -> None:
    parser = argparse.ArgumentParser(description="Draw the stratified afterlife sample.")
    parser.add_argument("--size", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=10)
    args = parser.parse_args()

    public_unitids = set()
    for entry in json.loads(CURATION.read_text(encoding="utf-8"))["sites"].values():
        ipeds = entry.get("ipeds") or {}
        for key in ("unitid", "parentUnitid"):
            if ipeds.get(key):
                public_unitids.add(int(ipeds[key]))

    frame = []
    with SPINE_CSV.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if row["control_label"] != "Private nonprofit" or row["degree_granting"] != "1":
                continue
            if row["status"] == "active" or int(row["unitid"]) in public_unitids:
                continue
            band = band_of(exit_year(row))
            if band:
                frame.append({**row, "exit_year": exit_year(row), "stratum": f"{row['status']}|{band}"})

    strata: dict[str, list[dict]] = defaultdict(list)
    for row in frame:
        strata[row["stratum"]].append(row)
    allocation = allocate({key: len(rows) for key, rows in strata.items()}, args.size)

    rng = random.Random(SEED)
    sample = []
    for key in sorted(strata):
        pool = sorted(strata[key], key=lambda r: int(r["unitid"]))
        sample.extend(rng.sample(pool, allocation[key]))
    rng.shuffle(sample)
    for index, row in enumerate(sample):
        row["batch"] = f"{index // args.batch_size + 1:02d}"

    with FRAME_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(sample)

    STRATA_JSON.write_text(
        json.dumps(
            {
                "seed": SEED,
                "frame": "Private nonprofit degree-granting institutions that left IPEDS 2010-2024, excluding public-layer sites",
                "frameSize": len(frame),
                "sampleSize": len(sample),
                "strata": {
                    key: {"population": len(strata[key]), "sampled": allocation[key]} for key in sorted(strata)
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    batches: dict[str, list[dict]] = defaultdict(list)
    for row in sample:
        batches[row["batch"]].append(
            {
                "unitid": int(row["unitid"]),
                "name": row["name"],
                "city": row["city"],
                "state": row["state"],
                "ipedsStatus": row["status"],
                "firstYearInIpeds": int(row["first_year"]),
                "lastYearInIpeds": int(row["last_year"]),
                "exitYear": int(row["exit_year"]),
                "ipedsCloseDate": row["date_closed"],
                "combinedIntoUnitid": int(row["newid"]) if row["newid"] else None,
                "combinedIntoName": row["newid_name"] or None,
            }
        )
    for batch, rows in sorted(batches.items()):
        (BATCH_DIR / f"batch_{batch}_input.json").write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")

    print(f"Frame: {len(frame)} institutions in {len(strata)} strata; sample {len(sample)} in {len(batches)} batches")
    for key in sorted(strata):
        print(f"  {key:18} population {len(strata[key]):4}  sampled {allocation[key]:3}")
    print(f"Status mix in sample: {dict(Counter(r['status'] for r in sample))}")


if __name__ == "__main__":
    main()
