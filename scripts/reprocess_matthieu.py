
import os
import sys
import logging
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.logic.reprocessor import ReprocessingEngine
from projectk_core.db.connector import DBConnector

# Setup logging
logging.basicConfig(level=logging.INFO)

def reprocess_matthieu():
    reprocessor = ReprocessingEngine()
    print(f"🔄 Reprocessing activities for Matthieu Poullain using UniversalParser...")
    try:
        reprocessor.run(athlete_name_filter="Matthieu", force=True)
        print(f"✅ Reprocessing complete.")
    except Exception as e:
        print(f"❌ Failed: {e}")

if __name__ == "__main__":
    reprocess_matthieu()
