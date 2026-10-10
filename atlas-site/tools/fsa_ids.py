#!/usr/bin/env python3
"""Stable record ids for the federal closure sites.

The FSA closed-school file is sorted newest first, so a site's row number changes
every week. Ids built from row numbers would move, and every geocode, link, and
citation keyed to them would point at the wrong school. This registry fixes an id to
the site itself: OPEID, closed date, name, location, and address.

    _DATA/fsa_site_ids.csv   key fields + id; append-only, an id is never reused

A site that disappears from the file keeps its id (retired). A site that appears gets
the next number. The ids already published are the original row numbers, so every
existing geocode stays valid.

    python3 tools/fsa_ids.py --bootstrap   # one time: freeze today's ids
    python3 tools/fsa_ids.py --stamp       # add ATLAS_RECORD_ID to the normalized CSV
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA_ROOT = ROOT / "_DATA"
REGISTRY = DATA_ROOT / "fsa_site_ids.csv"
NORMALIZED = DATA_ROOT / "dead_campus_phase9_peps_normalized.csv"
FIELDS = ["id", "opeid", "closed_date", "school_name", "location", "address"]


def _clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def row_key(row: dict) -> tuple[str, str, str, str, str]:
    """The identity of a site. Matches the key the refresh uses to carry annotations forward."""
    return (
        _clean(row.get("OPEID_8")),
        _clean(row.get("Closed_Date")),
        _clean(row.get("School_Name")).upper(),
        _clean(row.get("Location")).upper(),
        _clean(row.get("Address")).upper(),
    )


def load() -> dict[tuple, str]:
    if not REGISTRY.exists():
        return {}
    with REGISTRY.open(newline="", encoding="utf-8") as handle:
        return {
            (r["opeid"], r["closed_date"], r["school_name"], r["location"], r["address"]): r["id"]
            for r in csv.DictReader(handle)
        }


def save(registry: dict[tuple, str]) -> None:
    ordered = sorted(registry.items(), key=lambda item: item[1])
    with REGISTRY.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(FIELDS)
        for key, record_id in ordered:
            writer.writerow([record_id, *key])


def _number(record_id: str) -> int:
    return int(record_id.split("-")[1])


def assign(rows: list[dict], registry: dict[tuple, str]) -> list[str]:
    """Return one id per row, adding unseen sites to the registry in file order (oldest closure last)."""
    next_number = max((_number(v) for v in registry.values()), default=0) + 1
    ids: list[str] = []
    seen: dict[tuple, int] = {}
    for row in rows:
        key = row_key(row)
        # Two rows with identical keys are distinguished by order of appearance.
        occurrence = seen.get(key, 0)
        seen[key] = occurrence + 1
        if occurrence:
            key = (*key[:4], f"{key[4]} #{occurrence + 1}")
        if key not in registry:
            registry[key] = f"fsa-{next_number:05d}"
            next_number += 1
        ids.append(registry[key])
    return ids


def bootstrap() -> None:
    if REGISTRY.exists():
        raise SystemExit(f"{REGISTRY} already exists; ids are append-only, so it is not rebuilt.")
    with NORMALIZED.open(newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle))
    registry: dict[tuple, str] = {}
    seen: dict[tuple, int] = {}
    for index, row in enumerate(rows, start=1):
        key = row_key(row)
        occurrence = seen.get(key, 0)
        seen[key] = occurrence + 1
        if occurrence:
            key = (*key[:4], f"{key[4]} #{occurrence + 1}")
        registry[key] = f"fsa-{index:05d}"
    save(registry)
    print(f"Froze {len(registry):,} ids in {REGISTRY}")


def stamp() -> None:
    """Add ATLAS_RECORD_ID to the normalized CSV from the registry."""
    registry = load()
    if not registry:
        raise SystemExit("No registry; run --bootstrap first.")
    with NORMALIZED.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        fields = [f for f in reader.fieldnames if f != "ATLAS_RECORD_ID"]
        rows = list(reader)
    ids = assign(rows, registry)
    save(registry)
    for row, record_id in zip(rows, ids):
        row["ATLAS_RECORD_ID"] = record_id
    with NORMALIZED.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=[*fields, "ATLAS_RECORD_ID"], lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    print(f"Stamped {len(rows):,} rows; registry holds {len(registry):,} ids")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--bootstrap", action="store_true")
    parser.add_argument("--stamp", action="store_true")
    args = parser.parse_args()
    if args.bootstrap:
        bootstrap()
    if args.stamp:
        stamp()
    if not (args.bootstrap or args.stamp):
        parser.print_help(sys.stderr)
