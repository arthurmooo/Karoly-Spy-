
import os
import sys
import tempfile
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.parser import FitParser

def check_fit_hr(nolio_id, athlete_id):
    client = NolioClient()
    print(f"Downloading FIT for {nolio_id}...")
    activity = client.get_activity_details(nolio_id, athlete_id=athlete_id)
    file_url = activity.get('file_url')
    
    if not file_url:
        print("No FIT file URL.")
        return

    fit_data = client.download_fit_file(file_url)
    if not fit_data:
        print("Failed to download FIT.")
        return

    with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
        tmp.write(fit_data)
        tmp_path = tmp.name

    try:
        df, meta, laps = FitParser.parse(tmp_path)
        print(f"FIT columns: {df.columns.tolist()}")
        if 'heart_rate' in df.columns:
            hr_data = df['heart_rate'].dropna()
            if not hr_data.empty:
                print(f"Found {len(hr_data)} HR points. Avg: {hr_data.mean():.1f}")
            else:
                print("Heart rate column exists but is empty (all NaN).")
        else:
            print("No 'heart_rate' column in FIT file.")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    check_fit_hr(89841100, 25820)
