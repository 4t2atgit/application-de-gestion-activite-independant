import { Encaissement } from '../types';
import { createCsvRepository, getNextId } from './csvService';
import { getFactureById, updateFacture } from './factureService';

const fileName = 'encaissements.csv';
const headers = ['id', 'facture_id', 'date', 'montant', 'moyen_paiement', 'note', 'deleted_at'];

export const MOYENS_PAIEMENT = ['virement', 'chèque', 'espèces', 'carte', 'autre'] as const;

export class EncaissementValidationError extends Error {}

export type EncaissementInput = {
  facture_id: string;
  date: string;
  montant: number;
  moyen_paiement?: (typeof MOYENS_PAIEMENT)[number];
  note?: string;
};

function parseEncaissement(row: Record<string, string>): Encaissement {
  return {
    id: row.id,
    facture_id: row.facture_id,
    date: row.date,
    montant: Number.parseFloat(row.montant),
    moyen_paiement: (row.moyen_paiement || undefined) as Encaissement['moyen_paiement'],
    note: row.note || undefined,
    deleted_at: row.deleted_at || undefined,
  };
}

function serializeEncaissement(item: Encaissement) {
  return {
    ...item,
    montant: item.montant.toString(),
    moyen_paiement: item.moyen_paiement ?? '',
    note: item.note ?? '',
  };
}

const encaissementsRepository = createCsvRepository(fileName, headers, parseEncaissement, serializeEncaissement);

function validateEncaissementInput(input: EncaissementInput): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new EncaissementValidationError('La date de l’encaissement est invalide.');
  }
  if (!Number.isFinite(input.montant) || input.montant <= 0) {
    throw new EncaissementValidationError('Le montant de l’encaissement doit être positif.');
  }
  if (input.moyen_paiement && !MOYENS_PAIEMENT.includes(input.moyen_paiement)) {
    throw new EncaissementValidationError('Le moyen de paiement est invalide.');
  }
}

export async function listAllEncaissements(): Promise<Encaissement[]> {
  return encaissementsRepository.listAll();
}

export async function listEncaissements(): Promise<Encaissement[]> {
  return encaissementsRepository.list();
}

export async function listEncaissementsForFacture(factureId: string): Promise<Encaissement[]> {
  return (await listEncaissements()).filter((item) => item.facture_id === factureId);
}

export async function getEncaissementById(id: string): Promise<Encaissement | undefined> {
  return (await listEncaissements()).find((item) => item.id === id);
}

export async function writeAllEncaissements(items: Encaissement[]): Promise<void> {
  await encaissementsRepository.writeAll(items);
}

/** Somme des encaissements actifs déjà enregistrés pour une facture. */
export async function getMontantEncaisse(factureId: string): Promise<number> {
  const items = await listEncaissementsForFacture(factureId);
  return Number(items.reduce((total, item) => total + item.montant, 0).toFixed(2));
}

/**
 * Enregistre un encaissement partiel ou total sur une facture envoyée. Le montant ne peut pas
 * dépasser le solde restant dû ; lorsque le cumul atteint le montant total de la facture, celle-ci
 * passe automatiquement au statut payée.
 */
export async function createEncaissement(input: EncaissementInput): Promise<Encaissement> {
  validateEncaissementInput(input);
  const facture = await getFactureById(input.facture_id);
  if (!facture) {
    throw new Error('Facture introuvable');
  }
  if (facture.type === 'avoir') {
    throw new EncaissementValidationError('Un avoir ne peut pas recevoir d’encaissement.');
  }
  if (facture.statut === 'brouillon') {
    throw new EncaissementValidationError('Impossible d’enregistrer un encaissement sur une facture en brouillon.');
  }
  if (facture.statut === 'payée') {
    throw new EncaissementValidationError('Cette facture est déjà entièrement payée.');
  }

  const dejaEncaisse = await getMontantEncaisse(input.facture_id);
  const solde = Number((facture.montant_ht - dejaEncaisse).toFixed(2));
  if (input.montant > solde + 0.01) {
    throw new EncaissementValidationError(`Le montant dépasse le solde restant dû (${solde.toFixed(2)} €).`);
  }

  const items = await listAllEncaissements();
  const created: Encaissement = {
    id: getNextId(items),
    facture_id: input.facture_id,
    date: input.date,
    montant: input.montant,
    moyen_paiement: input.moyen_paiement,
    note: input.note,
  };
  await encaissementsRepository.writeAll([...items, created]);

  const nouveauTotal = Number((dejaEncaisse + input.montant).toFixed(2));
  if (nouveauTotal >= Number((facture.montant_ht - 0.01).toFixed(2))) {
    await updateFacture(input.facture_id, { statut: 'payée' });
  }

  return created;
}

/**
 * Supprime logiquement un encaissement. Interdit une fois la facture entièrement payée, afin de
 * conserver la cohérence entre son solde et son statut verrouillé.
 */
export async function softDeleteEncaissement(id: string, deletedAt = new Date().toISOString()): Promise<boolean> {
  const items = await listAllEncaissements();
  const item = items.find((entry) => entry.id === id && !entry.deleted_at);
  if (!item) {
    return false;
  }
  const facture = await getFactureById(item.facture_id);
  if (facture?.statut === 'payée') {
    throw new EncaissementValidationError('Impossible de supprimer un encaissement d’une facture déjà payée.');
  }
  item.deleted_at = deletedAt;
  await writeAllEncaissements(items);
  return true;
}

export const deleteEncaissement = softDeleteEncaissement;

export async function softDeleteEncaissementsForFacture(factureId: string, deletedAt: string): Promise<void> {
  const items = await listAllEncaissements();
  let changed = false;
  for (const item of items) {
    if (item.facture_id === factureId && !item.deleted_at) {
      item.deleted_at = deletedAt;
      changed = true;
    }
  }
  if (changed) {
    await writeAllEncaissements(items);
  }
}
