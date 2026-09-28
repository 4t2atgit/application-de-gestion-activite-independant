# micro-entreprise-suivi

Application locale de suivi d'activité pour micro-entrepreneur avec persistance en fichiers CSV.

## Documentation

La documentation de référence est centralisée dans [.docs](.docs/000-index.md) :

- [Architecture](.docs/001-architecture.md)
- [Règles métier](.docs/002-regles-metier.md)
- [Recommandations](.docs/003-recommandations.md)
- [Journal du projet](.docs/004-journal.md)

## Stack

- **Backend** : Node.js + Express + TypeScript
- **Frontend** : React + TypeScript + Vite + TailwindCSS
- **Persistance** : fichiers CSV versionnables dans `/backend/data`

## Fonctionnalités MVP

- CRUD **clients** (`backend/data/clients.csv`)
- CRUD **projets** (`backend/data/projets.csv`)
- CRUD **activités journalières** avec semainier mensuel par client/projet (`backend/data/heures.csv`)
- CRUD **factures** avec calcul automatique du montant HT à partir des jours d'un projet (`backend/data/factures.csv`)
- **Dashboard** : jours du mois, chiffre d'affaires du mois, factures en attente

## Structure

```text
micro-entreprise-suivi/
├── backend/
│   ├── data/
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── package.json
└── README.md
```

## Démarrage local

```bash
npm install
npm run dev
```

- Frontend : http://localhost:5173
- Backend : http://localhost:3001

## Scripts utiles

```bash
npm run build
npm run test
npm --workspace frontend run lint
```

## API REST

- `GET/POST/PUT/DELETE /api/clients`
- `GET/POST/PUT/DELETE /api/projets`
- `GET/POST/PUT/DELETE /api/heures` (activités journalières)
- `GET/POST/PUT/DELETE /api/factures`
- `GET /api/dashboard`
