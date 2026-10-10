#!/usr/bin/env python3
"""Validate the static atlas bundle.

Two layers of checks:

* Structural checks always fail the run: missing files, broken data shape,
  duplicate ids, federal counts that disagree with each other, stale sources.
* Release gates (one source URL per public site, a verification state from the
  controlled vocabulary, and so on) are always reported. They only fail the run
  with ``--release``, so day-to-day rebuilds keep working while the editorial
  gaps stay visible.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
DATA = DIST / "data" / "atlas-data.js"
FEDERAL_DATA = DIST / "data" / "federal-records.js"
JSON_DATA = DIST / "data" / "canonical-atlas.json"
CURATION = ROOT / "curation" / "public-sites.json"
MAX_SOURCE_AGE_DAYS = 45


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.gaps: list[str] = []

    def error(self, message: str) -> None:
        self.errors.append(message)

    def gap(self, message: str) -> None:
        self.gaps.append(message)


def load_js_payload(path: Path, global_name: str, label: str, report: Report):
    if not path.exists():
        report.error(f"Missing {path.relative_to(ROOT)}")
        return None
    text = path.read_text(encoding="utf-8")
    match = re.match(rf"window\.{re.escape(global_name)} = (.*);\s*$", text, re.S)
    if not match:
        report.error(f"{label} does not assign window.{global_name}")
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        report.error(f"{label} is not valid JSON: {exc}")
        return None


def check_files(report: Report) -> None:
    for path in [
        DIST / "index.html",
        DIST / "styles.css",
        DIST / "app.js",
        JSON_DATA,
        FEDERAL_DATA,
        CURATION,
        DIST / "assets" / "te-atlas.png",
        DIST / "assets" / "te-seal.png",
        DIST / "assets" / "phase10-map.png",
    ]:
        if not path.exists():
            report.error(f"Missing required file: {path.relative_to(ROOT)}")


def check_public_sites(payload: dict, report: Report) -> None:
    sites = payload.get("publicSites", [])
    release_bar = payload.get("releaseBar", {})
    minimum = release_bar.get("minimumPublicSites", 1)
    vocabulary = set(payload.get("verificationVocabulary", []))
    typology = payload.get("typology", {})

    if len(sites) < minimum:
        report.error(f"Expected at least {minimum} public sites, found {len(sites)}")
    ids = [site.get("id") for site in sites]
    if len(ids) != len(set(ids)):
        report.error("Duplicate public site ids")
    for site_id in ids:
        if not site_id or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", site_id):
            report.error(f"Public site id is not a stable slug: {site_id!r}")
    if not vocabulary:
        report.error("Payload is missing the verification vocabulary")

    for site in sites:
        label = site.get("name") or site.get("id")
        # Structural: these break the page or the map, so they always fail.
        if not site.get("closureYear"):
            report.error(f"{label}: missing closureYear")
        if site.get("latitude") is None or site.get("longitude") is None:
            report.error(f"{label}: missing coordinates")
        if site.get("morphology") not in typology:
            report.error(f"{label}: morphology {site.get('morphology')!r} is not in the typology")
        if vocabulary and site.get("verification") not in vocabulary:
            report.error(f"{label}: verification {site.get('verification')!r} is outside the controlled vocabulary")
        # Release gates: reported, enforced only with --release.
        for gap in site.get("releaseGaps", []):
            report.gap(f"{label}: {gap}")

    # The generated gap list and the data must agree, or the page lies.
    recomputed = sum(len(site.get("releaseGaps", [])) for site in sites)
    reported = sum(release_bar.get("gapCounts", {}).values())
    if recomputed != reported:
        report.error("releaseBar gap counts do not match per-site releaseGaps")


def check_curation(payload: dict, report: Report) -> None:
    if not CURATION.exists():
        return
    try:
        curation = json.loads(CURATION.read_text(encoding="utf-8")).get("sites", {})
    except json.JSONDecodeError as exc:
        report.error(f"curation/public-sites.json is not valid JSON: {exc}")
        return
    site_ids = {site.get("id") for site in payload.get("publicSites", [])}
    for curated_id, entry in curation.items():
        if curated_id not in site_ids:
            report.error(f"curation entry {curated_id!r} does not match any public site id")
        for url in entry.get("sourceUrls", []):
            if not re.match(r"^https?://", str(url)):
                report.error(f"curation entry {curated_id!r} has a non-URL in sourceUrls: {url!r}")


def check_federal(payload: dict, report: Report) -> None:
    abyss = payload.get("abyss", {})
    federal_source = payload.get("sourceFreshness", {}).get("fsaClosedSchoolSearch", {})
    total_records = abyss.get("totalRecords")
    normalized_rows = federal_source.get("normalizedRows")
    if not isinstance(total_records, int) or total_records < 10000:
        report.error("Unexpectedly small PEPS abyss record count")
    if normalized_rows is not None and total_records != normalized_rows:
        report.error("PEPS abyss record count does not match source freshness metadata")
    if payload.get("federalRecordCount") != total_records:
        report.error("Federal record count does not match PEPS abyss record count")
    federal_records = load_js_payload(FEDERAL_DATA, "DEAD_CAMPUS_FEDERAL_RECORDS", "Federal data file", report)
    if federal_records is not None and len(federal_records) != total_records:
        report.error("Federal record table does not match PEPS abyss record count")
    reported_age_days = federal_source.get("reportedAgeDays")
    if isinstance(reported_age_days, int) and reported_age_days > MAX_SOURCE_AGE_DAYS:
        report.error(f"FSA closed-school source is stale ({reported_age_days} days)")


def check_page(report: Report) -> None:
    html_path = DIST / "index.html"
    app_path = DIST / "app.js"
    if not html_path.exists() or not app_path.exists():
        return
    html = html_path.read_text(encoding="utf-8")
    app = app_path.read_text(encoding="utf-8")
    for reference in ["styles.css", "data/atlas-data.js", "app.js"]:
        if reference not in html:
            report.error(f"index.html does not reference {reference}")
    if "data/federal-records.js" in html:
        report.error("index.html loads data/federal-records.js eagerly; app.js should load it on demand")
    if "data/federal-records.js" not in app:
        report.error("app.js does not load data/federal-records.js")


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate the static Dead Campus Atlas bundle.")
    parser.add_argument(
        "--release",
        action="store_true",
        help="Fail when any public site has release gaps, not only on structural errors.",
    )
    args = parser.parse_args()

    report = Report()
    check_files(report)
    payload = load_js_payload(DATA, "DEAD_CAMPUS_ATLAS", "Data file", report)
    if payload is not None:
        check_public_sites(payload, report)
        check_curation(payload, report)
        check_federal(payload, report)
    check_page(report)

    if report.gaps:
        print(f"Release gaps ({len(report.gaps)}):")
        for gap in report.gaps:
            print(f"  - {gap}")
    if report.errors:
        print(f"Errors ({len(report.errors)}):", file=sys.stderr)
        for error in report.errors:
            print(f"  - {error}", file=sys.stderr)
        raise SystemExit(1)
    if args.release and report.gaps:
        raise SystemExit("Release validation failed: public sites still have gaps")

    if payload is not None:
        bar = payload.get("releaseBar", {})
        print(
            f"Static atlas validation passed: {bar.get('publicSites')} public sites, "
            f"{bar.get('releaseReady')} release-ready"
        )
    else:
        print("Static atlas validation passed")


if __name__ == "__main__":
    main()
