import { Router } from 'express';
import { getIssuerProfile, saveIssuerProfile, validateIssuerProfile } from '../services/issuerService';

const router = Router();

router.get('/', async (_request, response) => {
  response.json(await getIssuerProfile());
});

router.put('/', async (request, response) => {
  if (!validateIssuerProfile(request.body)) {
    return response.status(400).json({ message: 'Coordonnées de facturation invalides.' });
  }
  return response.json(await saveIssuerProfile(request.body));
});

export default router;
