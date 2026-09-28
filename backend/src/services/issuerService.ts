import { IssuerProfile } from '../types';
import { readCsv, writeCsv } from './csvService';

const fileName = 'emetteur.csv';
const textFields: Array<keyof IssuerProfile> = [
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
const headers = [...textFields, 'delai_paiement_jours', 'tva_non_applicable', 'plafond_annuel'];

export const emptyIssuerProfile: IssuerProfile = {
  raison_sociale: '',
  nom_commercial: '',
  adresse_postale: '',
  siret: '',
  numero_tva: '',
  email: '',
  telephone: '',
  iban: '',
  conditions_paiement: '',
  delai_paiement_jours: 30,
  tva_non_applicable: false,
  plafond_annuel: 0,
};

function parseIssuerRow(row: Record<string, string>): IssuerProfile {
  return {
    ...(Object.fromEntries(textFields.map((field) => [field, row[field] ?? ''])) as Record<
      (typeof textFields)[number],
      string
    >),
    delai_paiement_jours: Number.parseInt(row.delai_paiement_jours ?? '', 10) || emptyIssuerProfile.delai_paiement_jours,
    tva_non_applicable: row.tva_non_applicable === 'true',
    plafond_annuel: Number.parseFloat(row.plafond_annuel ?? '') || 0,
  };
}

export async function getIssuerProfile(): Promise<IssuerProfile> {
  const rows = await readCsv<Record<string, string>>(fileName, headers);
  const row = rows[0];
  if (!row) return { ...emptyIssuerProfile };
  return parseIssuerRow(row);
}

export function validateIssuerProfile(input: unknown): input is IssuerProfile {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const profile = input as Record<string, unknown>;
  if (!textFields.every((field) => typeof profile[field] === 'string')) return false;
  if (textFields.some((field) => (profile[field] as string).length > 2000)) return false;
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email as string)) return false;
  const siret = (profile.siret as string).replace(/\s/g, '');
  if (siret && !/^\d{14}$/.test(siret)) return false;
  const iban = (profile.iban as string).replace(/\s/g, '');
  if (iban && !/^[A-Za-z0-9]{15,34}$/.test(iban)) return false;
  if (typeof profile.delai_paiement_jours !== 'number' || profile.delai_paiement_jours < 0 || profile.delai_paiement_jours > 365) {
    return false;
  }
  if (typeof profile.tva_non_applicable !== 'boolean') return false;
  if (typeof profile.plafond_annuel !== 'number' || profile.plafond_annuel < 0) return false;
  return true;
}

/** Champs indispensables pour identifier l'émetteur sur une facture (mentions légales minimales). */
const requiredIssuerFields: Array<keyof IssuerProfile> = ['raison_sociale', 'adresse_postale', 'siret', 'email'];

export function isIssuerProfileComplete(profile: IssuerProfile): boolean {
  return requiredIssuerFields.every((field) => (profile[field] as string).trim().length > 0);
}

export async function saveIssuerProfile(input: IssuerProfile): Promise<IssuerProfile> {
  const profile: IssuerProfile = {
    ...(Object.fromEntries(textFields.map((field) => [field, (input[field] as string).trim()])) as Record<
      (typeof textFields)[number],
      string
    >),
    delai_paiement_jours: input.delai_paiement_jours,
    tva_non_applicable: input.tva_non_applicable,
    plafond_annuel: input.plafond_annuel,
  };
  await writeCsv(fileName, headers, [profile]);
  return profile;
}
