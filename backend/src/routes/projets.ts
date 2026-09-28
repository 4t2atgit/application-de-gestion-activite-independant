import { Router } from 'express';
import { createProject, deleteProject, listProjects, updateProject } from '../services/projectService';
import { sendServiceError } from './httpErrors';

const router = Router();

router.get('/', async (_request, response) => {
  response.json(await listProjects());
});

router.post('/', async (request, response) => {
  const { nom, client_id, taux_journalier, statut, date_creation } = request.body;

  if (!nom || !client_id || !Number.isFinite(taux_journalier) || taux_journalier < 0 || (statut !== 'actif' && statut !== 'archivé')) {
    return response.status(400).json({ message: 'Champs projet invalides.' });
  }

  try {
    return response.status(201).json(
      await createProject({
        nom,
        client_id,
        taux_journalier,
        statut,
        date_creation: date_creation || new Date().toISOString().slice(0, 10),
      }),
    );
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de créer ce projet.', defaultStatus: 500 });
  }
});

router.put('/:id', async (request, response) => {
  const { nom, client_id, taux_journalier, statut, date_creation } = request.body;

  if (!nom || !client_id || !Number.isFinite(taux_journalier) || taux_journalier < 0 || (statut !== 'actif' && statut !== 'archivé')) {
    return response.status(400).json({ message: 'Champs projet invalides.' });
  }

  let project;
  try {
    project = await updateProject(request.params.id, {
      nom,
      client_id,
      taux_journalier,
      statut,
      date_creation,
    });
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de mettre à jour ce projet.', defaultStatus: 500 });
  }

  if (!project) {
    return response.status(404).json({ message: 'Projet introuvable.' });
  }

  return response.json(project);
});

router.delete('/:id', async (request, response) => {
  try {
    const deleted = await deleteProject(request.params.id);
    if (!deleted) {
      return response.status(404).json({ message: 'Projet introuvable.' });
    }
    return response.status(204).send();
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de supprimer ce projet.' });
  }
});

export default router;
