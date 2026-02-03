
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(str(Path(__file__).parent.parent))

from projectk_core.db.connector import DBConnector

def calculate_ratio():
    db = DBConnector()
    print("🔍 Calculating ratio of NULL Power AND Pace in view_intervals_karo...")
    
    try:
        # Get all records from the view
        res = db.client.table("view_intervals_karo").select("*").execute()
        
        if not res.data:
            print("✅ No data found in the view.")
            return

        total = len(res.data)
        both_null = 0
        
        for row in res.data:
            # Note: the column names observed in scripts/check_null_intervals.py were:
            # 'Puissance (W)' and 'Allure (min/km)'
            p = row.get('Puissance (W)')
            a = row.get('Allure (min/km)')
            
            if p is None and a is None:
                both_null += 1
        
        ratio = (both_null / total) * 100 if total > 0 else 0
        
        print(f"📊 Results:")
        print(f"   Total interval activities: {total}")
        print(f"   Activities with both NULL: {both_null}")
        print(f"   Ratio: {ratio:.1f}%")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    calculate_ratio()
