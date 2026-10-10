#!/usr/bin/env python3
"""Build the census frame: every private nonprofit degree-granting institution that
IPEDS records as closed from 2010 to the last directory year and that is neither in the curated public layer
nor in the random afterlife sample.

Together with the 20 curated and the 44 sampled closures this is a complete census of
the population, so the extended layer on the site is exhaustive, not a selection.

Writes _DATA/afterlife_census_frame.csv and _DATA/afterlife_batches/census_NN_input.json.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_data import FRAME_END, FRAME_START  # noqa: E402

PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_DIR.parent / "_DATA"
SPINE = DATA_ROOT / "ipeds_directory_spine.csv"
SAMPLE_FRAME = DATA_ROOT / "afterlife_sample_frame.csv"
CURATION = PROJECT_DIR / "curation" / "public-sites.json"
OUT_FRAME = DATA_ROOT / "afterlife_census_frame.csv"  # default; --prefix exits writes afterlife_exits_frame.csv
BATCH_DIR = DATA_ROOT / "afterlife_batches"
FIELDS = ["unitid", "opeid", "name", "city", "state", "status", "first_year", "last_year",
          "exit_year", "date_closed", "latitude", "longitude", "batch"]


def exit_year(row: dict) -> int:
    return int(row["year_closed"] or row["year_deleted"] or (int(row["last_year"]) + 1))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--batch-size", type=int, default=15)
    parser.add_argument("--statuses", default="closed", help="comma list of spine statuses to include")
    parser.add_argument("--prefix", default="census", help="census (closed) or exits (dropped and combined)")
    parser.add_argument(
        "--new-only",
        action="store_true",
        help="Keep the existing frame and batch numbers; write batch inputs only for institutions not yet coded.",
    )
    args = parser.parse_args()
    statuses = set(args.statuses.split(","))
    out_frame = OUT_FRAME if args.prefix == "census" else DATA_ROOT / f"afterlife_{args.prefix}_frame.csv"

    sampled = {int(r["unitid"]) for r in csv.DictReader(SAMPLE_FRAME.open(encoding="utf-8"))}
    public = set()
    for entry in json.loads(CURATION.read_text(encoding="utf-8"))["sites"].values():
        ipeds = entry.get("ipeds") or {}
        for key in ("unitid", "parentUnitid"):
            if ipeds.get(key):
                public.add(int(ipeds[key]))

    rows = []
    for row in csv.DictReader(SPINE.open(encoding="utf-8")):
        if row["control_label"] != "Private nonprofit" or row["degree_granting"] != "1":
            continue
        if row["status"] not in statuses or not (FRAME_START <= exit_year(row) <= FRAME_END):
            continue
        unitid = int(row["unitid"])
        if unitid in sampled or unitid in public:
            continue
        rows.append({**row, "exit_year": exit_year(row)})
    rows.sort(key=lambda r: (r["exit_year"], r["name"]))
    previous: dict[int, str] = {}
    if out_frame.exists():
        previous = {int(r["unitid"]): r["batch"] for r in csv.DictReader(out_frame.open(encoding="utf-8"))}
    if args.new_only:
        # Institutions already in the frame keep their batch; new ones continue the numbering.
        next_batch = max((int(b) for b in previous.values()), default=0) + 1
        fresh = [r for r in rows if int(r["unitid"]) not in previous]
        for row in rows:
            if int(row["unitid"]) in previous:
                row["batch"] = previous[int(row["unitid"])]
        for index, row in enumerate(fresh):
            row["batch"] = f"{next_batch + index // args.batch_size:02d}"
    else:
        for index, row in enumerate(rows):
            row["batch"] = f"{index // args.batch_size + 1:02d}"

    with out_frame.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    batches: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        if args.new_only and int(row["unitid"]) in previous:
            continue
        batches[row["batch"]].append(
            {
                "unitid": int(row["unitid"]),
                "name": row["name"],
                "city": row["city"],
                "state": row["state"],
                "ipedsStatus": row["status"],
                "combinedIntoName": row.get("newid_name") or None,
                "firstYearInIpeds": int(row["first_year"]),
                "lastYearInIpeds": int(row["last_year"]),
                "exitYear": int(row["exit_year"]),
                "ipedsCloseDate": row["date_closed"],
            }
        )
    for batch, items in sorted(batches.items()):
        (BATCH_DIR / f"{args.prefix}_{batch}_input.json").write_text(json.dumps(items, indent=2) + "\n", encoding="utf-8")
    print(f"Census frame: {len(rows)} institutions in {len(batches)} batches of up to {args.batch_size}")


if __name__ == "__main__":
    main()
