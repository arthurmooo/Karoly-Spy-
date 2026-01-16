import os
import sys
import tempfile
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.storage import StorageManager
from projectk_core.processing.parser import FitParser

def analyze_structure(nolio_id, storage_path):
    storage = StorageManager()
    content = storage.download_fit_file(storage_path)
    
    if not content:
        print("Could not download file.")
        return

    with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        df, meta, laps = FitParser.parse(tmp_path)
        print(f"\nStructure for Nolio ID {nolio_id}:")
        print(f"{ 'Lap':<5} | {'Dist (m)':<10} | {'Dur (s)':<8} | {'P. Avg':<8} | {'FC Avg':<8}")
        print("-" * 55)
        for i, lap in enumerate(laps):
            dist = lap.get('total_distance', 0)
            dur = lap.get('total_elapsed_time', 0)
            p = lap.get('avg_power', 0) or 0
            fc = lap.get('avg_heart_rate', 0) or 0
            print(f"{i+1:<5} | {dist:<10.0f} | {dur:<8.0f} | {p:<8.1f} | {fc:<8.1f}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    analyze_structure('89279056', '9f82e8ce-1ae7-48ef-9576-33d7ed6fe331/2026/89279056.fit')
