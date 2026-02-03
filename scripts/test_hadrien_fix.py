
import os
import sys
from dotenv import load_dotenv
from projectk_core.integrations.nolio import NolioClient

load_dotenv()

def test_hadrien_health():
    client = NolioClient()
    # Hadrien Tabou: 717708
    data = client.get_athlete_health_metrics(717708, days=5)
    print("Health data for Hadrien:")
    for date, metrics in data.items():
        print(f"{date}: {metrics}")

if __name__ == "__main__":
    test_hadrien_health()
