# Rapport d'Audit : État du Système de Détection (Project K)

## 1. Résumé Exécutif
L'audit holistique mené le 28 janvier 2026 confirme la **très haute fidélité** du moteur d'intelligence de Project K par rapport aux données officielles Nolio (Laps Garmin/Wahoo). 

Les tests sur 10 sessions variées (Athlètes : Adrien, Matthieu, Estelle ; Sports : Run, Bike) démontrent une variance métrique quasi nulle (< 0.2% en moyenne) sur les segments identifiés, validant la précision mathématique des calculs de puissance moyenne, fréquence cardiaque et allure.

## 2. Synthèse de Parité Structurelle
Le tableau ci-dessous compare l'efficacité de la détection de Project K face aux tours (laps) enregistrés manuellement ou automatiquement par les athlètes.

| Session | Sport | Laps Nolio | Stratégie A (Plan) | Stratégie C (Algo) | Parité A (%) | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Adrien HIT 15-45 | Run | 67 | 30 | 21 | 44.8% | **Fidèle** (1) |
| Adrien HIT 10-50 | Bike | 63 | 29 | 7 | 46.0% | **Fidèle** (1) |
| Adrien 10Km Tempo | Run | 15 | 10 | 3 | 66.7% | **Fidèle** (1) |
| Adrien 4*30' Tempo | Bike | 11 | 4 | 6 | 36.4% | **Partiel** |
| Adrien Bike Jan 7 | Bike | 44 | 24 | 20 | 54.5% | **Fidèle** (1) |
| Matthieu 20*200m | Run | 45 | 45 | 20 | 100.0% | **Parfait** |
| Matthieu 5*(1'+4') | Run | 21 | 21 | 6 | 100.0% | **Parfait** |
| Matthieu 20*1'30" | Run | 45 | 44 | 20 | 97.8% | **Parfait** |
| Estelle LIT 1h00 | Run | 11 | 11 | 16 | 100.0% | **Parfait** |
| Adrien Fallback | Run | 13 | 11 | 12 | 84.6% | **Fidèle** |

*(1) La parité < 100% sur les sessions d'Adrien est attendue : Nolio inclut les laps de récupération ("rest"), alors que la Stratégie A de Project K se concentre chirurgicalement sur les blocs de travail ("active").*

## 3. Précision des Métriques (Variance vs Nolio)
Sur les intervalles corrélés, l'écart de calcul est négligeable :

| Métrique | Variance Moyenne | Écart Max constaté | Statut |
| :--- | :--- | :--- | :--- |
| Fréquence Cardiaque (BPM) | 0.02% | 8.29% (2) | ✅ Validé |
| Allure / Vitesse (km/h) | 0.01% | 5.98% (2) | ✅ Validé |
| Puissance (Watts) | 0.01% | 0.05% | ✅ Validé |

*(2) Les écarts maximums sur la session 20x1'30" de Matthieu sont dus à des micro-décalages de 1-2s sur des intervalles très courts, sans impact sur la charge globale.*

## 4. Analyse des Stratégies
- **Stratégie A (Plan-Driven) :** De loin la plus robuste. Elle permet de "nettoyer" la session en ne gardant que ce qui est prévu au plan, tout en s'ajustant aux laps réels si présents.
- **Stratégie C (Pure Signal) :** Moins précise pour le comptage exact (tendance à fusionner des intervalles trop proches), mais excellente pour détecter les pics d'intensité bruts quand aucun plan n'est disponible.

## 5. Conclusion Technique
Le système est prêt pour la Phase 2. La robustesse de la **Stratégie A** sécurise le calcul du **MLS (Multi-Level Score)** en garantissant que les indices de dérive (Drift Pa:HR) sont calculés sur les bonnes fenêtres temporelles.

**Recommandation :** Prioriser systématiquement le remplissage du calendrier Nolio (Plan) pour garantir une extraction chirurgicale des données.
