from projectk_core.processing.interval_matcher import IntervalMatcher
import pandas as pd
import numpy as np

print("🧪 Test du Matcher d'Intervalles (Chirurgie)...")

matcher = IntervalMatcher()

# 1. Création de données synthétiques :
# 3min Échauffement (100W) + 2min Travail (300W) + 3min Repos (100W)
# Total 8min = 480s à 1Hz
power = np.concatenate([np.full(180, 100), np.full(120, 300), np.full(180, 100)])
df = pd.DataFrame({'power': power, 'speed': np.zeros(480)})

# 2. Définition de la cible (Plan Nolio)
# On attend 1 bloc de 120s à 300W
target = [{"duration": 120, "target_type": "power", "type": "active", "target_min": 300}]

# 3. Exécution du Matcher
results = matcher.match(df, target, sport="bike")

# 4. Vérification des résultats
print(f"Nombre d'intervalles détectés : {len(results)} (Attendu: 1)")

if results:
    int1 = results[0]
    print(f"  Bloc 1 : Puissance Moyenne = {int1['avg_power']:.1f}W (Cible: 300.0W)")
    print(f"  Respect Score : {int1['respect_score']:.1f}% (Attendu: 100.0%)")
    
    # Test de réussite
    if len(results) == 1 and int1['avg_power'] == 300.0 and int1['respect_score'] == 100.0:
        print("\n✅ Validation Réussie ! Le matcher a isolé le bloc avec une précision chirurgicale.")
    else:
        print("\n❌ Échec de la validation. Les valeurs ne correspondent pas.")
else:
    print("\n❌ Échec : Aucun intervalle détecté.")
