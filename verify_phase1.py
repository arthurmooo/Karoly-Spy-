from projectk_core.processing.plan_parser import NolioPlanParser
import json

parser = NolioPlanParser()

# On simule une structure Nolio complexe : 2 répétitions de (5min travail + 1min récup)
sample = {
    "type": "repetition",
    "value": 2,
    "steps": [
        {"intensity_type": "active", "step_duration_value": 300, "target_value_min": 250, "step_duration_type": "duration"},
        {"intensity_type": "rest", "step_duration_value": 60, "step_duration_type": "duration"}
    ]
}

print("🧪 Test du Parser de Plan...")
result = parser.parse(sample)

# On vérifie qu'on a bien aplati la structure et gardé que le "travail"
print(f"Nombre d'intervalles détectés : {len(result)} (Attendu: 2)")
for i, step in enumerate(result):
    print(f"  Bloc {i+1}: Type={step.get('type')}, Durée={step.get('duration')}s, Cible={step.get('target_min')}W")

if len(result) == 2 and result[0]['duration'] == 300:
    print("\n✅ Validation Réussie !")
else:
    print("\n❌ Échec de la validation.")

