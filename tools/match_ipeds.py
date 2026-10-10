#!/usr/bin/env python3
"""Match public atlas sites to IPEDS UNITIDs using the directory spine.

Reads _DATA/ipeds_directory_spine.csv and curation/public-sites.json, matches
by normalized name within the same state, and records the result:

* Exact or alias matches are written into the curation file as
  ``"ipeds": {"unitid": ..., "opeid": ..., "status": ..., "newidName": ...}``.
* Everything else goes to _DATA/ipeds_match_review.csv with the best candidates
  so a person can decide.

Run ``tools/pull_ipeds_directory.py`` first.
"""

from __future__ import annotations

import csv
import difflib
import json
import re
from collections import defaultdict
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_DIR.parent / "_DATA"
SPINE_CSV = DATA_ROOT / "ipeds_directory_spine.csv"
REVIEW_CSV = DATA_ROOT / "ipeds_match_review.csv"
CURATION = PROJECT_DIR / "curation" / "public-sites.json"

STOPWORDS = {"the", "of", "at", "in", "and"}
SYNONYMS = {
    "saint": "st",
    "university": "",
    "college": "",
    "main": "",
    "campus": "",
}


def norm(value: str) -> str:
    text = value.lower().replace("&", " and ").replace("–", " ").replace("-", " ")
    text = re.sub(r"[^a-z0-9 ]+", " ", text)
    words = []
    for word in text.split():
        if word in STOPWORDS:
            continue
        word = SYNONYMS.get(word, word)
        if word:
            words.append(word)
    return " ".join(words)


def load_spine() -> dict[str, list[dict]]:
    if not SPINE_CSV.exists():
        raise SystemExit(f"Missing {SPINE_CSV}; run tools/pull_ipeds_directory.py first")
    by_state: dict[str, list[dict]] = defaultdict(list)
    with SPINE_CSV.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            row["_norm"] = norm(row["name"])
            row["_alias_norm"] = norm(row["alias"]) if row.get("alias") else ""
            by_state[row["state"]].append(row)
    return by_state


def candidates(name: str, state: str, by_state: dict[str, list[dict]]) -> list[tuple[float, dict]]:
    target = norm(name)
    scored = []
    for row in by_state.get(state, []):
        score = difflib.SequenceMatcher(None, target, row["_norm"]).ratio()
        if row["_alias_norm"]:
            score = max(score, difflib.SequenceMatcher(None, target, row["_alias_norm"]).ratio())
        if target == row["_norm"] or (row["_alias_norm"] and target == row["_alias_norm"]):
            score = 1.0
        scored.append((score, row))
    scored.sort(key=lambda item: (-item[0], item[1]["status"] != "closed", -int(item[1]["last_year"] or 0)))
    return scored[:3]


def main() -> None:
    by_state = load_spine()
    curation = json.loads(CURATION.read_text(encoding="utf-8"))
    sites = curation["sites"]

    review_rows = []
    matched = 0
    for site_id, entry in sites.items():
        state = site_id.rsplit("-", 1)[-1].upper()
        ranked = candidates(entry["name"], state, by_state)
        best_score, best = ranked[0] if ranked else (0.0, None)
        # Accept an exact match, or a near-exact match when the candidate has left IPEDS.
        accept = best is not None and (best_score >= 0.97 or (best_score >= 0.9 and best["status"] != "active"))
        if accept:
            entry["ipeds"] = {
                "unitid": int(best["unitid"]),
                "opeid": best["opeid"],
                "status": best["status"],
                "lastYear": int(best["last_year"]),
                "yearClosed": int(best["year_closed"]) if best["year_closed"] else None,
                "newid": int(best["newid"]) if best["newid"] else None,
                "newidName": best["newid_name"],
            }
            matched += 1
        else:
            entry.pop("ipeds", None)
        review_rows.append(
            {
                "siteId": site_id,
                "name": entry["name"],
                "state": state,
                "accepted": "yes" if accept else "no",
                "bestScore": f"{best_score:.2f}",
                "bestUnitid": best["unitid"] if best else "",
                "bestName": best["name"] if best else "",
                "bestStatus": best["status"] if best else "",
                "bestLastYear": best["last_year"] if best else "",
                "alternates": " | ".join(f"{r['unitid']} {r['name']} ({r['status']}, {s:.2f})" for s, r in ranked[1:]),
            }
        )

    CURATION.write_text(json.dumps(curation, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    with REVIEW_CSV.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(review_rows[0].keys()))
        writer.writeheader()
        writer.writerows(review_rows)

    print(f"Matched {matched} of {len(sites)} public sites to IPEDS UNITIDs")
    print(f"Review file: {REVIEW_CSV}")
    for row in review_rows:
        if row["accepted"] == "no":
            print(f"  review: {row['name']} ({row['state']}) best={row['bestName']!r} score={row['bestScore']}")


if __name__ == "__main__":
    main()
