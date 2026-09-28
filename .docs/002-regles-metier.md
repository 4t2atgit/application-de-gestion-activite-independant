# Règles métier

## Clients et projets

- Un projet doit être rattaché à un client existant par `client_id`.
- Un projet est affiché uniquement dans le contexte de son client.
- Le profil client comprend la raison/nom affiché, l'email de facturation,
  l'identité et la fonction du contact, son téléphone et l'adresse de
  facturation. Les colonnes de contact sont facultatives pour conserver la
  compatibilité avec les anciens fichiers clients.
- La suppression normale est réversible : client, projet, activité et facture
  reçoivent une date `deleted_at` et ne sont plus exposés par les listes usuelles.
- Supprimer un client place également ses projets, activités et factures liés dans
  la corbeille. Supprimer un projet place seulement ses activités dans la
  corbeille : les factures sont rattachées au client, jamais à un projet.
- Un client ayant une activité associée à une facture dont le statut n'est pas
  `brouillon` ne peut être supprimé ni supprimé définitivement.
- Un projet peut être supprimé et purgé même si ses activités figurent dans une
  facture non brouillon : la facture conserve les valeurs facturées, sans
  identifiant vers le projet ou les activités d'origine.
- Restaurer une activité, une facture ou un projet restaure les parents nécessaires
  afin qu'aucune donnée active ne référence un parent supprimé. La restauration
  d'une facture restaure son client, sans restaurer de projet. La restauration
  globale réactive toute la corbeille.
- La suppression définitive depuis la corbeille est irréversible. La purge d'un
  client ou projet supprime aussi ses dépendances déjà supprimées, à l'exception
  absolue des factures. Une facture ne peut jamais être purgée et sa présence
  empêche de vider la corbeille, avant toute modification.

## Activités journalières

- Une activité représente `0,5` ou `1` journée de travail.
- Une même date ne peut pas totaliser plus d'une journée.
- Une même date ne peut référencer que deux projets au maximum.
- Deux projets renseignés le même jour doivent chacun représenter une demi-journée.
- Un projet ne peut avoir qu'une seule activité pour une même date.
- Le taux appliqué est celui du client au moment de la création, sauf si un taux
  explicite est fourni.
- Une description absente est générée automatiquement à partir du projet et de la
  date. Lors d'une mise à jour, la description existante est conservée si elle
  n'est pas fournie.

## Factures

- La facturation est établie par client et par mois de facturation `AAAA-MM`,
  jamais par projet. Une facture agrège les activités de tous les projets non
  supprimés du client sur ce mois : `somme(duree × taux_applique)`.
- Une seule facture peut exister pour un couple client/mois, y compris si elle
  est dans la corbeille. Cette contrainte est levée dès que la facture existante
  est intégralement créditée par un avoir actif (non supprimé) : le mois
  redevient facturable, ce qui permet de corriger une facture envoyée ou payée
  en l'annulant puis en la réémettant.
- Le numéro (`AAAA-NNNN`) et la date de création ISO complète sont générés par
  le serveur. La séquence annuelle compte toutes les factures, y compris les
  supprimées logiquement, et ne peut donc pas être réutilisée.
- Le brouillon peut changer de client ou de mois et son montant est alors
  recalculé. Son numéro et sa date de création restent immuables.
- À partir du statut `envoyée`, les données métier sont verrouillées : la seule
  transition autorisée est `envoyée` vers `payée`. Une facture payée est
  entièrement verrouillée. La seule façon de corriger une facture envoyée ou
  payée est d'émettre un avoir (voir ci-dessous), puis de générer une nouvelle
  facture pour le même client et le même mois.
- Le profil émetteur est configurable dans l'interface Factures et persiste dans
  `backend/data/emetteur.csv`. Il comprend raison sociale, nom commercial,
  adresse postale, SIRET, numéro de TVA, email, téléphone, IBAN et conditions de
  paiement.
- À la génération d'une facture, le serveur capture dans la facture un
  instantané des coordonnées émetteur et client, ainsi que les lignes d'activité
  (date, nom du projet, jours, taux journalier appliqué, montant HT). Les lignes
  ne conservent pas les identifiants du projet ni des activités d'origine ;
  elles restent donc autonomes si ces données sont supprimées.
  Modifier ultérieurement les profils ne modifie pas cet instantané. La
  sauvegarde d'un brouillon le recalcule et le rafraîchit ; une facture envoyée
  ou payée le conserve sans modification.
- Un PDF est téléchargeable pour chaque statut. Le PDF brouillon porte une
  mention proéminente « BROUILLON — DOCUMENT NON DÉFINITIF ». Les factures
  envoyées et payées sont exportées sans cette mention. Les coordonnées
  absentes d'une facture héritée sont explicitement remplacées par
  « Information manquante ».
- Lors de la transition brouillon → envoyée, le serveur génère et persiste
  automatiquement le PDF définitif dans `backend/data/factures-pdf/`, nommé
  `facture-<client>-<mois_facture>.pdf` (nom du client normalisé sans accents
  ni espaces). Ce fichier reflète l'instantané figé au moment de l'envoi et
  n'est pas régénéré lors du passage ultérieur au statut payée.
- Les flèches des pages Heures et Factures avancent/reculent d'un mois sans
  changer le jour de référence ni le périmètre de facturation.

## Avoirs (correction d'une facture)

- Un avoir annule intégralement une facture `envoyée` ou `payée` : il reprend
  les mêmes coordonnées et lignes que la facture d'origine, mais avec des
  montants négatifs (`montant_ht` et chaque ligne). Il est numéroté
  `AV-AAAA-NNNN` (séquence annuelle dédiée), créé directement au statut
  `envoyée` et constitue un document définitif, jamais modifiable ni
  supprimable au même titre qu'une facture.
- Un seul avoir actif peut exister par facture d'origine. Impossible d'émettre
  un avoir sur un brouillon ou sur un autre avoir.
- L'avoir ne supprime pas la facture d'origine : celle-ci reste visible avec
  son statut inchangé, mais son montant est neutralisé par l'avoir dans le
  chiffre d'affaires et les exports.
- Il n'existe pas d'avoir partiel : la correction d'une erreur porte
  nécessairement sur la totalité du montant facturé.
- Pour corriger une facture envoyée ou payée, il faut donc : émettre un avoir
  qui l'annule intégralement, puis générer une nouvelle facture correcte pour
  le même client et le même mois. Dès qu'une facture est intégralement
  créditée par un avoir actif, le couple client/mois n'est plus considéré
  comme facturé et une nouvelle facture peut être créée pour cette période.

## Encaissements

- Un encaissement (date, montant, moyen de paiement facultatif, note
  facultative) enregistre un règlement partiel ou total d'une facture de type
  `facture` dont le statut est `envoyée`. Impossible d'en créer sur un
  brouillon, un avoir ou une facture déjà `payée`.
- Le montant d'un encaissement ne peut jamais dépasser le solde restant dû
  (`montant_ht` moins la somme des encaissements déjà actifs), à une tolérance
  d'arrondi de 0,01 € près.
- Dès que le cumul des encaissements atteint le montant HT de la facture (à
  0,01 € près), le statut de la facture passe automatiquement à `payée`, en
  réutilisant la même transition verrouillée que le passage manuel.
- Un encaissement peut être supprimé logiquement tant que la facture reste
  `envoyée`. Une fois la facture `payée`, ses encaissements sont verrouillés et
  ne peuvent plus être supprimés, cohérent avec le verrouillage complet d'une
  facture payée.
- La suppression d'une facture place ses encaissements actifs dans la
  corbeille ; leur restauration restaure la facture (et son client) au
  préalable.

## Tableau de bord

- Le graphique d'évolution mensuelle affiche 12 mois glissants se terminant au
  dernier mois pour lequel une activité (`heure`) est enregistrée, et non au
  mois civil courant : ainsi, une saisie d'activité en avance sur le mois en
  cours (par exemple le mois suivant) décale la fenêtre affichée d'autant. En
  l'absence de toute activité, la fenêtre se termine au mois courant.
- Le graphique affiche trois séries en barres verticales : le CA au sens
  URSSAF (somme des encaissements reçus ce mois-ci, quelle que soit la facture
  d'origine), le montant facturé (agrégé par `mois_facture`, indépendamment de
  la date d'encaissement) et le nombre de jours travaillés (somme des
  `duree` des activités du mois). Le CA et le montant facturé partagent l'axe
  monétaire ; les jours travaillés utilisent un axe dédié.
- Le CA ainsi défini ne s'incrémente qu'à la réception effective d'un
  règlement : un mois avec de l'activité et une facture émise mais non encore
  encaissée affiche un CA de `0 €` pour ce mois.
- La barre du montant facturé est empilée en deux segments qui mettent en
  évidence les sommes manquantes : `montantFactureEncaisse` (part déjà réglée
  des factures de ce mois, quelle que soit la date de l'encaissement) et
  `montantFactureResteDu` (`montantFacture` moins `montantFactureEncaisse`),
  affiché dans une couleur d'alerte distincte.
