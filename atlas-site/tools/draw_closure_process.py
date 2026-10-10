#!/usr/bin/env python3
"""Draw the for-profit exits that SHEEO's closure-process file does not cover.

SHEEO coded 748 closures for how they happened (announcement date, abrupt or orderly,
teach-out, mergers, records custody). It covers 320 of the 1,196 for-profit degree-granting
institutions that left IPEDS from 2010 to the last directory year. This script frames the
other 876 so the same fields can be coded for them, in batches:

* chain batches: institutions that share a name stem with four or more members (ITT
  Technical Institute, University of Phoenix units, DeVry, and so on). A chain event is
  researched once and applied to the members it fits.
* independent batches: everything else, twelve to a batch.

Writes _DATA/forprofit_process_frame.csv and _DATA/afterlife_batches/closureproc_NN_input.json.
Results go to closureproc_NN_result.json and are merged by tools/merge_closure_process.py.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_data as bd  # noqa: E402

DATA_ROOT = bd.ROOT / "_DATA"
BATCH_DIR = DATA_ROOT / "afterlife_batches"
FRAME_OUT = DATA_ROOT / "forprofit_process_frame.csv"
FIELDS = ["unitid", "opeid", "name", "city", "state", "status", "first_year", "last_year",
          "exit_year", "date_closed", "newid_name", "chain", "batch"]

CHAIN_RULES = [
    (r"^itt technical", "ITT Technical Institute"),
    (r"phoenix", "University of Phoenix"),
    (r"^devry", "DeVry University"),
    (r"^national american", "National American University"),
    (r"^brown mackie", "Brown Mackie College"),
    (r"^brightwood", "Brightwood College"),
    (r"^vatterott", "Vatterott College"),
    (r"^fortis", "Fortis College"),
    (r"^westwood", "Westwood College"),
    (r"^kaplan", "Kaplan College"),
    (r"^carrington", "Carrington College"),
    (r"^miller[- ]motte", "Miller-Motte College"),
    (r"^bryant (&|and) stratton", "Bryant & Stratton College"),
    (r"^strayer", "Strayer University"),
    (r"^lincoln (tech|college of tech)", "Lincoln Technical Institute"),
    (r"^rasmussen", "Rasmussen College"),
    (r"^sanford[- ]brown", "Sanford-Brown College"),
    (r"^art institute|^the art institute", "The Art Institutes"),
    (r"^everest", "Everest (Corinthian)"),
    (r"^virginia college", "Virginia College"),
    (r"^remington", "Remington College"),
    (r"^anthem", "Anthem College"),
    (r"^harris school", "Harris School of Business"),
    (r"^heald", "Heald College"),
    (r"^corinthian", "Corinthian Colleges"),
    (r"^ecpi", "ECPI"),
    (r"^concorde", "Concorde Career College"),
    (r"^gibbs", "Gibbs College"),
    (r"^le cordon bleu", "Le Cordon Bleu"),
    (r"^argosy", "Argosy University"),
    (r"^dade medical", "Dade Medical College"),
    (r"^medtech", "MedTech College"),
    (r"^triangle tech", "Triangle Tech"),
]


def exit_year(row: dict) -> int:
    return int(row["year_closed"] or row["year_deleted"] or (int(row["last_year"]) + 1))


def chain_of(name: str) -> str:
    lowered = name.lower().strip()
    for pattern, label in CHAIN_RULES:
        if re.search(pattern, lowered):
            return label
    stem = re.split(r"\s+[-–]\s*|-", name)[0].strip()
    return re.sub(r"\s+", " ", stem)


def sheeo_covered_units() -> set[int]:
    """UNITIDs with at least one OPEID in the SHEEO file."""
    sheeo = bd.load_sheeo()
    index = bd.load_ipeds_index()
    covered: set[int] = set()
    for row in bd.csv_rows(DATA_ROOT / "dead_campus_phase9_peps_normalized.csv"):
        root = row["ATLAS_OPEID_ROOT"].zfill(6) if row["ATLAS_OPEID_ROOT"].isdigit() else row["ATLAS_OPEID_ROOT"]
        opeid = row["ATLAS_OPEID_RAW"].zfill(8) if row["ATLAS_OPEID_RAW"].isdigit() else row["ATLAS_OPEID_RAW"]
        match, _ = bd.join_ipeds(root, opeid, index)
        if match and opeid in sheeo:
            covered.add(int(match["unitid"]))
    for row in bd.csv_rows(bd.SPINE_CSV):
        if row["opeid"] and row["opeid"] in sheeo:
            covered.add(int(row["unitid"]))
    return covered


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--independent-batch", type=int, default=12)
    parser.add_argument("--chain-min", type=int, default=4)
    parser.add_argument("--chain-split", type=int, default=140, help="split a chain batch above this many members")
    args = parser.parse_args()

    covered = sheeo_covered_units()
    rows = [
        r for r in bd.csv_rows(bd.SPINE_CSV)
        if r["control_label"] == "Private for-profit" and r["degree_granting"] == "1"
        and r["status"] in ("closed", "dropped", "combined")
        and bd.FRAME_START <= exit_year(r) <= bd.FRAME_END
        and int(r["unitid"]) not in covered
    ]
    for r in rows:
        r["exit_year"] = exit_year(r)
        r["chain"] = chain_of(r["name"])
    sizes = Counter(r["chain"] for r in rows)
    chains: dict[str, list[dict]] = defaultdict(list)
    independents: list[dict] = []
    for r in rows:
        (chains[r["chain"]] if sizes[r["chain"]] >= args.chain_min else independents).append(r)

    BATCH_DIR.mkdir(parents=True, exist_ok=True)
    for stale in BATCH_DIR.glob("closureproc_*_input.json"):
        stale.unlink()
    batches: list[tuple[str, str, list[dict]]] = []  # (kind, label, members)
    for label, members in sorted(chains.items(), key=lambda kv: -len(kv[1])):
        members.sort(key=lambda r: (r["exit_year"], r["name"]))
        if len(members) > args.chain_split:
            for start in range(0, len(members), args.chain_split):
                batches.append(("chain", label, members[start : start + args.chain_split]))
        else:
            batches.append(("chain", label, members))
    independents.sort(key=lambda r: (r["exit_year"], r["name"]))
    for start in range(0, len(independents), args.independent_batch):
        batches.append(("independent", "independent institutions", independents[start : start + args.independent_batch]))

    with FRAME_OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, extrasaction="ignore")
        writer.writeheader()
        for number, (kind, label, members) in enumerate(batches, start=1):
            for r in members:
                r["batch"] = f"{number:02d}"
                writer.writerow(r)
    for number, (kind, label, members) in enumerate(batches, start=1):
        payload = {
            "batch": f"{number:02d}",
            "kind": kind,
            "chain": label if kind == "chain" else None,
            "members": [
                {
                    "unitid": int(r["unitid"]),
                    "name": r["name"],
                    "city": r["city"],
                    "state": r["state"],
                    "ipedsStatus": r["status"],
                    "firstYearInIpeds": int(r["first_year"]),
                    "lastYearInIpeds": int(r["last_year"]),
                    "exitYear": int(r["exit_year"]),
                    "ipedsCloseDate": r["date_closed"],
                    "combinedIntoName": r.get("newid_name") or None,
                }
                for r in members
            ],
        }
        (BATCH_DIR / f"closureproc_{number:02d}_input.json").write_text(
            json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8"
        )
    print(f"{len(rows)} institutions; {sum(1 for b in batches if b[0] == 'chain')} chain batches "
          f"({sum(len(b[2]) for b in batches if b[0] == 'chain')} members), "
          f"{sum(1 for b in batches if b[0] == 'independent')} independent batches ({len(independents)} institutions)")
    for number, (kind, label, members) in enumerate(batches, start=1):
        if kind == "chain":
            print(f"  {number:02d} {label}: {len(members)}  {dict(Counter(m['status'] for m in members))}")


if __name__ == "__main__":
    main()
