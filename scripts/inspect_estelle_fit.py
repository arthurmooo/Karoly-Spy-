
import os
import tempfile
import pandas as pd
import fitdecode
from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.parser import FitParser
from dotenv import load_dotenv

load_dotenv()

def inspect_fit():
    client = NolioClient()
    athlete_id = 25826
    workout_id = 90004734
    
    print(f"--- Fetching details for workout {workout_id} ---")
    details = client.get_activity_details(workout_id, athlete_id=athlete_id)
    
    if not details or 'file_url' not in details or not details['file_url']:
        print("❌ No file_url found for this workout.")
        return

    file_url = details['file_url']
    print(f"✅ Found file_url: {file_url[:100]}...")
    
    print("📥 Downloading FIT file...")
    content = client.download_fit_file(file_url)
    
    if not content:
        print("❌ Failed to download FIT file.")
        return
        
    with tempfile.NamedTemporaryFile(suffix=".fit", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name
        
    print(f"📄 Saved to {tmp_path}")
    
    try:
        # Inspect frames
        hr_in_records = 0
        hr_in_laps = 0
        total_records = 0
        
        with fitdecode.FitReader(tmp_path) as fit:
            first_record = True
            for frame in fit:
                if frame.frame_type == fitdecode.FIT_FRAME_DATA:
                    if frame.name == 'record':
                        if first_record:
                            print(f"   🔍 First record fields: {[f.name for f in frame.fields]}")
                            first_record = False
                        total_records += 1
                        for field in frame.fields:
                            if field.name == 'heart_rate' and field.value is not None:
                                hr_in_records += 1
                                break
                    elif frame.name == 'lap':
                        for field in frame.fields:
                            if field.name == 'avg_heart_rate' and field.value is not None:
                                hr_in_laps += 1
                                print(f"   ❤️ Found avg_heart_rate in lap: {field.value}")
                                break
                    elif frame.name == 'session':
                        print(f"   🔍 Session fields: {[f.name for f in frame.fields]}")
                        for field in frame.fields:
                            if field.name in ['avg_heart_rate', 'max_heart_rate'] and field.value is not None:
                                print(f"   ❤️ Found {field.name} in session: {field.value}")
        
        print(f"📊 Total record frames: {total_records}")
        print(f"❤️ Records with heart_rate: {hr_in_records}")
        print(f"❤️ Laps with avg_heart_rate: {hr_in_laps}")
        
        if total_records > 0 and hr_in_records == 0:
            print("⚠️ WARNING: Heart rate is MISSING from record messages but might be elsewhere.")
            
        # Try full parse
        print("⚙️ Attempting full parse with FitParser...")
        df, metadata, laps = FitParser.parse(tmp_path)
        print(f"✅ Parsed DF shape: {df.shape}")
        if 'heart_rate' in df.columns:
            print(f"📈 Heart rate mean in DF: {df['heart_rate'].mean()}")
        else:
            print("❌ heart_rate column NOT FOUND in parsed DataFrame.")
            print(f"Columns found: {df.columns.tolist()}")

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    inspect_fit()
