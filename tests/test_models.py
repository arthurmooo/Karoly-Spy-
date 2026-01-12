import pytest
import pandas as pd
from datetime import datetime
# Import qui sera créé ensuite
import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.logic.models import Activity, Athlete, PhysioProfile, ActivityMetadata

def test_physio_profile_validation():
    """Test que le profil physio valide bien les données."""
    # Cas valide
    profile = PhysioProfile(
        lt1_hr=140, lt2_hr=170,
        cp=300, valid_from=datetime(2024, 1, 1)
    )
    assert profile.lt1_hr == 140
    
    # Cas invalide (HR négatif par exemple)
    # Note: Pydantic v2 raise ValidationError
    with pytest.raises(ValueError):
        PhysioProfile(lt1_hr=-10, lt2_hr=170, cp=300, valid_from=datetime.now())

def test_athlete_profile_history():
    """Test que l'athlète retourne le bon profil selon la date."""
    athlete = Athlete(id="123", name="Test Runner")
    
    p1 = PhysioProfile(lt1_hr=140, lt2_hr=160, cp=250, valid_from=datetime(2023, 1, 1))
    p2 = PhysioProfile(lt1_hr=145, lt2_hr=165, cp=260, valid_from=datetime(2024, 1, 1))
    
    athlete.add_profile(p1)
    athlete.add_profile(p2)
    
    # Date en 2023 -> p1
    assert athlete.get_profile_for_date(datetime(2023, 6, 1)).lt1_hr == 140
    # Date en 2024 -> p2
    assert athlete.get_profile_for_date(datetime(2024, 2, 1)).lt1_hr == 145
    # Date avant tout profil -> None ou erreur ? Disons None pour l'instant
    assert athlete.get_profile_for_date(datetime(2022, 1, 1)) is None

def test_activity_structure():
    """Test l'initialisation d'une activité avec DataFrame."""
    df = pd.DataFrame({'timestamp': [], 'power': []})
    meta = ActivityMetadata(
        activity_type="Run",
        start_time=datetime.now(),
        duration_sec=3600
    )
    
    activity = Activity(metadata=meta, streams=df)
    assert activity.streams is not None
    assert isinstance(activity.streams, pd.DataFrame)
