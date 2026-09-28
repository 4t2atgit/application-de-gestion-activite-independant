export interface Client {
  id: string;
  nom: string;
  email: string;
  contact_name: string;
  contact_role: string;
  phone: string;
  billing_address: string;
  deleted_at?: string;
}

export interface IssuerProfile {
  raison_sociale: string;
  nom_commercial: string;
  adresse_postale: string;
  siret: string;
  numero_tva: string;
  email: string;
  telephone: string;
  iban: string;
  conditions_paiement: string;
  /** Délai de paiement en jours, utilisé pour calculer automatiquement l'échéance d'une facture envoyée. */
  delai_paiement_jours: number;
  /** Franchise en base de TVA (article 293 B du CGI) : remplace le n° de TVA par la mention légale sur les factures. */
  tva_non_applicable: boolean;
  /** Plafond annuel de chiffre d'affaires du régime micro-entreprise, pour le suivi du dépassement (0 = non renseigné). */
  plafond_annuel: number;
}

export interface FactureLine {
  date: string;
  projet: string;
  jours: number;
  taux_journalier: number;
  montant_ht: number;
}

export interface FactureRecipientSnapshot {
  nom: string;
  contact_name: string;
  contact_role: string;
  email: string;
  phone: string;
  billing_address: string;
}

export interface Project {
  id: string;
  nom: string;
  client_id: string;
  taux_journalier: number;
  statut: 'actif' | 'archivé';
  date_creation: string;
  deleted_at?: string;
}

export interface Heure {
  id: string;
  date: string;
  projet_id: string;
  duree: number;
  taux_applique: number;
  deleted_at?: string;
}

export interface Facture {
  id: string;
  numero_facture: string;
  client_id: string;
  mois_facture: string;
  montant_ht: number;
  date_creation: string;
  /** Date d'envoi (passage au statut envoyée), point de départ du calcul de l'échéance. */
  date_envoi?: string;
  /** Échéance de paiement, calculée à l'envoi à partir du délai de paiement de l'émetteur. */
  date_echeance?: string;
  statut: 'brouillon' | 'envoyée' | 'payée';
  /** Une facture standard ou un avoir (note de crédit) annulant une facture envoyée/payée. */
  type: 'facture' | 'avoir';
  /** Identifiant de la facture annulée, uniquement renseigné pour un avoir. */
  facture_origine_id?: string;
  emetteur: IssuerProfile;
  destinataire: FactureRecipientSnapshot;
  lignes: FactureLine[];
  deleted_at?: string;
}

export interface Frais {
  id: string;
  date: string;
  libelle: string;
  categorie: 'matériel' | 'déplacement' | 'logiciel/abonnement' | 'repas' | 'autre';
  montant_ttc: number;
  /** Indique si le frais est déductible du résultat imposable (information, non calculée en micro-entreprise). */
  deductible: boolean;
  /** Rattachement optionnel à un projet. */
  projet_id?: string;
  /** Nom d'origine du fichier de justificatif téléversé, s'il existe. */
  justificatif_nom_fichier?: string;
  deleted_at?: string;
}

export interface Encaissement {
  id: string;
  /** Facture (standard, jamais un avoir) sur laquelle l'encaissement est enregistré. */
  facture_id: string;
  date: string;
  montant: number;
  moyen_paiement?: 'virement' | 'chèque' | 'espèces' | 'carte' | 'autre';
  note?: string;
  deleted_at?: string;
}

export interface Trash {
  clients: Client[];
  projets: Project[];
  heures: Heure[];
  factures: Facture[];
  frais: Frais[];
  encaissements: Encaissement[];
}

export interface DashboardMonthlyPoint {
  mois: string;
  /** Chiffre d'affaires au sens URSSAF : somme des encaissements reçus ce mois-ci, quelle que soit la facture d'origine. */
  chiffreAffaires: number;
  montantFacture: number;
  /** Part de `montantFacture` déjà réglée à ce jour (encaissements des factures de ce mois, quelle que soit leur date). */
  montantFactureEncaisse: number;
  /** Sommes manquantes : part de `montantFacture` restant à encaisser à ce jour (`montantFacture` - `montantFactureEncaisse`). */
  montantFactureResteDu: number;
  /** Nombre de journées et demi-journées d'activité saisies ce mois-ci. */
  joursTravailles: number;
}

export interface DashboardClientShare {
  clientId: string;
  clientNom: string;
  montant: number;
}

export interface DashboardStats {
  joursCeMois: number;
  chiffreAffairesCeMois: number;
  facturesEnAttente: number;
  /** Nombre de factures envoyées dont l'échéance de paiement est dépassée. */
  facturesEnRetard: number;
  /** Chiffre d'affaires facturé cumulé depuis le 1er janvier de l'année en cours. */
  chiffreAffairesAnnuel: number;
  /** Plafond annuel de chiffre d'affaires du régime micro-entreprise (0 si non renseigné dans les paramètres). */
  plafondAnnuel: number;
  /** Total des frais professionnels enregistrés sur le mois en cours. */
  fraisCeMois: number;
  evolutionMensuelle: DashboardMonthlyPoint[];
  repartitionParClient: DashboardClientShare[];
}
