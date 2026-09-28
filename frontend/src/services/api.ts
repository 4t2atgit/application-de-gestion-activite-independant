import type { Client, DashboardStats, Encaissement, Facture, Frais, Heure, IssuerProfile, Project, Trash } from '../types';

const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

type HeurePayload = Omit<Heure, 'id' | 'taux_applique'> & {
  taux_applique?: number;
};
type FactureCreatePayload = Pick<Facture, 'client_id' | 'mois_facture'>;
type FactureUpdatePayload = Partial<Pick<Facture, 'client_id' | 'mois_facture' | 'statut'>>;
type FraisPayload = Omit<Frais, 'id' | 'justificatif_nom_fichier'> & { justificatif?: File };
type EncaissementPayload = Omit<Encaissement, 'id'>;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erreur réseau' }));
    throw new Error(error.message ?? 'Erreur réseau');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function buildFraisFormData(payload: FraisPayload): FormData {
  const formData = new FormData();
  formData.set('date', payload.date);
  formData.set('libelle', payload.libelle);
  formData.set('categorie', payload.categorie);
  formData.set('montant_ttc', String(payload.montant_ttc));
  formData.set('deductible', String(payload.deductible));
  if (payload.projet_id) formData.set('projet_id', payload.projet_id);
  if (payload.justificatif) formData.set('justificatif', payload.justificatif);
  return formData;
}

// Requête multipart : ne pas fixer Content-Type, le navigateur ajoute la frontière du FormData.
async function requestForm<T>(path: string, method: 'POST' | 'PUT', payload: FraisPayload): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { method, body: buildFraisFormData(payload) });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erreur réseau' }));
    throw new Error(error.message ?? 'Erreur réseau');
  }

  return response.json() as Promise<T>;
}

function parseFileNameFromContentDisposition(header: string | null): string | undefined {
  const match = header ? /filename="?([^";]+)"?/.exec(header) : null;
  return match?.[1];
}

async function requestBlob(path: string): Promise<{ blob: Blob; fileName?: string }> {
  const response = await fetch(`${apiBaseUrl}${path}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erreur réseau' }));
    throw new Error(error.message ?? 'Erreur réseau');
  }

  return { blob: await response.blob(), fileName: parseFileNameFromContentDisposition(response.headers.get('Content-Disposition')) };
}

export const api = {
  getDashboard: () => request<DashboardStats>('/dashboard'),
  getClients: () => request<Client[]>('/clients'),
  createClient: (payload: Omit<Client, 'id'>) => request<Client>('/clients', { method: 'POST', body: JSON.stringify(payload) }),
  updateClient: (id: string, payload: Omit<Client, 'id'>) => request<Client>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteClient: (id: string) => request<void>(`/clients/${id}`, { method: 'DELETE' }),
  getProjects: () => request<Project[]>('/projets'),
  createProject: (payload: Omit<Project, 'id'>) => request<Project>('/projets', { method: 'POST', body: JSON.stringify(payload) }),
  updateProject: (id: string, payload: Omit<Project, 'id'>) => request<Project>(`/projets/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProject: (id: string) => request<void>(`/projets/${id}`, { method: 'DELETE' }),
  getHeures: () => request<Heure[]>('/heures'),
  createHeure: (payload: HeurePayload) => request<Heure>('/heures', { method: 'POST', body: JSON.stringify(payload) }),
  updateHeure: (id: string, payload: HeurePayload) => request<Heure>(`/heures/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteHeure: (id: string) => request<void>(`/heures/${id}`, { method: 'DELETE' }),
  getFactures: () => request<Facture[]>('/factures'),
  createFacture: (payload: FactureCreatePayload) => request<Facture>('/factures', { method: 'POST', body: JSON.stringify(payload) }),
  updateFacture: (id: string, payload: FactureUpdatePayload) => request<Facture>(`/factures/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteFacture: (id: string) => request<void>(`/factures/${id}`, { method: 'DELETE' }),
  createAvoir: (id: string) => request<Facture>(`/factures/${id}/avoir`, { method: 'POST' }),
  getFacturePdf: (id: string) => requestBlob(`/factures/${id}/pdf`),
  getFacturesExport: (annee: string) => requestBlob(`/factures/export/${annee}`),
  getIssuerProfile: () => request<IssuerProfile>('/issuer'),
  updateIssuerProfile: (payload: IssuerProfile) => request<IssuerProfile>('/issuer', { method: 'PUT', body: JSON.stringify(payload) }),
  getTrash: () => request<Trash>('/corbeille'),
  restoreTrashItem: (type: keyof Trash, id: string) => request<void>(`/corbeille/${type}/${id}/restore`, { method: 'POST' }),
  restoreAllTrash: () => request<void>('/corbeille/restore-all', { method: 'POST' }),
  purgeTrashItem: (type: keyof Trash, id: string) => request<void>(`/corbeille/${type}/${id}`, { method: 'DELETE' }),
  emptyTrash: () => request<void>('/corbeille', { method: 'DELETE' }),
  getFrais: () => request<Frais[]>('/frais'),
  createFrais: (payload: FraisPayload) => requestForm<Frais>('/frais', 'POST', payload),
  updateFrais: (id: string, payload: FraisPayload) => requestForm<Frais>(`/frais/${id}`, 'PUT', payload),
  deleteFrais: (id: string) => request<void>(`/frais/${id}`, { method: 'DELETE' }),
  getFraisJustificatif: (id: string) => requestBlob(`/frais/${id}/justificatif`),
  getFraisExport: (annee: string) => requestBlob(`/frais/export/${annee}`),
  getEncaissements: (factureId?: string) => request<Encaissement[]>(`/encaissements${factureId ? `?facture_id=${factureId}` : ''}`),
  createEncaissement: (payload: EncaissementPayload) => request<Encaissement>('/encaissements', { method: 'POST', body: JSON.stringify(payload) }),
  deleteEncaissement: (id: string) => request<void>(`/encaissements/${id}`, { method: 'DELETE' }),
};
