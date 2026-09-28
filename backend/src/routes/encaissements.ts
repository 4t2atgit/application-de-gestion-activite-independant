import { Router } from 'express';
import { createEncaissement, deleteEncaissement, listEncaissements } from '../services/encaissementService';
import { sendServiceError } from './httpErrors';

const router = Router();

router.get('/', async (request, response) => {
  const factureId = typeof request.query.facture_id === 'string' ? request.query.facture_id : undefined;
  const items = await listEncaissements();
  return response.json(factureId ? items.filter((item) => item.facture_id === factureId) : items);
});

router.post('/', async (request, response) => {
  const { facture_id, date, montant, moyen_paiement, note } = request.body;
  if (typeof facture_id !== 'string' || typeof date !== 'string' || typeof montant !== 'number') {
    return response.status(400).json({ message: 'Champs d’encaissement invalides.' });
  }
  try {
    const created = await createEncaissement({ facture_id, date, montant, moyen_paiement, note });
    return response.status(201).json(created);
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible d’enregistrer cet encaissement.' });
  }
});

router.delete('/:id', async (request, response) => {
  try {
    const deleted = await deleteEncaissement(request.params.id);
    if (!deleted) return response.status(404).json({ message: 'Encaissement introuvable.' });
    return response.status(204).send();
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de supprimer cet encaissement.' });
  }
});

export default router;
