#!/usr/bin/env python3
"""Validate and merge the closure-process batches for for-profit exits.

Each result file holds groups. A group is a set of UNITIDs that share the same facts, so a
chain event is written once and applied to every member it fits. Merging expands each group
to one record per institution, checks the controlled values, and writes
curation/closure-process-forprofit.json, keyed by UNITID.

Rules, as in the SHEEO file this extends:
* every institution in the frame appears in exactly one group;
* abrupt is a boolean and is set only for an event that is a closure;
* any announced date, abrupt, teach-out, merger, or records claim needs an evidence URL
  with a claim, unless the event is "unresolved";
* dates are YYYY, YYYY-MM, or YYYY-MM-DD.
"""

from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_data as bd  # noqa: E402

DATA_ROOT = bd.ROOT / "_DATA"
BATCH_DIR = DATA_ROOT / "afterlife_batches"
FRAME = DATA_ROOT / "forprofit_process_frame.csv"
OUT = Path(__file__).resolve().parents[1] / "curation" / "closure-process-forprofit.json"

EVENTS = {"closure", "consolidation", "merger", "still-operating", "unresolved"}
TEACH_OUT = {"yes", "no", "unclear", "n/a"}
MERGER = {"none", "attempted", "executed"}
RECORDS = {"yes", "no", "unknown"}
CONFIDENCE = {"high", "medium", "low"}
DATE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")
KEEP = ("event", "announced", "closed", "abrupt", "teachOut", "merger", "mergerNote", "records", "recordsNote",
        "confidence", "notes", "evidence")


def check(group: dict) -> list[str]:
    problems: list[str] = []
    event = group.get("event")
    if event not in EVENTS:
        problems.append(f"event {event!r} invalid")
    for key, allowed in (("teachOut", TEACH_OUT), ("merger", MERGER), ("records", RECORDS)):
        value = group.get(key)
        if value is not None and value not in allowed:
            problems.append(f"{key} {value!r} invalid")
    if group.get("confidence") not in CONFIDENCE:
        problems.append(f"confidence {group.get('confidence')!r} invalid")
    for key in ("announced", "closed"):
        value = group.get(key)
        if value is not None and not DATE.match(str(value)):
            problems.append(f"{key} {value!r} is not YYYY, YYYY-MM, or YYYY-MM-DD")
    abrupt = group.get("abrupt")
    if abrupt is not None and not isinstance(abrupt, bool):
        problems.append("abrupt must be true, false, or null")
    if abrupt is not None and event != "closure":
        problems.append("abrupt is set but the event is not a closure")
    evidence = group.get("evidence") or []
    # "unclear", "n/a", "unknown", and "none" say a fact was not found; they need no page.
    claims = (
        group.get("announced") not in (None, "")
        or group.get("abrupt") is not None
        or group.get("teachOut") in ("yes", "no")
        or group.get("records") in ("yes", "no")
        or group.get("merger") in ("attempted", "executed")
    )
    if event != "unresolved" and claims and not evidence:
        problems.append("claims without evidence")
    for item in evidence:
        if not str(item.get("url", "")).startswith(("http://", "https://")):
            problems.append(f"evidence url {item.get('url')!r} is not http(s)")
        if not str(item.get("claim", "")).strip():
            problems.append("evidence item without a claim")
    return problems


def main() -> None:
    frame = {int(r["unitid"]): r for r in csv.DictReader(FRAME.open(encoding="utf-8"))}
    results = sorted(BATCH_DIR.glob("closureproc_*_result.json"))
    if not results:
        raise SystemExit("No closure-process result files found")
    accepted: dict[int, dict] = {}
    rejected: list[tuple[str, str, list[str]]] = []
    for path in results:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            print(f"{path.name}: invalid JSON: {exc}", file=sys.stderr)
            continue
        groups = payload.get("groups", []) if isinstance(payload, dict) else payload
        for number, group in enumerate(groups, start=1):
            problems = check(group)
            unitids = group.get("unitids") or []
            if not unitids:
                problems.append("group has no unitids")
            unknown = [u for u in unitids if u not in frame]
            if unknown:
                problems.append(f"unitids not in the frame: {unknown[:3]}")
            repeated = [u for u in unitids if u in accepted]
            if repeated:
                problems.append(f"unitids already coded: {repeated[:3]}")
            if problems:
                rejected.append((path.name, f"group {number} ({len(unitids)} institutions)", problems))
                continue
            for unitid in unitids:
                row = frame[unitid]
                accepted[unitid] = {
                    **{k: group.get(k) for k in KEEP},
                    "name": row["name"],
                    "chain": row["chain"],
                    "ipedsStatus": row["status"],
                    "exitYear": int(row["exit_year"]),
                    "groupSize": len(unitids),
                    "batch": row["batch"],
                }
    missing = [u for u in frame if u not in accepted]
    payload = {
        "about": "How for-profit degree-granting institutions that left IPEDS closed, coded with the SHEEO Closed College Context scheme for institutions SHEEO did not cover. One record per institution; chain events are written once and applied to the members they fit.",
        "frame": f"Private for-profit degree-granting institutions that left IPEDS {bd.FRAME_LABEL} and have no OPEID in the SHEEO file",
        "frameSize": len(frame),
        "coded": len(accepted),
        "records": {str(u): accepted[u] for u in sorted(accepted)},
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    events = Counter(r["event"] for r in accepted.values())
    print(f"Accepted {len(accepted)} of {len(frame)} institutions -> {OUT}")
    print("  events:", dict(events))
    print("  abrupt:", dict(Counter(r["abrupt"] for r in accepted.values() if r["event"] == "closure")))
    if missing:
        print(f"Not yet coded ({len(missing)}): batches {sorted({frame[u]['batch'] for u in missing})}")
    for name, label, problems in rejected:
        print(f"REJECTED {name} {label}: {'; '.join(problems)}")


if __name__ == "__main__":
    main()
