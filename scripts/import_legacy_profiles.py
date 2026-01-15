import os
import re
import pandas as pd
from datetime import datetime
from projectk_core.db.connector import DBConnector

def get_athlete_id_map(db):
    response = db.client.table("athletes").select("id, first_name, last_name").execute()
    return {f"{a['first_name']} {a['last_name']}": a['id'] for a in response.data}

def extract_profiles():
    db = DBConnector()
    athlete_map = get_athlete_id_map(db)
    data_dir = "Excel Actuel/Suivi_HR"
    
    print("Extracting profiles from 'Test' sessions...")
    
    for filename in os.listdir(data_dir):
        if not filename.endswith(".csv"):
            continue
            
        # Get athlete name from filename
        match = re.match(r"^([^-]+)", filename)
        if not match:
            continue
        name = match.group(1).strip().replace("_", " ")
        athlete_id = athlete_map.get(name)
        
        if not athlete_id:
            continue
            
        # Determine sport
        sport = "bike" if "Tableau 1.csv" in filename else "run"
        
        try:
            # Read CSV with proper separator
            df = pd.read_csv(os.path.join(data_dir, filename), sep=';', on_bad_lines='skip')
            
            # Look for "Test" in Comments or Type columns
            # Column names vary between files, let's look for "Commentaires"
            comment_col = next((c for c in df.columns if "Comment" in c), None)
            if not comment_col:
                continue
                
            test_sessions = df[df[comment_col].str.contains("Test", case=False, na=False)]
            
            for _, row in test_sessions.iterrows():
                date_str = str(row.iloc[0]) # First column is usually Date
                hr_mean = row.get("HRmean")
                power = row.get("Puissance")
                
                try:
                    # Parse date DD/MM/YY or DD/MM/YYYY
                    dt = pd.to_datetime(date_str, dayfirst=True)
                    
                    if pd.isna(dt) or pd.isna(hr_mean):
                        continue
                        
                    # Create profile entry
                    # NO APPROXIMATION: Leave thresholds null until explicitly provided
                    db.client.table("physio_profiles").insert({
                        "athlete_id": athlete_id,
                        "sport": sport,
                        "lt1_hr": None,
                        "lt2_hr": None,
                        "lt2_power_pace": None,
                        "valid_from": dt.isoformat(),
                        "valid_to": None
                    }).execute()
                    print(f"  -> Test date placeholder created for {name} ({sport}) on {date_str}")
                    
                except Exception as e:
                    pass # Skip rows with unparseable dates
                    
        except Exception as e:
            print(f"  !! Error processing {filename}: {e}")

if __name__ == "__main__":
    extract_profiles()
