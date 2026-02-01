import pytest
from datetime import datetime, timezone
from projectk_core.logic.models import PhysioProfile, Athlete

def test_louis_richard_dual_profile_init():
    """
    Verify that we can initialize separate Bike and Run profiles for Louis Richard.
    This serves as the TDD verification for the profile initialization task.
    """
    # 1. Create Athlete
    louis = Athlete(id="louis_uuid", name="Louis Richard")
    
    # 2. Define Bike Profile (2025)
    # LT1=270W, LT2=340W (Example values from Nolio)
    bike_profile = PhysioProfile(
        valid_from=datetime(2025, 1, 1, tzinfo=timezone.utc),
        sport="bike",
        lt1_power_pace=270,
        lt2_power_pace=340,
        cp_cs=360,
        weight=64.0
    )
    
    # 3. Define Run Profile (2025)
    # LT1=145bpm, LT2=172bpm (Example values)
    run_profile = PhysioProfile(
        valid_from=datetime(2025, 1, 1, tzinfo=timezone.utc),
        sport="run",
        lt1_hr=145,
        lt2_hr=172,
        # cp_cs=0 -> Removed, optional field, >0 constraint
        weight=64.0
    )
    
    # 4. Add to Athlete
    louis.add_profile(bike_profile)
    louis.add_profile(run_profile)
    
    # 5. Verify Retrieval logic
    target_date = datetime(2025, 2, 1, tzinfo=timezone.utc)
    
    retrieved_bike = louis.get_profile_for_date(target_date, sport="bike")
    retrieved_run = louis.get_profile_for_date(target_date, sport="run")
    
    assert retrieved_bike is not None
    assert retrieved_bike.sport == "bike"
    assert retrieved_bike.cp_cs == 360
    
    assert retrieved_run is not None
    assert retrieved_run.sport == "run"
    assert retrieved_run.lt2_hr == 172
    
    # Ensure they are distinct objects
    assert retrieved_bike != retrieved_run
