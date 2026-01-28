
import pytest
from datetime import datetime, timedelta

class CorrelationMatcher:
    """
    Matches detected intervals with reference (Nolio) laps based on temporal overlap.
    """
    @staticmethod
    def match(detected_intervals, reference_laps, min_overlap_pct=0.5):
        """
        Args:
            detected_intervals: List of dicts with 'start_time', 'end_time' (datetime)
            reference_laps: List of dicts with 'start_time', 'end_time' (datetime)
            
        Returns:
            List of tuples (detected_idx, reference_idx, overlap_pct)
        """
        matches = []
        for i, det in enumerate(detected_intervals):
            best_ref_idx = -1
            max_overlap = 0
            
            det_start = det['start_time']
            det_end = det['end_time']
            det_dur = (det_end - det_start).total_seconds()
            
            if det_dur <= 0: continue

            for j, ref in enumerate(reference_laps):
                ref_start = ref['start_time']
                ref_end = ref['end_time']
                
                # Calculate Intersection
                overlap_start = max(det_start, ref_start)
                overlap_end = min(det_end, ref_end)
                
                overlap_dur = max(0, (overlap_end - overlap_start).total_seconds())
                overlap_pct = overlap_dur / det_dur
                
                if overlap_pct > max_overlap:
                    max_overlap = overlap_pct
                    best_ref_idx = j
            
            if max_overlap >= min_overlap_pct:
                matches.append((i, best_ref_idx, max_overlap))
        
        return matches

def test_perfect_alignment():
    start = datetime(2026, 1, 1, 10, 0, 0)
    det = [{"start_time": start, "end_time": start + timedelta(seconds=60)}]
    ref = [{"start_time": start, "end_time": start + timedelta(seconds=60)}]
    
    matcher = CorrelationMatcher()
    matches = matcher.match(det, ref)
    assert len(matches) == 1
    assert matches[0] == (0, 0, 1.0)

def test_partial_overlap():
    start = datetime(2026, 1, 1, 10, 0, 0)
    # Detected is 10:00:05 to 10:01:05 (60s)
    det = [{"start_time": start + timedelta(seconds=5), "end_time": start + timedelta(seconds=65)}]
    # Reference is 10:00:00 to 10:01:00 (60s)
    ref = [{"start_time": start, "end_time": start + timedelta(seconds=60)}]
    
    # Overlap is 10:00:05 to 10:01:00 = 55s
    # Overlap % = 55 / 60 = 0.9166
    
    matcher = CorrelationMatcher()
    matches = matcher.match(det, ref)
    assert len(matches) == 1
    assert matches[0][0] == 0
    assert matches[0][1] == 0
    assert pytest.approx(matches[0][2], 0.01) == 0.916

def test_no_overlap():
    start = datetime(2026, 1, 1, 10, 0, 0)
    det = [{"start_time": start, "end_time": start + timedelta(seconds=60)}]
    ref = [{"start_time": start + timedelta(seconds=70), "end_time": start + timedelta(seconds=130)}]
    
    matcher = CorrelationMatcher()
    matches = matcher.match(det, ref)
    assert len(matches) == 0

def test_multiple_intervals():
    start = datetime(2026, 1, 1, 10, 0, 0)
    det = [
        {"start_time": start, "end_time": start + timedelta(seconds=60)},
        {"start_time": start + timedelta(seconds=120), "end_time": start + timedelta(seconds=180)}
    ]
    ref = [
        {"start_time": start, "end_time": start + timedelta(seconds=60)},
        {"start_time": start + timedelta(seconds=125), "end_time": start + timedelta(seconds=185)}
    ]
    
    matcher = CorrelationMatcher()
    matches = matcher.match(det, ref)
    assert len(matches) == 2
    assert matches[0] == (0, 0, 1.0)
    assert matches[1][0] == 1
    assert matches[1][1] == 1
    assert matches[1][2] > 0.9
