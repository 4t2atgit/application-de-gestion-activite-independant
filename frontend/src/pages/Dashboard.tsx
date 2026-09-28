import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { DashboardStats } from '../types';
import { RevenueEvolutionChart } from '../components/dashboard/RevenueEvolutionChart';
import { ClientRevenuePieChart } from '../components/dashboard/ClientRevenuePieChart';

interface Kpi {
  key: string;
  title: string;
  description: string;
  value: (stats: DashboardStats) => string;
}

const kpis: Kpi[] = [
  { key: 'joursCeMois', title: 'Jours ce mois-ci', description: 'Somme des journées et demi-journées saisies sur le mois en cours, tous clients confondus.', value: (stats) => `${stats.joursCeMois} j` },
  { key: 'chiffreAffairesCeMois', title: 'CA généré ce mois-ci', description: 'Montant total des factures dont le mois facturé correspond au mois en cours.', value: (stats) => `${stats.chiffreAffairesCeMois} € HT` },
  { key: 'facturesEnAttente', title: 'Factures en attente', description: 'Nombre de factures non encore marquées comme payées (brouillons et factures envoyées).', value: (stats) => `${stats.facturesEnAttente}` },
  { key: 'facturesEnRetard', title: 'Factures en retard', description: 'Factures envoyées dont l’échéance de paiement est dépassée.', value: (stats) => `${stats.facturesEnRetard}` },
  { key: 'fraisCeMois', title: 'Frais ce mois-ci', description: 'Total des frais professionnels enregistrés sur le mois en cours (TTC).', value: (stats) => `${stats.fraisCeMois} €` },
  { key: 'resultatNet', title: 'Résultat net (estimé) ce mois-ci', description: 'Chiffre d’affaires facturé du mois, diminué des frais professionnels du mois.', value: (stats) => formatEuros(Number.parseFloat((stats.chiffreAffairesCeMois - stats.fraisCeMois).toFixed(2))) },
];

function formatEuros(value: number): string {
  return `${value.toLocaleString('fr-FR')} €`;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.getDashboard().then(setStats).catch(console.error);
  }, []);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-heading">Vue d'ensemble</h2>
        <p className="text-sm text-muted">Suivez rapidement votre activité, votre chiffre d'affaires et vos factures.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi) => (
          <article key={kpi.key} className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-subtle">
            <p className="text-sm text-muted">{kpi.title}</p>
            <p className="mt-3 text-3xl font-semibold text-heading">
              {stats ? kpi.value(stats) : '...'}
            </p>
            <p className="mt-2 text-xs text-faint">{kpi.description}</p>
          </article>
        ))}
      </div>
      {stats && stats.plafondAnnuel > 0 ? (
        <article className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-subtle">
          <p className="text-sm text-muted">CA facturé cumulé sur l'année</p>
          <p className="mt-2 text-sm text-faint">Suivi du chiffre d'affaires facturé depuis le 1er janvier, par rapport au plafond du régime micro-entreprise.</p>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full rounded-full ${stats.chiffreAffairesAnnuel >= stats.plafondAnnuel ? 'bg-danger-strong' : 'bg-success-strong'}`}
              style={{
                width: `${Math.min(100, (stats.chiffreAffairesAnnuel / stats.plafondAnnuel) * 100)}%`,
                backgroundColor: stats.chiffreAffairesAnnuel < stats.plafondAnnuel && stats.chiffreAffairesAnnuel >= stats.plafondAnnuel * 0.8 ? 'var(--theme-warning-soft-text)' : undefined,
              }}
            />
          </div>
          <p className="mt-2 text-sm text-body">{formatEuros(stats.chiffreAffairesAnnuel)} / {formatEuros(stats.plafondAnnuel)} ({Math.round((stats.chiffreAffairesAnnuel / stats.plafondAnnuel) * 100)} %)</p>
        </article>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-subtle">
          <h3 className="text-lg font-semibold text-heading">Évolution du CA et du montant facturé</h3>
          <p className="text-sm text-muted">12 derniers mois se terminant au dernier mois d'activité enregistré : CA au sens URSSAF (encaissements reçus), montant facturé et jours travaillés. Le montant facturé distingue la part encaissée de la part restant due, mise en évidence en couleur d'alerte.</p>
          <div className="mt-4">
            {stats ? <RevenueEvolutionChart data={stats.evolutionMensuelle} /> : <p className="text-sm text-muted">Chargement...</p>}
          </div>
        </article>
        <article className="rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-subtle">
          <h3 className="text-lg font-semibold text-heading">Répartition du CA par client</h3>
          <p className="text-sm text-muted">Part de chaque client dans le montant total facturé (hors brouillons supprimés).</p>
          <div className="mt-4">
            {stats ? <ClientRevenuePieChart data={stats.repartitionParClient} /> : <p className="text-sm text-muted">Chargement...</p>}
          </div>
        </article>
      </div>
    </section>
  );
}
