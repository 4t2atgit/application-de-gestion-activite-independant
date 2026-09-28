import type { Client, Project } from '../types';

/**
 * Libellé d'un projet toujours accompagné du nom de son client, pour les
 * listes déroulantes et libellés où le projet est présenté hors de son
 * contexte client (ex. sélection dans un formulaire).
 */
export function formatProjectLabel(project: Project, clients: Client[] | Map<string, Client>): string {
  const client = clients instanceof Map ? clients.get(project.client_id) : clients.find((item) => item.id === project.client_id);
  return client ? `${client.nom} — ${project.nom}` : project.nom;
}
