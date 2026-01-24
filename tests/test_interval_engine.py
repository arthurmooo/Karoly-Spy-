import pytest
from projectk_core.logic.interval_engine import IntervalEngine

def test_interval_engine_instantiation():
    """Verify that IntervalEngine can be instantiated."""
    engine = IntervalEngine()
    assert engine is not None
