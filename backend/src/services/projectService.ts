import { Project } from '../types';
import { createCsvRepository, getNextId } from './csvService';
import { getClientById } from './clientService';
import { softDeleteHeuresForProject } from './heuresService';
import { softDeleteFraisForProject } from './fraisService';

const fileName = 'projets.csv';
const headers = ['id', 'nom', 'client_id', 'taux_journalier', 'statut', 'date_creation', 'deleted_at'];

function parseProject(row: Record<string, string>): Project {
  return {
    id: row.id,
    nom: row.nom,
    client_id: row.client_id,
    taux_journalier: Number.parseFloat(row.taux_journalier),
    statut: row.statut as Project['statut'],
    date_creation: row.date_creation,
    deleted_at: row.deleted_at || undefined,
  };
}

function serializeProject(project: Project) {
  return {
    ...project,
    taux_journalier: project.taux_journalier.toString(),
  };
}

const projectsRepository = createCsvRepository(fileName, headers, parseProject, serializeProject);

export async function listAllProjects(): Promise<Project[]> {
  return projectsRepository.listAll();
}

export async function listProjects(): Promise<Project[]> {
  return projectsRepository.list();
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  const projects = await listProjects();
  return projects.find((project) => project.id === id);
}

export async function createProject(input: Omit<Project, 'id'>): Promise<Project> {
  const projects = await listAllProjects();
  if (!await getClientById(input.client_id)) {
    throw new Error('Client introuvable');
  }
  const project: Project = { id: getNextId(projects), ...input };
  await projectsRepository.writeAll([...projects, project]);
  return project;
}

export async function updateProject(id: string, input: Omit<Project, 'id'>): Promise<Project | undefined> {
  const projects = await listAllProjects();
  const index = projects.findIndex((project) => project.id === id);

  if (index === -1 || projects[index]?.deleted_at) {
    return undefined;
  }
  if (!await getClientById(input.client_id)) {
    throw new Error('Client introuvable');
  }

  const project: Project = { id, ...input };
  projects[index] = project;
  await projectsRepository.writeAll(projects);
  return project;
}

export async function writeAllProjects(projects: Project[]): Promise<void> {
  await projectsRepository.writeAll(projects);
}

export async function softDeleteProject(id: string, deletedAt = new Date().toISOString()): Promise<boolean> {
  const projects = await listAllProjects();
  const project = projects.find((item) => item.id === id && !item.deleted_at);
  if (!project) {
    return false;
  }

  project.deleted_at = deletedAt;
  await softDeleteHeuresForProject(id, deletedAt);
  await softDeleteFraisForProject(id, deletedAt);
  await writeAllProjects(projects);
  return true;
}

export const deleteProject = softDeleteProject;
