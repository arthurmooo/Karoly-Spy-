"""Tests for centralized sport mapper."""

import pytest
from projectk_core.logic.sport_mapper import normalize_sport, normalize_sport_lower


class TestNormalizeSportById:
    """sport_id-based mapping (primary, most reliable)."""

    def test_ski_mountaineering(self):
        assert normalize_sport("Ski de randonnée", sport_id=7) == "Ski"

    def test_road_cycling(self):
        assert normalize_sport("Road cycling", sport_id=14) == "Bike"

    def test_running(self):
        assert normalize_sport("Running", sport_id=2) == "Run"

    def test_swimming(self):
        assert normalize_sport("Swimming", sport_id=19) == "Swim"

    def test_xc_ski_classic(self):
        assert normalize_sport("Ski de fond", sport_id=3) == "Ski"

    def test_biathlon(self):
        assert normalize_sport("Biathlon", sport_id=38) == "Ski"

    def test_trail_running(self):
        assert normalize_sport("Trail", sport_id=52) == "Run"

    def test_strength(self):
        assert normalize_sport("Strength", sport_id=20) == "Strength"

    def test_unknown_id_falls_back_to_string(self):
        assert normalize_sport("Vélo de route", sport_id=999) == "Bike"


class TestNormalizeSportByString:
    """String fallback — critical: Ski before Run."""

    def test_ski_de_randonnee_not_run(self):
        """The original bug: 'Ski de randonnée' was matched as Run."""
        assert normalize_sport("Ski de randonnée") == "Ski"

    def test_ski_de_fond(self):
        assert normalize_sport("Ski de fond") == "Ski"

    def test_randonnee_without_ski_is_run(self):
        assert normalize_sport("Randonnée") == "Run"

    def test_course_a_pied(self):
        assert normalize_sport("Course à pied") == "Run"

    def test_velo(self):
        assert normalize_sport("Vélo de route") == "Bike"

    def test_natation(self):
        assert normalize_sport("Natation") == "Swim"

    def test_renforcement(self):
        assert normalize_sport("Renforcement musculaire") == "Strength"

    def test_ppg(self):
        assert normalize_sport("PPG") == "Strength"

    def test_trail(self):
        assert normalize_sport("Trail") == "Run"

    def test_biathlon_string(self):
        assert normalize_sport("Biathlon") == "Ski"

    def test_roller_ski(self):
        assert normalize_sport("Roller ski - Classic") == "Ski"

    def test_empty_string(self):
        assert normalize_sport("") == "Other"

    def test_none_sport_name(self):
        assert normalize_sport("", sport_id=None) == "Other"

    def test_unknown_sport(self):
        assert normalize_sport("Tennis de table") == "Other"


class TestNormalizeSportLower:
    """Lowercase variant used by processing layer."""

    def test_returns_lowercase(self):
        assert normalize_sport_lower("Vélo") == "bike"

    def test_ski_de_randonnee_lower(self):
        assert normalize_sport_lower("Ski de randonnée") == "ski"

    def test_with_sport_id(self):
        assert normalize_sport_lower("whatever", sport_id=14) == "bike"
