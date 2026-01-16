import os
import sys
import pandas as pd
import tempfile
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.integrations.nolio import NolioClient
from projectk_core.processing.parser import FitParser
from projectk_core.logic.classifier import ActivityClassifier

def verify_athletes(athlete_names):
    nolio = NolioClient()
    classifier = ActivityClassifier()
    
    # Get managed athletes to find IDs
    try:
        all_athletes = nolio.get_managed_athletes()
    except Exception as e:
        print(f"❌ Error fetching athletes: {e}")
        return

    target_athletes = []
    for name in athlete_names:
        found = next((a for a in all_athletes if name.lower() in a.get('name', '').lower()), None)
        if found:
            target_athletes.append(found)
        else:
            print(f"⚠️ Athlete '{name}' not found on Nolio.")

    date_to = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    date_from = (datetime.now(timezone.utc) - timedelta(days=20)).strftime("%Y-%m-%d")

    results = []

    for a in target_athletes:
        a_id = a.get('nolio_id', a.get('id'))
        name = a.get('name')
        print(f"\n--- Checking Athlete: {name} (ID: {a_id}) ---")
        
        activities = nolio.get_activities(a_id, date_from, date_to)
        if not activities:
            print("No activities found in the last 20 days.")
            continue

        for act in activities[:10]:
            title = act.get('name', 'No Title')
            nolio_sport = act.get('sport', 'Unknown')
            nolio_type = act.get('type', 'Unknown')
            file_url = act.get('file_url')
            
            detected_type = "N/A"
            cv = 0.0
            
            if file_url:
                fit_data = nolio.download_fit_file(file_url)
                if fit_data:
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".fit") as tmp:
                        tmp.write(fit_data)
                        tmp_path = tmp.name
                    
                    try:
                        df, _, _ = FitParser.parse(tmp_path)
                        if not df.empty:
                            # Calculate CV manually for logging
                            signal = None
                            if 'power' in df.columns and df['power'].mean() > 0:
                                signal = df['power']
                            elif 'speed' in df.columns and df['speed'].mean() > 0:
                                signal = df['speed']
                            
                            if signal is not None and signal.mean() > 0:
                                cv = signal.std() / signal.mean()
                            
                            detected_type = classifier.detect_work_type(df, title, nolio_sport)
                    except Exception as e:
                        print(f"  ⚠️ Error parsing {title}: {e}")
                    finally:
                        if os.path.exists(tmp_path):
                            os.remove(tmp_path)
            else:
                # Still try competition detection without FIT
                if classifier.is_competition(title, nolio_sport):
                    detected_type = "competition"
                else:
                    detected_type = "endurance (no data)"

            results.append({
                "Athlete": name,
                "Title": title,
                "Nolio Sport": nolio_sport,
                "Nolio Type": nolio_type,
                "Detected": detected_type,
                "CV": f"{cv:.2%}"
            })
            print(f"  - {title}: Nolio={nolio_type} | Detected={detected_type} (CV={cv:.2%})")

    df_results = pd.DataFrame(results)
    print("\n=== SUMMARY ===")
    print(df_results.to_string(index=False))

if __name__ == "__main__":
    # Test with a few known active athletes
    verify_athletes(["Ilan Spy", "Matthieu Poullain"])
