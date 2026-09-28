import type { IssuerProfile } from '../types';

/**
 * Champs indispensables pour identifier l'émetteur sur une facture (mentions
 * légales minimales). Doit rester cohérent avec
 * backend/src/services/issuerService.ts (requiredIssuerFields).
 */
const requiredIssuerFields: Array<keyof IssuerProfile> = ['raison_sociale', 'adresse_postale', 'siret', 'email'];

export function isIssuerProfileComplete(profile: IssuerProfile): boolean {
  return requiredIssuerFields.every((field) => (profile[field] as string).trim().length > 0);
}
