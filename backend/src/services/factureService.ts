import { Facture, FactureLine, FactureRecipientSnapshot, IssuerProfile } from '../types';
import { buildCsvDocument, createCsvRepository, getNextId } from './csvService';
import { getClientById, listClients } from './clientService';
import { listAllHeures, listHeures } from './heuresService';
import { listAllProjects, listProjects } from './projectService';
import { emptyIssuerProfile, getIssuerProfile, isIssuerProfileComplete } from './issuerService';
import { buildInvoicePdfBuffer, persistInvoicePdf } from './facturePdfService';
import { softDeleteEncaissementsForFacture } from './encaissementService';

const fileName = 'factures.csv';
const issuerFields: Array<keyof IssuerProfile> = [
  'raison_sociale',
  'nom_commercial',
  'adresse_postale',
  'siret',
  'numero_tva',
  'email',
  'telephone',
  'iban',
  'conditions_paiement',
  'delai_paiement_jours',
  'tva_non_applicable',
  'plafond_annuel',
];
const recipientFields: Array<keyof FactureRecipientSnapshot> = [
  'nom',
  'contact_name',
  'contact_role',
  'email',
  'phone',
  'billing_address',
];
const headers = [
  'id',
  'numero_facture',
  'client_id',
  'mois_facture',
  'montant_ht',
  'date_creation',
  'date_envoi',
  'date_echeance',
  'statut',
  'type',
  'facture_origine_id',
  ...issuerFields.map((field) => `emetteur_${field}`),
  ...recipientFields.map((field) => `destinataire_${field}`),
  'lignes_json',
  'deleted_at',
];
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export type FactureCreateInput = {
  client_id: string;
  mois_facture: string;
};

export type FactureUpdateInput = {
  client_id?: string;
  mois_facture?: string;
  statut?: Facture['statut'];
};

const textIssuerFields: Array<keyof IssuerProfile> = [
  'raison_sociale',
  'nom_commercial',
  'adresse_postale',
  'siret',
  'numero_tva',
  'email',
  'telephone',
  'iban',
  'conditions_paiement',
];

function parseEmetteurSnapshot(row: Record<string, string>): IssuerProfile {
  return {
    ...(Object.fromEntries(
      textIssuerFields.map((field) => [field, row[`emetteur_${field}`] ?? '']),
    ) as Record<(typeof textIssuerFields)[number], string>),
    delai_paiement_jours: Number.parseInt(row.emetteur_delai_paiement_jours ?? '', 10) || emptyIssuerProfile.delai_paiement_jours,
    tva_non_applicable: row.emetteur_tva_non_applicable === 'true',
    plafond_annuel: Number.parseFloat(row.emetteur_plafond_annuel ?? '') || 0,
  };
}

function parseFacture(row: Record<string, string>): Facture {
  const legacyDate = row.date_creation || row.date_facture;
  const mois_facture = row.mois_facture || legacyDate?.slice(0, 7) || '';
  let lignes: FactureLine[] = [];
  try {
    const parsed = JSON.parse(row.lignes_json || '[]') as unknown;
    if (Array.isArray(parsed)) lignes = parsed as FactureLine[];
  } catch {
    lignes = [];
  }
  return {
    id: row.id,
    numero_facture: row.numero_facture,
    client_id: row.client_id,
    mois_facture,
    montant_ht: Number.parseFloat(row.montant_ht),
    date_creation: legacyDate || `${mois_facture}-01T00:00:00.000Z`,
    date_envoi: row.date_envoi || undefined,
    date_echeance: row.date_echeance || undefined,
    statut: row.statut as Facture['statut'],
    type: row.type === 'avoir' ? 'avoir' : 'facture',
    facture_origine_id: row.facture_origine_id || undefined,
    emetteur: parseEmetteurSnapshot(row),
    destinataire: Object.fromEntries(
      recipientFields.map((field) => [field, row[`destinataire_${field}`] ?? '']),
    ) as unknown as FactureRecipientSnapshot,
    lignes,
    deleted_at: row.deleted_at || undefined,
  };
}

function serializeFacture(facture: Facture) {
  return {
    ...facture,
    montant_ht: facture.montant_ht.toString(),
    ...Object.fromEntries(issuerFields.map((field) => [`emetteur_${field}`, facture.emetteur[field]])),
    ...Object.fromEntries(recipientFields.map((field) => [`destinataire_${field}`, facture.destinataire[field]])),
    lignes_json: JSON.stringify(facture.lignes),
  };
}

function assertBillingMonth(moisFacture: string): void {
  if (!monthPattern.test(moisFacture)) {
    throw new Error('Le mois de facturation doit être au format AAAA-MM.');
  }
}

async function buildLines(clientId: string, moisFacture: string): Promise<FactureLine[]> {
  const [projects, heures] = await Promise.all([listProjects(), listHeures()]);
  const clientProjects = new Map(
    projects.filter((project) => project.client_id === clientId).map((project) => [project.id, project.nom]),
  );
  return heures
    .filter((heure) => clientProjects.has(heure.projet_id) && heure.date.startsWith(moisFacture))
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id))
    .map((heure) => ({
      date: heure.date,
      projet: clientProjects.get(heure.projet_id) ?? '',
      jours: heure.duree,
      taux_journalier: heure.taux_applique,
      montant_ht: Number((heure.duree * heure.taux_applique).toFixed(2)),
    }));
}

function assertNoDuplicate(factures: Facture[], clientId: string, moisFacture: string, currentId?: string): void {
  const isCreditedByActiveAvoir = (factureId: string) =>
    factures.some((facture) => facture.facture_origine_id === factureId && facture.type === 'avoir' && !facture.deleted_at);
  if (factures.some((facture) =>
    facture.id !== currentId
    && facture.type === 'facture'
    && facture.client_id === clientId
    && facture.mois_facture === moisFacture
    && !isCreditedByActiveAvoir(facture.id))) {
    throw new Error('Une facture existe déjà pour ce client et ce mois de facturation, y compris dans la corbeille.');
  }
}

function getNextInvoiceNumber(factures: Facture[], year: string): string {
  const sequence = factures.reduce((maximum, facture) => {
    const match = new RegExp(`^${year}-(\\d{1,4})$`).exec(facture.numero_facture);
    return match ? Math.max(maximum, Number.parseInt(match[1]!, 10)) : maximum;
  }, 0);
  return `${year}-${String(sequence + 1).padStart(4, '0')}`;
}

function getNextAvoirNumber(factures: Facture[], year: string): string {
  const sequence = factures.reduce((maximum, facture) => {
    const match = new RegExp(`^AV-${year}-(\\d{1,4})$`).exec(facture.numero_facture);
    return match ? Math.max(maximum, Number.parseInt(match[1]!, 10)) : maximum;
  }, 0);
  return `AV-${year}-${String(sequence + 1).padStart(4, '0')}`;
}

/** Calcule l'échéance de paiement à partir de la date d'envoi et du délai (en jours) de l'émetteur. */
function computeDueDate(fromIso: string, delaiJours: number): string {
  const date = new Date(fromIso);
  date.setUTCDate(date.getUTCDate() + delaiJours);
  return date.toISOString();
}

async function buildFacture(
  factures: Facture[],
  input: { client_id: string; mois_facture: string },
  options: { id: string; numero_facture: string; date_creation: string; statut: Facture['statut']; currentId?: string },
): Promise<Facture> {
  assertBillingMonth(input.mois_facture);
  if (!await getClientById(input.client_id)) {
    throw new Error('Client introuvable');
  }
  assertNoDuplicate(factures, input.client_id, input.mois_facture, options.currentId);
  const [client, emetteur, lignes] = await Promise.all([
    getClientById(input.client_id),
    getIssuerProfile(),
    buildLines(input.client_id, input.mois_facture),
  ]);
  if (!client) throw new Error('Client introuvable');
  if (!isIssuerProfileComplete(emetteur)) {
    throw new Error(
      'Impossible de générer une facture : les coordonnées de l’entreprise doivent d’abord être renseignées dans les paramètres.',
    );
  }
  const destinataire: FactureRecipientSnapshot = {
    nom: client.nom,
    contact_name: client.contact_name ?? '',
    contact_role: client.contact_role ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    billing_address: client.billing_address ?? '',
  };
  return {
    id: options.id,
    numero_facture: options.numero_facture,
    client_id: input.client_id,
    mois_facture: input.mois_facture,
    montant_ht: Number(lignes.reduce((total, ligne) => total + ligne.montant_ht, 0).toFixed(2)),
    date_creation: options.date_creation,
    statut: options.statut,
    type: 'facture',
    emetteur: { ...emptyIssuerProfile, ...emetteur },
    destinataire,
    lignes,
  };
}

const facturesRepository = createCsvRepository(fileName, headers, parseFacture, serializeFacture);

export async function listAllFactures(): Promise<Facture[]> {
  return facturesRepository.listAll();
}

export async function listFactures(): Promise<Facture[]> {
  return facturesRepository.list();
}

export async function getFactureById(id: string): Promise<Facture | undefined> {
  return (await listFactures()).find((facture) => facture.id === id);
}

export async function createFacture(input: FactureCreateInput): Promise<Facture> {
  const factures = await listAllFactures();
  const date_creation = new Date().toISOString();
  const facture = await buildFacture(factures, input, {
    id: getNextId(factures),
    numero_facture: getNextInvoiceNumber(factures, date_creation.slice(0, 4)),
    date_creation,
    statut: 'brouillon',
  });
  await writeAllFactures([...factures, facture]);
  return facture;
}

export async function updateFacture(id: string, input: FactureUpdateInput): Promise<Facture | undefined> {
  const factures = await listAllFactures();
  const index = factures.findIndex((facture) => facture.id === id);
  const existing = factures[index];
  if (!existing || existing.deleted_at) return undefined;

  if (existing.type === 'avoir') {
    throw new Error('Un avoir est un document définitif : il ne peut pas être modifié.');
  }
  if (existing.statut === 'payée') {
    throw new Error('Une facture payée est entièrement verrouillée.');
  }
  if (existing.statut === 'envoyée') {
    if (input.statut !== 'payée' || input.client_id !== undefined || input.mois_facture !== undefined) {
      throw new Error('Une facture envoyée ne peut être modifiée que pour passer au statut payée.');
    }
    existing.statut = 'payée';
    await writeAllFactures(factures);
    return existing;
  }

  if (input.statut === 'payée') {
    throw new Error('Une facture brouillon doit d’abord être envoyée.');
  }
  const clientId = input.client_id ?? existing.client_id;
  const moisFacture = input.mois_facture ?? existing.mois_facture;
  const facture = await buildFacture(
    factures,
    {
      client_id: clientId,
      mois_facture: moisFacture,
    },
    {
      id,
      numero_facture: existing.numero_facture,
      date_creation: existing.date_creation,
      statut: input.statut ?? 'brouillon',
      currentId: id,
    },
  );
  const isBeingSent = facture.statut === 'envoyée';
  if (isBeingSent) {
    facture.date_envoi = new Date().toISOString();
    facture.date_echeance = computeDueDate(facture.date_envoi, facture.emetteur.delai_paiement_jours);
  }
  const pdfBuffer = isBeingSent ? buildInvoicePdfBuffer(facture) : undefined;
  factures[index] = facture;
  await writeAllFactures(factures);
  if (pdfBuffer) {
    await persistInvoicePdf(facture, pdfBuffer);
  }
  return facture;
}

export async function writeAllFactures(factures: Facture[]): Promise<void> {
  await facturesRepository.writeAll(factures);
}

/**
 * Émet un avoir (note de crédit) annulant intégralement une facture envoyée ou payée : montant et
 * lignes en négatif, coordonnées reprises à l'identique, document immuable dès sa création.
 */
export async function createAvoir(factureOrigineId: string): Promise<Facture> {
  const factures = await listAllFactures();
  const origine = factures.find((facture) => facture.id === factureOrigineId);
  if (!origine || origine.deleted_at) {
    throw new Error('Facture d’origine introuvable.');
  }
  if (origine.type === 'avoir') {
    throw new Error('Impossible de créer un avoir à partir d’un avoir.');
  }
  if (origine.statut === 'brouillon') {
    throw new Error('Un avoir ne peut être émis que pour une facture envoyée ou payée.');
  }
  if (factures.some((facture) => facture.facture_origine_id === factureOrigineId && !facture.deleted_at)) {
    throw new Error('Un avoir existe déjà pour cette facture.');
  }

  const date_creation = new Date().toISOString();
  const avoir: Facture = {
    id: getNextId(factures),
    numero_facture: getNextAvoirNumber(factures, date_creation.slice(0, 4)),
    client_id: origine.client_id,
    mois_facture: origine.mois_facture,
    montant_ht: Number((-origine.montant_ht).toFixed(2)),
    date_creation,
    date_envoi: date_creation,
    statut: 'envoyée',
    type: 'avoir',
    facture_origine_id: origine.id,
    emetteur: origine.emetteur,
    destinataire: origine.destinataire,
    lignes: origine.lignes.map((ligne) => ({ ...ligne, montant_ht: Number((-ligne.montant_ht).toFixed(2)) })),
  };
  await writeAllFactures([...factures, avoir]);
  await persistInvoicePdf(avoir, buildInvoicePdfBuffer(avoir));
  return avoir;
}

export async function deleteFacture(id: string): Promise<boolean> {
  const factures = await listAllFactures();
  const facture = factures.find((item) => item.id === id && !item.deleted_at);
  if (!facture) return false;
  facture.deleted_at = new Date().toISOString();
  await writeAllFactures(factures);
  await softDeleteEncaissementsForFacture(id, facture.deleted_at);
  return true;
}

export async function softDeleteFacturesForClient(clientId: string, deletedAt: string): Promise<void> {
  const factures = await listAllFactures();
  let changed = false;
  for (const facture of factures) {
    if (facture.client_id === clientId && !facture.deleted_at) {
      facture.deleted_at = deletedAt;
      changed = true;
    }
  }
  if (changed) await writeAllFactures(factures);
}

function factureContainsProjectActivity(
  facture: Facture,
  projectId: string,
  heures: Awaited<ReturnType<typeof listAllHeures>>,
  projects: Awaited<ReturnType<typeof listAllProjects>>,
): boolean {
  const project = projects.find((item) => item.id === projectId);
  return project?.client_id === facture.client_id
    && heures.some((heure) => heure.projet_id === projectId && heure.date.startsWith(facture.mois_facture));
}

export async function hasNonDraftFactureForClientMonth(clientId: string, moisFacture: string): Promise<boolean> {
  const factures = await listAllFactures();
  return factures.some((facture) =>
    facture.client_id === clientId && facture.mois_facture === moisFacture && facture.statut !== 'brouillon');
}

export async function hasNonDraftFactureForClient(clientId: string): Promise<boolean> {
  const [factures, heures, projects] = await Promise.all([listAllFactures(), listAllHeures(), listAllProjects()]);
  return factures.some((facture) =>
    facture.client_id === clientId
    && facture.statut !== 'brouillon'
    && projects.some((project) => factureContainsProjectActivity(facture, project.id, heures, projects)));
}

export async function hasNonDraftFactureForHeure(heureId: string): Promise<boolean> {
  const [factures, heures, projects] = await Promise.all([listAllFactures(), listAllHeures(), listAllProjects()]);
  const heure = heures.find((item) => item.id === heureId);
  return !!heure && factures.some((facture) =>
    facture.statut !== 'brouillon'
    && factureContainsProjectActivity(facture, heure.projet_id, heures, projects)
    && heure.date.startsWith(facture.mois_facture));
}

export function isFactureEnRetard(facture: Facture, now: Date = new Date()): boolean {
  return facture.statut === 'envoyée' && !!facture.date_echeance && new Date(facture.date_echeance).getTime() < now.getTime();
}

export async function countFacturesEnRetard(): Promise<number> {
  const factures = await listFactures();
  const now = new Date();
  return factures.filter((facture) => isFactureEnRetard(facture, now)).length;
}

/** Chiffre d'affaires facturé cumulé depuis le 1er janvier de l'année en cours (factures et avoirs confondus). */
export async function getChiffreAffairesAnnuel(now: Date = new Date()): Promise<number> {
  const factures = await listFactures();
  const year = String(now.getFullYear());
  return Number(
    factures
      .filter((facture) => facture.mois_facture.startsWith(year))
      .reduce((total, facture) => total + facture.montant_ht, 0)
      .toFixed(2),
  );
}

const exportHeaders = [
  'numero_facture',
  'type',
  'client',
  'mois_facture',
  'montant_ht',
  'date_creation',
  'date_envoi',
  'date_echeance',
  'statut',
];

/**
 * Génère un export CSV récapitulatif des factures d'une année (par défaut l'année en cours), pour
 * la déclaration de chiffre d'affaires (URSSAF) : une ligne par facture/avoir, hors corbeille.
 */
export async function buildAnnualFacturesExportCsv(year: string): Promise<string> {
  const [factures, clients] = await Promise.all([listFactures(), listClients()]);
  const rows = factures
    .filter((facture) => facture.mois_facture.startsWith(year))
    .sort((left, right) => left.mois_facture.localeCompare(right.mois_facture) || left.numero_facture.localeCompare(right.numero_facture))
    .map((facture) => ({
      numero_facture: facture.numero_facture,
      type: facture.type,
      client: clients.find((client) => client.id === facture.client_id)?.nom ?? facture.destinataire.nom,
      mois_facture: facture.mois_facture,
      montant_ht: facture.montant_ht.toFixed(2),
      date_creation: facture.date_creation,
      date_envoi: facture.date_envoi ?? '',
      date_echeance: facture.date_echeance ?? '',
      statut: facture.statut,
    }));
  return buildCsvDocument(exportHeaders, rows);
}
