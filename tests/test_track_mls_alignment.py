import pytest
from datetime import datetime
from projectk_core.logic.models import PhysioProfile

def test_physio_profile_has_sport_field():
    """Verify that PhysioProfile accepts a sport field."""
    profile = PhysioProfile(
        valid_from=datetime.now(),
        lt1_hr=140,
        lt2_hr=170,
        sport="run"
    )
    assert profile.sport == "run"

def test_physio_profile_default_sport():
    """Verify that PhysioProfile defaults to 'bike' if sport is missing."""
    profile = PhysioProfile(
        valid_from=datetime.now(),
        lt1_hr=140,
        lt2_hr=170
    )
    assert profile.sport == "bike"
