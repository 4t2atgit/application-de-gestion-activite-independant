import { Router } from 'express';
import { createClient, deleteClient, listClients, updateClient } from '../services/clientService';
import { sendServiceError } from './httpErrors';

const router = Router();

function validOptionalText(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= 2000);
}

function validClientBody(body: unknown): body is Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const payload = body as Record<string, unknown>;
  const { nom, email, contact_name, contact_role, phone, billing_address } = payload;
  return typeof nom === 'string'
    && !!nom.trim()
    && nom.length <= 200
    && (email === undefined || (typeof email === 'string' && email.length <= 254))
    && (typeof email !== 'string' || !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    && [contact_name, contact_role, phone, billing_address].every(validOptionalText);
}

function clientPayload(body: Record<string, unknown>) {
  return {
    nom: (body.nom as string).trim(),
    email: typeof body.email === 'string' ? body.email.trim() : '',
    contact_name: typeof body.contact_name === 'string' ? body.contact_name.trim() : '',
    contact_role: typeof body.contact_role === 'string' ? body.contact_role.trim() : '',
    phone: typeof body.phone === 'string' ? body.phone.trim() : '',
    billing_address: typeof body.billing_address === 'string' ? body.billing_address.trim() : '',
  };
}

router.get('/', async (_request, response) => {
  response.json(await listClients());
});

router.post('/', async (request, response) => {
  if (!validClientBody(request.body)) {
    return response.status(400).json({ message: 'Champs client invalides.' });
  }

  return response.status(201).json(
    await createClient(clientPayload(request.body)),
  );
});

router.put('/:id', async (request, response) => {
  if (!validClientBody(request.body)) {
    return response.status(400).json({ message: 'Champs client invalides.' });
  }

  const client = await updateClient(request.params.id, {
    ...clientPayload(request.body),
  });

  if (!client) {
    return response.status(404).json({ message: 'Client introuvable.' });
  }

  return response.json(client);
});

router.delete('/:id', async (request, response) => {
  try {
    const deleted = await deleteClient(request.params.id);
    if (!deleted) {
      return response.status(404).json({ message: 'Client introuvable.' });
    }
    return response.status(204).send();
  } catch (error) {
    return sendServiceError(error, response, { fallbackMessage: 'Impossible de supprimer ce client.' });
  }
});

export default router;
