# Recommandations

## Contrat entre frontend et backend

Lorsqu'une ressource évolue, mettre à jour ensemble les types du frontend et du
backend, le service métier, la route Express et `frontend/src/services/api.ts`.
Les champs dérivés par le backend, notamment le montant, le numéro et la date de
création d'une facture, ne doivent pas devenir des champs saisissables côté
frontend. Une facture ne référence qu'un client et un mois de facturation, pas
un projet.

## Données CSV

Préserver l'utilisation de `csvService` pour toute nouvelle collection CSV :
création du fichier, échappement des valeurs, écriture atomique et génération
d'identifiants y sont centralisés. Ajouter les conversions `parse*` et
`serialize*` nécessaires pour les champs numériques.

Ne pas utiliser les données de `backend/data` comme jeu de données de test. Les
tests de services créent un répertoire temporaire puis y basculent
`process.cwd()` afin d'isoler leurs fichiers CSV. Les tests de facture doivent
conserver des lignes supprimées logiquement pour vérifier la numérotation et
l'unicité client/mois.

## Règles réparties entre l'API et l'interface

Les contraintes de saisie des activités sont imposées par `heuresService` et
reproduites dans `frontend/src/pages/Heures.tsx` pour éviter les choix invalides.
Toute évolution de ces règles doit modifier les deux couches, en laissant le
backend comme autorité finale.

## Interface

L'interface et les messages métier sont en français. Réutiliser `FormField` et
`DataTable` pour les écrans CRUD comparables, et conserver les styles Tailwind
déjà employés par les pages existantes.
