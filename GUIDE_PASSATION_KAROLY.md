# 🏁 Guide de Passation Complet : Project K

Ce document est le mode d'emploi pour transférer l'intégralité de l'infrastructure (Base de données, Webhooks, Intelligence Engine) vers le compte personnel de Karoly.

---

## 🏗️ 1. Pré-requis logistiques (L'Invitation)
Il n'est pas nécessaire de partager des mots de passe personnels.

1.  **Côté Karoly :** Il crée son compte sur Supabase.
2.  **Invitation Team :** Il doit aller dans `Settings -> Organization -> Team` et inviter ton adresse email avec le rôle **Owner** ou **Administrator**.
3.  **Ton Accès :** Une fois l'invitation acceptée, le projet de Karoly apparaîtra dans **ton** propre tableau de bord Supabase (via le menu en haut à gauche). Tu peux alors gérer son projet avec tes propres identifiants.

---

## 💾 2. Étape technique : Déploiement via Supabase CLI
C'est toi qui effectues ces commandes depuis **ton ordinateur**.

### A. Préparation du terminal
Ouvre ton terminal à la **racine du projet** (là où se trouvent les dossiers `supabase/` et `projectk_core/`).
```bash
cd "/Users/arthurmo/Documents/Pro/Freelance/Jobs/Karo Spy/Dossier de travail /"
```

### B. Connexion au projet de Karoly
1.  **Login :** `supabase login` (ouvre une page web pour t'identifier).
2.  **Liaison (Link) :** 
    ```bash
    supabase link --project-ref <ID_PROJET_KAROLY>
    ```
    *Note : L'ID se trouve dans l'URL de son tableau de bord (ex: abcde-fghij-...).*
3.  **Mot de passe BDD :** La CLI va te demander le **Database Password**.
    *   C'est le mot de passe défini à la création du projet.
    *   Si Karoly l'a oublié : va dans `Settings -> Database` et clique sur **Reset database password** pour en créer un nouveau.

### C. Envoi de la structure (Tables & Vues)
```bash
supabase db push
```
*Cette commande lit tes fichiers dans `supabase/migrations/` et recrée tout chez lui instantanément.*

### D. Envoi du Webhook (Logique Nolio)
```bash
supabase functions deploy nolio-webhook
```

---

## 🤖 3. Étape finale : Automatisation (GitHub Actions)
Le "cerveau" Python doit maintenant pointer vers sa nouvelle base.

1.  **URL & Clé :** Récupère la `Project URL` et la `service_role key` dans `Settings -> API` sur son Supabase.
2.  **Secrets GitHub :** Dans ton repo GitHub (Settings -> Secrets -> Actions), remplace les anciennes valeurs par les siennes :
    *   `SUPABASE_URL`
    *   `SUPABASE_SERVICE_ROLE_KEY`
3.  **Nolio :** Assure-toi que les secrets Nolio sont aussi à jour pour ses athlètes.

---

## 📥 4. Initialisation des données (Population)
Une fois le lien établi, lance ces commandes pour remplir sa base vide :

1.  **Créer le dossier de stockage :** `python scripts/setup_storage.py`
2.  **Lancer l'ingestion historique :**
    ```bash
    python run_k.py ingest --days 90 --force
    ```
    *Cela va créer les athlètes, les profils physio et importer les 3 derniers mois d'activités.*

---

## ❓ FAQ Technique
*   **Dois-je aller dans le dossier migrations ?** Non, reste toujours à la racine du projet. La CLI trouvera toute seule le dossier `supabase/`.
*   **Le mdp de la BDD est-il celui de son compte ?** Non. C'est le mot de passe technique "Postgres" du projet. Tu peux le réinitialiser si besoin en tant qu'Admin.
*   **Est-ce que ça va écraser ses données ?** Si la base est vide, non. Si tu refais un `db push` plus tard, la CLI n'enverra que les nouveautés.

---
*Document généré le 25 Janvier 2026 pour sécuriser la Phase 1.*