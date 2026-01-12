import os
import re
from projectk_core.db.connector import DBConnector

def get_athlete_name(filename):
    """Extract athlete name from filename (e.g., 'Adrien Claeyssen-Tableau 1.csv')."""
    # Match everything before the first hyphen
    match = re.match(r"^([^-]+)", filename)
    if match:
        name = match.group(1).strip().replace("_", " ")
        # Split into first and last name
        parts = name.split(" ")
        first_name = parts[0]
        last_name = " ".join(parts[1:]) if len(parts) > 1 else "Unknown"
        return first_name, last_name
    return None, None

def import_athletes():
    db = DBConnector()
    data_dir = "Excel Actuel/Suivi_HR"
    
    athletes_found = set()
    
    print("Scanning CSV files...")
    for filename in os.listdir(data_dir):
        if filename.endswith(".csv"):
            first, last = get_athlete_name(filename)
            if first:
                athletes_found.add((first, last))
    
    print(f"Found {len(athletes_found)} unique athletes.")
    
    for first, last in athletes_found:
        print(f"Importing {first} {last}...")
        try:
            # Upsert logic: if athlete exists (matched by first+last), do nothing or update
            # Since we don't have a unique constraint on names in the schema yet, 
            # we'll do a simple check first.
            existing = db.client.table("athletes").select("id").match({
                "first_name": first,
                "last_name": last
            }).execute()
            
            if not existing.data:
                db.client.table("athletes").insert({
                    "first_name": first,
                    "last_name": last
                }).execute()
                print(f"  -> Created.")
            else:
                print(f"  -> Already exists (ID: {existing.data[0]['id']})")
                
        except Exception as e:
            print(f"  !! Error importing {first} {last}: {e}")

if __name__ == "__main__":
    import_athletes()
