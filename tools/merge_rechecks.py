#!/usr/bin/env python3
"""Validate and merge recheck batches into curation/afterlife-rechecks.json.

A recheck result is the institution's coding as it should now stand, with a verdict
and any new evidence. The overlay stores only what differs from the first coding, plus
the first coding's values, so the history is never lost:

    {"records": {"<unitid>": {"verdict", "checkedOn", "changed": [...], "revised": {...},
                              "newEvidence": [...], "note"}}}

Same vocabularies and rules as tools/merge_afterlife_sample.py. Records that fail are
listed and left out, never repaired.
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_data as bd  # noqa: E402
from merge_afterlife_sample import clean_evidence, validate  # noqa: E402

BATCH_DIR = bd.ROOT / "_DATA" / "afterlife_batches"
VERDICTS = {"confirmed", "revised", "unresolved"}
# Directories and aggregators that republish the IPEDS directory or each other. They are
# useful for locating an institution but are not independent evidence of what happened.
DERIVED_HOSTS = {
    "collegetuitioncompare.com", "skillplum.com", "collegeevaluator.com", "ope.ed.gov", "nces.ed.gov",
    "collegenavigator.ed.gov", "ed.gov", "causeiq.com", "unigo.com", "cappex.com", "petersons.com",
    "usnews.com", "niche.com", "collegefactual.com", "schoolgrades.com", "mapquest.com", "datausa.io",
    "collegesimply.com", "collegeraptor.com", "educationdata.urban.org", "data.ed.gov", "ipeds.ed.gov",
    "universities.com", "4icu.org", "collegestats.org", "mydegreeguide.com", "edsurge.com",
}


def main() -> None:
    results = sorted(BATCH_DIR.glob("recheck_*_result.json"))
    if not results:
        raise SystemExit("No recheck result files found")
    base = {int(r["unitid"]): r for r in bd.load_coded_records(apply_rechecks=False)}

    accepted: dict[str, dict] = {}
    rejected: list[tuple[int, str, list[str]]] = []
    for path in results:
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            print(f"{path.name}: invalid JSON: {exc}", file=sys.stderr)
            continue
        for item in rows:
            unitid = item.get("unitid")
            original = base.get(unitid)
            if original is None:
                rejected.append((unitid or 0, str(item.get("name")), ["unitid is not a coded institution"]))
                continue
            problems: list[str] = []
            if item.get("verdict") not in VERDICTS:
                problems.append(f"verdict {item.get('verdict')!r} invalid")
            if not str(item.get("note", "")).strip():
                problems.append("no note on what was checked")
            revised = item.get("revised") or {}
            missing = [k for k in bd.RECHECK_FIELDS if k not in revised]
            if missing:
                problems.append(f"revised is missing {missing}")
            new_evidence = clean_evidence(item.get("newEvidence"))
            if not problems:
                candidate = {
                    **{k: revised.get(k) for k in bd.RECHECK_FIELDS},
                    "unitid": unitid,
                    "name": original["name"],
                    "evidence": list(original.get("evidence") or []) + new_evidence,
                }
                problems += validate(candidate, {"name": original["name"]})
            if problems:
                rejected.append((unitid, str(item.get("name")), problems))
                continue
            revised = dict(revised)
            clamped = None
            rank = {"low": 0, "medium": 1, "high": 2}
            asked = rank.get(revised.get("confidence"), 0)
            held = rank.get(original.get("confidence"), 0)
            if asked > held:
                # medium needs one page that is not an IPEDS-derived directory; high needs two
                # independent hosts. A record cannot become more certain only by being looked at again.
                hosts = {
                    urlparse(e["url"]).netloc.lower().removeprefix("www.")
                    for e in [*(original.get("evidence") or []), *new_evidence]
                    if e.get("url")
                }
                independent = {h for h in hosts if not any(h == d or h.endswith("." + d) for d in DERIVED_HOSTS)}
                allowed = 2 if len(independent) >= 2 else 1 if independent else 0
                if not new_evidence:
                    allowed = held
                if asked > max(held, allowed):
                    granted = max(held, allowed)
                    clamped = f"{revised.get('confidence')} requested, {['low', 'medium', 'high'][granted]} kept"
                    revised["confidence"] = ["low", "medium", "high"][granted]
            changed = [k for k in bd.RECHECK_FIELDS if (revised.get(k) or None) != (original.get(k) or None)]
            accepted[str(unitid)] = {
                "name": original["name"],
                "verdict": item["verdict"],
                "checkedOn": date.today().isoformat(),
                "changed": changed,
                "revised": {k: revised.get(k) for k in bd.RECHECK_FIELDS},
                "newEvidence": new_evidence,
                "note": str(item["note"]).strip()
                + (f" Confidence limit applied ({clamped}): medium needs one non-directory source, high needs two." if clamped else ""),
            }
            if clamped:
                accepted[str(unitid)]["confidenceClamped"] = clamped

    payload = {
        "about": "Second-pass checks of coded institutions. The first coding stays in afterlife-sample/census/exits.json; this overlay replaces only the fields listed in `changed`.",
        "count": len(accepted),
        "records": dict(sorted(accepted.items(), key=lambda kv: int(kv[0]))),
    }
    bd.AFTERLIFE_RECHECKS.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    from collections import Counter
    print(f"Accepted {len(accepted)} rechecks -> {bd.AFTERLIFE_RECHECKS}")
    print("  verdicts:", dict(Counter(v["verdict"] for v in accepted.values())))
    print("  changed a field:", sum(1 for v in accepted.values() if v["changed"]))
    for unitid, name, problems in rejected:
        print(f"REJECTED {unitid} {name}: {'; '.join(problems)}")


if __name__ == "__main__":
    main()
