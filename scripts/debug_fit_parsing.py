import fitdecode
import pandas as pd
import sys

def debug_fit_with_fitdecode(file_path):
    print(f"--- Inspection de {file_path} avec fitdecode ---")
    data = []
    try:
        with fitdecode.FitReader(file_path) as fit:
            for frame in fit:
                if frame.frame_type == fitdecode.FIT_FRAME_DATA and frame.name == 'record':
                    row = {}
                    for field in frame.fields:
                        row[field.name] = field.value
                    data.append(row)
        
        if not data:
            print("Aucune donnée 'record' trouvée.")
            return

        df = pd.DataFrame(data)
        print(f"Lignes extraites : {len(df)}")
        print(f"Champs disponibles : {list(df.columns)}")
        
        cols = [c for c in ['timestamp', 'heart_rate', 'power', 'speed', 'distance', 'calories'] if c in df.columns]
        print("\nAperçu (5 dernières lignes) :")
        print(df[cols].tail(5))
        
        if 'calories' in df.columns:
            print(f"\nCalories totales (cumulées ou max) : {df['calories'].max() if 'calories' in df.columns else 'N/A'}")
        
    except Exception as e:
        print(f"Erreur avec fitdecode : {e}")

if __name__ == "__main__":
    file_to_debug = sys.argv[1] if len(sys.argv) > 1 else "allure_semi.fit"
    debug_fit_with_fitdecode(file_to_debug)