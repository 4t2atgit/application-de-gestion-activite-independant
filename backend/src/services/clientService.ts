import { Client } from '../types';
import { createCsvRepository, getNextId } from './csvService';
import { hasNonDraftFactureForClient, softDeleteFacturesForClient } from './factureService';
import { listAllProjects, softDeleteProject } from './projectService';

const fileName = 'clients.csv';
const headers = [
  'id',
  'nom',
  'email',
  'contact_name',
  'contact_role',
  'phone',
  'billing_address',
  'deleted_at',
];

function parseClient(row: Record<string, string>): Client {
  return {
    id: row.id,
    nom: row.nom,
    email: row.email,
    contact_name: row.contact_name ?? '',
    contact_role: row.contact_role ?? '',
    phone: row.phone ?? '',
    billing_address: row.billing_address ?? '',
    deleted_at: row.deleted_at || undefined,
  };
}

function serializeClient(client: Client) {
  return client;
}

const clientsRepository = createCsvRepository(fileName, headers, parseClient, serializeClient);

export async function listAllClients(): Promise<Client[]> {
  return clientsRepository.listAll();
}

export async function listClients(): Promise<Client[]> {
  return clientsRepository.list();
}

export async function getClientById(id: string): Promise<Client | undefined> {
  const clients = await listClients();
  return clients.find((client) => client.id === id);
}

export async function createClient(input: Omit<Client, 'id'>): Promise<Client> {
  const clients = await listAllClients();
  const client: Client = { id: getNextId(clients), ...input };
  await clientsRepository.writeAll([...clients, client]);
  return client;
}

export async function updateClient(id: string, input: Omit<Client, 'id'>): Promise<Client | undefined> {
  const clients = await listAllClients();
  const index = clients.findIndex((client) => client.id === id);

  if (index === -1 || clients[index]?.deleted_at) {
    return undefined;
  }

  const client: Client = { id, ...input };
  clients[index] = client;
  await clientsRepository.writeAll(clients);
  return client;
}

export async function writeAllClients(clients: Client[]): Promise<void> {
  await clientsRepository.writeAll(clients);
}

export async function deleteClient(id: string): Promise<boolean> {
  const clients = await listAllClients();
  const client = clients.find((item) => item.id === id && !item.deleted_at);
  if (!client) {
    return false;
  }

  if (await hasNonDraftFactureForClient(id)) {
    throw new Error('Impossible de supprimer ce client : une facture non brouillon y est rattachée.');
  }

  const deletedAt = new Date().toISOString();
  client.deleted_at = deletedAt;
  for (const project of await listAllProjects()) {
    if (project.client_id === id && !project.deleted_at) {
      await softDeleteProject(project.id, deletedAt);
    }
  }
  await softDeleteFacturesForClient(id, deletedAt);
  await writeAllClients(clients);
  return true;
}
