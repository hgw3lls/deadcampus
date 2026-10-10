#!/usr/bin/env python3
"""Run the full Dead Campus Atlas update pipeline."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_DIR.parent / "_DATA"
FRESHNESS_JSON = DATA_ROOT / "source_freshness.json"


def run_step(label: str, command: list[str]) -> None:
    print(f"\n==> {label}", flush=True)
    subprocess.run(command, cwd=PROJECT_DIR, check=True)


def freshness_summary() -> str:
    if not FRESHNESS_JSON.exists():
        return "No source freshness file was written."
    freshness = json.loads(FRESHNESS_JSON.read_text(encoding="utf-8"))
    source = freshness.get("fsaClosedSchoolSearch", {})
    lines = [
        "Update summary:",
        f"  FSA report date: {source.get('reportedDate') or 'unknown'}",
        f"  FSA report age: {source.get('reportedAgeDays', 'unknown')} days",
        f"  Detail rows: {source.get('detailRows') or source.get('normalizedRows') or 'unknown'}",
        f"  Official reported total: {source.get('reportedTotal') or 'unknown'}",
        f"  Latest closure year: {source.get('latestClosureYear') or 'unknown'}",
        f"  Source: {source.get('sourceUrl') or 'unknown'}",
    ]
    return "\n".join(lines)


def build_refresh_args(args: argparse.Namespace) -> list[str]:
    refresh = [sys.executable, "tools/refresh_fsa_reports.py"]
    if args.local:
        refresh.append("--use-local")
    if args.source_url:
        refresh.extend(["--source-url", args.source_url])
    if args.allow_stale:
        refresh.append("--allow-stale")
    if args.allow_legacy_fallback:
        refresh.append("--allow-legacy-fallback")
    if args.max_stale_days is not None:
        refresh.extend(["--max-stale-days", str(args.max_stale_days)])
    return refresh


def main() -> None:
    parser = argparse.ArgumentParser(description="Update, rebuild, and validate the Dead Campus Atlas.")
    parser.add_argument("--local", action="store_true", help="Use the cached local FSA workbook instead of downloading.")
    parser.add_argument("--source-url", help="Explicit FSA workbook or archive URL.")
    parser.add_argument("--skip-fsa", action="store_true", help="Only rebuild and validate from existing local data.")
    parser.add_argument("--skip-validate", action="store_true", help="Skip the final static-site validator.")
    parser.add_argument("--allow-stale", action="store_true", help="Allow FSA reports older than the freshness limit.")
    parser.add_argument("--allow-legacy-fallback", action="store_true", help="Allow the old ED workbook if the current FSA API/page fails.")
    parser.add_argument("--max-stale-days", type=int, help="Override the live FSA report freshness limit.")
    args = parser.parse_args()

    if args.local and args.source_url:
        raise SystemExit("Use either --local or --source-url, not both.")
    if args.skip_fsa and any(
        [args.local, args.source_url, args.allow_stale, args.allow_legacy_fallback, args.max_stale_days is not None]
    ):
        raise SystemExit("--skip-fsa cannot be combined with FSA refresh options.")

    if not args.skip_fsa:
        run_step("Refresh FSA closed-school data", build_refresh_args(args))
    else:
        print("Skipping FSA refresh; rebuilding from existing local data.")

    run_step("Build browser data bundle", [sys.executable, "tools/build_data.py"])
    if not args.skip_validate:
        run_step("Validate static atlas", [sys.executable, "tools/validate_site.py"])
    else:
        print("Skipping static atlas validation.")

    print()
    print(freshness_summary())
    print("\nDone.")


if __name__ == "__main__":
    main()
