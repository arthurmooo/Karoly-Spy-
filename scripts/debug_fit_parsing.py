import fitdecode
import pandas as pd

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
        
        cols = [c for c in ['timestamp', 'heart_rate', 'power', 'speed', 'distance', 'Effort Pace'] if c in df.columns]
        print("\nAperçu (5 dernières lignes) :")
        print(df[cols].tail(5))
        
        # Statut sur la puissance
        if 'power' in df.columns:
            p_mean = df['power'].dropna().mean()
            print(f"\nPuissance moyenne détectée : {p_mean:.1f} W")
        
    except Exception as e:
        print(f"Erreur avec fitdecode : {e}")

if __name__ == "__main__":
    debug_fit_with_fitdecode("allure_semi.fit")