import { Router } from 'express';
import { createHeure, deleteHeure, listHeures, updateHeure } from '../services/heuresService';
import { sendServiceError } from './httpErrors';

const router = Router();

router.get('/', async (_request, response) => {
  response.json(await listHeures());
});

router.post('/', async (request, response) => {
  const { date, projet_id, duree, taux_applique } = request.body;

  if (!date || !projet_id || !Number.isFinite(duree)) {
    return response.status(400).json({ message: 'Champs heure invalides.' });
  }

  try {
    return response.status(201).json(
      await createHeure({
        date,
        projet_id,
        duree,
        taux_applique,
      }),
    );
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de traiter cette entrée de temps.' });
  }
});

router.put('/:id', async (request, response) => {
  const { date, projet_id, duree, taux_applique } = request.body;

  if (!date || !projet_id || !Number.isFinite(duree)) {
    return response.status(400).json({ message: 'Champs heure invalides.' });
  }

  try {
    const heure = await updateHeure(request.params.id, {
      date,
      projet_id,
      duree,
      taux_applique,
    });

    if (!heure) {
      return response.status(404).json({ message: 'Entrée de temps introuvable.' });
    }

    return response.json(heure);
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de traiter cette entrée de temps.' });
  }
});

router.delete('/:id', async (request, response) => {
  try {
    const deleted = await deleteHeure(request.params.id);
    if (!deleted) {
      return response.status(404).json({ message: 'Entrée de temps introuvable.' });
    }
    return response.status(204).send();
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de supprimer cette activité.' });
  }
});

export default router;
