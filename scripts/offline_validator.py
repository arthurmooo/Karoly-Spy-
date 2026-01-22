#!/usr/bin/env python3
"""
Offline Validator for Interval Matcher V2

Tests the interval detection engine against all cached test files.
Provides detailed output and validation metrics.

Usage:
    python scripts/offline_validator.py [--file NAME] [--verbose]
"""

import sys
import os
import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Tuple

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.processing.parser import FitParser
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.processing.interval_matcher import IntervalMatcher, MatchStatus, MatchSource, MatchConfig

# Test data directory
TEST_CACHE_DIR = Path(__file__).parent.parent / "data" / "test_cache"

# Expected results for validation
# NOTE: Some files have known limitations:
# - Baptiste_2026-01-08: TCX file (not FIT), will fail to parse
# - Cyril_2025-08-11: Swimming with no speed/power data
EXPECTED_RESULTS = {
    "Adrien_2026-01-07": {
        "description": "10x2' Z3 avec 2 ramp_up",
        "expected_intervals": 12,  # 2 ramp_up + 10 active
        "expected_matched": 12,
        "key_check": "12 intervalles à ~5.14 m/s (3:14/km)",
        "sport": "run",
    },
    "Baptiste_2025-12-14": {
        "description": "3x4km Tempo (distance-based)",
        "expected_intervals": 3,
        "expected_matched": 3,
        "key_check": "3 blocs tempo à ~4.6-4.8 m/s",
        "sport": "run",
    },
    "Baptiste_2026-01-08": {
        "description": "10x1' + 5x2' + 10' (FICHIER TCX - NON SUPPORTÉ)",
        "expected_intervals": 18,
        "expected_matched": 0,  # Will fail - TCX not supported
        "key_check": "⚠️ Fichier TCX, pas FIT - skip",
        "sport": "run",
        "skip": True,
    },
    "Baptiste_2026-01-09": {
        "description": "10x1' + 5x2' + 10' (fait la moitié)",
        "expected_intervals": 18,
        "expected_matched": 13,  # 10x1' + 3x2' réellement faits (pas les 2 derniers 2' ni le 10')
        "key_check": "~13-15 matched, 3-5 NOT_FOUND (normal)",
        "sport": "run",
    },
    "Bernard_2025-10-17": {
        "description": "5x(1'30 Z3 + 3'30 Z2)",
        "expected_intervals": 10,
        "expected_matched": 10,
        "key_check": "Alternance haute/moyenne intensité",
        "sport": "run",
    },
    "Cyril_2025-08-11": {
        "description": "Natation 6x50m + 8x200m (PAS DE DONNÉES SPEED)",
        "expected_intervals": 14,
        "expected_matched": 0,  # No speed/power in swimming FIT
        "key_check": "⚠️ Natation sans données vitesse - skip",
        "sport": "swim",
        "skip": True,
    },
    "Cyril_2025-08-17": {
        "description": "35km Waves (3x10km progressif)",
        "expected_intervals": 3,
        "expected_matched": 3,
        "key_check": "3 blocs très longs basés distance (~40min chacun)",
        "sport": "run",
    },
    "Cyril_2025-10-12": {
        "description": "4x20' progressif",
        "expected_intervals": 4,
        "expected_matched": 4,
        "key_check": "4 blocs de 20min progressifs",
        "sport": "run",
    },
    "Dries_2026-01-11": {
        "description": "2x50' LT1 vélo (MODIFIÉ par athlète: 3x30')",
        "expected_intervals": 2,
        "expected_matched": 1,  # Athlete did 3x30 not 2x50, plan doesn't match reality
        "key_check": "⚠️ Athlète a modifié: 3x30' fait, 2x50' planifié - 1 match partiel OK",
        "sport": "bike",
    },
    "Hadrien_2025-10-07": {
        "description": "Test 5' (structure vide)",
        "expected_intervals": 0,
        "expected_matched": 0,
        "key_check": "Structure vide - rien à détecter",
        "sport": "run",
    },
}


def speed_to_pace(speed_ms: float) -> str:
    """Convert m/s to min/km string."""
    if speed_ms <= 0:
        return "N/A"
    pace_sec_per_km = 1000 / speed_ms
    mins = int(pace_sec_per_km // 60)
    secs = int(pace_sec_per_km % 60)
    return f"{mins}:{secs:02d}/km"


def load_test_case(name: str) -> Tuple[Any, Dict, Dict]:
    """Load FIT file and JSON for a test case."""
    fit_path = TEST_CACHE_DIR / f"{name}.fit"
    json_path = TEST_CACHE_DIR / f"{name}.json"
    
    if not fit_path.exists() or not json_path.exists():
        raise FileNotFoundError(f"Test files not found for {name}")
    
    # Parse FIT
    df, meta, laps = FitParser.parse(str(fit_path))
    
    # Load JSON
    with open(json_path, 'r') as f:
        nolio_data = json.load(f)
    
    expected = EXPECTED_RESULTS.get(name, {})
    
    return df, nolio_data, expected, laps


def run_validation(name: str, verbose: bool = False) -> Dict[str, Any]:
    """Run validation for a single test case."""
    print(f"\n{'='*60}")
    print(f"📋 {name}")
    print('='*60)
    
    # Check if this case should be skipped BEFORE loading files
    expected = EXPECTED_RESULTS.get(name, {})
    if expected.get('skip'):
        print(f"⏭️ SKIP: {expected.get('key_check', 'Known limitation')}")
        return {
            "name": name, 
            "status": "⏭️ SKIP", 
            "matched": 0, 
            "expected": expected.get('expected_matched', 0),
            "skipped": True
        }
    
    try:
        df, nolio_data, expected, laps = load_test_case(name)
    except (FileNotFoundError, Exception) as e:
        print(f"❌ Error: {e}")
        return {"name": name, "status": "error", "error": str(e), "matched": 0, "expected": 0}
    
    print(f"📝 {expected.get('description', 'No description')}")
    print(f"🎯 Attendu: ~{expected.get('expected_matched', '?')} intervalles matchés")
    print(f"🔍 Check: {expected.get('key_check', '')}")
    
    # Parse plan
    parser = NolioPlanParser()
    structure = nolio_data.get('planned_structure', [])
    sport = expected.get('sport', 'run')
    target_grid = parser.parse(structure, sport_type=sport)
    
    print(f"\n📊 Signal disponible:")
    print(f"   - Durée: {len(df)} secondes ({len(df)//60} min)")
    print(f"   - Speed: {'✓' if 'speed' in df.columns and df['speed'].notna().sum() > 0 else '✗'}")
    print(f"   - Power: {'✓' if 'power' in df.columns and df['power'].notna().sum() > 0 else '✗'}")
    print(f"   - HR: {'✓' if 'heart_rate' in df.columns and df['heart_rate'].notna().sum() > 0 else '✗'}")
    
    print(f"\n🎯 Target Grid ({len(target_grid)} intervalles à chercher):")
    for i, t in enumerate(target_grid[:5]):  # Show first 5
        dur = t.get('duration', 0)
        t_min = t.get('target_min', 0)
        t_type = t.get('type', 'active')
        
        if t.get('target_type') == 'power':
            target_str = f"{t_min:.0f}W" if t_min else "N/A"
        elif t_min:
            target_str = f"{t_min:.2f} m/s ({speed_to_pace(t_min)})"
        else:
            target_str = "N/A"
        
        print(f"   [{i}] {t_type}: {dur}s @ {target_str}")
    
    if len(target_grid) > 5:
        print(f"   ... et {len(target_grid) - 5} de plus")
    
    # Run matcher with LAPs
    matcher = IntervalMatcher()
    results = matcher.match(df, target_grid, sport=sport, laps=laps)
    
    # Analyze results
    matched = [r for r in results if r['status'] == MatchStatus.MATCHED.value]
    not_found = [r for r in results if r['status'] == MatchStatus.NOT_FOUND.value]
    
    # Count sources
    lap_matched = [r for r in matched if r.get('source') == MatchSource.LAP.value]
    signal_matched = [r for r in matched if r.get('source') == MatchSource.SIGNAL.value]
    
    print(f"\n📈 Résultats:")
    print(f"   ✅ Matched: {len(matched)} (LAP: {len(lap_matched)}, Signal: {len(signal_matched)})")
    print(f"   ❌ Not Found: {len(not_found)}")
    
    # Show matched intervals
    if verbose or len(matched) <= 10:
        print(f"\n📍 Intervalles détectés:")
        for r in matched:
            dur = r['duration_sec']
            exp_dur = r['expected_duration']
            
            # Format metrics
            if r.get('plateau_avg_power'):
                metric_str = f"{r['plateau_avg_power']:.0f}W"
            elif r.get('plateau_avg_speed'):
                metric_str = f"{r['plateau_avg_speed']:.2f} m/s ({speed_to_pace(r['plateau_avg_speed'])})"
            elif r.get('avg_speed'):
                metric_str = f"{r['avg_speed']:.2f} m/s ({speed_to_pace(r['avg_speed'])})"
            else:
                metric_str = "N/A"
            
            respect = r.get('respect_score')
            respect_str = f"{respect:.0f}%" if respect else "N/A"
            
            hr_str = f"{r['avg_hr']:.0f}bpm" if r.get('avg_hr') else ""
            
            # Source indicator
            source = r.get('source', 'signal')
            src_icon = "🎯" if source == 'lap' else "📉"
            conf_str = f"{r['confidence']:.0%}" if r.get('confidence') else ""
            
            print(f"   {src_icon}[{r['target_index']:2d}] {r['start_index']:5d}-{r['end_index']:5d} "
                  f"({dur:3d}s/{exp_dur:3d}s) | {metric_str:20s} | {respect_str:5s} {hr_str} {conf_str}")
    
    # Show not found
    if not_found and (verbose or len(not_found) <= 5):
        print(f"\n⚠️ Intervalles non trouvés:")
        for r in not_found:
            target = r.get('target', {})
            t_min = target.get('target_min', 0)
            print(f"   [{r['target_index']:2d}] Attendu: {r['expected_duration']}s @ {t_min:.2f}")
    
    # Validation - use expected_matched if available
    expected_matched = expected.get('expected_matched', expected.get('expected_intervals', len(target_grid)))
    
    # Calculate success rate
    if len(target_grid) > 0:
        success_rate = len(matched) / len(target_grid) * 100
    else:
        success_rate = 100.0 if len(results) == 0 else 0.0
    
    # Status based on expected_matched
    if expected_matched == 0:
        status = "✅ PASS" if len(matched) == 0 else "⚠️ PARTIAL"
    elif len(matched) >= expected_matched * 0.9:  # 90% of expected
        status = "✅ PASS"
    elif len(matched) >= expected_matched * 0.6:
        status = "⚠️ PARTIAL"
    else:
        status = "❌ FAIL"
    
    print(f"\n{status} - {len(matched)}/{expected_matched} attendus ({success_rate:.0f}% du grid)")
    
    return {
        "name": name,
        "status": status,
        "expected": expected_matched,
        "matched": len(matched),
        "not_found": len(not_found),
        "success_rate": success_rate,
        "results": results
    }


def main():
    parser = argparse.ArgumentParser(description="Validate interval matcher")
    parser.add_argument("--file", "-f", help="Specific file to test (without extension)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = parser.parse_args()
    
    print("="*60)
    print("🏃 INTERVAL MATCHER V2 - OFFLINE VALIDATOR")
    print("="*60)
    
    if args.file:
        # Single file test
        results = [run_validation(args.file, verbose=args.verbose)]
    else:
        # Test all files
        results = []
        for name in EXPECTED_RESULTS.keys():
            try:
                result = run_validation(name, verbose=args.verbose)
                results.append(result)
            except Exception as e:
                print(f"\n💥 Crash on {name}: {e}")
                results.append({"name": name, "status": "crash", "error": str(e)})
    
    # Summary
    print("\n" + "="*60)
    print("📊 RÉSUMÉ FINAL")
    print("="*60)
    
    passed = sum(1 for r in results if "PASS" in r.get("status", ""))
    partial = sum(1 for r in results if "PARTIAL" in r.get("status", ""))
    failed = sum(1 for r in results if "FAIL" in r.get("status", "") or r.get("status") in ["error", "crash"])
    
    for r in results:
        name = r.get("name", "?")
        status = r.get("status", "?")
        matched = r.get("matched", 0)
        expected = r.get("expected", 0)
        print(f"   {status:12s} {name:25s} ({matched}/{expected} intervalles)")
    
    print(f"\n   Total: {passed}✅ {partial}⚠️ {failed}❌")
    
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
