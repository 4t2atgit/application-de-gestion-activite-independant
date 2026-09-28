# Architecture

## Vue d'ensemble

L'application est une solution locale de suivi d'activité pour
micro-entrepreneur. Elle est composée de deux workspaces npm TypeScript :

- `frontend` : SPA React construite avec Vite et mise en forme avec Tailwind CSS.
- `backend` : API REST Express.

Le frontend est servi par Vite sur le port `5173` et le backend par défaut sur le
port `3001`. Le frontend appelle l'API avec `VITE_API_URL` ou, en l'absence de
configuration, `http://localhost:3001/api`.

## Frontend

`frontend/src/main.tsx` monte l'application dans `BrowserRouter`. `App.tsx` déclare
les routes du tableau de bord (`/`), des clients, projets, activités, factures et
de la corbeille. `Navbar` utilise `NavLink` afin que l'URL, le bouton de navigation
actif et la page affichée restent synchronisés ; les liens directs et l'historique
du navigateur fonctionnent également.

Les pages accèdent au backend exclusivement par
`frontend/src/services/api.ts`. Ce client centralise les requêtes HTTP, le
traitement des erreurs et les payloads. Les types de l'interface utilisateur sont
définis dans `frontend/src/types.ts`.

Les pages de gestion utilisent les composants génériques `FormField` et
`DataTable`. La page `Heures` constitue une exception : elle présente un
semainier mensuel. Pour chaque semaine, l'utilisateur sélectionne les projets
actifs à renseigner ; les projets ayant déjà des activités pour cette semaine
restent visibles. Les lignes sont regroupées par client et appliquent
préventivement les contraintes de répartition des journées.

## Backend

`backend/src/server.ts` initialise Express, charge le fichier `.env` du
répertoire `backend` lorsqu'il existe, puis monte les routes sous `/api`.

Les routes assurent la validation des requêtes HTTP et délèguent le traitement aux
services :

| Ressource | Route | Service |
| --- | --- | --- |
| Clients | `/api/clients` | `clientService` |
| Projets | `/api/projets` | `projectService` |
| Activités | `/api/heures` | `heuresService` |
| Factures | `/api/factures` | `factureService` |
| Profil émetteur | `/api/issuer` | `issuerService` |
| Encaissements | `/api/encaissements` | `encaissementService` |
| Tableau de bord | `/api/dashboard` | `dashboardService` |
| Corbeille | `/api/corbeille` | `trashService` |

Les services appliquent les règles métier, résolvent les relations entre entités
et lisent ou écrivent les données. Les types de l'API sont définis dans
`backend/src/types.ts` et doivent rester synchronisés avec ceux du frontend.

## Persistance CSV

Les données métier résident dans les fichiers versionnés de `backend/data` :
`clients.csv`, `projets.csv`, `heures.csv`, `factures.csv`, `encaissements.csv`
et `emetteur.csv`.

`csvService` crée les fichiers manquants, échappe les valeurs CSV et écrit via un
fichier temporaire renommé ensuite de manière atomique. Les services convertissent
explicitement les nombres à la lecture et à l'écriture, car le format CSV stocke
des chaînes.

Chaque CSV métier contient aussi `deleted_at`. Une valeur vide désigne une donnée
active ; une date ISO la place dans la corbeille. Les listes métier et le tableau
de bord excluent ces lignes.

`clients.csv` conserve les colonnes historiques et ajoute le nom complet et la
fonction du contact, son téléphone et son adresse de facturation. Une colonne
absente dans un ancien CSV est lue comme une chaîne vide.

`emetteur.csv` stocke l'unique profil d'entreprise réutilisable : raison sociale,
nom commercial, adresse, SIRET, TVA, email, téléphone, IBAN et conditions de
paiement. L'API expose ce profil par `GET` et `PUT /api/issuer`.

Le schéma courant de `factures.csv` conserve `id`, `numero_facture`,
`client_id`, `mois_facture`, `montant_ht`, `date_creation` et `statut`, puis
enregistre les coordonnées émetteur/client sous forme d'instantanés et les
lignes d'activité sérialisées en JSON dans une cellule CSV échappée. La lecture
reste compatible avec les anciennes lignes sans ces colonnes : les coordonnées
manquantes sont représentées par des chaînes vides et les lignes par une liste
vide. Les lignes historiques utilisant `projet_id` et `date_facture` restent
lisibles ; cette date fournit alors le mois et la date de création de secours,
sans modifier manuellement les données existantes.

Les chemins de données sont résolus depuis le répertoire de travail. Les scripts
npm du workspace backend doivent donc être utilisés pour travailler sur les
données réelles.

`encaissements.csv` conserve `id`, `facture_id`, `date`, `montant`,
`moyen_paiement` (facultatif), `note` (facultative) et `deleted_at`. Chaque
encaissement règle partiellement ou totalement une facture envoyée ; le cumul
des encaissements actifs détermine le solde restant dû affiché dans
l'interface Factures.

## Flux métier

1. Un client est créé avec son taux journalier par défaut.
2. Un projet est rattaché à ce client.
3. Une activité enregistre une journée ou une demi-journée pour ce projet et
   capture le taux applicable.
4. Une facture choisit un client et un mois, puis calcule son montant HT à partir
   de toutes les activités de ses projets pour cette période. Le backend génère
   son numéro annuel et sa date de création, et capture les coordonnées des deux
   parties ainsi que les lignes détaillées. Le brouillon PDF est généré avec
   jsPDF côté navigateur et fortement marqué « BROUILLON ». La police DejaVu
   Sans embarquée (licence dans `frontend/src/assets/fonts`) prend en charge les
   accents français et le symbole euro. Les factures envoyées et payées exportent
   le même instantané finalisé sans marque.
5. Le tableau de bord agrège les activités et factures du mois courant.

Les flèches de navigation mensuelle des pages Heures et Factures modifient
respectivement le mois de saisie et le mois de facturation.
