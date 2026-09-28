import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormField } from '../components/forms/FormField';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/tables/DataTable';
import { api } from '../services/api';
import type { Client } from '../types';

const initialForm = {
  nom: '',
  contact_name: '',
  contact_role: '',
  email: '',
  phone: '',
  billing_address: '',
};

export function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadClients = useCallback(async () => {
    setClients(await api.getClients());
  }, []);

  useEffect(() => {
    void loadClients().catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Impossible de charger les clients.'));
  }, [loadClients]);

  function closeForm() {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(initialForm);
    setErrorMessage(null);
  }

  function openCreateForm() {
    setForm(initialForm);
    setEditingId(null);
    setErrorMessage(null);
    setIsFormOpen(true);
  }

  function openEditForm(client: Client) {
    setEditingId(client.id);
    setForm({ nom: client.nom, contact_name: client.contact_name, contact_role: client.contact_role, email: client.email, phone: client.phone, billing_address: client.billing_address });
    setErrorMessage(null);
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingId) await api.updateClient(editingId, form);
      else await api.createClient(form);
      await loadClients();
      closeForm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Client impossible à enregistrer.');
    }
  }

  async function deleteClient() {
    if (!clientToDelete) return;
    try {
      await api.deleteClient(clientToDelete.id);
      setClientToDelete(null);
      await loadClients();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Suppression impossible.');
      setClientToDelete(null);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-heading">Clients <span className="text-sm font-normal text-muted">({clients.length})</span></h2>
          <p className="text-sm text-muted">Gérez votre portefeuille client.</p>
        </div>
        <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-success-strong px-4 py-2 text-sm font-medium text-white hover:bg-success-strong-hover" type="button" onClick={openCreateForm}>
          <Plus size={18} aria-hidden="true" /> Nouveau client
        </button>
      </header>
      {errorMessage && !isFormOpen ? <p className="rounded-xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text" role="alert">{errorMessage}</p> : null}
      <DataTable
        items={clients}
        emptyMessage="Aucun client enregistré. Créez votre premier client pour commencer."
        columns={[
          { key: 'nom', header: 'Nom', render: (client) => client.nom },
          { key: 'contact', header: 'Contact', render: (client) => <span>{client.contact_name || '—'}<br /><span className="text-xs text-muted">{client.email || '—'}</span></span> },
          {
            key: 'actions',
            header: 'Actions',
            render: (client) => <div className="flex gap-2">
              <button title="Modifier" aria-label="Modifier" className="inline-flex items-center justify-center rounded-full bg-surface-hover p-2 text-body hover:opacity-80" type="button" onClick={() => openEditForm(client)}><Pencil size={15} aria-hidden="true" /></button>
              <button title="Supprimer" aria-label="Supprimer" className="inline-flex items-center justify-center rounded-full bg-danger-soft p-2 text-danger-soft-text hover:opacity-80" type="button" onClick={() => setClientToDelete(client)}><Trash2 size={15} aria-hidden="true" /></button>
            </div>,
          },
        ]}
      />
      {isFormOpen ? (
        <Modal title={editingId ? 'Modifier le client' : 'Nouveau client'} description="Les champs obligatoires sont signalés par le navigateur." onClose={closeForm}>
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            {errorMessage ? <p className="rounded-xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text" role="alert">{errorMessage}</p> : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="client-nom" label="Nom"><input id="client-nom" className="w-full rounded-xl border border-subtle px-3 py-2" value={form.nom} onChange={(event) => setForm({ ...form, nom: event.target.value })} required /></FormField>
              <FormField id="client-contact-name" label="Nom complet du contact"><input id="client-contact-name" className="w-full rounded-xl border border-subtle px-3 py-2" value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></FormField>
              <FormField id="client-contact-role" label="Fonction du contact"><input id="client-contact-role" className="w-full rounded-xl border border-subtle px-3 py-2" value={form.contact_role} onChange={(event) => setForm({ ...form, contact_role: event.target.value })} /></FormField>
              <FormField id="client-email" label="Email de facturation"><input id="client-email" className="w-full rounded-xl border border-subtle px-3 py-2" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></FormField>
              <FormField id="client-phone" label="Téléphone"><input id="client-phone" className="w-full rounded-xl border border-subtle px-3 py-2" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></FormField>
            </div>
            <FormField id="client-address" label="Adresse de facturation"><textarea id="client-address" className="w-full rounded-xl border border-subtle px-3 py-2" rows={3} value={form.billing_address} onChange={(event) => setForm({ ...form, billing_address: event.target.value })} /></FormField>
            <div className="flex justify-end gap-3">
              <button className="rounded-xl bg-surface-muted px-4 py-2 text-sm font-medium text-body hover:bg-surface-hover" type="button" onClick={closeForm}>Annuler</button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-success-strong px-4 py-2 text-sm font-medium text-white hover:bg-success-strong-hover" type="submit"><Save size={16} aria-hidden="true" /> {editingId ? 'Enregistrer' : 'Créer le client'}</button>
            </div>
          </form>
        </Modal>
      ) : null}
      {clientToDelete ? <ConfirmDialog title="Supprimer le client" message={`« ${clientToDelete.nom} » sera placé dans la corbeille.`} confirmLabel="Mettre à la corbeille" onConfirm={() => void deleteClient()} onClose={() => setClientToDelete(null)} /> : null}
    </section>
  );
}
