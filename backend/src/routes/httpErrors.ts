import type { Response } from 'express';

export interface ServiceErrorOptions {
  /** Message renvoyé quand l'erreur interceptée n'est pas une instance d'`Error`. */
  fallbackMessage: string;
  /** Statut HTTP utilisé pour une erreur métier qui ne signale pas une ressource introuvable. */
  defaultStatus?: 400 | 500;
}

/**
 * Traduit une erreur levée par un service en réponse HTTP JSON. Toute erreur
 * dont le message contient « introuvable » est traduite en 404 ; les autres
 * erreurs métier utilisent `defaultStatus` (400 par défaut) ; une valeur
 * inattendue (non `Error`) retombe sur un 500 avec `fallbackMessage`.
 */
export function sendServiceError(error: unknown, response: Response, options: ServiceErrorOptions): Response {
  const { fallbackMessage, defaultStatus = 400 } = options;

  if (error instanceof Error) {
    const status = error.message.includes('introuvable') ? 404 : defaultStatus;
    return response.status(status).json({ message: error.message });
  }

  return response.status(500).json({ message: fallbackMessage });
}
