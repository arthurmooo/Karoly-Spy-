"""
Tests for scripts/patch_rpe.py — surgical RPE patching.
"""
import pytest
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.patch_rpe import RPEPatcher, K_RPE, PER_MIN, PER_MAX


# ─── Helpers ───

def _make_record(rpe=0, load_index=100.0, intensity_ratio_avg=0.5, moving_time_sec=3600):
    """Build a fake activity DB record for testing patch_activity."""
    return {
        "id": "test-uuid-123",
        "nolio_id": "99999",
        "athlete_id": "ath-uuid-1",
        "session_date": "2026-03-28T10:00:00+00:00",
        "rpe": rpe,
        "moving_time_sec": moving_time_sec,
        "duration_sec": moving_time_sec,
        "load_index": load_index,
        "load_components": {
            "external": {"duration_min": 60.0, "distance_km": 12.0, "intensity_ratio_avg": intensity_ratio_avg},
            "internal": {"srpe_load": None, "time_lt1_sec": 1000, "time_between_lt1_lt2_sec": 2000, "time_gt_lt2_sec": 600},
            "global": {"mls": load_index},
        },
        "segmented_metrics": {
            "per_index": 1.0,
            "rpe_delta": None,
            "interval_pahr_mean": 0.85,
            "interval_blocks": [],
        },
    }


class FakeDB:
    """Minimal mock for DBConnector — records updates without hitting Supabase."""
    def __init__(self):
        self.updates = []
        self._query_results = []

    class FakeTable:
        def __init__(self, parent, table_name):
            self.parent = parent
            self.table_name = table_name
            self._filters = {}

        def update(self, payload):
            self.parent.updates.append({"table": self.table_name, "payload": payload, "filters": {}})
            return self

        def select(self, *args, **kwargs):
            return self

        def eq(self, key, val):
            if self.parent.updates:
                self.parent.updates[-1]["filters"][key] = val
            return self

        def or_(self, *args):
            return self

        def not_(self):
            return self

        def is_(self, *args):
            return self

        def gte(self, *args):
            return self

        def order(self, *args):
            return self

        def execute(self):
            class Result:
                data = []
            return Result()

    @property
    def client(self):
        return self

    def table(self, name):
        return self.FakeTable(self, name)


class FakeNolio:
    """Minimal mock for NolioClient."""
    def __init__(self, rpe_map=None):
        self._rpe_map = rpe_map or {}
        self.calls = []

    def get_activities(self, athlete_id, date_from, date_to):
        self.calls.append((athlete_id, date_from, date_to))
        return [{"id": k, "rpe": v} for k, v in self._rpe_map.items()]


# ─── Tests: patch_activity (surgical recalculation) ───

class TestPatchActivity:

    def test_recalculates_per_index(self):
        """RPE=7 with intensity_ratio_avg=0.5 → PER > 1.0 (perceived harder than objective)."""
        db = FakeDB()
        patcher = RPEPatcher(db, FakeNolio())
        record = _make_record(rpe=0, load_index=100.0, intensity_ratio_avg=0.5)

        result = patcher.patch_activity(record, new_rpe=7)

        # rpe_norm = (7-1)/9 = 0.6667, rpe_delta = 0.6667 - 0.5 = 0.1667
        # per = 1.0 + 0.3 * 0.1667 = 1.05
        assert result["per_index"] == pytest.approx(1.05, abs=0.01)
        assert result["new_rpe"] == 7

    def test_per_clamped_high(self):
        """RPE=10 with low intensity → PER clamped at 1.15."""
        db = FakeDB()
        patcher = RPEPatcher(db, FakeNolio())
        record = _make_record(rpe=0, load_index=100.0, intensity_ratio_avg=0.1)

        result = patcher.patch_activity(record, new_rpe=10)

        # rpe_norm = 1.0, delta = 0.9, per = 1.0 + 0.3*0.9 = 1.27 → clamped to 1.15
        assert result["per_index"] == PER_MAX

    def test_per_clamped_low(self):
        """RPE=1 with high intensity → PER clamped at 0.85."""
        db = FakeDB()
        patcher = RPEPatcher(db, FakeNolio())
        record = _make_record(rpe=0, load_index=100.0, intensity_ratio_avg=0.9)

        result = patcher.patch_activity(record, new_rpe=1)

        # rpe_norm = 0.0, delta = -0.9, per = 1.0 + 0.3*(-0.9) = 0.73 → clamped to 0.85
        assert result["per_index"] == PER_MIN

    def test_recalculates_mls(self):
        """MLS = old_load_index * per_index (old PER was 1.0)."""
        db = FakeDB()
        patcher = RPEPatcher(db, FakeNolio())
        record = _make_record(rpe=0, load_index=200.0, intensity_ratio_avg=0.5)

        result = patcher.patch_activity(record, new_rpe=7)

        expected_per = round(1.0 + K_RPE * ((7-1)/9.0 - 0.5), 4)
        expected_mls = round(200.0 * expected_per, 1)
        assert result["new_mls"] == pytest.approx(expected_mls, abs=0.2)

    def test_recalculates_srpe(self):
        """sRPE = duration_min * rpe."""
        db = FakeDB()
        patcher = RPEPatcher(db, FakeNolio())
        record = _make_record(rpe=0, moving_time_sec=3600)

        result = patcher.patch_activity(record, new_rpe=8)

        assert result["srpe"] == pytest.approx(60.0 * 8, abs=0.1)

    def test_null_load_index_preserved(self):
        """If load_index was NULL (no thresholds), it stays NULL."""
        db = FakeDB()
        patcher = RPEPatcher(db, FakeNolio())
        record = _make_record(rpe=None, load_index=None, intensity_ratio_avg=None)

        result = patcher.patch_activity(record, new_rpe=5)

        assert result["new_mls"] is None
        assert result["per_index"] == 1.0  # No intensity_ratio_avg → PER stays neutral
        assert result["new_rpe"] == 5

    def test_db_update_payload_is_surgical(self):
        """Verify the DB update only touches RPE-related fields."""
        db = FakeDB()
        patcher = RPEPatcher(db, FakeNolio())
        record = _make_record(rpe=0, load_index=100.0, intensity_ratio_avg=0.5)

        patcher.patch_activity(record, new_rpe=6)

        assert len(db.updates) == 1
        payload = db.updates[0]["payload"]
        # Only these keys should be in the update
        assert set(payload.keys()) == {"rpe", "missing_rpe_flag", "load_index", "segmented_metrics", "load_components"}
        assert payload["rpe"] == 6
        assert payload["missing_rpe_flag"] is False

    def test_preserves_existing_jsonb_keys(self):
        """segmented_metrics and load_components should preserve non-RPE keys."""
        db = FakeDB()
        patcher = RPEPatcher(db, FakeNolio())
        record = _make_record(rpe=0)

        patcher.patch_activity(record, new_rpe=5)

        payload = db.updates[0]["payload"]
        # Original keys preserved
        assert payload["segmented_metrics"]["interval_pahr_mean"] == 0.85
        assert payload["segmented_metrics"]["interval_blocks"] == []
        assert payload["load_components"]["internal"]["time_lt1_sec"] == 1000
        assert payload["load_components"]["external"]["distance_km"] == 12.0


# ─── Tests: fetch_nolio_rpe ───

class TestFetchNolioRPE:

    def test_returns_valid_rpe_only(self):
        """Only RPE >= 1 should be returned."""
        nolio = FakeNolio(rpe_map={"100": 7, "101": 0, "102": None, "103": 5})
        patcher = RPEPatcher(FakeDB(), nolio)

        result = patcher.fetch_nolio_rpe(12345, "2026-03-01", "2026-03-31")

        assert result == {"100": 7, "103": 5}
        assert "101" not in result  # RPE=0 excluded
        assert "102" not in result  # RPE=None excluded

    def test_api_error_returns_empty(self):
        """If Nolio API fails, return empty dict gracefully."""
        class BrokenNolio:
            def get_activities(self, *args):
                raise Exception("Rate limit")

        patcher = RPEPatcher(FakeDB(), BrokenNolio())
        result = patcher.fetch_nolio_rpe(12345, "2026-03-01", "2026-03-31")

        assert result == {}
