import os
import sys
from dotenv import load_dotenv

load_dotenv(override=True)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from scripts.run_ingest import IngestionRobot

def test_webhook_only():
    print("🧪 Testing Webhook processing only (Zero-scan mode)")
    # On initialise le robot sans writeback pour ce test
    robot = IngestionRobot(history_days=0) 
    
    # On appelle directement la méthode interne qui traite la table webhook_events
    robot.process_webhooks()
    
    print("\n🏁 Test complete.")

if __name__ == "__main__":
    test_webhook_only()
