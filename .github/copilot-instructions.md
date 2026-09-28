# Instructions pour Copilot

## Commandes

Ce depot npm utilise les workspaces `backend` et `frontend` et requiert Node.js >= 22.12.0.

```powershell
npm install
npm run dev
npm run build
npm test
npm --workspace frontend run lint
```

`npm run dev` lance le backend Express sur `http://localhost:3001` et Vite sur
`http://localhost:5173`. Le frontend peut cibler une autre API avec
`VITE_API_URL`.

Les tests sont des tests natifs Node.js, situes dans `backend/src/**/*.test.ts`.
Ils doivent d'abord etre compiles :

```powershell
npm --workspace backend run build
node --test --test-concurrency=1 backend/dist/services/heuresService.test.js
node --test --test-concurrency=1 --test-name-pattern="dépasse une journée" backend/dist/services/heuresService.test.js
```

## Architecture

- Le frontend est une SPA React/Vite avec `BrowserRouter` : `App.tsx` declare les
  routes et `Navbar` utilise `NavLink`. Les pages appellent exclusivement le client
  central `frontend/src/services/api.ts`; ajouter une operation API a cet endroit
  avant de l'utiliser dans une page.
- Le backend Express monte les routeurs REST sous `/api` dans `src/server.ts`.
  Les routeurs valident les donnees HTTP et traduisent les erreurs attendues en
  reponses 400/404; les services dans `backend/src/services` portent les regles
  metier et les acces aux donnees.
- Les donnees persistantes sont les CSV versionnes dans `backend/data`. Les
  services lisent/ecrivent les fichiers par leur nom relatif au repertoire de
  travail, et `csvService` assure la creation, l'echappement CSV et une ecriture
  atomique via fichier temporaire. Lancer le backend depuis `backend/` (comme les
  scripts workspace) pour utiliser ces donnees.
- Les types de domaine sont dupliques intentionnellement dans `backend/src/types.ts`
  et `frontend/src/types.ts`; toute evolution du contrat REST doit mettre a jour
  les deux definitions, le service backend, le routeur et `api.ts`.
- Les services CSV avec suppression logique (clients, projets, heures, factures)
  s'appuient sur `csvService.createCsvRepository` pour le trio
  `listAll`/`list`/`writeAll`; reutiliser ce repository pour toute nouvelle
  collection CSV plutot que de reimplementer ce trio.
- Les routeurs traduisent les erreurs de service en reponses HTTP via
  `routes/httpErrors.ts` (`sendServiceError`) : un message contenant
  « introuvable » devient 404, sinon `defaultStatus` (400 par defaut) ; garder
  cette convention pour tout nouveau routeur.
- Le theme visuel est pilote par variables CSS : chaque theme est un bloc
  `[data-theme="..."]` dans `frontend/src/styles/themes.css` (variables
  `--theme-*`), mappe en couleurs Tailwind (`bg-app`, `bg-surface`,
  `text-heading`, etc.) via `@theme inline` dans `index.css`. `ThemeProvider`
  (`frontend/src/theme/`) applique `data-theme` sur `<html>` et persiste le
  choix en `localStorage`. Ajouter un theme = ajouter un bloc `[data-theme]` +
  une entree dans `theme/themes.ts`, sans toucher aux composants.

## Regles metier et conventions

- Un projet reference un client (`client_id`) et doit rester rattache a ce client.
  Les affichages groupes par client filtrent les projets orphelins.
- Les activites (`Heure`) representent des jours, pas des heures : seules `0.5` et
  `1` sont admises. Une date ne peut totaliser plus de 1, contenir plus de deux
  projets, ni contenir deux entrees pour le meme projet; deux projets imposent deux
  demi-journees. Garder la validation serveur dans `heuresService` et les options
  preventives de `Heures.tsx` coherentes.
- Le taux applique est capture lors de la creation d'une activite depuis le taux
  journalier du client, sauf taux fourni. La description est facultative et prend
  une valeur generee; une mise a jour sans description conserve celle existante.
- La facturation est unique par client et mois et agrège les activités de tous les
  projets non supprimés du client pour la période sélectionnée. Le numéro `AAAA-NNNN`,
  la date de création, les lignes et le montant sont générés/capturés côté serveur ;
  ne pas accepter ces champs dans le payload frontend.
- Les factures conservent les instantanés des coordonnées de l'émetteur, du client
  et des lignes à leur génération. Un brouillon peut être recalculé ; après envoi,
  seule la transition vers payée est permise, puis la facture est verrouillée.
- Les CSV stockent les nombres sous forme de texte. Conserver les fonctions
  `parse*`/`serialize*` des services lors de l'ajout de champs numeriques.
- Les quatre collections métier utilisent `deleted_at` pour la suppression
  logique. Les listes usuelles et le dashboard n'exposent que les lignes actives ;
  les opérations de restauration et purge sont centralisées dans `trashService`
  et `/api/corbeille`. Une suppression de client/projet cascade sur ses enfants ;
  une facture non `brouillon` issue d'une activité interdit la suppression ou purge
  du parent.
- Les tests de services isolent les CSV en creant un repertoire temporaire puis en
  changeant `process.cwd()`. Suivre ce modele pour ne jamais modifier
  `backend/data` pendant les tests.
- L'interface est en francais et utilise Tailwind CSS 4. Les pages CRUD reutilisent
  `FormField` et `DataTable`; garder les libelles, erreurs et statuts en francais.
  Les actions utilisent des boutons icône seuls avec `title` et `aria-label` ;
  garder le texte visible sur les liens de navigation.
- Une page volumineuse (calculs + plusieurs vues) doit etre eclatee : fonctions
  pures dans `utils/`, composants reutilisables dans `components/`, sous-vues
  dans un sous-dossier `pages/<page>/`, la page restant l'orchestrateur d'etat
  (voir `pages/Heures.tsx` et `pages/heures/`).
- Les coordonnees de l'entreprise (emetteur) se saisissent uniquement sur la
  page Parametrages (`pages/Parametrages.tsx`), pas sur la page Factures. Une
  facture ne peut etre generee/recalculee que si le profil emetteur est
  complet (`raison_sociale`, `adresse_postale`, `siret`, `email`) ; cette regle
  est verifiee cote backend dans `factureService.buildFacture` (via
  `issuerService.isIssuerProfileComplete`) et cote frontend dans
  `Factures.tsx` (bouton desactive) via `frontend/src/utils/issuerProfile.ts`,
  qui doit rester coherent avec le backend.

## Journal

- Après chaque ensemble de modifications, mettre à jour `.docs/004-journal.md`
  avec un résumé concis des changements apportés.
- Regrouper les entrées par jour sous un titre `## AAAA-MM-JJ` ; ajouter les
  nouvelles entrées du jour courant sous le titre existant s'il y en a déjà un,
  sinon créer un nouveau titre en tête de fichier.

## Page d'aide

- Après chaque évolution du code impactant les règles métier ou l'architecture
  technique, mettre à jour la page d'aide `frontend/src/pages/Aide.tsx` (section
  « Fonctionnement métier » et/ou « Aspects techniques ») pour qu'elle reste le
  reflet fidèle du comportement courant de l'application.
