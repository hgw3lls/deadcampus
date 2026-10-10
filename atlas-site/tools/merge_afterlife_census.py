#!/usr/bin/env python3
"""Validate and merge the coded census batches into curation/afterlife-census.json.

Same vocabularies and rules as tools/merge_afterlife_sample.py; the difference is
the frame (every closed private nonprofit degree-granting institution, 2010 to the last IPEDS year,
not already curated or sampled) and that results are not weighted, because this is
a census, not a sample.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_DIR.parent / "_DATA"
BATCH_DIR = DATA_ROOT / "afterlife_batches"
PREFIXES = {
    "census": (DATA_ROOT / "afterlife_census_frame.csv", PROJECT_DIR / "curation" / "afterlife-census.json"),
    "exits": (DATA_ROOT / "afterlife_exits_frame.csv", PROJECT_DIR / "curation" / "afterlife-exits.json"),
}

sys.path.insert(0, str(Path(__file__).resolve().parent))
from merge_afterlife_sample import clean_evidence, validate  # noqa: E402
from build_data import FRAME_LABEL  # noqa: E402

KEEP = (
    "unitid", "name", "outcome", "closureDate", "campusFate", "buyerName", "buyerSector",
    "replacementSystem", "originalSystem", "transferDate", "evidence", "confidence", "notes",
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prefix", choices=sorted(PREFIXES), default="census")
    args = parser.parse_args()
    frame_csv, out_json = PREFIXES[args.prefix]
    frame = {int(r["unitid"]): r for r in csv.DictReader(frame_csv.open(encoding="utf-8"))}
    results = sorted(BATCH_DIR.glob(f"{args.prefix}_*_result.json"))
    if not results:
        raise SystemExit(f"No {args.prefix} result files found")

    accepted: dict[int, dict] = {}
    rejected: list[tuple[int, str, list[str]]] = []
    for path in results:
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            print(f"{path.name}: invalid JSON: {exc}", file=sys.stderr)
            continue
        for record in rows:
            unitid = record.get("unitid")
            if unitid not in frame:
                rejected.append((unitid or 0, str(record.get("name")), ["unitid not in the census frame"]))
                continue
            if unitid in accepted:
                rejected.append((unitid, str(record.get("name")), ["duplicate record"]))
                continue
            problems = validate(record, frame[unitid])
            if problems:
                rejected.append((unitid, str(record.get("name")), problems))
                continue
            row = frame[unitid]
            accepted[unitid] = {
                **{key: record.get(key) for key in KEEP},
                "evidence": clean_evidence(record.get("evidence")),
                "state": row["state"],
                "city": row["city"],
                "ipedsStatus": row["status"],
                "exitYear": int(row["exit_year"]),
                "batch": row["batch"],
            }

    missing = [u for u in frame if u not in accepted and u not in {r[0] for r in rejected}]
    payload = {
        "frame": f"Private nonprofit degree-granting institutions that left IPEDS {FRAME_LABEL} (" + ("closed" if args.prefix == "census" else "dropped or combined") + "), not curated and not in the random sample",
        "frameSize": len(frame),
        "coded": len(accepted),
        "records": sorted(accepted.values(), key=lambda r: (r["exitYear"], r["name"])),
    }
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Accepted {len(accepted)} of {len(frame)} {args.prefix} institutions -> {out_json}")
    if missing:
        print(f"Not yet coded ({len(missing)}): {', '.join(frame[u]['name'] for u in missing[:10])}")
    for unitid, name, problems in rejected:
        print(f"REJECTED {unitid} {name}: {'; '.join(problems)}")


if __name__ == "__main__":
    main()
