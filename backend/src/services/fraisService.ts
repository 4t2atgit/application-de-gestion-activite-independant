import fs from 'node:fs';
import path from 'node:path';
import { Frais } from '../types';
import { createCsvRepository, getNextId, buildCsvDocument } from './csvService';
import { getProjectById } from './projectService';

const fileName = 'frais.csv';
const headers = ['id', 'date', 'libelle', 'categorie', 'montant_ttc', 'deductible', 'projet_id', 'justificatif_nom_fichier', 'deleted_at'];

export const FRAIS_CATEGORIES = ['matériel', 'déplacement', 'logiciel/abonnement', 'repas', 'autre'] as const;
/** Extensions de justificatif acceptées, alignées sur les types MIME autorisés par la route d'upload. */
export const JUSTIFICATIF_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

export class FraisValidationError extends Error {}

type FraisInput = Omit<Frais, 'id' | 'justificatif_nom_fichier'>;

function getJustificatifsDirectory(): string {
  return path.resolve(process.cwd(), 'data', 'frais-justificatifs');
}

function parseFrais(row: Record<string, string>): Frais {
  return {
    id: row.id,
    date: row.date,
    libelle: row.libelle,
    categorie: row.categorie as Frais['categorie'],
    montant_ttc: Number.parseFloat(row.montant_ttc),
    deductible: row.deductible === 'true',
    projet_id: row.projet_id || undefined,
    justificatif_nom_fichier: row.justificatif_nom_fichier || undefined,
    deleted_at: row.deleted_at || undefined,
  };
}

function serializeFrais(frais: Frais) {
  return {
    ...frais,
    montant_ttc: frais.montant_ttc.toString(),
    deductible: frais.deductible.toString(),
    projet_id: frais.projet_id ?? '',
    justificatif_nom_fichier: frais.justificatif_nom_fichier ?? '',
  };
}

const fraisRepository = createCsvRepository(fileName, headers, parseFrais, serializeFrais);

function validateFraisInput(input: FraisInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new FraisValidationError('La date du frais est invalide.');
  }
  if (!input.libelle?.trim()) {
    throw new FraisValidationError('Le libellé du frais est obligatoire.');
  }
  if (!FRAIS_CATEGORIES.includes(input.categorie)) {
    throw new FraisValidationError('La catégorie du frais est invalide.');
  }
  if (!Number.isFinite(input.montant_ttc) || input.montant_ttc <= 0) {
    throw new FraisValidationError('Le montant du frais doit être positif.');
  }
}

export async function listAllFrais(): Promise<Frais[]> {
  return fraisRepository.listAll();
}

export async function listFrais(): Promise<Frais[]> {
  return fraisRepository.list();
}

export async function getFraisById(id: string): Promise<Frais | undefined> {
  const frais = await listFrais();
  return frais.find((item) => item.id === id);
}

export async function writeAllFrais(frais: Frais[]): Promise<void> {
  await fraisRepository.writeAll(frais);
}

export async function createFrais(input: FraisInput): Promise<Frais> {
  validateFraisInput(input);
  if (input.projet_id && !await getProjectById(input.projet_id)) {
    throw new Error('Projet introuvable');
  }

  const frais = await listAllFrais();
  const created: Frais = { id: getNextId(frais), ...input };
  await fraisRepository.writeAll([...frais, created]);
  return created;
}

export async function updateFrais(id: string, input: FraisInput): Promise<Frais | undefined> {
  validateFraisInput(input);
  if (input.projet_id && !await getProjectById(input.projet_id)) {
    throw new Error('Projet introuvable');
  }

  const frais = await listAllFrais();
  const index = frais.findIndex((item) => item.id === id);
  if (index === -1 || frais[index]?.deleted_at) {
    return undefined;
  }

  const updated: Frais = { id, justificatif_nom_fichier: frais[index]?.justificatif_nom_fichier, ...input };
  frais[index] = updated;
  await fraisRepository.writeAll(frais);
  return updated;
}

export async function softDeleteFrais(id: string, deletedAt = new Date().toISOString()): Promise<boolean> {
  const frais = await listAllFrais();
  const item = frais.find((entry) => entry.id === id && !entry.deleted_at);
  if (!item) {
    return false;
  }
  item.deleted_at = deletedAt;
  await writeAllFrais(frais);
  return true;
}

export const deleteFrais = softDeleteFrais;

export async function softDeleteFraisForProject(projetId: string, deletedAt: string): Promise<void> {
  const frais = await listAllFrais();
  let changed = false;
  for (const item of frais) {
    if (item.projet_id === projetId && !item.deleted_at) {
      item.deleted_at = deletedAt;
      changed = true;
    }
  }
  if (changed) {
    await writeAllFrais(frais);
  }
}

function sanitizeExtension(originalName: string): string {
  const extension = path.extname(originalName).toLowerCase();
  if (!JUSTIFICATIF_EXTENSIONS.includes(extension)) {
    throw new FraisValidationError('Format de justificatif non pris en charge (PDF, JPG ou PNG uniquement).');
  }
  return extension;
}

function getJustificatifPath(id: string, extension: string): string {
  return path.join(getJustificatifsDirectory(), `frais_${id}${extension}`);
}

async function removeExistingJustificatif(frais: Frais): Promise<void> {
  if (!frais.justificatif_nom_fichier) {
    return;
  }
  const extension = path.extname(frais.justificatif_nom_fichier).toLowerCase();
  try {
    await fs.promises.unlink(getJustificatifPath(frais.id, extension));
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT')) {
      throw error;
    }
  }
}

/** Enregistre (ou remplace) le justificatif d'un frais et met à jour son nom de fichier d'origine. */
export async function saveJustificatif(id: string, buffer: Buffer, originalName: string): Promise<Frais> {
  const frais = await listAllFrais();
  const index = frais.findIndex((item) => item.id === id && !item.deleted_at);
  if (index === -1) {
    throw new Error('Frais introuvable');
  }

  const extension = sanitizeExtension(originalName);
  await removeExistingJustificatif(frais[index]!);
  await fs.promises.mkdir(getJustificatifsDirectory(), { recursive: true });
  await fs.promises.writeFile(getJustificatifPath(id, extension), buffer);

  const updated = { ...frais[index]!, justificatif_nom_fichier: originalName };
  frais[index] = updated;
  await fraisRepository.writeAll(frais);
  return updated;
}

export async function readJustificatif(frais: Frais): Promise<Buffer | undefined> {
  if (!frais.justificatif_nom_fichier) {
    return undefined;
  }
  const extension = path.extname(frais.justificatif_nom_fichier).toLowerCase();
  try {
    return await fs.promises.readFile(getJustificatifPath(frais.id, extension));
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

/** Supprime définitivement l'enregistrement et son justificatif éventuel (purge corbeille). */
export async function purgeFraisFile(frais: Frais): Promise<void> {
  await removeExistingJustificatif(frais);
}

export async function getFraisCeMois(now = new Date()): Promise<number> {
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const frais = await listFrais();
  return Number.parseFloat(
    frais
      .filter((item) => item.date.slice(0, 7) === month)
      .reduce((total, item) => total + item.montant_ttc, 0)
      .toFixed(2),
  );
}

/** Construit l'export CSV annuel des frais professionnels (usage comptable), trié par date. */
export async function buildAnnualFraisExportCsv(year: string): Promise<string> {
  const frais = (await listFrais())
    .filter((item) => item.date.startsWith(year))
    .sort((a, b) => a.date.localeCompare(b.date));

  const headers = ['date', 'libelle', 'categorie', 'montant_ttc', 'deductible', 'justificatif'];
  const rows = frais.map((item) => ({
    date: item.date,
    libelle: item.libelle,
    categorie: item.categorie,
    montant_ttc: item.montant_ttc.toFixed(2),
    deductible: item.deductible ? 'oui' : 'non',
    justificatif: item.justificatif_nom_fichier ?? '',
  }));

  return buildCsvDocument(headers, rows);
}
