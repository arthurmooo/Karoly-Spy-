from datetime import datetime, timezone

from projectk_core.logic.session_grouper import SessionGrouper


def make_row(row_id, sport, ts, name, planned_name=""):
    source_json = {"planned_name": planned_name} if planned_name else {}
    return {
        "id": row_id,
        "sport_type": sport,
        "session_date": ts,
        "activity_name": name,
        "source_json": source_json,
        "nolio_id": row_id,
    }


def test_pair_score_requires_similarity_when_both_planned():
    grouper = SessionGrouper(db_connector=None)
    bike = make_row("b1", "Bike", "2026-02-05T08:50:00+00:00", "Bike", planned_name="ENC Tempo Full")
    run = make_row("r1", "Run", "2026-02-05T10:40:00+00:00", "Run", planned_name="ENC Tempo Full")
    bad_run = make_row("r2", "Run", "2026-02-05T10:40:00+00:00", "Run", planned_name="Easy Jog")

    assert grouper._pair_score(bike, run) is not None
    assert grouper._pair_score(bike, bad_run) is None


def test_pair_score_allows_missing_planned_if_close_in_time():
    grouper = SessionGrouper(db_connector=None)
    bike = make_row("b1", "Bike", "2026-02-05T08:50:00+00:00", "LIT 60", planned_name="LIT 60")
    run = make_row("r1", "Run", "2026-02-05T10:40:00+00:00", "Course à pied")
    far_run = make_row("r2", "Run", "2026-02-05T16:40:00+00:00", "Course à pied")

    assert grouper._pair_score(bike, run) is not None
    assert grouper._pair_score(bike, far_run) is None


def test_pair_score_allows_lit_bike_with_structured_run_when_close():
    grouper = SessionGrouper(db_connector=None)
    bike = make_row("b1", "Bike", "2026-02-05T08:50:00+00:00", "LIT 60")
    run = make_row("r1", "Run", "2026-02-05T10:40:00+00:00", "30Km : 9Km à 80-85% + 9Km à 86-90% + 9Km à 91-95%")
    assert grouper._pair_score(bike, run) is not None


def test_pair_score_rejects_structured_non_generic_pairs_without_planned_names():
    grouper = SessionGrouper(db_connector=None)
    bike = make_row("b1", "Bike", "2026-02-02T08:30:00+00:00", "15*2' Z2/ r 1'")
    run = make_row("r1", "Run", "2026-02-02T09:58:00+00:00", "10*1Km Z2/ r 250m")
    assert grouper._pair_score(bike, run) is None


def test_pair_score_rejects_run_before_bike():
    grouper = SessionGrouper(db_connector=None)
    bike = make_row("b1", "Bike", "2026-02-05T10:40:00+00:00", "LIT 60", planned_name="LIT 60")
    run = make_row("r1", "Run", "2026-02-05T08:50:00+00:00", "Course à pied")
    assert grouper._pair_score(bike, run) is None


def test_find_pairs_for_day_selects_best_pairs():
    grouper = SessionGrouper(db_connector=None)
    bikes = [
        make_row("b1", "Bike", "2026-02-05T08:50:00+00:00", "Bike", planned_name="Brick A"),
        make_row("b2", "Bike", "2026-02-05T12:00:00+00:00", "Bike", planned_name="Brick B"),
    ]
    runs = [
        make_row("r1", "Run", "2026-02-05T09:50:00+00:00", "Run", planned_name="Brick A"),
        make_row("r2", "Run", "2026-02-05T13:00:00+00:00", "Run", planned_name="Brick B"),
    ]

    pairs = grouper._find_pairs_for_day(bikes, runs, datetime(2026, 2, 5, tzinfo=timezone.utc).date())
    assert len(pairs) == 2
    pair_ids = {(b["id"], r["id"]) for b, r in pairs}
    assert ("b1", "r1") in pair_ids
    assert ("b2", "r2") in pair_ids
