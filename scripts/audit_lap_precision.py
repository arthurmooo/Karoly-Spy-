import os
import pandas as pd
from projectk_core.logic.interval_engine import LapAnalyzer, IntervalMetricsCalculator
from projectk_core.processing.parser import FitParser
from projectk_core.logic.models import DetectionSource

# GROUND TRUTH (Données Nolio fournies par l'utilisateur)
GROUND_TRUTH = {
    "Baptiste": [
        {"dist": 2300, "time": "10:00", "hr": 134, "speed": 13.74},
        {"dist": 1100, "time": "04:00", "hr": 154, "speed": 17.14},
        {"dist": 325, "time": "01:00", "hr": 165, "speed": 19.46},
        {"dist": 1000, "time": "05:00", "hr": 136, "speed": 12.46},
        {"dist": 335, "time": "01:00", "hr": 162, "speed": 20.11},
        {"dist": 127, "time": "00:30", "hr": 162, "speed": 15.19},
        {"dist": 343, "time": "01:00", "hr": 165, "speed": 20.57}
    ],
    "Alexis": [
        {"dist": 1900, "time": "10:00", "hr": 126, "speed": 11.36},
        {"dist": 702, "time": "03:00", "hr": 149, "speed": 14.06},
        {"dist": 518, "time": "02:00", "hr": 157, "speed": 15.58},
        {"dist": 254, "time": "01:00", "hr": 158, "speed": 15.25},
        {"dist": 903, "time": "04:00", "hr": 142, "speed": 13.53},
        {"dist": 474, "time": "01:30", "hr": 161, "speed": 18.95},
        {"dist": 994, "time": "03:30", "hr": 171, "speed": 17.06},
        {"dist": 681, "time": "03:00", "hr": 152, "speed": 13.64},
        {"dist": 454, "time": "01:30", "hr": 166, "speed": 18.18},
        {"dist": 1000, "time": "03:30", "hr": 175, "speed": 17.22},
        {"dist": 673, "time": "03:00", "hr": 158, "speed": 13.48},
        {"dist": 470, "time": "01:30", "hr": 165, "speed": 18.85},
        {"dist": 1000, "time": "03:30", "hr": 174, "speed": 17.65},
        {"dist": 673, "time": "03:00", "hr": 149, "speed": 13.48},
        {"dist": 457, "time": "01:30", "hr": 166, "speed": 18.27},
        {"dist": 1000, "time": "03:30", "hr": 166, "speed": 17.82},
        {"dist": 672, "time": "03:00", "hr": 140, "speed": 13.43}
    ],
    "Dries": [
        {"dist": 2000, "time": "08:47", "hr": 133, "speed": 13.64},
        {"dist": 948, "time": "04:17", "hr": 124, "speed": 13.24},
        {"dist": 9000, "time": "33:22", "hr": 155, "speed": 16.22},
        {"dist": 2000, "time": "09:43", "hr": 134, "speed": 12.37},
        {"dist": 9000, "time": "32:40", "hr": 158, "speed": 16.51},
        {"dist": 2000, "time": "09:30", "hr": 135, "speed": 12.63},
        {"dist": 1000, "time": "04:25", "hr": 142, "speed": 13.58},
        {"dist": 1000, "time": "04:40", "hr": 138, "speed": 12.86}
    ]
}

def time_to_seconds(t_str):
    if not t_str: return 0
    parts = t_str.split(':')
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
    return int(parts[0]) * 60 + int(parts[1])

def format_seconds(seconds):
    m, s = divmod(int(round(seconds)), 60)
    return f"{m:02d}:{s:02d}"

def audit_session(name, fit_path):
    print(f"\n--- AUDIT: {name} ({fit_path}) ---")
    if not os.path.exists(fit_path):
        print(f"❌ Fichier non trouvé: {fit_path}")
        return

    records_df, metadata, laps = FitParser.parse(fit_path)
    
    # Correction: Ajout de la colonne 'time' pour IntervalMetricsCalculator
    if 'timestamp' in records_df.columns:
        start_ts = records_df['timestamp'].iloc[0]
        records_df['time'] = (records_df['timestamp'] - start_ts).dt.total_seconds()

    # 1. Utiliser LapAnalyzer pour extraire les blocs à partir des laps FIT
    analyzer = LapAnalyzer(laps, reference_start_time=metadata.get('start_time'))
    lap_blocks = analyzer.to_blocks()
    
    # 2. Utiliser IntervalMetricsCalculator pour recalculer les métriques SEULEMENT si absentes
    # Dans ce run, on garde les valeurs extraites du FIT par LapAnalyzer
    calculator = IntervalMetricsCalculator(records_df)
    final_blocks = [calculator.calculate(b) for b in lap_blocks]
    
    reference = GROUND_TRUTH.get(name, [])
    
    results = []
    # On compare seulement jusqu'au nombre de tours de référence
    for i, (ref, calc) in enumerate(zip(reference, final_blocks)):
        ref_time = time_to_seconds(ref['time'])
        calc_time = calc.duration
        
        # Unit conversion: PK speed is m/s, Nolio is km/h
        calc_speed_kmh = (calc.avg_speed * 3.6) if calc.avg_speed else 0
        
        delta_time = calc_time - ref_time
        delta_dist = (calc.distance_m - ref['dist']) if calc.distance_m is not None else -ref['dist']
        delta_hr = (calc.avg_hr - ref['hr']) if calc.avg_hr else 0
        delta_speed = calc_speed_kmh - ref['speed']
        
        results.append({
            "Tour": i + 1,
            "Nolio_Time": ref['time'],
            "PK_Time": format_seconds(calc_time),
            "Delta_Time": delta_time,
            "Nolio_Dist": ref['dist'],
            "PK_Dist": round(calc.distance_m, 1) if calc.distance_m is not None else 0,
            "Delta_Dist": round(delta_dist, 1),
            "Nolio_HR": ref['hr'],
            "PK_HR": round(calc.avg_hr, 1) if calc.avg_hr else 0,
            "Delta_HR": round(delta_hr, 1),
            "Nolio_Speed": ref['speed'],
            "PK_Speed": round(calc_speed_kmh, 2),
            "Delta_Speed": round(delta_speed, 2)
        })
    
    df = pd.DataFrame(results)
    print(df.to_markdown(index=False))
    return df

if __name__ == "__main__":
    sessions = [
        ("Baptiste", "data/test_cache/Baptiste_2026-01-09.fit"),
        ("Alexis", "data/test_cache/Alexis_2025-10-17.fit"),
        ("Dries", "data/test_cache/Dries_2026-01-17.fit")
    ]
    
    for name, path in sessions:
        audit_session(name, path)
