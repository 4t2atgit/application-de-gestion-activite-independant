import { Router } from 'express';
import multer from 'multer';
import {
  buildAnnualFraisExportCsv,
  createFrais,
  deleteFrais,
  FRAIS_CATEGORIES,
  getFraisById,
  listFrais,
  readJustificatif,
  saveJustificatif,
  updateFrais,
} from '../services/fraisService';
import { sendServiceError } from './httpErrors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    callback(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

function parseFraisBody(body: Record<string, string>) {
  return {
    date: body.date,
    libelle: body.libelle,
    categorie: body.categorie as (typeof FRAIS_CATEGORIES)[number],
    montant_ttc: Number.parseFloat(body.montant_ttc),
    deductible: body.deductible === 'true',
    projet_id: body.projet_id || undefined,
  };
}

router.get('/', async (_request, response) => {
  response.json(await listFrais());
});

router.get('/export/:annee', async (request, response) => {
  const year = request.params.annee;
  if (!/^\d{4}$/.test(year)) {
    return response.status(400).json({ message: 'Année invalide.' });
  }
  const csv = await buildAnnualFraisExportCsv(year);
  response.setHeader('Content-Type', 'text/csv; charset=utf-8');
  response.setHeader('Content-Disposition', `attachment; filename="frais_${year}.csv"`);
  return response.send(csv);
});

router.get('/:id/justificatif', async (request, response) => {
  const frais = await getFraisById(request.params.id);
  if (!frais) {
    return response.status(404).json({ message: 'Frais introuvable.' });
  }
  const buffer = await readJustificatif(frais);
  if (!buffer || !frais.justificatif_nom_fichier) {
    return response.status(404).json({ message: 'Aucun justificatif pour ce frais.' });
  }
  response.setHeader('Content-Disposition', `attachment; filename="${frais.justificatif_nom_fichier}"`);
  return response.send(buffer);
});

router.post('/', upload.single('justificatif'), async (request, response) => {
  try {
    const frais = await createFrais(parseFraisBody(request.body));
    const withJustificatif = request.file
      ? await saveJustificatif(frais.id, request.file.buffer, request.file.originalname)
      : frais;
    return response.status(201).json(withJustificatif);
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de créer ce frais.', defaultStatus: 500 });
  }
});

router.put('/:id', upload.single('justificatif'), async (request, response) => {
  try {
    const frais = await updateFrais(request.params.id as string, parseFraisBody(request.body));
    if (!frais) {
      return response.status(404).json({ message: 'Frais introuvable.' });
    }
    const withJustificatif = request.file
      ? await saveJustificatif(frais.id, request.file.buffer, request.file.originalname)
      : frais;
    return response.json(withJustificatif);
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de mettre à jour ce frais.', defaultStatus: 500 });
  }
});

router.delete('/:id', async (request, response) => {
  const deleted = await deleteFrais(request.params.id);
  if (!deleted) {
    return response.status(404).json({ message: 'Frais introuvable.' });
  }
  return response.status(204).send();
});

export default router;
