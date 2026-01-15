import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()

# Add project root to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.db.connector import DBConnector
from projectk_core.auth.nolio_auth import NolioAuthenticator

def normalize(name: str) -> str:
    """Basic normalization for matching."""
    if not name: return ""
    return "".join(name.lower().split()).replace("-", "").replace("_", "")

def map_athletes():
    print("=== Mapping Nolio Athletes to DB ===")
    db = DBConnector()
    auth = NolioAuthenticator()
    
    # 1. Get Athletes from DB (Excel)
    res = db.client.table("athletes").select("id, first_name, last_name").execute()
    db_athletes = res.data
    print(f"Found {len(db_athletes)} athletes in Database (Excel).")
    
    # 2. Get Athletes from Nolio
    token = auth.get_valid_token()
    headers = {"Authorization": f"Bearer {token}"}
    response = requests.get("https://www.nolio.io/api/get/athletes/", headers=headers)
    
    if response.status_code != 200:
        print(f"Error fetching Nolio athletes: {response.text}")
        return
        
    nolio_athletes = response.json()
    print(f"Found {len(nolio_athletes)} athletes on Nolio.")
    
    # 3. Matching Logic
    mapped_count = 0
    for n_ath in nolio_athletes:
        n_id = n_ath.get("nolio_id")
        n_full_name = normalize(n_ath.get("name", ""))
        
        # Look for match in DB
        for d_ath in db_athletes:
            d_full_name = normalize(f"{d_ath['first_name']} {d_ath['last_name']}")
            
            # Match if strings are very similar
            if n_full_name == d_full_name or n_full_name in d_full_name or d_full_name in n_full_name:
                print(f"Match: {n_ath.get('name')} (Nolio:{n_id}) <-> {d_ath['first_name']} {d_ath['last_name']} (DB:{d_ath['id']})")
                
                # Update DB
                db.client.table("athletes").update({"nolio_id": n_id}).eq("id", d_ath["id"]).execute()
                mapped_count += 1
                break
                
    print(f"\n✅ Mapping complete: {mapped_count} athletes linked.")

if __name__ == "__main__":
    map_athletes()