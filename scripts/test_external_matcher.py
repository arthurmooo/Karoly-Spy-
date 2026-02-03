import os
import sys
import json
import pandas as pd
import glob
import argparse

# Add current directory to path
sys.path.append(os.getcwd())

from projectk_core.processing.parser import FitParser
from projectk_core.processing.plan_parser import NolioPlanParser

def prepare_llm_payload(fit_path, json_path):
    print(f"--- Preparing payload for {fit_path} ---")
    
    # 1. Parse Data
    df, meta, laps = FitParser.parse(fit_path)
    
    # 2. Parse Plan
    with open(json_path, 'r') as f:
        plan_data = json.load(f)
    
    sport = plan_data.get('activity', {}).get('sport', 'run')
    parser = NolioPlanParser()
    target_grid = parser.parse(plan_data.get('planned_structure', []), sport_type=sport)
    
    # 3. Simplify Stream for LLM (Token efficiency)
    # We only take the columns we need
    cols = ['timestamp', 'power', 'heart_rate', 'speed', 'cadence']
    # Ensure columns exist
    df_llm = df[[c for c in cols if c in df.columns]].copy()
    
    # Convert timestamp to relative seconds for easier reading
    if 'timestamp' in df_llm.columns:
        start_ts = df_llm['timestamp'].iloc[0]
        df_llm['sec'] = (df_llm['timestamp'] - start_ts).dt.total_seconds().astype(int)
        df_llm = df_llm.drop(columns=['timestamp'])

    # 4. Prepare Laps metadata
    laps_summary = []
    for l in laps:
        laps_summary.append({
            'start_time': l.get('start_time'),
            'total_elapsed_time': l.get('total_elapsed_time'),
            'avg_power': l.get('avg_power'),
            'avg_speed': l.get('avg_speed')
        })

    payload = {
        "context": {
            "sport": sport,
            "athlete": plan_data.get('athlete', {}).get('name', 'Unknown'),
            "athlete_id": plan_data.get('athlete', {}).get('id'),
            "date": plan_data.get('activity', {}).get('date_start'),
            "activity_id": plan_data.get('activity', {}).get('id'),
            "id_partner": plan_data.get('activity', {}).get('id_partner'),
            "fit_file_name": os.path.basename(fit_path)
        },
        "target_grid": target_grid,
        "laps_metadata": laps_summary,
        "stream_data_sample": df_llm.to_dict(orient='records')
    }
    
    return payload

def main():
    parser = argparse.ArgumentParser(description="Prepare LLM payload for interval matching.")
    parser.add_argument("--athlete", type=str, help="Athlete name (e.g., Adrien)")
    parser.add_argument("--date", type=str, help="Date (e.g., 2026-01-07)")
    args = parser.parse_args()

    test_files = glob.glob("data/test_cache/*.fit")
    if not test_files:
        print("No test files found in data/test_cache/")
        return

    selected_file = None
    if args.athlete or args.date:
        for f in test_files:
            if (not args.athlete or args.athlete.lower() in f.lower()) and \
               (not args.date or args.date in f):
                selected_file = f
                break
    else:
        # Default to Adrien Jan 7 if available, otherwise first file
        for f in test_files:
            if "Adrien" in f and "2026-01-07" in f:
                selected_file = f
                break
        if not selected_file:
            selected_file = test_files[0]

    if not selected_file:
        print("No matching file found.")
        return

    fpath = selected_file
    jpath = fpath.replace(".fit", ".json")
    
    if not os.path.exists(jpath):
        print(f"Missing JSON for {fpath}")
        return
        
    payload = prepare_llm_payload(fpath, jpath)
    
    output_path = f"llm_payload_{os.path.basename(fpath).replace('.fit', '')}.json"
    with open(output_path, 'w') as f:
        json.dump(payload, f, indent=2, default=str)
        
    print(f"\nPayload generated: {output_path}")
    print(f"Targeting: {os.path.basename(fpath)}")
    print("You can now copy its content and paste it to your LLM along with PROMPT_INTERVAL_MATCHER.md")

if __name__ == "__main__":
    main()
