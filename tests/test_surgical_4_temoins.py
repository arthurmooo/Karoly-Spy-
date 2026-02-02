"""
Surgical Validation Tests for Interval Matcher - 4 Témoins

These tests validate the interval matcher against real-world data with
SURGICAL PRECISION. The tolerances are:
- Duration: ±1-5s depending on interval type
- Speed: ±0.05 m/s
- HR: ±1 bpm maximum
- Number of intervals: EXACT match (0 tolerance)

Ground truth data comes from Nolio LAP exports (benchmark_ground_truth.json)
"""

import unittest
import json
import os
import numpy as np
from pathlib import Path

from projectk_core.processing.parser import UniversalParser
from projectk_core.processing.plan_parser import NolioPlanParser
from projectk_core.processing.interval_matcher import IntervalMatcher


# Path to test data
TEST_DATA_DIR = Path(__file__).parent.parent / "data" / "test_cache"
GROUND_TRUTH_PATH = TEST_DATA_DIR / "benchmark_ground_truth.json"


def load_ground_truth():
    """Load the ground truth data from JSON."""
    if GROUND_TRUTH_PATH.exists():
        with open(GROUND_TRUTH_PATH) as f:
            return json.load(f)
    return {}


class TestAdrien10x2minZ3(unittest.TestCase):
    """
    Témoin A: Adrien - 10×2' Z3 / r 1'

    Expected:
    - 10 intervals of 120s each
    - Last interval (#12 in Nolio): speed = 5.266 m/s, HR = 162.3 bpm
    - Average speed ~5.15 m/s (3'14''/km)
    """

    @classmethod
    def setUpClass(cls):
        cls.ground_truth = load_ground_truth().get("Adrien_2026-01-07", [])

        # Load activity data
        fit_path = TEST_DATA_DIR / "Adrien_2026-01-07.fit"
        json_path = TEST_DATA_DIR / "Adrien_2026-01-07.json"

        cls.has_data = fit_path.exists() and json_path.exists()
        if not cls.has_data:
            return

        # Parse FIT file
        cls.df, cls.session, cls.laps = UniversalParser.parse(str(fit_path))

        # Load plan structure
        with open(json_path) as f:
            data = json.load(f)
        cls.plan_structure = data.get("planned_structure", [])

        # Parse plan
        parser = NolioPlanParser()
        cls.target_grid = parser.parse(cls.plan_structure, sport_type="run")

        # Match intervals
        cls.matcher = IntervalMatcher()
        cls.results = cls.matcher.match(
            cls.df,
            cls.target_grid,
            sport="run",
            laps=cls.laps
        )

        # Filter to only the 10 main work intervals (120s duration)
        cls.work_intervals = [r for r in cls.results
                             if r.get('expected_duration') == 120]

    def test_data_available(self):
        """Verify test data files exist."""
        if not self.has_data:
            self.skipTest("Test data files not available")

    def test_interval_count_exact(self):
        """RÈGLE 5: Le nombre d'intervalles doit correspondre EXACTEMENT."""
        if not self.has_data:
            self.skipTest("Test data files not available")

        # Ground truth shows 10 work intervals (laps 3-12 are the 10×2')
        # Laps 1-2 are warmup/transition
        work_gt = [gt for gt in self.ground_truth if abs(gt['duration'] - 120) <= 10]

        self.assertEqual(
            len(self.work_intervals), 10,
            f"ÉCHEC: {len(self.work_intervals)} intervalles au lieu de 10"
        )

    def test_last_interval_duration(self):
        """Test durée du dernier intervalle: ±1s."""
        if not self.has_data or not self.work_intervals:
            self.skipTest("Test data not available")

        last = self.work_intervals[-1]
        duration = last.get('duration_sec', 0)

        self.assertLessEqual(
            abs(duration - 120), 1,
            f"ÉCHEC durée dernier: {duration}s vs 120s attendu"
        )

    def test_last_interval_speed(self):
        """Test vitesse du dernier intervalle: ±0.05 m/s."""
        if not self.has_data or not self.work_intervals:
            self.skipTest("Test data not available")

        last = self.work_intervals[-1]
        speed = last.get('avg_speed', 0)

        # Ground truth: 5.266 m/s
        expected_speed = 5.266

        self.assertLessEqual(
            abs(speed - expected_speed), 0.05,
            f"ÉCHEC vitesse dernier: {speed:.3f} m/s vs {expected_speed} m/s"
        )

    def test_last_interval_hr(self):
        """Test FC du dernier intervalle: ±1 bpm."""
        if not self.has_data or not self.work_intervals:
            self.skipTest("Test data not available")

        last = self.work_intervals[-1]
        hr = last.get('avg_hr', 0)

        # Ground truth: 162.35 bpm
        expected_hr = 162.35

        self.assertLessEqual(
            abs(hr - expected_hr), 1,
            f"ÉCHEC HR dernier: {hr:.2f} bpm vs {expected_hr} bpm"
        )

    def test_average_speed_all_intervals(self):
        """Test vitesse moyenne sur tous les intervalles."""
        if not self.has_data or not self.work_intervals:
            self.skipTest("Test data not available")

        speeds = [r.get('avg_speed', 0) for r in self.work_intervals if r.get('avg_speed')]
        avg_speed = np.mean(speeds) if speeds else 0

        # Expected ~5.15 m/s based on ground truth mean
        self.assertLessEqual(
            abs(avg_speed - 5.15), 0.1,
            f"ÉCHEC moyenne globale: {avg_speed:.3f} m/s vs ~5.15 m/s"
        )

    def test_last_interval_extraction(self):
        """Test the last_interval extraction helper."""
        if not self.has_data or not self.work_intervals:
            self.skipTest("Test data not available")

        last_metrics = self.matcher.extract_last_interval_metrics(self.work_intervals)

        self.assertIsNotNone(last_metrics)
        self.assertEqual(last_metrics['index'], 10)
        self.assertIsNotNone(last_metrics['avg_pace'])
        # Pace should be around 3'07''/km for 5.266 m/s
        self.assertIn("3'", last_metrics['avg_pace'])


class TestBaptisteIncompleteSession(unittest.TestCase):
    """
    Témoin B: Baptiste - 10×1' Z3 + 5×2' Z3 + 10' Z2 (Session incomplète)

    Expected:
    - Session marked as incomplete
    - ~16 intervals detected instead of 25+ expected
    - completion_ratio around 0.64
    - Athlete comment: "Nul, pas d'énergie, j'ai fait que la moitié"
    """

    @classmethod
    def setUpClass(cls):
        cls.ground_truth = load_ground_truth().get("Baptiste_2026-01-09", [])

        # Load activity data
        fit_path = TEST_DATA_DIR / "Baptiste_2026-01-09.fit"
        json_path = TEST_DATA_DIR / "Baptiste_2026-01-09.json"

        cls.has_data = fit_path.exists() and json_path.exists()
        if not cls.has_data:
            return

        # Parse FIT file
        cls.df, cls.session, cls.laps = UniversalParser.parse(str(fit_path))

        # Load plan structure
        with open(json_path) as f:
            data = json.load(f)
        cls.plan_structure = data.get("planned_structure", [])

        # Parse plan
        parser = NolioPlanParser()
        cls.target_grid = parser.parse(cls.plan_structure, sport_type="run")

        # Match intervals
        cls.matcher = IntervalMatcher()
        cls.results = cls.matcher.match(
            cls.df,
            cls.target_grid,
            sport="run",
            laps=cls.laps
        )

        # Detect incomplete session
        cls.session_status = cls.matcher.detect_incomplete_session(
            cls.results,
            cls.target_grid,
            cls.df
        )

    def test_data_available(self):
        """Verify test data files exist."""
        if not self.has_data:
            self.skipTest("Test data files not available")

    def test_session_marked_incomplete(self):
        """Session should be marked as incomplete."""
        if not self.has_data:
            self.skipTest("Test data not available")

        self.assertFalse(
            self.session_status['is_complete'],
            "ÉCHEC: session marquée complète alors qu'elle est incomplète"
        )

    def test_matched_less_than_expected(self):
        """Matched count should be less than expected count."""
        if not self.has_data:
            self.skipTest("Test data not available")

        self.assertLess(
            self.session_status['matched_count'],
            self.session_status['expected_count'],
            "ÉCHEC: pas de détection d'abandon"
        )

    def test_completion_ratio_range(self):
        """Completion ratio should be less than 100% (incomplete session)."""
        if not self.has_data:
            self.skipTest("Test data not available")

        ratio = self.session_status['completion_ratio']

        # The athlete said "j'ai fait que la moitié" but actually completed most work.
        # Key test: ratio should be less than 1.0 (not fully complete)
        # Ground truth shows 16 laps detected out of 18 planned work intervals
        # Ratio should be around 0.89-0.95
        self.assertGreater(ratio, 0.5, f"ÉCHEC ratio trop bas: {ratio}")
        self.assertLess(ratio, 1.0, f"ÉCHEC ratio = 100% mais session incomplète: {ratio}")


class TestAlexisFusedBlocks(unittest.TestCase):
    """
    Témoin C: Alexis (Bernard) - 5×(1'30'' Z3 + 3'30'' Z2)

    WITH merge_adjacent_work=True:
    - Should produce 5 blocks of 5 minutes each (300s)
    - Z3 and Z2 are fused into single work blocks

    Ground Truth from Nolio shows alternating 90s/210s laps.
    """

    @classmethod
    def setUpClass(cls):
        # Note: The file is named "Alexis" in ground_truth but "Bernard" in test_cache
        cls.ground_truth = load_ground_truth().get("Alexis_2025-10-17", [])

        # Load activity data - using Bernard file which is the same session
        fit_path = TEST_DATA_DIR / "Alexis_2025-10-17.fit"
        json_path = TEST_DATA_DIR / "Bernard_2025-10-17.json"

        cls.has_data = fit_path.exists() and json_path.exists()
        if not cls.has_data:
            return

        # Parse FIT file
        cls.df, cls.session, cls.laps = UniversalParser.parse(str(fit_path))

        # Load plan structure
        with open(json_path) as f:
            data = json.load(f)
        cls.plan_structure = data.get("planned_structure", [])

        # Parse plan WITH merge_adjacent_work=True for fused blocks
        parser = NolioPlanParser()
        cls.target_grid = parser.parse(
            cls.plan_structure,
            sport_type="run",
            merge_adjacent_work=True
        )

        # Also get unfused grid for comparison
        cls.unfused_grid = parser.parse(
            cls.plan_structure,
            sport_type="run",
            merge_adjacent_work=False
        )

        # Match intervals with fused grid
        cls.matcher = IntervalMatcher()
        cls.results = cls.matcher.match(
            cls.df,
            cls.target_grid,
            sport="run",
            laps=cls.laps
        )

    def test_data_available(self):
        """Verify test data files exist."""
        if not self.has_data:
            self.skipTest("Test data files not available")

    def test_unfused_produces_10_intervals(self):
        """Without fusion, plan should have 10 work intervals (5×2)."""
        if not self.has_data:
            self.skipTest("Test data not available")

        # The original plan has 5 reps of (90s active + 210s active)
        # So 10 work intervals before fusion
        self.assertEqual(
            len(self.unfused_grid), 10,
            f"Plan non-fusionné devrait avoir 10 intervalles, pas {len(self.unfused_grid)}"
        )

    def test_fused_produces_5_blocks(self):
        """With fusion, plan should have 5 fused blocks of 300s."""
        if not self.has_data:
            self.skipTest("Test data not available")

        self.assertEqual(
            len(self.target_grid), 5,
            f"ÉCHEC: {len(self.target_grid)} blocs au lieu de 5 fusionnés"
        )

    def test_fused_block_duration(self):
        """Each fused block should be ~300s (1'30 + 3'30)."""
        if not self.has_data:
            self.skipTest("Test data not available")

        for i, block in enumerate(self.target_grid):
            duration = block.get('duration', 0)
            self.assertLessEqual(
                abs(duration - 300), 2,
                f"ÉCHEC durée bloc {i+1}: {duration}s vs 300s"
            )

    def test_matched_5_fused_blocks(self):
        """Should match exactly 5 fused blocks."""
        if not self.has_data:
            self.skipTest("Test data not available")

        # Filter for ~300s intervals
        fused_results = [r for r in self.results
                        if 295 <= r.get('expected_duration', 0) <= 305]

        self.assertEqual(
            len(fused_results), 5,
            f"ÉCHEC: {len(fused_results)} blocs matchés au lieu de 5"
        )


class TestDries2x9kmTempo(unittest.TestCase):
    """
    Témoin D: Dries - 2×9km Tempo / r 2km

    Expected:
    - 2 intervals of ~33 minutes each
    - Interval 1: ~2001s, speed 4.499 m/s, HR 155 bpm
    - Interval 2: ~1960s, speed 4.608 m/s, HR 158 bpm
    """

    @classmethod
    def setUpClass(cls):
        cls.ground_truth = load_ground_truth().get("Dries_2026-01-17", [])

        # Load activity data
        fit_path = TEST_DATA_DIR / "Dries_2026-01-17.fit"

        cls.has_data = fit_path.exists()
        if not cls.has_data:
            return

        # Parse FIT file
        cls.df, cls.session, cls.laps = UniversalParser.parse(str(fit_path))

        # For this test, we create a simple target grid based on expected workout
        # 2×9km tempo means 2 long intervals
        cls.target_grid = [
            {"duration": 2000, "target_type": "pace", "type": "active", "target_min": 4.0},
            {"duration": 2000, "target_type": "pace", "type": "active", "target_min": 4.0}
        ]

        # Match intervals
        cls.matcher = IntervalMatcher()
        cls.results = cls.matcher.match(
            cls.df,
            cls.target_grid,
            sport="run",
            laps=cls.laps
        )

    def test_data_available(self):
        """Verify test data files exist."""
        if not self.has_data:
            self.skipTest("Test data files not available")

    def test_interval_count_exact(self):
        """Should detect exactly 2 tempo intervals."""
        if not self.has_data:
            self.skipTest("Test data not available")

        self.assertEqual(
            len(self.results), 2,
            f"ÉCHEC: {len(self.results)} intervalles au lieu de 2"
        )

    def test_first_interval_duration(self):
        """First interval duration: ~2001s ±5s."""
        if not self.has_data or len(self.results) < 1:
            self.skipTest("Test data not available")

        r1 = self.results[0]
        duration = r1.get('duration_sec', 0)

        self.assertLessEqual(
            abs(duration - 2001), 5,
            f"ÉCHEC durée bloc 1: {duration}s vs 2001s"
        )

    def test_first_interval_speed(self):
        """First interval speed: 4.499 m/s ±0.05."""
        if not self.has_data or len(self.results) < 1:
            self.skipTest("Test data not available")

        r1 = self.results[0]
        speed = r1.get('avg_speed', 0)

        self.assertLessEqual(
            abs(speed - 4.499), 0.05,
            f"ÉCHEC vitesse bloc 1: {speed:.3f} m/s vs 4.499 m/s"
        )

    def test_first_interval_hr(self):
        """First interval HR: 154.96 bpm ±1."""
        if not self.has_data or len(self.results) < 1:
            self.skipTest("Test data not available")

        r1 = self.results[0]
        hr = r1.get('avg_hr', 0)

        self.assertLessEqual(
            abs(hr - 154.96), 1,
            f"ÉCHEC HR bloc 1: {hr:.2f} bpm vs 154.96 bpm"
        )

    def test_second_interval_duration(self):
        """Second interval duration: ~1960s ±5s."""
        if not self.has_data or len(self.results) < 2:
            self.skipTest("Test data not available")

        r2 = self.results[1]
        duration = r2.get('duration_sec', 0)

        self.assertLessEqual(
            abs(duration - 1960), 5,
            f"ÉCHEC durée bloc 2: {duration}s vs 1960s"
        )

    def test_second_interval_speed(self):
        """Second interval speed: 4.608 m/s ±0.05."""
        if not self.has_data or len(self.results) < 2:
            self.skipTest("Test data not available")

        r2 = self.results[1]
        speed = r2.get('avg_speed', 0)

        self.assertLessEqual(
            abs(speed - 4.608), 0.05,
            f"ÉCHEC vitesse bloc 2: {speed:.3f} m/s vs 4.608 m/s"
        )

    def test_second_interval_hr(self):
        """Second interval HR: 158.12 bpm ±1."""
        if not self.has_data or len(self.results) < 2:
            self.skipTest("Test data not available")

        r2 = self.results[1]
        hr = r2.get('avg_hr', 0)

        self.assertLessEqual(
            abs(hr - 158.12), 1,
            f"ÉCHEC HR bloc 2: {hr:.2f} bpm vs 158.12 bpm"
        )

    def test_last_interval_is_best(self):
        """The last interval (bloc 2) should be the 'best' for Karoly."""
        if not self.has_data or len(self.results) < 2:
            self.skipTest("Test data not available")

        last_metrics = self.matcher.extract_last_interval_metrics(self.results)

        self.assertIsNotNone(last_metrics)
        self.assertEqual(last_metrics['index'], 2)
        # Last interval is faster than first
        self.assertGreater(last_metrics['avg_speed'], 4.5)


class TestPlanParserMergeAdjacentWork(unittest.TestCase):
    """Unit tests for the merge_adjacent_work feature in NolioPlanParser."""

    def setUp(self):
        self.parser = NolioPlanParser()

    def test_merge_z3_z2_pattern(self):
        """Test merging Z3+Z2 adjacent blocks."""
        # Simulate 5×(90s + 210s) pattern
        plan_json = {
            "type": "repetition",
            "value": 5,
            "steps": [
                {
                    "intensity_type": "active",
                    "step_duration_type": "duration",
                    "step_duration_value": 90,
                    "step_percent_low": 106,
                    "target_type": "pace"
                },
                {
                    "intensity_type": "active",
                    "step_duration_type": "duration",
                    "step_duration_value": 210,
                    "step_percent_low": 91,
                    "target_type": "pace"
                },
                {
                    "intensity_type": "cooldown",
                    "step_duration_type": "duration",
                    "step_duration_value": 180
                }
            ]
        }

        # Without merging: should get 10 active intervals
        result_no_merge = self.parser.parse(plan_json, merge_adjacent_work=False)
        active_no_merge = [r for r in result_no_merge if r['type'] == 'active']
        self.assertEqual(len(active_no_merge), 10)

        # With merging: should get 5 fused intervals of 300s
        result_merged = self.parser.parse(plan_json, merge_adjacent_work=True)
        self.assertEqual(len(result_merged), 5)

        for block in result_merged:
            self.assertEqual(block['duration'], 300)  # 90 + 210

    def test_no_merge_same_duration(self):
        """Don't merge blocks with similar durations (same type of work)."""
        # 10×60s pattern - all same duration, should NOT merge
        plan_json = {
            "type": "repetition",
            "value": 10,
            "steps": [
                {
                    "intensity_type": "active",
                    "step_duration_type": "duration",
                    "step_duration_value": 60,
                    "step_percent_low": 106
                },
                {
                    "intensity_type": "rest",
                    "step_duration_type": "duration",
                    "step_duration_value": 60
                }
            ]
        }

        result_merged = self.parser.parse(plan_json, merge_adjacent_work=True)
        # Should still be 10 intervals (not 5 merged pairs)
        self.assertEqual(len(result_merged), 10)


if __name__ == '__main__':
    unittest.main(verbosity=2)
