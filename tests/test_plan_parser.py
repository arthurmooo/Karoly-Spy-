import unittest
from projectk_core.processing.plan_parser import NolioPlanParser, TextPlanParser

class TestNolioPlanParser(unittest.TestCase):
    
    def setUp(self):
        self.parser = NolioPlanParser()

    def test_parse_simple_repetition(self):
        """Test parsing a simple 10x30/30 structure."""
        plan_json = {
            "type": "repetition",
            "value": 10,
            "steps": [
                {"intensity_type": "active", "step_duration_value": 30, "target_value_min": 300, "target_value_max": 320, "target_type": "power"},
                {"intensity_type": "rest", "step_duration_value": 30}
            ]
        }
        
        target_grid = self.parser.parse(plan_json)
        
        self.assertEqual(len(target_grid), 10)
        self.assertEqual(target_grid[0]['duration'], 30)
        self.assertEqual(target_grid[0]['type'], 'active')
        self.assertEqual(target_grid[0]['target_min'], 300)

    def test_parse_complex_nested(self):
        """Test parsing nested waves: 3x(2min active + 1min rest)."""
        # This simulates a "block" that contains steps
        # Nolio structure can be a list of blocks/steps
        plan_json = [
            {"intensity_type": "warmup", "step_duration_value": 600},
            {
                "type": "repetition",
                "value": 3,
                "steps": [
                    {"intensity_type": "active", "step_duration_value": 120, "target_value_min": 250},
                    {"intensity_type": "rest", "step_duration_value": 60}
                ]
            },
            {"intensity_type": "cooldown", "step_duration_value": 600}
        ]
        
        target_grid = self.parser.parse(plan_json)
        
        # Should only contain the 3 active intervals
        self.assertEqual(len(target_grid), 3)
        self.assertEqual(target_grid[0]['duration'], 120)
        self.assertEqual(target_grid[0]['target_min'], 250)

    def test_parse_ramp_up(self):
        """Test that ramp_up is considered work."""
        plan_json = [
            {"intensity_type": "ramp_up", "step_duration_value": 300, "target_value_min": 200},
            {"intensity_type": "active", "step_duration_value": 300, "target_value_min": 300}
        ]
        
        target_grid = self.parser.parse(plan_json)
        self.assertEqual(len(target_grid), 2)

    def test_parse_high_pct_cooldown_as_work(self):
        """High-intensity cooldown labels from Nolio should still be treated as work."""
        plan_json = [
            {"intensity_type": "active", "step_duration_type": "distance", "step_duration_value": 1000, "target_type": "pace", "target_value_min": 5.2, "step_percent_low": 101},
            {"intensity_type": "cooldown", "step_duration_type": "distance", "step_duration_value": 9000, "target_type": "pace", "target_value_min": 5.0, "step_percent_low": 95},
        ]
        target_grid = self.parser.parse(plan_json)
        self.assertEqual(len(target_grid), 2)
        self.assertEqual(target_grid[1]["distance_m"], 9000)

class TestTextPlanParser(unittest.TestCase):
    def setUp(self):
        self.parser = TextPlanParser()

    def test_parse_simple_seconds(self):
        title = "10x 30/30"
        plan = self.parser.parse(title)
        self.assertEqual(len(plan), 10)
        self.assertEqual(plan[0]['duration'], 30)
        self.assertEqual(plan[0]['type'], 'active')

    def test_parse_seconds_with_quote(self):
        title = "10x 30\"/30\""
        plan = self.parser.parse(title)
        self.assertEqual(len(plan), 10)
        self.assertEqual(plan[0]['duration'], 30)

    def test_parse_minutes(self):
        title = "6*4' Z3"
        plan = self.parser.parse(title)
        self.assertEqual(len(plan), 6)
        self.assertEqual(plan[0]['duration'], 240) # 4 mins
        
    def test_parse_distance(self):
        title = "3x 2000m"
        plan = self.parser.parse(title)
        self.assertEqual(len(plan), 3)
        self.assertEqual(plan[0]['distance_m'], 2000)
        
    def test_parse_distance_with_rest(self):
        title = "8*1Km Z2/ r 250m"
        plan = self.parser.parse(title)
        self.assertEqual(len(plan), 8)
        self.assertEqual(plan[0]['distance_m'], 1000)

    def test_parse_multi_block_reps_plus_tempo_distance(self):
        title = "21Km : 5*1Km seuil + 9Km Tempo"
        plan = self.parser.parse(title)
        self.assertEqual(len(plan), 6)
        self.assertEqual(plan[0]['distance_m'], 1000)
        self.assertEqual(plan[-1]['distance_m'], 9000)

    def test_parse_additive_distance_3_blocks(self):
        """Fix 5: additive distance pattern with 3 equal blocks."""
        title = "30Km : 9Km à 80-85% + 9Km à 86-90% + 9Km à 91-95%"
        plan = self.parser.parse(title)
        self.assertEqual(len(plan), 3)
        self.assertEqual(plan[0]['distance_m'], 9000)
        self.assertEqual(plan[1]['distance_m'], 9000)
        self.assertEqual(plan[2]['distance_m'], 9000)

    def test_parse_additive_distance_2_blocks(self):
        """Fix 5: additive distance pattern with 2 unequal blocks."""
        title = "40Km : 32Km Tempo + 4Km Z2"
        plan = self.parser.parse(title)
        self.assertEqual(len(plan), 2)
        self.assertEqual(plan[0]['distance_m'], 32000)
        self.assertEqual(plan[1]['distance_m'], 4000)


if __name__ == '__main__':
    unittest.main()
