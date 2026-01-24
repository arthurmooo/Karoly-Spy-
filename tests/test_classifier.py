import pytest
from projectk_core.logic.classifier import ActivityClassifier

def test_classify_competition_keywords():
    classifier = ActivityClassifier()
    
    # Test keywords
    assert classifier.is_competition("Mon premier Marathon", "Course") == True
    assert classifier.is_competition("Semi-marathon de Paris", "") == True
    assert classifier.is_competition("Sortie longue", "Course à pied") == False
    assert classifier.is_competition("Triathlon 90km", "") == True

def test_parse_split_tags():
    classifier = ActivityClassifier()
    
    # Test distance-based split
    tags_km = classifier.parse_splits("#split: 0-10, 10-21.1")
    assert len(tags_km) == 2
    assert tags_km[0] == {"start": 0, "end": 10, "unit": "km"}
    assert tags_km[1] == {"start": 10, "end": 21.1, "unit": "km"}
    
    # Test time-based split
    tags_time = classifier.parse_splits("Super séance ! #split: 00:00:00-00:45:00, 00:45:00-01:30:00")
    assert len(tags_time) == 2
    assert tags_time[0]["unit"] == "time"
    assert tags_time[0]["start"] == 0
    assert tags_time[1]["start"] == 2700 # 45 min in seconds

def test_determine_segmentation_strategy():
    classifier = ActivityClassifier()
    
    # Case 1: Manual takes precedence
    strategy = classifier.get_strategy("Course", "Race", "#split: 0-5, 5-10")
    assert strategy == "manual"
    
    # Case 2: Competition auto
    strategy = classifier.get_strategy("Marathon", "Competition", "")
    assert strategy == "auto_competition"
    
    # Case 3: Training auto
    strategy = classifier.get_strategy("Footing", "Entraînement", "")
    assert strategy == "auto_training"

def test_lit_priority():
    classifier = ActivityClassifier()
    # Even if it contains 'Marathon' which is a competition keyword
    assert classifier.detect_work_type(None, "LIT Marathon", "") == "endurance"
    assert classifier.is_competition("LIT Marathon", "") == False
    
    # LIT must override explicit competition flag
    assert classifier.detect_work_type(None, "LIT Race", "Compétition", is_competition_nolio=True) == "endurance"
    assert classifier.is_competition("LIT Race", "Compétition", is_competition_nolio=True) == False
    
    # Check case insensitivity
    assert classifier.detect_work_type(None, "lit session", "") == "endurance"
    
    # Check that it doesn't match 'lithium' (though unlikely, it's a test of \b)
    assert classifier.is_competition("Lithium race", "") == True # 'race' matches

def test_lit_hit_combination():
    classifier = ActivityClassifier()
    # If LIT and HIT are both present, HIT wins for interval detection
    assert classifier.detect_work_type(None, "LIT + HIT session", "Training") == "intervals"
    # But for competition, LIT still downgrades it to false
    assert classifier.is_competition("LIT + HIT Marathon", "Competition") == False
