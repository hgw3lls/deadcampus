#!/usr/bin/env python3
"""Select coded institutions whose coding most needs a second look and write recheck batches.

A recheck is a second, independent pass over a record that is weak in a way the data
can show: low confidence, one source, a source that is only Wikipedia, a fate that was
unknown when coded (campuses get sold), a closure year far from the IPEDS exit, or a
coded outcome that contradicts the IPEDS status.

Writes _DATA/afterlife_recheck_frame.csv (one row per institution with its reasons) and
_DATA/afterlife_batches/recheck_NN_input.json. Results go to recheck_NN_result.json and
are merged by tools/merge_rechecks.py into curation/afterlife-rechecks.json, an overlay
that leaves the original coding in place.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_data as bd  # noqa: E402

DATA_ROOT = bd.ROOT / "_DATA"
BATCH_DIR = DATA_ROOT / "afterlife_batches"
FRAME_OUT = DATA_ROOT / "afterlife_recheck_frame.csv"
CLOSURE_OUTCOMES = {"closed-campus-reused", "closed-campus-unknown", "merged-campus-closed"}
OPERATING_OUTCOMES = {"still-operating", "not-a-closure", "merged-campus-continues"}
PRIORITY = [
    "ipeds-contradiction", "no-evidence", "unresolved", "low-confidence",
    "date-gap", "single-source", "unknown-fate",
]


def reasons_for(record: dict, spine_row: dict | None, exclude_reasons: set[str]) -> list[str]:
    out: list[str] = []
    outcome = record.get("outcome")
    evidence = [e for e in (record.get("evidence") or []) if e.get("url")]
    hosts = {urlparse(e["url"]).netloc.replace("www.", "") for e in evidence}
    status = (spine_row or {}).get("status")
    if outcome in CLOSURE_OUTCOMES and status == "active":
        out.append("ipeds-contradiction")
    if outcome in OPERATING_OUTCOMES and status == "closed" and outcome != "merged-campus-continues":
        out.append("ipeds-contradiction")
    if outcome != "unresolved" and not evidence:
        out.append("no-evidence")
    if outcome == "unresolved":
        out.append("unresolved")
    if record.get("confidence") == "low" and outcome != "unresolved":
        out.append("low-confidence")
    if outcome in CLOSURE_OUTCOMES:
        year = str(record.get("closureDate") or "")[:4]
        last = (spine_row or {}).get("last_year")
        if year.isdigit() and last and abs(int(year) - int(last)) > 2:
            out.append("date-gap")
    only_wikipedia = bool(hosts) and all("wikipedia.org" in h for h in hosts)
    if outcome != "unresolved" and (len(evidence) <= 1 or only_wikipedia) and record.get("confidence") != "high":
        out.append("single-source")
    if outcome == "closed-campus-unknown":
        out.append("unknown-fate")
    return [r for r in out if r not in exclude_reasons]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--batch-size", type=int, default=10)
    parser.add_argument("--exclude-reasons", default="", help="comma list of reasons to ignore")
    parser.add_argument("--skip-rechecked", action="store_true", help="leave out unitids already in curation/afterlife-rechecks.json")
    args = parser.parse_args()
    exclude = {r for r in args.exclude_reasons.split(",") if r}

    spine = {int(r["unitid"]): r for r in bd.csv_rows(bd.SPINE_CSV)}
    curated_units = set()
    for entry in bd.load_curation().values():
        for key in ("unitid", "parentUnitid"):
            if (entry.get("ipeds") or {}).get(key):
                curated_units.add(int(entry["ipeds"][key]))
    done: set[int] = set()
    overlay_path = bd.AFTERLIFE_RECHECKS
    if args.skip_rechecked and overlay_path.exists():
        done = {int(k) for k in json.loads(overlay_path.read_text(encoding="utf-8")).get("records", {})}

    picked = []
    for record in bd.load_coded_records(apply_rechecks=False):
        unitid = int(record["unitid"])
        if unitid in curated_units or unitid in done or record.get("duplicateOf"):
            continue
        reasons = reasons_for(record, spine.get(unitid), exclude)
        if reasons:
            picked.append((min(PRIORITY.index(r) for r in reasons), unitid, record, reasons))
    picked.sort(key=lambda item: (item[0], item[1]))

    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    for stale in BATCH_DIR.glob("recheck_*_input.json"):
        stale.unlink()
    with FRAME_OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["unitid", "name", "state", "tier", "outcome", "confidence", "reasons", "batch"])
        for index, (_, unitid, record, reasons) in enumerate(picked):
            writer.writerow([unitid, record["name"], record.get("state"), record.get("tier"), record.get("outcome"),
                             record.get("confidence"), "|".join(reasons), f"{index // args.batch_size + 1:02d}"])
    batches: dict[str, list[dict]] = {}
    for index, (_, unitid, record, reasons) in enumerate(picked):
        row = spine.get(unitid) or {}
        batches.setdefault(f"{index // args.batch_size + 1:02d}", []).append({
            "unitid": unitid,
            "name": record["name"],
            "city": record.get("city"),
            "state": record.get("state"),
            "ipeds": {
                "status": row.get("status"), "firstYear": row.get("first_year"), "lastYear": row.get("last_year"),
                "dateClosed": row.get("date_closed"), "combinedInto": row.get("newid_name") or None,
            },
            "reasonsForRecheck": reasons,
            "current": {k: record.get(k) for k in (
                "outcome", "closureDate", "campusFate", "buyerName", "buyerSector", "replacementSystem",
                "originalSystem", "transferDate", "confidence", "notes", "evidence")},
        })
    for batch, items in batches.items():
        (BATCH_DIR / f"recheck_{batch}_input.json").write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    from collections import Counter
    counts = Counter(r for _, _, _, rs in picked for r in rs)
    print(f"{len(picked)} institutions in {len(batches)} batches of up to {args.batch_size}")
    for reason in PRIORITY:
        print(f"  {reason}: {counts.get(reason, 0)}")


if __name__ == "__main__":
    main()
