import { Router } from 'express';
import {
  TrashBusinessError,
  emptyTrash,
  getTrash,
  purgeTrashEntity,
  restoreAllTrash,
  restoreTrashEntity,
  type TrashEntityType,
} from '../services/trashService';

const router = Router();
const types = new Set<TrashEntityType>(['clients', 'projets', 'heures', 'factures', 'frais', 'encaissements']);

function getType(value: string): TrashEntityType | undefined {
  return types.has(value as TrashEntityType) ? value as TrashEntityType : undefined;
}

function sendError(error: unknown, response: import('express').Response) {
  if (error instanceof TrashBusinessError) return response.status(400).json({ message: error.message });
  return response.status(500).json({ message: 'Impossible de traiter la corbeille.' });
}

router.get('/', async (_request, response) => {
  response.json(await getTrash());
});

router.post('/restore-all', async (_request, response) => {
  await restoreAllTrash();
  return response.status(204).send();
});

router.delete('/', async (_request, response) => {
  try {
    await emptyTrash();
    return response.status(204).send();
  } catch (error) {
    return sendError(error, response);
  }
});

router.post('/:type/:id/restore', async (request, response) => {
  const type = getType(request.params.type);
  if (!type) return response.status(400).json({ message: 'Type de ressource invalide.' });
  if (!await restoreTrashEntity(type, request.params.id)) {
    return response.status(404).json({ message: 'Élément introuvable dans la corbeille.' });
  }
  return response.status(204).send();
});

router.delete('/:type/:id', async (request, response) => {
  const type = getType(request.params.type);
  if (!type) return response.status(400).json({ message: 'Type de ressource invalide.' });
  try {
    if (!await purgeTrashEntity(type, request.params.id)) {
      return response.status(404).json({ message: 'Élément introuvable dans la corbeille.' });
    }
    return response.status(204).send();
  } catch (error) {
    return sendError(error, response);
  }
});

export default router;
