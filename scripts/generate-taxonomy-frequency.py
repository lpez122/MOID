#!/usr/bin/env python3

import csv
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = (
    PROJECT_ROOT.parent
    / "images_finalized_AI_built"
    / "archive"
    / "done_framed_nearedge_level123_box_manifest.csv"
)
TAXONOMY_PATH = PROJECT_ROOT / "public" / "taxonomy.json"
OUTPUT_PATH = PROJECT_ROOT / "public" / "taxonomy-frequency.json"


def main() -> None:
    taxonomy = json.loads(TAXONOMY_PATH.read_text())
    counts: Counter[str] = Counter()

    with MANIFEST_PATH.open(newline="") as handle:
        for row in csv.DictReader(handle):
            counts[row["category_path"]] += 1

    taxonomy_paths = {
        concept["id"]
        for category in taxonomy["categories"]
        for group in category["groups"]
        for concept in group["concepts"]
    }
    unknown_paths = sorted(set(counts) - taxonomy_paths)
    if unknown_paths:
        raise ValueError(
            f"Manifest contains {len(unknown_paths)} paths outside taxonomy.json: "
            f"{unknown_paths[:5]}"
        )

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceManifest": MANIFEST_PATH.name,
        "stats": {
            "images": sum(counts.values()),
            "coveredConcepts": sum(counts[path] > 0 for path in taxonomy_paths),
            "concepts": len(taxonomy_paths),
        },
        "counts": {path: counts[path] for path in sorted(taxonomy_paths)},
    }
    OUTPUT_PATH.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
    print(
        f"Wrote {payload['stats']['images']:,} images across "
        f"{payload['stats']['coveredConcepts']:,} covered labels to {OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()
