import { Trash } from '../types';
import { listAllClients, writeAllClients } from './clientService';
import {
  hasNonDraftFactureForClient,
  hasNonDraftFactureForHeure,
  listAllFactures,
  writeAllFactures,
} from './factureService';
import { listAllHeures, writeAllHeures } from './heuresService';
import { listAllProjects, writeAllProjects } from './projectService';
import { listAllFrais, purgeFraisFile, writeAllFrais } from './fraisService';
import { listAllEncaissements, writeAllEncaissements } from './encaissementService';

export type TrashEntityType = keyof Trash;
export class TrashBusinessError extends Error {}

export async function getTrash(): Promise<Trash> {
  const [clients, projets, heures, factures, frais, encaissements] = await Promise.all([
    listAllClients(), listAllProjects(), listAllHeures(), listAllFactures(), listAllFrais(), listAllEncaissements(),
  ]);
  return {
    clients: clients.filter((item) => item.deleted_at),
    projets: projets.filter((item) => item.deleted_at),
    heures: heures.filter((item) => item.deleted_at),
    factures: factures.filter((item) => item.deleted_at),
    frais: frais.filter((item) => item.deleted_at),
    encaissements: encaissements.filter((item) => item.deleted_at),
  };
}

async function restoreDependencies(type: TrashEntityType, id: string): Promise<boolean> {
  const [clients, projects, heures, factures, frais, encaissements] = await Promise.all([
    listAllClients(), listAllProjects(), listAllHeures(), listAllFactures(), listAllFrais(), listAllEncaissements(),
  ]);
  const restoreClient = (clientId: string): boolean => {
    const client = clients.find((item) => item.id === clientId);
    if (!client) return false;
    client.deleted_at = undefined;
    return true;
  };
  const restoreProject = (projectId: string): boolean => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return false;
    project.deleted_at = undefined;
    return restoreClient(project.client_id);
  };
  const restoreFacture = (factureId: string): boolean => {
    const facture = factures.find((item) => item.id === factureId);
    if (!facture) return false;
    facture.deleted_at = undefined;
    return restoreClient(facture.client_id);
  };

  let found = false;
  if (type === 'clients') {
    const client = clients.find((item) => item.id === id && item.deleted_at);
    if (client) { client.deleted_at = undefined; found = true; }
  } else if (type === 'projets') {
    const project = projects.find((item) => item.id === id && item.deleted_at);
    if (project) { found = restoreProject(id); }
  } else if (type === 'heures') {
    const heure = heures.find((item) => item.id === id && item.deleted_at);
    if (heure) { heure.deleted_at = undefined; found = restoreProject(heure.projet_id); }
  } else if (type === 'frais') {
    const item = frais.find((entry) => entry.id === id && entry.deleted_at);
    if (item) { item.deleted_at = undefined; found = item.projet_id ? restoreProject(item.projet_id) : true; }
  } else if (type === 'encaissements') {
    const item = encaissements.find((entry) => entry.id === id && entry.deleted_at);
    if (item) { item.deleted_at = undefined; found = restoreFacture(item.facture_id); }
  } else {
    const facture = factures.find((item) => item.id === id && item.deleted_at);
    if (facture) { found = restoreFacture(id); }
  }
  if (!found) return false;
  await Promise.all([
    writeAllClients(clients), writeAllProjects(projects), writeAllHeures(heures), writeAllFactures(factures), writeAllFrais(frais), writeAllEncaissements(encaissements),
  ]);
  return true;
}

export async function restoreTrashEntity(type: TrashEntityType, id: string): Promise<boolean> {
  return restoreDependencies(type, id);
}

export async function restoreAllTrash(): Promise<void> {
  const [clients, projects, heures, factures, frais, encaissements] = await Promise.all([
    listAllClients(), listAllProjects(), listAllHeures(), listAllFactures(), listAllFrais(), listAllEncaissements(),
  ]);
  for (const item of [...clients, ...projects, ...heures, ...factures, ...frais, ...encaissements]) item.deleted_at = undefined;
  await Promise.all([
    writeAllClients(clients), writeAllProjects(projects), writeAllHeures(heures), writeAllFactures(factures), writeAllFrais(frais), writeAllEncaissements(encaissements),
  ]);
}

async function assertPurgeAllowed(type: TrashEntityType, id: string): Promise<void> {
  if (type === 'factures') {
    throw new TrashBusinessError('Impossible de supprimer définitivement une facture : sa numérotation doit être conservée.');
  }
  if (type === 'clients' && await hasNonDraftFactureForClient(id)) {
    throw new TrashBusinessError('Impossible de supprimer définitivement ce client : une activité est incluse dans une facture non brouillon.');
  }
  if (type === 'heures' && await hasNonDraftFactureForHeure(id)) {
    throw new TrashBusinessError('Impossible de supprimer définitivement cette activité : elle est incluse dans une facture non brouillon.');
  }
}

export async function purgeTrashEntity(type: TrashEntityType, id: string): Promise<boolean> {
  const trash = await getTrash();
  if (!trash[type].some((item) => item.id === id)) return false;
  await assertPurgeAllowed(type, id);

  const [clients, projects, heures, factures, frais, encaissements] = await Promise.all([
    listAllClients(), listAllProjects(), listAllHeures(), listAllFactures(), listAllFrais(), listAllEncaissements(),
  ]);
  if (type === 'clients' && projects.some((item) => item.client_id === id && !item.deleted_at)) {
    throw new TrashBusinessError('Impossible de supprimer définitivement ce client : des projets actifs y sont encore rattachés.');
  }
  if (type === 'clients' && factures.some((item) => item.client_id === id)) {
    throw new TrashBusinessError('Impossible de supprimer définitivement ce client : ses factures doivent être conservées.');
  }
  if (type === 'projets' && heures.some((item) => item.projet_id === id && !item.deleted_at)) {
    throw new TrashBusinessError('Impossible de supprimer définitivement ce projet : des activités actives y sont encore rattachées.');
  }

  const projectIds = new Set<string>();
  const clientIds = new Set<string>();
  if (type === 'clients') {
    clientIds.add(id);
    for (const project of projects) if (project.client_id === id) projectIds.add(project.id);
  } else if (type === 'projets') {
    projectIds.add(id);
  }
  const remainingClients = clients.filter((item) => !clientIds.has(item.id));
  const remainingProjects = projects.filter((item) => !projectIds.has(item.id));
  const remainingHeures = heures.filter((item) => type === 'heures' ? item.id !== id : !projectIds.has(item.projet_id));
  const purgedFrais = frais.filter((item) => type === 'frais' ? item.id === id : projectIds.has(item.projet_id ?? ''));
  const remainingFrais = frais.filter((item) => !purgedFrais.includes(item));
  const remainingEncaissements = encaissements.filter((item) => !(type === 'encaissements' && item.id === id));
  for (const item of purgedFrais) await purgeFraisFile(item);
  await Promise.all([
    writeAllClients(remainingClients),
    writeAllProjects(remainingProjects),
    writeAllHeures(remainingHeures),
    writeAllFactures(factures),
    writeAllFrais(remainingFrais),
    writeAllEncaissements(remainingEncaissements),
  ]);
  return true;
}

export async function emptyTrash(): Promise<void> {
  const trash = await getTrash();
  if (trash.factures.length > 0) {
    throw new TrashBusinessError('Impossible de vider la corbeille : les factures doivent être conservées pour leur numérotation.');
  }
  const idsByType: Array<[TrashEntityType, string]> = [
    ...trash.clients.map((item) => ['clients', item.id] as [TrashEntityType, string]),
    ...trash.projets.map((item) => ['projets', item.id] as [TrashEntityType, string]),
    ...trash.heures.map((item) => ['heures', item.id] as [TrashEntityType, string]),
    ...trash.frais.map((item) => ['frais', item.id] as [TrashEntityType, string]),
    ...trash.encaissements.map((item) => ['encaissements', item.id] as [TrashEntityType, string]),
  ];
  for (const [type, id] of idsByType) await assertPurgeAllowed(type, id);
  for (const [type, id] of idsByType) await purgeTrashEntity(type, id);
}
