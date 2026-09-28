import { Heure } from '../types';
import { createCsvRepository, getNextId } from './csvService';
import { getProjectById } from './projectService';
import { hasNonDraftFactureForClientMonth, hasNonDraftFactureForHeure } from './factureService';

const fileName = 'heures.csv';
const headers = ['id', 'date', 'projet_id', 'duree', 'taux_applique', 'deleted_at'];
const allowedDurations = new Set([0.5, 1]);

export class HeureValidationError extends Error {}

type HeureInput = Omit<Heure, 'id' | 'taux_applique'> & {
  taux_applique?: number;
};

function parseHeure(row: Record<string, string>): Heure {
  return {
    id: row.id,
    date: row.date,
    projet_id: row.projet_id,
    duree: Number.parseFloat(row.duree),
    taux_applique: Number.parseFloat(row.taux_applique),
    deleted_at: row.deleted_at || undefined,
  };
}

function serializeHeure(heure: Heure) {
  return {
    ...heure,
    duree: heure.duree.toString(),
    taux_applique: heure.taux_applique.toString(),
  };
}

const heuresRepository = createCsvRepository(fileName, headers, parseHeure, serializeHeure);

function validateHeureInput(input: HeureInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new HeureValidationError('La date de l\'activité est invalide.');
  }

  if (!allowedDurations.has(input.duree)) {
    throw new HeureValidationError('Une activité doit valoir 0,5 ou 1 journée.');
  }
}

async function resolveProjectContext(projetId: string, providedRate?: number) {
  const project = await getProjectById(projetId);
  if (!project) {
    throw new Error('Projet introuvable');
  }

  return {
    client_id: project.client_id,
    taux_applique:
      typeof providedRate === 'number' && !Number.isNaN(providedRate)
        ? providedRate
        : project.taux_journalier,
  };
}

async function validateDayAllocation(current: HeureInput, heureId?: string) {
  const heures = await listHeures();
  const sameDayEntries = heures.filter((heure) => heure.date === current.date && heure.id !== heureId);

  if (sameDayEntries.some((heure) => heure.projet_id === current.projet_id)) {
    throw new HeureValidationError('Une seule saisie par projet est autorisée pour une même journée.');
  }

  const updatedEntries = [...sameDayEntries, { ...current, id: heureId ?? 'pending', taux_applique: 0 }];

  if (updatedEntries.length > 2) {
    throw new HeureValidationError('Une journée ne peut être répartie que sur deux projets maximum.');
  }

  const total = updatedEntries.reduce((sum, heure) => sum + heure.duree, 0);
  if (total > 1) {
    throw new HeureValidationError('Il n\'est pas possible de dépasser une journée de travail sur une même date.');
  }

  if (updatedEntries.length === 2 && updatedEntries.some((heure) => heure.duree !== 0.5)) {
    throw new HeureValidationError('Une journée répartie sur deux projets doit être saisie en deux demi-journées.');
  }
}

async function buildHeurePayload(
  input: HeureInput,
  options?: {
    heureId?: string;
  },
): Promise<Omit<Heure, 'id'>> {
  validateHeureInput(input);

  const { client_id, taux_applique } = await resolveProjectContext(input.projet_id, input.taux_applique);
  const moisFacture = input.date.slice(0, 7);
  if (await hasNonDraftFactureForClientMonth(client_id, moisFacture)) {
    throw new HeureValidationError(
      'Impossible de modifier une activité : une facture non brouillon existe déjà pour ce client sur ce mois.',
    );
  }

  await validateDayAllocation(input, options?.heureId);

  return {
    ...input,
    taux_applique,
  };
}

export async function listAllHeures(): Promise<Heure[]> {
  return heuresRepository.listAll();
}

export async function listHeures(): Promise<Heure[]> {
  return heuresRepository.list();
}

export async function createHeure(input: HeureInput): Promise<Heure> {
  const heures = await listAllHeures();
  const heure: Heure = {
    id: getNextId(heures),
    ...(await buildHeurePayload(input)),
  };
  await heuresRepository.writeAll([...heures, heure]);
  return heure;
}

export async function updateHeure(id: string, input: HeureInput): Promise<Heure | undefined> {
  const heures = await listAllHeures();
  const index = heures.findIndex((heure) => heure.id === id);

  if (index === -1 || heures[index]?.deleted_at) {
    return undefined;
  }

  if (await hasNonDraftFactureForHeure(id)) {
    throw new HeureValidationError(
      'Impossible de modifier cette activité : elle est incluse dans une facture non brouillon.',
    );
  }

  const heure: Heure = {
    id,
    ...(await buildHeurePayload(input, {
      heureId: id,
    })),
  };
  heures[index] = heure;
  await heuresRepository.writeAll(heures);
  return heure;
}

export async function writeAllHeures(heures: Heure[]): Promise<void> {
  await heuresRepository.writeAll(heures);
}

export async function deleteHeure(id: string): Promise<boolean> {
  const heures = await listAllHeures();
  const heure = heures.find((item) => item.id === id && !item.deleted_at);
  if (!heure) {
    return false;
  }
  if (await hasNonDraftFactureForHeure(id)) {
    throw new Error('Impossible de supprimer cette activité : elle est incluse dans une facture non brouillon.');
  }
  heure.deleted_at = new Date().toISOString();
  await writeAllHeures(heures);
  return true;
}

export async function softDeleteHeuresForProject(projetId: string, deletedAt: string): Promise<void> {
  const heures = await listAllHeures();
  let changed = false;
  for (const heure of heures) {
    if (heure.projet_id === projetId && !heure.deleted_at) {
      heure.deleted_at = deletedAt;
      changed = true;
    }
  }
  if (changed) {
    await writeAllHeures(heures);
  }
}
