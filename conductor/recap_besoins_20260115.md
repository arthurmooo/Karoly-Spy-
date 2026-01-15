# 📄 Récapitulatif des Besoins et Décisions - 15/01/2026
*Ce document synthétise les points validés lors de nos échanges du 15 janvier concernant l'industrialisation des outils d'analyse (Phase 1).*

## 1. Infrastructure & Données
- **Historique d'import :** Nous partirons sur une récupération des **6 derniers mois** d'historique de données .fit pour chaque athlète.
- **Stockage (Base de données) :** Validation du passage au **Plan Pro Supabase** (25$/mois) pour garantir le stockage à long terme de tous les fichiers bruts (.fit) sans contrainte de volume (pas de purge nécessaire à court/moyen terme).
- **Permissions Nolio :** La demande d'ouverture complète des droits API (Lecture/Écriture/Webhooks) a été envoyée au support Nolio.
- **Charge Nolio :** Non conservée. Nous ne stockons que la charge calculée par nos propres algorithmes (Méthode Karoly).

## 2. Périmètre Sportif
- **Sports Principaux :** Course à Pied et Vélo (Analyses complètes dès la Phase 1).
- **Sports Complémentaires :** Intégration des disciplines hivernales (Ski de fond, Ski de rando, etc.) demandée.
  - *Action :* Ils seront importés et stockés dès maintenant. L'implémentation du calcul de charge spécifique pour ces sports sera traitée dans un second temps (ou si les métriques Nolio suffisent, nous les récupérerons).

## 3. Nouvelles Métriques "Durabilité" (Séances Intervalles)
Pour chaque séance fractionnée, nous calculerons et stockerons de nouveaux indicateurs de durabilité comparant la fin de séance à la moyenne globale.

**Nouvelles colonnes en Base de Données :**
1.  **Dernier Intervalle :**
    - `Last_Int_Power` : Puissance moyenne du *dernier* intervalle.
    - `Last_Int_HR` : Fréquence Cardiaque moyenne du *dernier* intervalle.
2.  **Moyenne Globale des Intervalles :**
    - `Avg_Int_Power` (Pmoy) : Moyenne des puissances de *tous* les intervalles.
    - `Avg_Int_HR` (HRmean W) : Moyenne des FC de *tous* les intervalles.

*Objectif : Analyser le découplage/dérive entre la moyenne de la séance et l'effort final.*

## 4. Logique de Segmentation & Analyse
L'objectif est d'automatiser le découpage des séances sans dépendre des "laps" manuels (souvent absents ou irréguliers).

### A. Mode "Compétition"
Analyse de la dérive cardiaque (découplage) avec découpage automatique :
- **Segmentation 4 parties :** Analyse quart par quart (1/4, 2/4, 3/4, 4/4).
- **Segmentation 2 parties :** Analyse demi par demi (1/2, 2/2).
- **Métriques par segment :**
    - FC Moyenne
    - Vitesse Moyenne (CàP) ou Puissance Moyenne (Vélo)
    - Ratio Efficacité (FC / Vitesse ou FC / Puissance)
    - Torque (Vélo uniquement)

### B. Mode "Entraînement"
- **Fractionné :** Détection automatique des intervalles (algorithme en cours de finalisation) pour extraction des métriques de durabilité (point 3).
- **Continu (Footing / SL) :** Application systématique d'une analyse en **2 parties** (1/2, 2/2) pour observer la dérive sur les séances d'endurance, comme validé ensemble.

---
*Ce document servira de référence pour le développement des prochaines semaines.*
