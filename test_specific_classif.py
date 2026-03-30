
import pandas as pd
from projectk_core.logic.classifier import ActivityClassifier

classifier = ActivityClassifier()

test_cases = [
    {"title": "Run and Bike La Wantzenau", "nolio_type": "Course à pied", "sport_name": "Run"},
    {"title": "Sortie vélo le matin", "nolio_type": "Vélo", "sport_name": "Bike"},
    {"title": "Sortie vélo dans l'après-midi", "nolio_type": "Vélo", "sport_name": "Bike"},
    {"title": "Natation dans l'après-midi", "nolio_type": "Natation", "sport_name": "Swim"},
]

for case in test_cases:
    # Simulating a dataframe with some variability to see if it triggers strategy 7
    df = pd.DataFrame({"power": [100, 200, 100, 200, 100, 200]}) # High CV
    res = classifier.detect_work_type(df, case["title"], case["nolio_type"], case["sport_name"])
    print(f"Title: {case['title']} -> Result: {res}")

    # Test is_competition separately
    is_comp = classifier.is_competition(case["title"], case["nolio_type"])
    print(f"  is_competition: {is_comp}")
