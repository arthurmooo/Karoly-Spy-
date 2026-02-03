#!/usr/bin/env python3
"""
Surgical Validation Script for 4 Témoins

This script validates the interval matcher against 4 real-world test cases
with strict tolerances:
- Duration: ±1-5s
- Speed: ±0.05 m/s
- HR: ±1 bpm
- Interval count: EXACT

Run with: python scripts/validate_4_temoins.py
"""

import json
import sys
from pathlib import Path
import numpy as np

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.processing.interval_matcher import IntervalMatcher

TEST_DATA_DIR = PROJECT_ROOT / "data" / "test_cache"
GROUND_TRUTH_PATH = TEST_DATA_DIR / "benchmark_ground_truth.json"


def load_ground_truth():
    """Load ground truth data."""
    if GROUND_TRUTH_PATH.exists():
        with open(GROUND_TRUTH_PATH) as f:
            return json.load(f)
    return {}


def validate_adrien():
    """Validate Témoin A: Adrien 10×2' Z3."""
    print("\n" + "="*60)
    print("TÉMOIN A: Adrien - 10×2' Z3 / r 1'")
    print("="*60)

    fit_path = TEST_DATA_DIR / "Adrien_2026-01-07.fit"
    json_path = TEST_DATA_DIR / "Adrien_2026-01-07.json"

    if not fit_path.exists():
        print("  SKIP: Fichier FIT non trouvé")
        return None

    # Parse data
    df, session, laps = UniversalParser.parse(str(fit_path))
    with open(json_path) as f:
        plan_data = json.load(f)

    # Parse plan and match
    parser = NolioPlanParser()
    target_grid = parser.parse(plan_data["planned_structure"], sport_type="run")
    matcher = IntervalMatcher()
    results = matcher.match(df, target_grid, sport="run", laps=laps)

    # Filter work intervals (120s)
    work = [r for r in results if r.get('expected_duration') == 120]

    errors = []

    # Test 1: Count
    if len(work) != 10:
        errors.append(f"Nombre d'intervalles: {len(work)} (attendu: 10)")
    else:
        print(f"  ✓ Nombre d'intervalles: {len(work)} = 10")

    if work:
        last = work[-1]

        # Test 2: Duration
        dur = last.get('duration_sec', 0)
        if abs(dur - 120) > 1:
            errors.append(f"Durée dernier: {dur}s (attendu: 120 ±1s)")
        else:
            print(f"  ✓ Durée dernier: {dur}s")

        # Test 3: Speed
        speed = last.get('avg_speed', 0)
        if abs(speed - 5.266) > 0.05:
            errors.append(f"Vitesse dernier: {speed:.3f} m/s (attendu: 5.266 ±0.05)")
        else:
            print(f"  ✓ Vitesse dernier: {speed:.3f} m/s")

        # Test 4: HR
        hr = last.get('avg_hr', 0)
        if abs(hr - 162.35) > 1:
            errors.append(f"HR dernier: {hr:.2f} bpm (attendu: 162.35 ±1)")
        else:
            print(f"  ✓ HR dernier: {hr:.2f} bpm")

        # Test 5: Average speed
        avg_speed = np.mean([r.get('avg_speed', 0) for r in work if r.get('avg_speed')])
        if abs(avg_speed - 5.15) > 0.1:
            errors.append(f"Moyenne vitesse: {avg_speed:.3f} m/s (attendu: ~5.15)")
        else:
            print(f"  ✓ Moyenne vitesse: {avg_speed:.3f} m/s")

    if errors:
        print(f"\n  ÉCHEC ({len(errors)} erreurs):")
        for e in errors:
            print(f"    ✗ {e}")
        return False

    print("\n  SUCCÈS: Tous les tests passent!")
    return True


def validate_baptiste():
    """Validate Témoin B: Baptiste - Session incomplète."""
    print("\n" + "="*60)
    print("TÉMOIN B: Baptiste - Session incomplète")
    print("="*60)

    fit_path = TEST_DATA_DIR / "Baptiste_2026-01-09.fit"
    json_path = TEST_DATA_DIR / "Baptiste_2026-01-09.json"

    if not fit_path.exists():
        print("  SKIP: Fichier FIT non trouvé")
        return None

    # Parse data
    df, session, laps = UniversalParser.parse(str(fit_path))
    with open(json_path) as f:
        plan_data = json.load(f)

    # Parse plan and match
    parser = NolioPlanParser()
    target_grid = parser.parse(plan_data["planned_structure"], sport_type="run")
    matcher = IntervalMatcher()
    results = matcher.match(df, target_grid, sport="run", laps=laps)

    # Detect incomplete session
    status = matcher.detect_incomplete_session(results, target_grid, df)

    errors = []

    # Test 1: Session marked incomplete
    if status['is_complete']:
        errors.append("Session marquée complète (attendu: incomplète)")
    else:
        print(f"  ✓ Session incomplète détectée")

    # Test 2: Matched < Expected
    if status['matched_count'] >= status['expected_count']:
        errors.append(f"Pas d'abandon détecté: {status['matched_count']}/{status['expected_count']}")
    else:
        print(f"  ✓ Abandon détecté: {status['matched_count']}/{status['expected_count']}")

    # Test 3: Completion ratio - should be less than 1.0
    ratio = status['completion_ratio']
    if ratio >= 1.0:
        errors.append(f"Ratio: {ratio:.2f} (attendu: <1.0 pour session incomplète)")
    elif ratio < 0.5:
        errors.append(f"Ratio: {ratio:.2f} (attendu: >0.5)")
    else:
        print(f"  ✓ Ratio completion: {ratio:.2f} (<1.0)")

    if errors:
        print(f"\n  ÉCHEC ({len(errors)} erreurs):")
        for e in errors:
            print(f"    ✗ {e}")
        return False

    print("\n  SUCCÈS: Tous les tests passent!")
    return True


def validate_alexis():
    """Validate Témoin C: Alexis/Bernard - 5×(1'30 + 3'30) fusionnés."""
    print("\n" + "="*60)
    print("TÉMOIN C: Alexis - 5×(1'30'' Z3 + 3'30'' Z2) FUSIONNÉS")
    print("="*60)

    fit_path = TEST_DATA_DIR / "Alexis_2025-10-17.fit"
    json_path = TEST_DATA_DIR / "Bernard_2025-10-17.json"

    if not fit_path.exists():
        print("  SKIP: Fichier FIT non trouvé")
        return None

    # Parse data
    df, session, laps = UniversalParser.parse(str(fit_path))
    with open(json_path) as f:
        plan_data = json.load(f)

    # Parse plan WITH merge
    parser = NolioPlanParser()
    target_grid = parser.parse(
        plan_data["planned_structure"],
        sport_type="run",
        merge_adjacent_work=True
    )

    matcher = IntervalMatcher()
    results = matcher.match(df, target_grid, sport="run", laps=laps)

    errors = []

    # Test 1: 5 fused blocks in target
    if len(target_grid) != 5:
        errors.append(f"Plan fusionné: {len(target_grid)} blocs (attendu: 5)")
    else:
        print(f"  ✓ Plan fusionné: {len(target_grid)} blocs")

    # Test 2: Block durations
    for i, block in enumerate(target_grid):
        dur = block.get('duration', 0)
        if abs(dur - 300) > 2:
            errors.append(f"Bloc {i+1} durée: {dur}s (attendu: 300 ±2s)")
        else:
            print(f"  ✓ Bloc {i+1} durée: {dur}s")

    # Test 3: Matched results
    if len(results) != 5:
        errors.append(f"Intervalles matchés: {len(results)} (attendu: 5)")
    else:
        print(f"  ✓ Intervalles matchés: {len(results)}")

    if errors:
        print(f"\n  ÉCHEC ({len(errors)} erreurs):")
        for e in errors:
            print(f"    ✗ {e}")
        return False

    print("\n  SUCCÈS: Tous les tests passent!")
    return True


def validate_dries():
    """Validate Témoin D: Dries - 2×9km Tempo."""
    print("\n" + "="*60)
    print("TÉMOIN D: Dries - 2×9km Tempo / r 2km")
    print("="*60)

    gt = load_ground_truth().get("Dries_2026-01-17", [])
    fit_path = TEST_DATA_DIR / "Dries_2026-01-17.fit"

    if not fit_path.exists():
        print("  SKIP: Fichier FIT non trouvé")
        return None

    # Parse data
    df, session, laps = UniversalParser.parse(str(fit_path))

    # Manual target grid for 2×tempo
    target_grid = [
        {"duration": 2000, "target_type": "pace", "type": "active", "target_min": 4.0},
        {"duration": 2000, "target_type": "pace", "type": "active", "target_min": 4.0}
    ]

    matcher = IntervalMatcher()
    results = matcher.match(df, target_grid, sport="run", laps=laps)

    errors = []

    # Test 1: Count
    if len(results) != 2:
        errors.append(f"Nombre d'intervalles: {len(results)} (attendu: 2)")
    else:
        print(f"  ✓ Nombre d'intervalles: {len(results)}")

    if len(results) >= 2:
        r1, r2 = results[0], results[1]

        # Expected from ground truth
        expected = {
            'r1': {'duration': 2001, 'speed': 4.499, 'hr': 154.96},
            'r2': {'duration': 1960, 'speed': 4.608, 'hr': 158.12}
        }

        # Bloc 1 tests
        dur1 = r1.get('duration_sec', 0)
        if abs(dur1 - expected['r1']['duration']) > 5:
            errors.append(f"Durée bloc 1: {dur1}s (attendu: {expected['r1']['duration']} ±5)")
        else:
            print(f"  ✓ Durée bloc 1: {dur1}s")

        speed1 = r1.get('avg_speed', 0)
        if abs(speed1 - expected['r1']['speed']) > 0.05:
            errors.append(f"Vitesse bloc 1: {speed1:.3f} (attendu: {expected['r1']['speed']} ±0.05)")
        else:
            print(f"  ✓ Vitesse bloc 1: {speed1:.3f} m/s")

        hr1 = r1.get('avg_hr', 0)
        if abs(hr1 - expected['r1']['hr']) > 1:
            errors.append(f"HR bloc 1: {hr1:.2f} (attendu: {expected['r1']['hr']} ±1)")
        else:
            print(f"  ✓ HR bloc 1: {hr1:.2f} bpm")

        # Bloc 2 tests
        dur2 = r2.get('duration_sec', 0)
        if abs(dur2 - expected['r2']['duration']) > 5:
            errors.append(f"Durée bloc 2: {dur2}s (attendu: {expected['r2']['duration']} ±5)")
        else:
            print(f"  ✓ Durée bloc 2: {dur2}s")

        speed2 = r2.get('avg_speed', 0)
        if abs(speed2 - expected['r2']['speed']) > 0.05:
            errors.append(f"Vitesse bloc 2: {speed2:.3f} (attendu: {expected['r2']['speed']} ±0.05)")
        else:
            print(f"  ✓ Vitesse bloc 2: {speed2:.3f} m/s")

        hr2 = r2.get('avg_hr', 0)
        if abs(hr2 - expected['r2']['hr']) > 1:
            errors.append(f"HR bloc 2: {hr2:.2f} (attendu: {expected['r2']['hr']} ±1)")
        else:
            print(f"  ✓ HR bloc 2: {hr2:.2f} bpm")

    if errors:
        print(f"\n  ÉCHEC ({len(errors)} erreurs):")
        for e in errors:
            print(f"    ✗ {e}")
        return False

    print("\n  SUCCÈS: Tous les tests passent!")
    return True


def main():
    """Run all validations."""
    print("\n" + "#"*60)
    print("# VALIDATION CHIRURGICALE - 4 TÉMOINS")
    print("# Tolerances: Duration ±1-5s, Speed ±0.05 m/s, HR ±1 bpm")
    print("#"*60)

    results = {
        'Adrien': validate_adrien(),
        'Baptiste': validate_baptiste(),
        'Alexis': validate_alexis(),
        'Dries': validate_dries()
    }

    # Summary
    print("\n" + "="*60)
    print("RÉSUMÉ")
    print("="*60)

    passed = sum(1 for v in results.values() if v is True)
    skipped = sum(1 for v in results.values() if v is None)
    failed = sum(1 for v in results.values() if v is False)

    for name, result in results.items():
        if result is True:
            print(f"  ✓ {name}: SUCCÈS")
        elif result is False:
            print(f"  ✗ {name}: ÉCHEC")
        else:
            print(f"  - {name}: SKIP")

    print(f"\nTotal: {passed} succès, {failed} échecs, {skipped} skips")

    if failed > 0:
        print("\n⚠️  VALIDATION ÉCHOUÉE - Corrections requises")
        return 1
    elif passed == 4:
        print("\n✅ VALIDATION RÉUSSIE - Précision chirurgicale atteinte!")
        return 0
    else:
        print("\n⚠️  Certains tests ont été ignorés (données manquantes)")
        return 0


if __name__ == "__main__":
    sys.exit(main())
