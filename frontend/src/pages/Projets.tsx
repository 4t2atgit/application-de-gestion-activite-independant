import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormField } from '../components/forms/FormField';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/tables/DataTable';
import { api } from '../services/api';
import type { Client, Project } from '../types';

const emptyForm = { nom: '', client_id: '', taux_journalier: 500, statut: 'actif' as Project['statut'], date_creation: new Date().toISOString().slice(0, 10) };

export function Projets() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [projectsData, clientsData] = await Promise.all([api.getProjects(), api.getClients()]);
    setProjects(projectsData);
    setClients(clientsData);
  }, []);

  useEffect(() => {
    void loadData().catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Impossible de charger les projets.'));
  }, [loadData]);

  function resetForm() {
    setForm({ ...emptyForm, client_id: clients[0]?.id ?? '' });
    setEditingId(null);
    setErrorMessage(null);
  }

  function closeForm() {
    setIsFormOpen(false);
    resetForm();
  }

  function openCreateForm() {
    resetForm();
    setIsFormOpen(true);
  }

  function openEditForm(project: Project) {
    setEditingId(project.id);
    setForm({ nom: project.nom, client_id: project.client_id, taux_journalier: project.taux_journalier, statut: project.statut, date_creation: project.date_creation });
    setErrorMessage(null);
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingId) await api.updateProject(editingId, form);
      else await api.createProject(form);
      await loadData();
      closeForm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Projet impossible à enregistrer.');
    }
  }

  async function deleteProject() {
    if (!projectToDelete) return;
    try {
      await api.deleteProject(projectToDelete.id);
      setProjectToDelete(null);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Suppression impossible.');
      setProjectToDelete(null);
    }
  }

  const groupedProjects = useMemo(() => {
    const groups = new Map<string, Project[]>();
    projects.forEach((project) => {
      const group = groups.get(project.client_id) ?? [];
      group.push(project);
      groups.set(project.client_id, group);
    });

    return Array.from(groups.entries())
      .map(([clientId, items]) => ({
        client: clients.find((client) => client.id === clientId),
        clientId,
        projects: [...items].sort((a, b) => a.nom.localeCompare(b.nom, 'fr-FR')),
      }))
      .sort((left, right) => (left.client?.nom ?? '').localeCompare(right.client?.nom ?? '', 'fr-FR'));
  }, [projects, clients]);

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-heading">Projets <span className="text-sm font-normal text-muted">({projects.length})</span></h2>
          <p className="text-sm text-muted">Associez chaque projet à un client et suivez son statut.</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-success-strong px-4 py-2 text-sm font-medium text-white hover:bg-success-strong-hover disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={clients.length === 0} title={clients.length === 0 ? 'Créez d’abord un client' : undefined} onClick={openCreateForm}>
          <Plus size={18} aria-hidden="true" /> Nouveau projet
        </button>
      </header>
      {clients.length === 0 ? <p className="rounded-xl border border-warning-soft-border bg-warning-soft px-4 py-3 text-sm text-warning-soft-text">Créez d’abord un client pour pouvoir ajouter un projet.</p> : null}
      {errorMessage && !isFormOpen ? <p className="rounded-xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text" role="alert">{errorMessage}</p> : null}
      {projects.length === 0 ? (
        <p className="rounded-2xl bg-surface p-6 text-sm text-muted shadow-sm">Aucun projet enregistré.</p>
      ) : (
        <div className="space-y-6">
          {groupedProjects.map((group) => (
            <div key={group.clientId} className="space-y-2">
              <h3 className="text-sm font-semibold text-heading">
                {group.client?.nom ?? 'Client inconnu'} <span className="font-normal text-muted">({group.projects.length})</span>
              </h3>
              <DataTable
                items={group.projects}
                emptyMessage="Aucun projet enregistré."
                columns={[
                  { key: 'nom', header: 'Nom', render: (project) => project.nom },
                  { key: 'taux', header: 'Taux', render: (project) => `${project.taux_journalier} €/j` },
                  { key: 'statut', header: 'Statut', render: (project) => <span className={`rounded-full px-2 py-1 text-xs font-medium ${project.statut === 'actif' ? 'bg-success-soft text-success-soft-text' : 'bg-surface-muted text-body'}`}>{project.statut}</span> },
                  { key: 'date', header: 'Création', render: (project) => project.date_creation },
                  { key: 'actions', header: 'Actions', render: (project) => <div className="flex gap-2">
                    <button title="Modifier" aria-label="Modifier" className="inline-flex items-center justify-center rounded-full bg-surface-hover p-2 text-body hover:opacity-80" type="button" onClick={() => openEditForm(project)}><Pencil size={15} aria-hidden="true" /></button>
                    <button title="Supprimer" aria-label="Supprimer" className="inline-flex items-center justify-center rounded-full bg-danger-soft p-2 text-danger-soft-text hover:opacity-80" type="button" onClick={() => setProjectToDelete(project)}><Trash2 size={15} aria-hidden="true" /></button>
                  </div> },
                ]}
              />
            </div>
          ))}
        </div>
      )}
      {isFormOpen ? (
        <Modal title={editingId ? 'Modifier le projet' : 'Nouveau projet'} onClose={closeForm}>
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            {errorMessage ? <p className="rounded-xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text" role="alert">{errorMessage}</p> : null}
            <FormField id="project-nom" label="Nom"><input id="project-nom" className="w-full rounded-xl border border-subtle px-3 py-2" value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} required /></FormField>
            <FormField id="project-client" label="Client"><select id="project-client" className="w-full rounded-xl border border-subtle px-3 py-2" value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.target.value })} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.nom}</option>)}</select></FormField>
            <FormField id="project-rate" label="Taux journalier (€)"><input id="project-rate" className="w-full rounded-xl border border-subtle px-3 py-2" type="number" min="0" step="0.01" value={form.taux_journalier} onChange={(event) => setForm({ ...form, taux_journalier: Number(event.target.value) })} required /></FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="project-statut" label="Statut"><select id="project-statut" className="w-full rounded-xl border border-subtle px-3 py-2" value={form.statut} onChange={(event) => setForm({ ...form, statut: event.target.value as Project['statut'] })}><option value="actif">Actif</option><option value="archivé">Archivé</option></select></FormField>
              <FormField id="project-date" label="Date de création"><input id="project-date" className="w-full rounded-xl border border-subtle px-3 py-2" type="date" value={form.date_creation} onChange={(event) => setForm({ ...form, date_creation: event.target.value })} required /></FormField>
            </div>
            <div className="flex justify-end gap-3"><button className="rounded-xl bg-surface-muted px-4 py-2 text-sm font-medium text-body hover:bg-surface-hover" type="button" onClick={closeForm}>Annuler</button><button className="inline-flex items-center gap-2 rounded-xl bg-success-strong px-4 py-2 text-sm font-medium text-white hover:bg-success-strong-hover" type="submit"><Save size={16} aria-hidden="true" /> {editingId ? 'Enregistrer' : 'Créer le projet'}</button></div>
          </form>
        </Modal>
      ) : null}
      {projectToDelete ? <ConfirmDialog title="Supprimer le projet" message={`« ${projectToDelete.nom} » sera placé dans la corbeille.`} confirmLabel="Mettre à la corbeille" onConfirm={() => void deleteProject()} onClose={() => setProjectToDelete(null)} /> : null}
    </section>
  );
}
