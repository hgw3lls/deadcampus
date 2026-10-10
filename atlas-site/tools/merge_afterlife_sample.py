#!/usr/bin/env python3
"""Validate and merge the coded afterlife-sample batches.

Reads _DATA/afterlife_batches/batch_NN_result.json (written by the coding
agents), checks every record against the controlled vocabularies and the
sample frame, and writes curation/afterlife-sample.json. Records that fail
validation are listed and excluded, never silently repaired.

Rules enforced:
* every unitid in the frame appears exactly once, and no others;
* outcome, buyerSector, replacementSystem, originalSystem, confidence come from
  the controlled lists in tools/build_data.py;
* dates are YYYY, YYYY-MM, or YYYY-MM-DD;
* every outcome other than "unresolved" carries at least one http(s) evidence
  URL with a non-empty claim;
* a record with a buyerSector must carry an outcome that has a buyer
  (closed-campus-reused, merged-campus-continues, merged-campus-closed).
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_DIR.parent / "_DATA"
BATCH_DIR = DATA_ROOT / "afterlife_batches"
FRAME_CSV = DATA_ROOT / "afterlife_sample_frame.csv"
STRATA_JSON = DATA_ROOT / "afterlife_sample_strata.json"
OUT_JSON = PROJECT_DIR / "curation" / "afterlife-sample.json"

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_data as vocab  # noqa: E402

DATE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")
HAS_BUYER = {"closed-campus-reused", "merged-campus-continues", "merged-campus-closed"}
CONFIDENCE = {"high", "medium", "low"}


def clean_evidence(evidence: list[dict] | None) -> list[dict]:
    """Percent-encode spaces in evidence URLs; coders sometimes paste them raw."""
    return [
        {**item, "url": str(item.get("url", "")).strip().replace(" ", "%20")} for item in (evidence or [])
    ]


def validate(record: dict, frame_row: dict) -> list[str]:
    errors = []
    outcome = record.get("outcome")
    if outcome not in vocab.SAMPLE_OUTCOMES:
        errors.append(f"outcome {outcome!r} not in vocabulary")
    for key, allowed in (
        ("buyerSector", vocab.BUYER_SECTORS),
        ("replacementSystem", vocab.REPLACEMENT_SYSTEMS),
        ("originalSystem", vocab.ORIGINAL_SYSTEMS),
    ):
        value = record.get(key)
        if value is not None and value not in allowed:
            errors.append(f"{key} {value!r} not in vocabulary")
    if record.get("confidence") not in CONFIDENCE:
        errors.append(f"confidence {record.get('confidence')!r} invalid")
    for key in ("closureDate", "transferDate"):
        value = record.get(key)
        if value is not None and not DATE.match(str(value)):
            errors.append(f"{key} {value!r} is not YYYY, YYYY-MM, or YYYY-MM-DD")
    evidence = record.get("evidence") or []
    if outcome != "unresolved":
        if not evidence:
            errors.append("no evidence")
        for item in evidence:
            if not str(item.get("url", "")).startswith(("http://", "https://")):
                errors.append(f"evidence url {item.get('url')!r} is not http(s)")
            if not str(item.get("claim", "")).strip():
                errors.append("evidence item without a claim")
    if record.get("buyerSector") and outcome not in HAS_BUYER:
        errors.append(f"buyerSector set but outcome {outcome!r} has no buyer")
    if str(record.get("name", "")).strip() != frame_row["name"].strip():
        errors.append(f"name {record.get('name')!r} does not match frame {frame_row['name']!r}")
    return errors


def main() -> None:
    frame = {int(r["unitid"]): r for r in csv.DictReader(FRAME_CSV.open(encoding="utf-8"))}
    strata = json.loads(STRATA_JSON.read_text(encoding="utf-8"))
    batches = sorted(BATCH_DIR.glob("batch_*_result.json"))
    if not batches:
        raise SystemExit("No batch result files found")

    accepted: dict[int, dict] = {}
    rejected: list[tuple[int, str, list[str]]] = []
    seen: set[int] = set()
    for path in batches:
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            print(f"{path.name}: invalid JSON: {exc}", file=sys.stderr)
            continue
        for record in rows:
            unitid = record.get("unitid")
            if unitid not in frame:
                rejected.append((unitid or 0, str(record.get("name")), ["unitid not in the sample frame"]))
                continue
            if unitid in seen:
                rejected.append((unitid, str(record.get("name")), ["duplicate record"]))
                continue
            seen.add(unitid)
            problems = validate(record, frame[unitid])
            if problems:
                rejected.append((unitid, str(record.get("name")), problems))
                continue
            row = frame[unitid]
            accepted[unitid] = {
                **{k: record.get(k) for k in (
                    "unitid", "name", "outcome", "closureDate", "campusFate", "buyerName", "buyerSector",
                    "replacementSystem", "originalSystem", "transferDate", "evidence", "confidence", "notes")},
                "evidence": clean_evidence(record.get("evidence")),
                "state": row["state"],
                "city": row["city"],
                "ipedsStatus": row["status"],
                "exitYear": int(row["exit_year"]),
                "stratum": row["stratum"],
                "batch": row["batch"],
            }

    missing = [u for u in frame if u not in seen]
    payload = {
        "seed": strata["seed"],
        "frame": strata["frame"],
        "frameSize": strata["frameSize"],
        "sampleSize": strata["sampleSize"],
        "strata": strata["strata"],
        "coded": len(accepted),
        "records": sorted(accepted.values(), key=lambda r: (r["batch"], r["name"])),
    }
    OUT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Accepted {len(accepted)} of {len(frame)} sampled institutions -> {OUT_JSON}")
    if missing:
        print(f"Missing from results ({len(missing)}): {', '.join(frame[u]['name'] for u in missing[:12])}")
    for unitid, name, problems in rejected:
        print(f"REJECTED {unitid} {name}: {'; '.join(problems)}")


if __name__ == "__main__":
    main()
