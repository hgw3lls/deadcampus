#!/usr/bin/env python3
"""Validate the static atlas bundle."""

from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
DATA = DIST / "data" / "atlas-data.js"
JSON_DATA = DIST / "data" / "canonical-atlas.json"


def fail(message: str) -> None:
    raise SystemExit(message)


def load_payload() -> dict:
    if not DATA.exists():
        fail("Missing dist/data/atlas-data.js")
    text = DATA.read_text(encoding="utf-8")
    match = re.match(r"window\.DEAD_CAMPUS_ATLAS = (.*);\s*$", text, re.S)
    if not match:
        fail("Data file does not assign window.DEAD_CAMPUS_ATLAS")
    return json.loads(match.group(1))


def main() -> None:
    for path in [
        DIST / "index.html",
        DIST / "styles.css",
        DIST / "app.js",
        JSON_DATA,
        DIST / "assets" / "te-atlas.png",
        DIST / "assets" / "te-seal.png",
        DIST / "assets" / "phase10-map.png",
    ]:
        if not path.exists():
            fail(f"Missing required asset: {path}")

    payload = load_payload()
    sites = payload.get("publicSites", [])
    if len(sites) != 34:
        fail(f"Expected 34 public sites, found {len(sites)}")
    ids = [site.get("id") for site in sites]
    if len(ids) != len(set(ids)):
        fail("Duplicate public site ids")
    if any(not site.get("closureYear") for site in sites):
        fail("A public site is missing closureYear")
    if any(site.get("latitude") is None or site.get("longitude") is None for site in sites):
        fail("A public site is missing coordinates")
    if payload.get("abyss", {}).get("totalRecords") != 11408:
        fail("Unexpected PEPS abyss record count")

    html = (DIST / "index.html").read_text(encoding="utf-8")
    for reference in ["styles.css", "data/atlas-data.js", "app.js"]:
        if reference not in html:
            fail(f"index.html does not reference {reference}")

    print("Static atlas validation passed")


if __name__ == "__main__":
    main()
