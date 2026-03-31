from projectk_core.logic.reprocessor import _manual_segments_to_interval_details


def test_manual_segments_to_interval_details_marks_rows_as_manual_and_sorts():
    details = _manual_segments_to_interval_details(
        [
            {
                "block_index": 2,
                "segments": [
                    {
                        "start_sec": 240.0,
                        "end_sec": 300.0,
                        "duration_sec": 60.0,
                        "distance_m": 300.0,
                        "avg_speed": 5.0,
                        "avg_power": None,
                        "avg_hr": 168.0,
                    }
                ],
            },
            {
                "block_index": 1,
                "segments": [
                    {
                        "start_sec": 120.0,
                        "end_sec": 180.0,
                        "duration_sec": 60.0,
                        "distance_m": 300.0,
                        "avg_speed": 5.1,
                        "avg_power": None,
                        "avg_hr": 166.0,
                    }
                ],
            },
        ]
    )

    assert [detail["start_index"] for detail in details] == [120.0, 240.0]
    assert all(detail["status"] == "matched" for detail in details)
    assert all(detail["source"] == "manual" for detail in details)
