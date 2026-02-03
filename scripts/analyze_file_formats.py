import os
import sys
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from projectk_core.db.connector import DBConnector

def analyze_file_formats():
    db = DBConnector()
    
    # Récupérer tous les chemins de fichiers non nuls
    res = db.client.table("activities").select("fit_file_path").not_.is_("fit_file_path", "null").execute()
    
    stats = {}
    for row in res.data:
        path = row['fit_file_path']
        if not path:
            continue
        ext = os.path.splitext(path)[1].lower()
        if not ext:
            ext = "unknown"
        stats[ext] = stats.get(ext, 0) + 1
        
    total = sum(stats.values())
    
    print(f"Rapport des formats de fichiers (Total: {total}) :")
    print(f"-----------------------------------------------")
    for ext, count in sorted(stats.items(), key=lambda x: x[1], reverse=True):
        percentage = (count / total) * 100
        print(f" - {ext.upper().replace('.', '')}: {count} ({percentage:.1f}%)")

if __name__ == "__main__":
    analyze_file_formats()