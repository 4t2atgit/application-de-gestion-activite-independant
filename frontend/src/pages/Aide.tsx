import type { ReactNode } from 'react';

interface HelpSection {
  title: string;
  body: ReactNode;
}

const businessSections: HelpSection[] = [
  {
    title: 'Clients et projets',
    body: (
      <>
        <p>Un client regroupe ses coordonnées de facturation (raison sociale, contact, adresse). Un projet est toujours rattaché à un client existant et n’est visible que dans le contexte de ce client.</p>
        <p>Le <strong>taux journalier</strong> est défini sur chaque projet (et non plus sur le client) : il s’applique par défaut à chaque activité saisie sur ce projet, sauf si un taux explicite est renseigné lors de la saisie.</p>
        <p>La page Projets regroupe la liste par client (une section et un tableau par client). Partout où un projet est proposé dans une liste déroulante hors de son contexte client (par exemple pour rattacher un frais), il est présenté sous la forme « Client — Projet » afin de lever toute ambiguïté.</p>
      </>
    ),
  },
  {
    title: 'Saisie des activités (Heures)',
    body: (
      <>
        <p>Une activité représente une journée ou une demi-journée de travail (<code>0,5</code> ou <code>1</code>). Une même date ne peut jamais totaliser plus d’une journée, ni référencer plus de deux projets ; si deux projets sont saisis le même jour, chacun compte pour une demi-journée.</p>
        <p>La page affiche les 12 derniers mois glissants pour lesquels une fiche existe déjà. Un lien permet de créer une nouvelle fiche mensuelle, uniquement sur une fenêtre de 2 mois passés à 1 mois futur, et seulement si le mois n’a pas déjà une fiche.</p>
        <p>Il n’est pas possible de créer, modifier ou supprimer une activité d’un client dont la facture du mois concerné a déjà été <strong>envoyée</strong> ou <strong>payée</strong> : les données facturées sont verrouillées.</p>
      </>
    ),
  },
  {
    title: 'Facturation',
    body: (
      <>
        <p>La facturation se fait <strong>par client et par mois</strong>, jamais par projet : une facture agrège les activités de tous les projets actifs du client sur la période choisie. Un seul couple client/mois peut exister à la fois.</p>
        <p>Le numéro (<code>AAAA-NNNN</code>) et la date de création sont générés automatiquement par le serveur, sans trou possible dans la numérotation annuelle.</p>
        <p>Une facture passe par les statuts <strong>brouillon</strong> → <strong>envoyée</strong> → <strong>payée</strong>. Un brouillon peut être recalculé librement (changement de client, de mois). Les coordonnées et les lignes (date, nom du projet, jours, taux et montant) sont copiées dans la facture, sans identifiants vers les données d’origine ; l’envoi les fige et la seule transition possible ensuite est vers « payée ».</p>
        <p>Le téléchargement du PDF s’adapte au statut : pour un brouillon, le PDF est régénéré à la volée et porte la mention « BROUILLON » ; pour une facture envoyée ou payée, c’est le fichier définitif déjà sauvegardé qui est renvoyé. Le nom de fichier suit toujours le modèle <code>facture_&lt;client&gt;_&lt;période&gt;.pdf</code>.</p>
        <p>Une facture envoyée ou payée est verrouillée : la seule façon de la corriger est d’émettre un <strong>avoir</strong>, qui l’annule <strong>intégralement</strong> (il n’existe pas d’avoir partiel) avec sa propre numérotation (<code>AV-AAAA-NNNN</code>) et son propre PDF. Une fois la facture d’origine intégralement créditée par un avoir actif, le couple client/mois redevient facturable : il suffit de générer une nouvelle facture correcte pour la même période.</p>
        <p>Une facture envoyée peut recevoir des <strong>encaissements</strong> partiels ou totaux (date, montant, moyen de paiement facultatif, note) tant qu’elle n’est pas déjà payée. Le solde restant dû est affiché en permanence ; dès que le cumul des encaissements atteint le montant facturé, la facture passe automatiquement au statut « payée ». Un encaissement peut être supprimé tant que la facture reste envoyée, mais plus une fois celle-ci payée.</p>
        <p>Aucune facture ne peut être générée tant que les coordonnées de l’entreprise n’ont pas été saisies dans la page Paramètres.</p>
      </>
    ),
  },
  {
    title: 'Frais professionnels',
    body: (
      <>
        <p>Chaque frais comporte une date, un libellé, une catégorie (matériel, déplacement, logiciel/abonnement, repas, autre), un montant TTC, une indication de déductibilité et un rattachement optionnel à un projet. Un justificatif (PDF, JPG ou PNG, 5 Mo maximum) peut être joint et téléchargé à tout moment.</p>
        <p>Un export CSV annuel regroupe l’ensemble des frais déductibles de l’année, utile pour la déclaration.</p>
      </>
    ),
  },
  {
    title: 'Suppression et corbeille',
    body: (
      <>
        <p>La suppression des clients, projets, activités et frais est réversible : chaque élément reçoit une date de suppression logique et disparaît des listes actives, mais reste consultable et restaurable depuis la Corbeille.</p>
        <p>Supprimer un client cascade sur ses projets, activités, frais et factures liés. Supprimer un projet cascade sur ses activités et frais. Supprimer une facture cascade sur ses encaissements. Restaurer un élément restaure automatiquement les parents nécessaires (par exemple, restaurer un encaissement restaure sa facture, et restaurer un frais restaure son projet s’il était aussi supprimé).</p>
        <p>Un client ayant une activité rattachée à une facture <strong>non brouillon</strong> ne peut être ni supprimé, ni définitivement purgé. Un projet peut être supprimé et purgé même si ses activités figurent dans une facture : l’instantané autonome de la facture conserve les données facturées sans référence aux enregistrements supprimés. Les factures elles-mêmes ne peuvent jamais être purgées définitivement : leur seule présence dans la corbeille bloque le vidage complet.</p>
      </>
    ),
  },
  {
    title: 'Tableau de bord',
    body: (
      <>
        <p>Les indicateurs clés (jours saisis, chiffre d’affaires facturé, factures en attente ou en retard, frais du mois, résultat net estimé) résument l’activité du mois en cours. Le résultat net estimé est une approximation (chiffre d’affaires HT moins frais TTC), à ne pas confondre avec un calcul comptable réel.</p>
        <p>Un graphique en barres compare, sur 12 mois glissants se terminant au dernier mois d’activité enregistré, trois séries : le <strong>CA au sens URSSAF</strong> (somme des encaissements effectivement reçus ce mois-ci, quelle que soit la facture d’origine), le <strong>montant facturé</strong> (agrégé par mois de facturation) et le <strong>nombre de jours travaillés</strong> (axe dédié). Un mois avec de l’activité facturée mais non encore encaissée affiche un CA à 0 €. La barre du montant facturé est empilée en deux segments — <strong>encaissé</strong> et <strong>restant dû</strong> — ce dernier dans une couleur d’alerte, afin de mettre en évidence les sommes manquantes de chaque mois facturé. Un camembert répartit le chiffre d’affaires facturé par client. Si un plafond annuel est renseigné dans les paramètres, une barre de progression suit le chiffre d’affaires cumulé de l’année par rapport à ce plafond (seuil micro-entreprise).</p>
      </>
    ),
  },
  {
    title: 'Paramètres',
    body: (
      <>
        <p>La page Paramètres regroupe les coordonnées de l’entreprise (raison sociale, SIRET, IBAN, mentions de TVA, délai de paiement, plafond annuel) utilisées sur les factures, ainsi que le choix du thème d’affichage (clair ou sombre).</p>
      </>
    ),
  },
];

const technicalSections: HelpSection[] = [
  {
    title: 'Architecture générale',
    body: (
      <>
        <p>L’application est un monorepo npm avec deux workspaces TypeScript : <code>frontend</code> (SPA React + Vite + Tailwind CSS) et <code>backend</code> (API REST Express). Le frontend est servi sur <code>http://localhost:5173</code> et appelle l’API sur <code>http://localhost:3001/api</code> (configurable via <code>VITE_API_URL</code>).</p>
        <p>Le frontend déclare ses routes dans <code>App.tsx</code> avec <code>react-router-dom</code> ; la barre de navigation utilise <code>NavLink</code> pour rester synchronisée avec l’URL. Toutes les pages passent exclusivement par le client centralisé <code>frontend/src/services/api.ts</code> pour parler au backend.</p>
        <p>Le backend monte ses routeurs REST sous <code>/api</code> dans <code>server.ts</code>. Chaque routeur valide les requêtes HTTP et délègue les règles métier à un service dédié (clients, projets, heures, factures, frais, émetteur, tableau de bord, corbeille).</p>
      </>
    ),
  },
  {
    title: 'Persistance des données',
    body: (
      <>
        <p>Les données métier sont stockées dans des fichiers CSV versionnés sous <code>backend/data</code> (<code>clients.csv</code>, <code>projets.csv</code>, <code>heures.csv</code>, <code>factures.csv</code>, <code>encaissements.csv</code>, <code>frais.csv</code>, <code>emetteur.csv</code>). Les PDF de factures définitifs sont conservés dans <code>backend/data/factures-pdf</code> et les justificatifs de frais dans <code>backend/data/frais-justificatifs</code>.</p>
        <p><code>csvService</code> centralise la création des fichiers manquants, l’échappement CSV et l’écriture atomique via un fichier temporaire renommé. Les entités partagent une colonne <code>deleted_at</code> : une valeur vide signifie active, une date ISO place la ligne en corbeille.</p>
        <p>Le backend doit être lancé depuis le répertoire <code>backend</code> (ou via les scripts npm du workspace) pour que les chemins relatifs vers <code>data/</code> pointent vers les bons fichiers.</p>
      </>
    ),
  },
  {
    title: 'Cohérence des types',
    body: (
      <p>Les types de domaine (<code>Client</code>, <code>Project</code>, <code>Heure</code>, <code>Facture</code>, <code>Frais</code>, <code>IssuerProfile</code>, <code>DashboardStats</code>, <code>Trash</code>...) sont intentionnellement dupliqués entre <code>backend/src/types.ts</code> et <code>frontend/src/types.ts</code>. Toute évolution du contrat REST doit mettre à jour les deux définitions, le service backend correspondant, son routeur, et le client <code>api.ts</code>.</p>
    ),
  },
  {
    title: 'Interface et composants réutilisables',
    body: (
      <>
        <p>Les pages de gestion (Clients, Projets, Frais, Factures) réutilisent les composants génériques <code>FormField</code>, <code>DataTable</code>, <code>Modal</code>, <code>ConfirmDialog</code> et <code>Pagination</code>. Les créations et modifications se font toujours dans une fenêtre modale plutôt que dans un formulaire permanent.</p>
        <p>Les feuilles de style sont organisées par thème sous <code>frontend/src/theme</code> et <code>index.css</code> : chaque thème définit un jeu de variables CSS (<code>--theme-*</code>) consommées par des classes utilitaires Tailwind (<code>bg-surface</code>, <code>text-heading</code>, <code>text-muted</code>...), ce qui permet d’ajouter de nouveaux thèmes sans toucher aux composants.</p>
      </>
    ),
  },
  {
    title: 'Tests et qualité',
    body: (
      <>
        <p>Les tests backend sont des tests natifs Node.js (<code>node --test</code>), situés dans <code>backend/src/**/*.test.ts</code> et compilés avant exécution. Ils isolent systématiquement les fichiers CSV en créant un répertoire temporaire et en changeant <code>process.cwd()</code>, afin de ne jamais modifier <code>backend/data</code> pendant les tests.</p>
        <p>Commandes utiles :</p>
        <pre className="overflow-x-auto rounded-xl bg-surface-muted p-3 text-xs text-body">{'npm --workspace backend run build\nnode --test --test-concurrency=1 backend/dist/services/heuresService.test.js'}</pre>
      </>
    ),
  },
];

function Accordion({ sections }: { sections: HelpSection[] }) {
  return (
    <div className="divide-y divide-subtle">
      {sections.map((section) => (
        <details key={section.title} className="group py-3">
          <summary className="cursor-pointer list-none text-base font-medium text-heading marker:content-none">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-90">▶</span>
              {section.title}
            </span>
          </summary>
          <div className="mt-2 space-y-2 pl-6 text-sm text-body">{section.body}</div>
        </details>
      ))}
    </div>
  );
}

export function Aide() {
  return (
    <section className="space-y-6">
      <header className="rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-heading">Aide</h2>
        <p className="text-sm text-muted">Comprendre le fonctionnement métier de l’application et les principes techniques de son implémentation.</p>
      </header>

      <section className="space-y-2 rounded-2xl bg-surface p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-heading">Fonctionnement métier</h3>
        <p className="text-sm text-muted">Règles appliquées par l’application pour gérer clients, projets, activités, factures et frais.</p>
        <Accordion sections={businessSections} />
      </section>

      <section className="space-y-2 rounded-2xl bg-surface p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-heading">Aspects techniques</h3>
        <p className="text-sm text-muted">Organisation du code, persistance des données et conventions à respecter.</p>
        <Accordion sections={technicalSections} />
      </section>
    </section>
  );
}
