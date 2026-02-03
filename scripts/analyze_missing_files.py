
import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from projectk_core.db.connector import DBConnector

def analyze_missing_files():
    db = DBConnector()
    
    # Récupérer les sports des activités sans fichier
    res = db.client.table("activities").select("sport_type").is_("fit_file_path", "null").execute()
    
    stats = {}
    for row in res.data:
        s = row['sport_type']
        stats[s] = stats.get(s, 0) + 1
        
    print(f"Répartition par sport des 79 activités sans fichier :")
    for sport, count in sorted(stats.items(), key=lambda x: x[1], reverse=True):
        print(f" - {sport}: {count}")

if __name__ == "__main__":
    analyze_missing_files()
