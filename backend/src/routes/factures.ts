import { Router } from 'express';
import { buildAnnualFacturesExportCsv, createAvoir, createFacture, deleteFacture, getFactureById, listFactures, updateFacture } from '../services/factureService';
import { buildInvoicePdfBuffer, getInvoicePdfFileName, persistInvoicePdf, readPersistedInvoicePdf } from '../services/facturePdfService';
import { sendServiceError } from './httpErrors';

const router = Router();
const immutableFields = ['numero_facture', 'montant_ht', 'date_creation', 'date_facture', 'projet_id'];

function hasImmutableOverride(body: Record<string, unknown>): boolean {
  return immutableFields.some((field) => Object.hasOwn(body, field));
}

router.get('/', async (_request, response) => {
  response.json(await listFactures());
});

router.get('/export/:annee', async (request, response) => {
  const year = request.params.annee;
  if (!/^\d{4}$/.test(year)) {
    return response.status(400).json({ message: 'Année invalide.' });
  }
  const csv = await buildAnnualFacturesExportCsv(year);
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="factures_${year}.csv"`);
  return response.send(csv);
});

router.get('/:id/pdf', async (request, response) => {
  const facture = await getFactureById(request.params.id);
  if (!facture) {
    return response.status(404).json({ message: 'Facture introuvable.' });
  }

  try {
    const fileName = getInvoicePdfFileName(facture);
    let buffer: Buffer;

    if (facture.statut === 'brouillon') {
      buffer = buildInvoicePdfBuffer(facture);
    } else {
      const persisted = await readPersistedInvoicePdf(facture);
      if (persisted) {
        buffer = persisted;
      } else {
        // Auto-réparation si le fichier persisté est manquant (ne devrait pas arriver en usage normal).
        buffer = buildInvoicePdfBuffer(facture);
        await persistInvoicePdf(facture, buffer);
      }
    }

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return response.send(buffer);
  } catch {
    return response.status(500).json({ message: 'Impossible de générer le PDF de cette facture.' });
  }
});

router.post('/', async (request, response) => {
  const { client_id, mois_facture } = request.body;
  if (
    hasImmutableOverride(request.body)
    || Object.hasOwn(request.body, 'statut')
    || typeof client_id !== 'string'
    || typeof mois_facture !== 'string'
  ) {
    return response.status(400).json({ message: 'Champs facture invalides.' });
  }
  try {
    return response.status(201).json(await createFacture({ client_id, mois_facture }));
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de traiter cette facture.' });
  }
});

router.put('/:id', async (request, response) => {
  const { client_id, mois_facture, statut } = request.body;
  if (
    hasImmutableOverride(request.body)
    || (client_id !== undefined && typeof client_id !== 'string')
    || (mois_facture !== undefined && typeof mois_facture !== 'string')
    || (statut !== undefined && !['brouillon', 'envoyée', 'payée'].includes(statut))
    || (client_id === undefined && mois_facture === undefined && statut === undefined)
  ) {
    return response.status(400).json({ message: 'Champs facture invalides.' });
  }
  try {
    const facture = await updateFacture(request.params.id, { client_id, mois_facture, statut });
    if (!facture) return response.status(404).json({ message: 'Facture introuvable.' });
    return response.json(facture);
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de traiter cette facture.' });
  }
});

router.delete('/:id', async (request, response) => {
  const deleted = await deleteFacture(request.params.id);
  if (!deleted) return response.status(404).json({ message: 'Facture introuvable.' });
  return response.status(204).send();
});

router.post('/:id/avoir', async (request, response) => {
  try {
    return response.status(201).json(await createAvoir(request.params.id));
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de générer cet avoir.' });
  }
});

export default router;
