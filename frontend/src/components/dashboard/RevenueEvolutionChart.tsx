import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardMonthlyPoint } from '../../types';
import { formatMonthShortLabel } from '../../utils/month';

interface RevenueEvolutionChartProps {
  data: DashboardMonthlyPoint[];
}

function formatEuros(value: number): string {
  return `${value.toLocaleString('fr-FR')} €`;
}

function formatJours(value: number): string {
  return `${value.toLocaleString('fr-FR')} j`;
}

/**
 * Barres d'évolution mensuelle : CA au sens URSSAF (encaissements), montant facturé (empilé en
 * « Encaissé » et « Restant dû » pour mettre en évidence les sommes manquantes) et nombre de jours
 * travaillés. Les montants partagent l'axe monétaire ; les jours utilisent un axe dédié.
 */
export function RevenueEvolutionChart({ data }: RevenueEvolutionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
        <CartesianGrid stroke="var(--theme-chart-grid)" strokeDasharray="4 4" />
        <XAxis dataKey="mois" tickFormatter={(value: string) => formatMonthShortLabel(value)} stroke="var(--theme-text-muted)" fontSize={12} />
        <YAxis yAxisId="montant" tickFormatter={(value: number) => formatEuros(value)} stroke="var(--theme-text-muted)" fontSize={12} width={90} />
        <YAxis yAxisId="jours" orientation="right" tickFormatter={(value: number) => formatJours(value)} stroke="var(--theme-text-muted)" fontSize={12} width={70} />
        <Tooltip
          labelFormatter={(value) => formatMonthShortLabel(String(value))}
          formatter={(value, name) => [name === 'Jours travaillés' ? formatJours(Number(value)) : formatEuros(Number(value)), name]}
          contentStyle={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border-subtle)', borderRadius: 12, color: 'var(--theme-text-body)' }}
        />
        <Legend />
        <Bar yAxisId="montant" dataKey="chiffreAffaires" name="CA (encaissements)" fill="var(--theme-chart-1)" />
        <Bar yAxisId="montant" dataKey="montantFactureEncaisse" name="Montant facturé — encaissé" stackId="facture" fill="var(--theme-chart-2)" />
        <Bar yAxisId="montant" dataKey="montantFactureResteDu" name="Montant facturé — restant dû" stackId="facture" fill="var(--theme-chart-5)" />
        <Bar yAxisId="jours" dataKey="joursTravailles" name="Jours travaillés" fill="var(--theme-chart-3)" />
      </BarChart>
    </ResponsiveContainer>
  );
}
