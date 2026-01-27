import pandas as pd
from projectk_core.processing.parser import UniversalParser

def main():
    path = "data/samples/seraphin_sprint_None.fit"
    print(f"📂 Parsing {path}...")
    
    df, meta, laps = UniversalParser.parse(path)
    
    print(f"📊 Found {len(laps)} laps.")
    
    print(f"{'#':<3} | {'Duration':<8} | {'Avg Power':<9} | {'Max Power':<9} | {'Label'}")
    print("-" * 50)
    
    for i, lap in enumerate(laps):
        dur = lap.get("total_timer_time", 0)
        avg_p = lap.get("avg_power", 0)
        max_p = lap.get("max_power", 0)
        
        # Heuristic label
        label = "Rest"
        if avg_p > 250:
            label = "Work"
        if avg_p > 400 and dur < 20:
            label = "SPRINT!"
            
        print(f"{i:<3} | {dur:<8.1f} | {avg_p:<9.1f} | {max_p:<9.1f} | {label}")

if __name__ == "__main__":
    main()
