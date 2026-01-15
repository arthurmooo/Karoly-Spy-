import os
import sys
import requests
from dotenv import load_dotenv

load_dotenv()
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from projectk_core.auth.nolio_auth import NolioAuthenticator

def test_full_access():
    print("=== 🔍 DIAGNOSTIC COMPLET ACCÈS API NOLIO ===")
    auth = NolioAuthenticator()
    token = auth.get_valid_token()
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    base_url = "https://www.nolio.io/api"
    
    # On utilise l'ID d'Adrien Claeyssen pour les tests "managed" 
    test_athlete_id = 57896 
    
    endpoints = [
        ("Mon Profil Coach", f"{base_url}/get/user/", {}),
        ("Liste de mes Athlètes", f"{base_url}/get/athletes/", {"wants_coach": "true"}),
        ("Séances Réalisées (Athlète)", f"{base_url}/get/training/", {"athlete_id": test_athlete_id, "limit": 1}),
        ("Séances Prévues (Athlète)", f"{base_url}/get/planned/training/", {"athlete_id": test_athlete_id, "limit": 1}),
        ("Notes / Blessures (Athlète)", f"{base_url}/get/note/", {"athlete_id": test_athlete_id, "limit": 1}),
        ("Métriques / Poids (Coach)", f"{base_url}/get/user/meta/", {"limit": 1}),
    ]

    results = []

    for name, url, params in endpoints:
        print(f"Testing: {name}...", end=" ", flush=True)
        try:
            res = requests.get(url, headers=headers, params=params)
            if res.status_code == 200:
                print("✅ OK")
                results.append((name, "✅ ACCÈS AUTORISÉ"))
            else:
                error_msg = res.text if res.text else "No error body"
                print(f"❌ BLOCKED ({res.status_code})")
                results.append((name, f"❌ BLOQUÉ ({res.status_code}) - {error_msg}"))
        except Exception as e:
            print(f"💥 ERREUR : {e}")
            results.append((name, f"💥 ERREUR TECHNIQUE : {e}"))

    # Test spécifique pour les STREAMS (très important pour nos calculs)
    print("Testing: Flux de données (Streams)...", end=" ", flush=True)
    # On ne peut tester streams que si on a un ID de workout, mais on peut tester l'URL de base
    res_stream = requests.get(f"{base_url}/get/training/streams/", headers=headers, params={"id": 0})
    if "Not authorized" in res_stream.text:
        print("❌ BLOCKED")
        results.append(("Flux de données (Streams)", "❌ BLOQUÉ - Nécessite une autorisation spéciale"))
    else:
        print("❓ MIEUX (Probablement autorisé mais ID invalide)")
        results.append(("Flux de données (Streams)", "✅ SEMBLE OUVERT (à confirmer avec un vrai ID)"))

    print("\n\n=== 📄 RAPPORT À ENVOYER À NOLIO ===")
    print(f"Client ID : {auth.client_id}")
    print("-" * 40)
    for name, status in results:
        print(f"{name.ljust(30)} : {status}")
    print("-" * 40)

if __name__ == "__main__":
    test_full_access()
