import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Download, FileDown, Paperclip, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormField } from '../components/forms/FormField';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/tables/DataTable';
import { Pagination } from '../components/Pagination';
import { api } from '../services/api';
import type { Client, Frais, Project } from '../types';
import { formatProjectLabel } from '../utils/projectLabel';

const PAGE_SIZE = 10;
const CATEGORIES: Array<Frais['categorie']> = ['matériel', 'déplacement', 'logiciel/abonnement', 'repas', 'autre'];

type FraisForm = Omit<Frais, 'id' | 'justificatif_nom_fichier'>;
const emptyForm: FraisForm = { date: new Date().toISOString().slice(0, 10), libelle: '', categorie: 'autre', montant_ttc: 0, deductible: true, projet_id: undefined };

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`));
}

export function Frais() {
  const [frais, setFrais] = useState<Frais[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState<FraisForm>(emptyForm);
  const [selectedFile, setSelectedFile] = useState<File | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [fraisToDelete, setFraisToDelete] = useState<Frais | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const [fraisData, projectsData, clientsData] = await Promise.all([api.getFrais(), api.getProjects(), api.getClients()]);
    setFrais(fraisData);
    setProjects(projectsData);
    setClients(clientsData);
  }, []);

  useEffect(() => {
    void loadData().catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Impossible de charger les frais.'));
  }, [loadData]);

  const sortedFrais = useMemo(() => [...frais].sort((a, b) => b.date.localeCompare(a.date)), [frais]);
  const pageCount = Math.max(1, Math.ceil(sortedFrais.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedFrais = sortedFrais.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => formatProjectLabel(a, clients).localeCompare(formatProjectLabel(b, clients))),
    [projects, clients],
  );

  function closeForm() {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setSelectedFile(undefined);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function openForm(item?: Frais) {
    if (item) {
      setEditingId(item.id);
      setForm({ date: item.date, libelle: item.libelle, categorie: item.categorie, montant_ttc: item.montant_ttc, deductible: item.deductible, projet_id: item.projet_id });
    } else {
      setForm({ ...emptyForm });
      setEditingId(null);
    }
    setSelectedFile(undefined);
    setErrorMessage(null);
    setIsFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const payload = { ...form, justificatif: selectedFile };
      if (editingId) await api.updateFrais(editingId, payload);
      else await api.createFrais(payload);
      await loadData();
      closeForm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Frais impossible à enregistrer.');
    }
  }

  async function removeFrais() {
    if (!fraisToDelete) return;
    try {
      await api.deleteFrais(fraisToDelete.id);
      setFraisToDelete(null);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Suppression impossible.');
      setFraisToDelete(null);
    }
  }

  function downloadJustificatif(item: Frais) {
    void api.getFraisJustificatif(item.id)
      .then(({ blob, fileName }) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName ?? item.justificatif_nom_fichier ?? 'justificatif';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
      .catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Impossible de télécharger le justificatif.'));
  }

  function exportAnnualCsv() {
    const year = String(new Date().getFullYear());
    void api.getFraisExport(year)
      .then(({ blob, fileName }) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName ?? `frais_${year}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
      .catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Impossible d’exporter les frais.'));
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-heading">Frais <span className="text-sm font-normal text-muted">({frais.length})</span></h2>
          <p className="text-sm text-muted">Enregistrez vos frais professionnels et conservez leurs justificatifs.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-muted px-4 py-2 text-sm font-medium text-body hover:bg-surface-hover" type="button" onClick={exportAnnualCsv}><FileDown size={18} aria-hidden="true" /> Exporter l’année</button>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-success-strong px-4 py-2 text-sm font-medium text-white hover:bg-success-strong-hover" type="button" onClick={() => openForm()}><Plus size={18} aria-hidden="true" /> Ajouter un frais</button>
        </div>
      </header>
      {errorMessage && !isFormOpen ? <p className="rounded-xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text" role="alert">{errorMessage}</p> : null}
      <div className="space-y-0">
        <DataTable
          items={pagedFrais}
          emptyMessage="Aucun frais enregistré."
          columns={[
            { key: 'date', header: 'Date', render: (item) => formatShortDate(item.date) },
            { key: 'libelle', header: 'Libellé', render: (item) => item.libelle },
            { key: 'categorie', header: 'Catégorie', render: (item) => item.categorie },
            { key: 'projet', header: 'Projet', render: (item) => {
              const project = projects.find((project) => project.id === item.projet_id);
              return project ? formatProjectLabel(project, clients) : '—';
            } },
            { key: 'montant', header: 'Montant TTC', render: (item) => `${item.montant_ttc.toFixed(2)} €` },
            { key: 'justificatif', header: 'Justificatif', render: (item) => item.justificatif_nom_fichier
              ? <button title="Télécharger le justificatif" aria-label="Télécharger le justificatif" className="inline-flex items-center gap-1 text-info-soft-text hover:opacity-80" type="button" onClick={() => downloadJustificatif(item)}><Paperclip size={14} aria-hidden="true" /> {item.justificatif_nom_fichier}</button>
              : <span className="text-muted">—</span> },
            { key: 'actions', header: 'Actions', render: (item) => <div className="flex flex-wrap gap-2">
              <button title="Modifier" aria-label="Modifier" className="inline-flex items-center justify-center rounded-full bg-surface-hover p-2 text-body hover:opacity-80" type="button" onClick={() => openForm(item)}><Pencil size={15} aria-hidden="true" /></button>
              {item.justificatif_nom_fichier ? <button title="Télécharger le justificatif" aria-label="Télécharger le justificatif" className="inline-flex items-center justify-center rounded-full bg-accent-soft p-2 text-accent-soft-text hover:opacity-80" type="button" onClick={() => downloadJustificatif(item)}><Download size={15} aria-hidden="true" /></button> : null}
              <button title="Mettre à la corbeille" aria-label="Mettre à la corbeille" className="inline-flex items-center justify-center rounded-full bg-danger-soft p-2 text-danger-soft-text hover:opacity-80" type="button" onClick={() => setFraisToDelete(item)}><Trash2 size={15} aria-hidden="true" /></button>
            </div> },
          ]}
        />
        {sortedFrais.length > 0 ? <div className="rounded-b-2xl bg-surface shadow-sm"><Pagination page={currentPage} pageCount={pageCount} onPageChange={setPage} /></div> : null}
      </div>
      {isFormOpen ? (
        <Modal title={editingId ? 'Modifier le frais' : 'Ajouter un frais'} onClose={closeForm} maxWidth="md">
          <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
            {errorMessage ? <p className="rounded-xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text" role="alert">{errorMessage}</p> : null}
            <FormField id="frais-date" label="Date"><input id="frais-date" className="w-full rounded-xl border border-subtle px-3 py-2" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></FormField>
            <FormField id="frais-libelle" label="Libellé"><input id="frais-libelle" className="w-full rounded-xl border border-subtle px-3 py-2" type="text" value={form.libelle} onChange={(event) => setForm({ ...form, libelle: event.target.value })} required /></FormField>
            <FormField id="frais-categorie" label="Catégorie">
              <select id="frais-categorie" className="w-full rounded-xl border border-subtle px-3 py-2" value={form.categorie} onChange={(event) => setForm({ ...form, categorie: event.target.value as Frais['categorie'] })}>
                {CATEGORIES.map((categorie) => <option key={categorie} value={categorie}>{categorie}</option>)}
              </select>
            </FormField>
            <FormField id="frais-montant" label="Montant TTC (€)"><input id="frais-montant" className="w-full rounded-xl border border-subtle px-3 py-2" type="number" step="0.01" min={0} value={form.montant_ttc} onChange={(event) => setForm({ ...form, montant_ttc: Number(event.target.value) })} required /></FormField>
            <FormField id="frais-projet" label="Projet (facultatif)">
              <select id="frais-projet" className="w-full rounded-xl border border-subtle px-3 py-2" value={form.projet_id ?? ''} onChange={(event) => setForm({ ...form, projet_id: event.target.value || undefined })}>
                <option value="">Aucun</option>
                {sortedProjects.map((project) => <option key={project.id} value={project.id}>{formatProjectLabel(project, clients)}</option>)}
              </select>
            </FormField>
            <FormField id="frais-deductible" label="Déductible">
              <label className="flex items-center gap-2 text-sm text-body"><input id="frais-deductible" type="checkbox" checked={form.deductible} onChange={(event) => setForm({ ...form, deductible: event.target.checked })} /> Frais professionnel déductible</label>
            </FormField>
            <FormField id="frais-justificatif" label="Justificatif (PDF, JPG ou PNG, 5 Mo max)">
              <input ref={fileInputRef} id="frais-justificatif" className="w-full text-sm text-body" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(event) => setSelectedFile(event.target.files?.[0])} />
              {editingId ? <p className="text-xs text-faint">Laisser vide pour conserver le justificatif actuel.</p> : null}
            </FormField>
            <div className="flex justify-end gap-3">
              <button className="rounded-xl bg-surface-muted px-4 py-2 text-sm font-medium text-body hover:bg-surface-hover" type="button" onClick={closeForm}>Annuler</button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-success-strong px-4 py-2 text-sm font-medium text-white hover:bg-success-strong-hover" type="submit"><Save size={16} aria-hidden="true" /> Enregistrer</button>
            </div>
          </form>
        </Modal>
      ) : null}
      {fraisToDelete ? <ConfirmDialog title="Mettre le frais à la corbeille" message={`Le frais « ${fraisToDelete.libelle} » sera placé dans la corbeille.`} confirmLabel="Mettre à la corbeille" onConfirm={() => void removeFrais()} onClose={() => setFraisToDelete(null)} /> : null}
    </section>
  );
}
