import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, Download, FileDown, FilePlus2, Pencil, Save, Send, Trash2, Undo2, Wallet } from 'lucide-react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { FormField } from '../components/forms/FormField';
import { Modal } from '../components/Modal';
import { DataTable } from '../components/tables/DataTable';
import { api } from '../services/api';
import type { Client, Encaissement, Facture, IssuerProfile } from '../types';
import { shiftMonth } from '../utils/month';
import { isIssuerProfileComplete } from '../utils/issuerProfile';

type FactureForm = Pick<Facture, 'client_id' | 'mois_facture'>;
const emptyForm: FactureForm = { client_id: '', mois_facture: new Date().toISOString().slice(0, 7) };
const emptyIssuerProfile: IssuerProfile = { raison_sociale: '', nom_commercial: '', adresse_postale: '', siret: '', numero_tva: '', email: '', telephone: '', iban: '', conditions_paiement: '', delai_paiement_jours: 30, tva_non_applicable: false, plafond_annuel: 0 };

const MOYENS_PAIEMENT = ['virement', 'chèque', 'espèces', 'carte', 'autre'] as const;
type EncaissementForm = { date: string; montant: string; moyen_paiement: (typeof MOYENS_PAIEMENT)[number]; note: string };
const emptyEncaissementForm: EncaissementForm = { date: new Date().toISOString().slice(0, 10), montant: '', moyen_paiement: 'virement', note: '' };

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
}

function isEnRetard(facture: Facture): boolean {
  return facture.statut === 'envoyée' && !!facture.date_echeance && new Date(facture.date_echeance).getTime() < Date.now();
}

function statusClass(facture: Facture) {
  if (isEnRetard(facture)) return 'bg-danger-soft text-danger-soft-text';
  return facture.statut === 'brouillon' ? 'bg-surface-muted text-body' : facture.statut === 'envoyée' ? 'bg-info-soft text-info-soft-text' : 'bg-success-soft text-success-soft-text';
}

export function Factures() {
  const [factures, setFactures] = useState<Facture[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [issuer, setIssuer] = useState<IssuerProfile>(emptyIssuerProfile);
  const [encaissements, setEncaissements] = useState<Encaissement[]>([]);
  const [form, setForm] = useState<FactureForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isInvoiceFormOpen, setIsInvoiceFormOpen] = useState(false);
  const [factureToDelete, setFactureToDelete] = useState<Facture | null>(null);
  const [encaissementsFacture, setEncaissementsFacture] = useState<Facture | null>(null);
  const [encaissementForm, setEncaissementForm] = useState<EncaissementForm>(emptyEncaissementForm);
  const [encaissementError, setEncaissementError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [facturesData, clientsData, issuerData, encaissementsData] = await Promise.all([api.getFactures(), api.getClients(), api.getIssuerProfile(), api.getEncaissements()]);
    setFactures(facturesData);
    setClients(clientsData);
    setIssuer(issuerData);
    setEncaissements(encaissementsData);
  }, []);

  useEffect(() => {
    void loadData().catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Impossible de charger les factures.'));
  }, [loadData]);

  const issuerComplete = isIssuerProfileComplete(issuer);

  function montantEncaisse(factureId: string, source: Encaissement[] = encaissements): number {
    return Number(source.filter((item) => item.facture_id === factureId).reduce((total, item) => total + item.montant, 0).toFixed(2));
  }

  function openEncaissements(facture: Facture, source: Encaissement[] = encaissements) {
    setEncaissementsFacture(facture);
    setEncaissementError(null);
    const solde = Number((facture.montant_ht - montantEncaisse(facture.id, source)).toFixed(2));
    setEncaissementForm({ ...emptyEncaissementForm, montant: solde > 0 ? String(solde) : '' });
  }

  function closeEncaissements() {
    setEncaissementsFacture(null);
    setEncaissementError(null);
  }

  async function submitEncaissement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!encaissementsFacture) return;
    try {
      await api.createEncaissement({
        facture_id: encaissementsFacture.id,
        date: encaissementForm.date,
        montant: Number.parseFloat(encaissementForm.montant),
        moyen_paiement: encaissementForm.moyen_paiement,
        note: encaissementForm.note || undefined,
      });
      const [facturesData, encaissementsData] = await Promise.all([api.getFactures(), api.getEncaissements()]);
      setFactures(facturesData);
      setEncaissements(encaissementsData);
      const refreshed = facturesData.find((item) => item.id === encaissementsFacture.id);
      if (refreshed && refreshed.statut !== 'payée') {
        openEncaissements(refreshed, encaissementsData);
      } else {
        closeEncaissements();
      }
    } catch (error) {
      setEncaissementError(error instanceof Error ? error.message : 'Encaissement impossible à enregistrer.');
    }
  }

  async function removeEncaissement(encaissement: Encaissement) {
    if (!window.confirm('Supprimer définitivement cet encaissement ?')) return;
    try {
      await api.deleteEncaissement(encaissement.id);
      const [facturesData, encaissementsData] = await Promise.all([api.getFactures(), api.getEncaissements()]);
      setFactures(facturesData);
      setEncaissements(encaissementsData);
    } catch (error) {
      setEncaissementError(error instanceof Error ? error.message : 'Suppression impossible.');
    }
  }


  function resetInvoiceForm() {
    setForm({ ...emptyForm, client_id: clients[0]?.id ?? '' });
    setEditingId(null);
    setErrorMessage(null);
  }

  function closeInvoiceForm() {
    setIsInvoiceFormOpen(false);
    resetInvoiceForm();
  }

  function openInvoiceForm(facture?: Facture) {
    if (facture) {
      setEditingId(facture.id);
      setForm({ client_id: facture.client_id, mois_facture: facture.mois_facture });
    } else {
      resetInvoiceForm();
    }
    setIsInvoiceFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingId) await api.updateFacture(editingId, form);
      else await api.createFacture(form);
      await loadData();
      closeInvoiceForm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Facture impossible à enregistrer.');
    }
  }

  async function deleteFacture() {
    if (!factureToDelete) return;
    try {
      await api.deleteFacture(factureToDelete.id);
      setFactureToDelete(null);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Suppression impossible.');
      setFactureToDelete(null);
    }
  }

  async function transition(id: string, statut: 'envoyée' | 'payée') {
    try {
      await api.updateFacture(id, { statut });
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Transition impossible.');
    }
  }

  async function createAvoir(facture: Facture) {
    try {
      await api.createAvoir(facture.id);
      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Impossible de générer un avoir pour cette facture.');
    }
  }

  function exportAnnualCsv() {
    const year = String(new Date().getFullYear());
    void api.getFacturesExport(year)
      .then(({ blob, fileName }) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName ?? `factures_${year}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
      .catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Impossible d’exporter les factures.'));
  }

  function exportPdf(facture: Facture) {
    void api.getFacturePdf(facture.id)
      .then(({ blob, fileName }) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName ?? `facture_${facture.numero_facture}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      })
      .catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Impossible de télécharger le PDF.'));
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-heading">Factures <span className="text-sm font-normal text-muted">({factures.length})</span></h2>
          <p className="text-sm text-muted">Créez des brouillons et suivez leur encaissement.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-muted px-4 py-2 text-sm font-medium text-body hover:bg-surface-hover" type="button" onClick={exportAnnualCsv}><FileDown size={18} aria-hidden="true" /> Exporter l’année (URSSAF)</button>
          <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-success-strong px-4 py-2 text-sm font-medium text-white hover:bg-success-strong-hover disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={clients.length === 0 || !issuerComplete} onClick={() => openInvoiceForm()}><FilePlus2 size={18} aria-hidden="true" /> Générer une facture</button>
        </div>
      </header>
      {clients.length === 0 ? <p className="rounded-xl border border-warning-soft-border bg-warning-soft px-4 py-3 text-sm text-warning-soft-text">Créez d’abord un client pour générer une facture.</p> : null}
      {clients.length > 0 && !issuerComplete ? <p className="rounded-xl border border-warning-soft-border bg-warning-soft px-4 py-3 text-sm text-warning-soft-text">Renseignez d’abord les coordonnées de l’entreprise dans la page Paramètres pour générer une facture.</p> : null}
      {errorMessage && !isInvoiceFormOpen ? <p className="rounded-xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text" role="alert">{errorMessage}</p> : null}
      <DataTable
        items={factures}
        emptyMessage="Aucune facture enregistrée. Générez un brouillon lorsque les activités du mois sont prêtes."
        columns={[
          { key: 'numero', header: 'Numéro', render: (facture) => <span>{facture.numero_facture}{facture.type === 'avoir' ? <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-soft-text">avoir</span> : null}</span> },
          { key: 'client', header: 'Client', render: (facture) => clients.find((client) => client.id === facture.client_id)?.nom ?? 'Inconnu' },
          { key: 'mois', header: 'Mois facturé', render: (facture) => new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date(`${facture.mois_facture}-01T12:00:00`)) },
          { key: 'montant', header: 'Montant HT', render: (facture) => `${facture.montant_ht.toFixed(2)} €` },
          { key: 'regle', header: 'Réglé', render: (facture) => facture.type === 'facture' && facture.statut !== 'brouillon' ? `${montantEncaisse(facture.id).toFixed(2)} € / ${facture.montant_ht.toFixed(2)} €` : '—' },
          { key: 'date', header: 'Générée le', render: (facture) => formatDate(facture.date_creation) },
          { key: 'echeance', header: 'Échéance', render: (facture) => facture.date_echeance ? formatShortDate(facture.date_echeance) : '—' },
          { key: 'statut', header: 'Statut', render: (facture) => <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(facture)}`}>{isEnRetard(facture) ? 'en retard' : facture.statut}</span> },
          { key: 'actions', header: 'Actions', render: (facture) => <div className="flex flex-wrap gap-2">
            {facture.type === 'facture' && facture.statut === 'brouillon' ? <><button title="Modifier le brouillon" aria-label="Modifier le brouillon" className="inline-flex items-center justify-center rounded-full bg-surface-hover p-2 text-body hover:opacity-80" type="button" onClick={() => openInvoiceForm(facture)}><Pencil size={15} aria-hidden="true" /></button><button title="Marquer envoyée" aria-label="Marquer envoyée" className="inline-flex items-center justify-center rounded-full bg-info-soft p-2 text-info-soft-text hover:opacity-80" type="button" onClick={() => void transition(facture.id, 'envoyée')}><Send size={15} aria-hidden="true" /></button></> : null}
            {facture.type === 'facture' && facture.statut === 'envoyée' ? <button title="Marquer payée" aria-label="Marquer payée" className="inline-flex items-center justify-center rounded-full bg-success-soft p-2 text-success-soft-text hover:opacity-80" type="button" onClick={() => void transition(facture.id, 'payée')}><Check size={15} aria-hidden="true" /></button> : null}
            {facture.type === 'facture' && facture.statut === 'envoyée' ? <button title="Gérer les encaissements" aria-label="Gérer les encaissements" className="inline-flex items-center justify-center rounded-full bg-accent-soft p-2 text-accent-soft-text hover:opacity-80" type="button" onClick={() => openEncaissements(facture)}><Wallet size={15} aria-hidden="true" /></button> : null}
            {facture.type === 'facture' && facture.statut !== 'brouillon' ? <button title="Générer un avoir" aria-label="Générer un avoir" className="inline-flex items-center justify-center rounded-full bg-warning-soft p-2 text-warning-soft-text hover:opacity-80" type="button" onClick={() => void createAvoir(facture)}><Undo2 size={15} aria-hidden="true" /></button> : null}
            <button title="Télécharger PDF" aria-label="Télécharger PDF" className="inline-flex items-center justify-center rounded-full bg-accent-soft p-2 text-accent-soft-text hover:opacity-80" type="button" onClick={() => exportPdf(facture)}><Download size={15} aria-hidden="true" /></button>
            <button title="Mettre à la corbeille" aria-label="Mettre à la corbeille" className="inline-flex items-center justify-center rounded-full bg-danger-soft p-2 text-danger-soft-text hover:opacity-80" type="button" onClick={() => setFactureToDelete(facture)}><Trash2 size={15} aria-hidden="true" /></button>
          </div> },
        ]}
      />
      {isInvoiceFormOpen ? <Modal title={editingId ? 'Modifier le brouillon' : 'Générer une facture'} description="Le numéro, la date, les lignes et le montant sont calculés automatiquement." onClose={closeInvoiceForm} maxWidth="md"><form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">{errorMessage ? <p className="rounded-xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text" role="alert">{errorMessage}</p> : null}<FormField id="facture-client" label="Client"><select id="facture-client" className="w-full rounded-xl border border-subtle px-3 py-2" value={form.client_id} onChange={(event) => setForm({ ...form, client_id: event.target.value })} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.nom}</option>)}</select></FormField><FormField id="facture-mois" label="Mois de facturation"><div className="flex items-center gap-2"><button className="rounded-xl border border-subtle p-2 hover:bg-surface-muted" type="button" title="Mois précédent" aria-label="Mois précédent" onClick={() => setForm({ ...form, mois_facture: shiftMonth(form.mois_facture, -1) })}><ChevronLeft size={18} aria-hidden="true" /></button><input id="facture-mois" className="min-w-0 flex-1 rounded-xl border border-subtle px-3 py-2" type="month" value={form.mois_facture} onChange={(event) => setForm({ ...form, mois_facture: event.target.value })} required /><button className="rounded-xl border border-subtle p-2 hover:bg-surface-muted" type="button" title="Mois suivant" aria-label="Mois suivant" onClick={() => setForm({ ...form, mois_facture: shiftMonth(form.mois_facture, 1) })}><ChevronRight size={18} aria-hidden="true" /></button></div></FormField><div className="flex justify-end gap-3"><button className="rounded-xl bg-surface-muted px-4 py-2 text-sm font-medium text-body hover:bg-surface-hover" type="button" onClick={closeInvoiceForm}>Annuler</button><button className="inline-flex items-center gap-2 rounded-xl bg-success-strong px-4 py-2 text-sm font-medium text-white hover:bg-success-strong-hover" type="submit"><Save size={16} aria-hidden="true" /> {editingId ? 'Enregistrer' : 'Générer le brouillon'}</button></div></form></Modal> : null}
      {factureToDelete ? <ConfirmDialog title="Mettre la facture à la corbeille" message={`La facture « ${factureToDelete.numero_facture} » sera placée dans la corbeille.`} confirmLabel="Mettre à la corbeille" onConfirm={() => void deleteFacture()} onClose={() => setFactureToDelete(null)} /> : null}
      {encaissementsFacture ? (() => {
        const solde = Number((encaissementsFacture.montant_ht - montantEncaisse(encaissementsFacture.id)).toFixed(2));
        const items = encaissements.filter((item) => item.facture_id === encaissementsFacture.id).sort((a, b) => b.date.localeCompare(a.date));
        return (
          <Modal title={`Encaissements — ${encaissementsFacture.numero_facture}`} description={`Montant HT : ${encaissementsFacture.montant_ht.toFixed(2)} € · Solde restant dû : ${solde.toFixed(2)} €`} onClose={closeEncaissements} maxWidth="md">
            {encaissementError ? <p className="mb-4 rounded-xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text" role="alert">{encaissementError}</p> : null}
            {items.length === 0 ? <p className="text-sm text-muted">Aucun encaissement enregistré pour cette facture.</p> : (
              <ul className="mb-4 divide-y divide-subtle">
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="text-sm text-body">
                      <p className="font-medium">{formatShortDate(item.date)} — {item.montant.toFixed(2)} €</p>
                      <p className="text-xs text-muted">{item.moyen_paiement ?? 'moyen non précisé'}{item.note ? ` · ${item.note}` : ''}</p>
                    </div>
                    <button title="Supprimer cet encaissement" aria-label="Supprimer cet encaissement" className="inline-flex items-center justify-center rounded-full bg-danger-soft p-2 text-danger-soft-text hover:opacity-80" type="button" onClick={() => void removeEncaissement(item)}><Trash2 size={14} aria-hidden="true" /></button>
                  </li>
                ))}
              </ul>
            )}
            {solde > 0 ? (
              <form onSubmit={(event) => void submitEncaissement(event)} className="space-y-4 border-t border-subtle pt-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField id="encaissement-date" label="Date"><input id="encaissement-date" type="date" className="w-full rounded-xl border border-subtle px-3 py-2" value={encaissementForm.date} onChange={(event) => setEncaissementForm({ ...encaissementForm, date: event.target.value })} required /></FormField>
                  <FormField id="encaissement-montant" label="Montant (€)"><input id="encaissement-montant" type="number" min={0.01} max={solde} step={0.01} className="w-full rounded-xl border border-subtle px-3 py-2" value={encaissementForm.montant} onChange={(event) => setEncaissementForm({ ...encaissementForm, montant: event.target.value })} required /></FormField>
                  <FormField id="encaissement-moyen" label="Moyen de paiement"><select id="encaissement-moyen" className="w-full rounded-xl border border-subtle px-3 py-2" value={encaissementForm.moyen_paiement} onChange={(event) => setEncaissementForm({ ...encaissementForm, moyen_paiement: event.target.value as EncaissementForm['moyen_paiement'] })}>{MOYENS_PAIEMENT.map((moyen) => <option key={moyen} value={moyen}>{moyen}</option>)}</select></FormField>
                  <FormField id="encaissement-note" label="Note (facultatif)"><input id="encaissement-note" type="text" className="w-full rounded-xl border border-subtle px-3 py-2" value={encaissementForm.note} onChange={(event) => setEncaissementForm({ ...encaissementForm, note: event.target.value })} /></FormField>
                </div>
                <div className="flex justify-end gap-3">
                  <button className="rounded-xl bg-surface-muted px-4 py-2 text-sm font-medium text-body hover:bg-surface-hover" type="button" onClick={closeEncaissements}>Fermer</button>
                  <button className="inline-flex items-center gap-2 rounded-xl bg-success-strong px-4 py-2 text-sm font-medium text-white hover:bg-success-strong-hover" type="submit"><Save size={16} aria-hidden="true" /> Enregistrer l’encaissement</button>
                </div>
              </form>
            ) : (
              <div className="flex justify-end border-t border-subtle pt-4">
                <button className="rounded-xl bg-surface-muted px-4 py-2 text-sm font-medium text-body hover:bg-surface-hover" type="button" onClick={closeEncaissements}>Fermer</button>
              </div>
            )}
          </Modal>
        );
      })() : null}
    </section>
  );
}
