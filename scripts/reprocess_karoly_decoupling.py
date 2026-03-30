#!/usr/bin/env python3
"""
Reprocess activities to realign Karoly decoupling and durability semantics.

Examples:
  python scripts/reprocess_karoly_decoupling.py --offline --force
  python scripts/reprocess_karoly_decoupling.py --athlete Romain --offline --force
"""

import argparse
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from projectk_core.logic.reprocessor import ReprocessingEngine


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Reprocess activities to refresh decoupling_index, segmented_metrics, durability_index and form_analysis."
    )
    parser.add_argument("--athlete", type=str, help="Filter by athlete first name")
    parser.add_argument("--force", action="store_true", help="Force recalculation even when form_analysis already exists")
    parser.add_argument("--offline", action="store_true", help="Disable Nolio API calls and rely on stored activity data")
    args = parser.parse_args()

    engine = ReprocessingEngine(offline_mode=args.offline)
    engine.run(athlete_name_filter=args.athlete, force=args.force)


if __name__ == "__main__":
    main()
