import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Save } from 'lucide-react';
import { FormField } from '../components/forms/FormField';
import { api } from '../services/api';
import type { IssuerProfile } from '../types';
import { useTheme } from '../theme/useTheme';

const emptyIssuerProfile: IssuerProfile = {
  raison_sociale: '',
  nom_commercial: '',
  adresse_postale: '',
  siret: '',
  numero_tva: '',
  email: '',
  telephone: '',
  iban: '',
  conditions_paiement: '',
  delai_paiement_jours: 30,
  tva_non_applicable: false,
  plafond_annuel: 0,
};

const issuerFields: Array<{ key: keyof IssuerProfile; label: string; type?: string; multiline?: boolean; required?: boolean }> = [
  { key: 'raison_sociale', label: 'Raison sociale', required: true }, { key: 'nom_commercial', label: 'Nom commercial' }, { key: 'adresse_postale', label: 'Adresse postale', multiline: true, required: true },
  { key: 'siret', label: 'SIRET', required: true }, { key: 'numero_tva', label: 'N° de TVA intracommunautaire' }, { key: 'email', label: 'Email', type: 'email', required: true },
  { key: 'telephone', label: 'Téléphone', type: 'tel' }, { key: 'iban', label: 'IBAN' }, { key: 'conditions_paiement', label: 'Conditions de paiement' },
];

export function Parametrages() {
  const { themeId, setThemeId, availableThemes } = useTheme();
  const [issuer, setIssuer] = useState<IssuerProfile>(emptyIssuerProfile);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void api.getIssuerProfile()
      .then(setIssuer)
      .catch((error: unknown) => setErrorMessage(error instanceof Error ? error.message : 'Impossible de charger les coordonnées de l’entreprise.'));
  }, []);

  async function saveIssuer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      setIssuer(await api.updateIssuerProfile(issuer));
      setErrorMessage(null);
      setSuccessMessage('Coordonnées enregistrées.');
    } catch (error) {
      setSuccessMessage(null);
      setErrorMessage(error instanceof Error ? error.message : 'Coordonnées impossibles à enregistrer.');
    }
  }

  return (
    <section className="space-y-6">
      <header className="rounded-2xl bg-surface p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-heading">Paramètres</h2>
        <p className="text-sm text-muted">Coordonnées de l’entreprise et préférences d’affichage.</p>
      </header>

      <section className="space-y-4 rounded-2xl bg-surface p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-heading">Apparence</h3>
          <p className="text-sm text-muted">Choisissez le thème appliqué à l’ensemble de l’application.</p>
        </div>
        <FormField id="theme-select" label="Thème">
          <select
            id="theme-select"
            className="w-full max-w-xs rounded-xl border border-subtle bg-surface px-3 py-2 text-body"
            value={themeId}
            onChange={(event) => setThemeId(event.target.value)}
          >
            {availableThemes.map((theme) => (
              <option key={theme.id} value={theme.id}>{theme.label}</option>
            ))}
          </select>
        </FormField>
      </section>

      <section className="space-y-4 rounded-2xl bg-surface p-6 shadow-sm">
        <div>
          <h3 className="text-lg font-semibold text-heading">Coordonnées de l’entreprise</h3>
          <p className="text-sm text-muted">Ces coordonnées sont capturées sur les nouvelles factures. Les factures envoyées ou payées restent inchangées. Les champs marqués * sont indispensables pour générer une facture.</p>
        </div>
        {errorMessage ? <p className="rounded-xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text" role="alert">{errorMessage}</p> : null}
        {successMessage ? <p className="rounded-xl border border-success-soft bg-success-soft px-4 py-3 text-sm text-success-soft-text" role="status">{successMessage}</p> : null}
        <form onSubmit={(event) => void saveIssuer(event)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {issuerFields.map(({ key, label, type, multiline, required }) => (
              <FormField key={key} id={`issuer-${key}`} label={required ? `${label} *` : label}>
                {multiline
                  ? <textarea id={`issuer-${key}`} className="w-full rounded-xl border border-subtle bg-surface px-3 py-2 text-body" rows={3} value={issuer[key] as string} onChange={(event) => setIssuer({ ...issuer, [key]: event.target.value })} required={required} />
                  : <input id={`issuer-${key}`} className="w-full rounded-xl border border-subtle bg-surface px-3 py-2 text-body" type={type ?? 'text'} value={issuer[key] as string} onChange={(event) => setIssuer({ ...issuer, [key]: event.target.value })} required={required} />}
              </FormField>
            ))}
            <FormField id="issuer-delai-paiement" label="Délai de paiement (jours)">
              <input id="issuer-delai-paiement" className="w-full rounded-xl border border-subtle bg-surface px-3 py-2 text-body" type="number" min={0} max={365} value={issuer.delai_paiement_jours} onChange={(event) => setIssuer({ ...issuer, delai_paiement_jours: Number(event.target.value) })} required />
              <p className="text-xs text-faint">Utilisé pour calculer automatiquement l’échéance d’une facture envoyée.</p>
            </FormField>
            <FormField id="issuer-plafond-annuel" label="Plafond annuel de CA (micro-entreprise)">
              <input id="issuer-plafond-annuel" className="w-full rounded-xl border border-subtle bg-surface px-3 py-2 text-body" type="number" min={0} step={100} value={issuer.plafond_annuel} onChange={(event) => setIssuer({ ...issuer, plafond_annuel: Number(event.target.value) })} />
              <p className="text-xs text-faint">Laisser à 0 pour ne pas afficher de suivi de plafond.</p>
            </FormField>
            <FormField id="issuer-tva-non-applicable" label="Franchise en base de TVA">
              <label className="flex items-center gap-2 text-sm text-body">
                <input id="issuer-tva-non-applicable" type="checkbox" checked={issuer.tva_non_applicable} onChange={(event) => setIssuer({ ...issuer, tva_non_applicable: event.target.checked })} />
                Afficher « TVA non applicable, art. 293 B du CGI » sur les factures
              </label>
            </FormField>
          </div>
          <div className="flex justify-end gap-3">
            <button className="inline-flex items-center gap-2 rounded-xl bg-success-strong px-4 py-2 text-sm font-medium text-white hover:bg-success-strong-hover" type="submit"><Save size={16} aria-hidden="true" /> Enregistrer</button>
          </div>
        </form>
      </section>
    </section>
  );
}
