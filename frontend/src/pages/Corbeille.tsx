import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import type { Client, Encaissement, Facture, Frais, Heure, Project, Trash } from '../types';

type TrashType = keyof Trash;

function formatDeletedAt(value: string | undefined) {
  return value ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Date inconnue';
}

interface TrashSectionProps<T extends { id: string; deleted_at?: string }> {
  type: TrashType;
  title: string;
  items: T[];
  describe: (item: T) => string;
  onRestore: (type: TrashType, id: string) => void;
  onPurge: (type: TrashType, id: string) => void;
  canPurge?: boolean;
}

function TrashSection<T extends { id: string; deleted_at?: string }>({ type, title, items, describe, onRestore, onPurge, canPurge = true }: TrashSectionProps<T>) {
  return (
    <section className="rounded-2xl bg-surface p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-heading">{title} <span className="text-sm font-normal text-muted">({items.length})</span></h3>
      {items.length === 0 ? <p className="mt-3 text-sm text-muted">Aucun élément supprimé.</p> : (
        <ul className="mt-3 divide-y divide-subtle">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-heading">{describe(item)}</p>
                <p className="text-xs text-muted">Supprimé le {formatDeletedAt(item.deleted_at)}</p>
              </div>
              <div className="flex gap-2">
                <button title="Restaurer" aria-label="Restaurer" type="button" className="inline-flex items-center justify-center rounded-full bg-success-soft p-2 text-xs font-medium text-success-soft-text" onClick={() => onRestore(type, item.id)}><RotateCcw size={13} aria-hidden="true" /></button>
                {canPurge ? <button title="Supprimer définitivement" aria-label="Supprimer définitivement" type="button" className="inline-flex items-center justify-center rounded-full bg-danger-soft p-2 text-xs font-medium text-danger-soft-text" onClick={() => onPurge(type, item.id)}><Trash2 size={13} aria-hidden="true" /></button> : <span className="px-3 py-1 text-xs text-muted">Conservée pour la numérotation</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function Corbeille() {
  const [trash, setTrash] = useState<Trash>({ clients: [], projets: [], heures: [], factures: [], frais: [], encaissements: [] });

  const loadTrash = useCallback(async () => setTrash(await api.getTrash()), []);
  useEffect(() => { void loadTrash().catch(console.error); }, [loadTrash]);

  async function run(action: () => Promise<void>) {
    try {
      await action();
      await loadTrash();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Opération impossible.');
    }
  }

  function purge(type: TrashType, id: string) {
    if (window.confirm('Supprimer définitivement cet élément ? Cette action est irréversible.')) {
      void run(() => api.purgeTrashItem(type, id));
    }
  }

  const count = trash.clients.length + trash.projets.length + trash.heures.length + trash.factures.length + trash.frais.length + trash.encaissements.length;
  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-heading">Corbeille</h2>
          <p className="text-sm text-muted">{count} élément{count > 1 ? 's' : ''} supprimé{count > 1 ? 's' : ''}. La restauration d'un enfant rétablit ses parents nécessaires.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button title="Tout restaurer" aria-label="Tout restaurer" type="button" disabled={count === 0} className="inline-flex items-center justify-center rounded-full bg-success-strong p-3 text-sm font-medium text-white hover:bg-success-strong-hover disabled:opacity-50" onClick={() => void run(() => api.restoreAllTrash())}><RotateCcw size={16} aria-hidden="true" /></button>
          <button title="Vider la corbeille" aria-label="Vider la corbeille" type="button" disabled={count === 0 || trash.factures.length > 0} className="inline-flex items-center justify-center rounded-full bg-danger-strong p-3 text-sm font-medium text-white hover:bg-danger-strong-hover disabled:opacity-50" onClick={() => { if (window.confirm('Vider définitivement toute la corbeille ? Cette action est irréversible.')) void run(() => api.emptyTrash()); }}><Trash2 size={16} aria-hidden="true" /></button>
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <TrashSection<Client> type="clients" title="Clients" items={trash.clients} describe={(item) => `${item.nom} — ${item.email}`} onRestore={(type, id) => void run(() => api.restoreTrashItem(type, id))} onPurge={purge} />
        <TrashSection<Project> type="projets" title="Projets" items={trash.projets} describe={(item) => item.nom} onRestore={(type, id) => void run(() => api.restoreTrashItem(type, id))} onPurge={purge} />
        <TrashSection<Heure> type="heures" title="Activités" items={trash.heures} describe={(item) => `${item.date} (${item.duree} j)`} onRestore={(type, id) => void run(() => api.restoreTrashItem(type, id))} onPurge={purge} />
        <TrashSection<Facture> type="factures" title="Factures" items={trash.factures} describe={(item) => `${item.numero_facture} — ${item.montant_ht.toFixed(2)} €`} onRestore={(type, id) => void run(() => api.restoreTrashItem(type, id))} onPurge={purge} canPurge={false} />
        <TrashSection<Frais> type="frais" title="Frais" items={trash.frais} describe={(item) => `${item.libelle} — ${item.montant_ttc.toFixed(2)} €`} onRestore={(type, id) => void run(() => api.restoreTrashItem(type, id))} onPurge={purge} />
        <TrashSection<Encaissement> type="encaissements" title="Encaissements" items={trash.encaissements} describe={(item) => `${item.date} — ${item.montant.toFixed(2)} €`} onRestore={(type, id) => void run(() => api.restoreTrashItem(type, id))} onPurge={purge} />
      </div>
    </div>
  );
}
