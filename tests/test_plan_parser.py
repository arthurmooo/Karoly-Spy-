import unittest
from projectk_core.processing.plan_parser import NolioPlanParser

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

if __name__ == '__main__':
    unittest.main()