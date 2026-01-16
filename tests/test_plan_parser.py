import pytest
from projectk_core.processing.plan_parser import NolioPlanParser

def test_parse_minutes():
    title = "3*15' Z2/ r 5'"
    res = NolioPlanParser.parse(title)
    assert res == {"type": "time", "duration": 900, "reps": 3, "unit": "s"}

def test_parse_seconds():
    title = "10x30\" / 30\""
    res = NolioPlanParser.parse(title)
    assert res == {"type": "time", "duration": 30, "reps": 10, "unit": "s"}

def test_parse_distance():
    title = "6 x 1000m VMA"
    res = NolioPlanParser.parse(title)
    assert res == {"type": "distance", "duration": 1000, "reps": 6, "unit": "m"}

def test_parse_no_match():
    title = "Footing cool 1h"
    res = NolioPlanParser.parse(title)
    assert res is None
