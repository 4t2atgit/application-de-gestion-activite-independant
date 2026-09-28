import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { DashboardClientShare } from '../../types';

interface ClientRevenuePieChartProps {
  data: DashboardClientShare[];
}

const chartColors = ['var(--theme-chart-1)', 'var(--theme-chart-2)', 'var(--theme-chart-3)', 'var(--theme-chart-4)', 'var(--theme-chart-5)', 'var(--theme-chart-6)'];

function formatEuros(value: number): string {
  return `${value.toLocaleString('fr-FR')} €`;
}

/** Camembert de répartition du montant facturé (CA) par client. */
export function ClientRevenuePieChart({ data }: ClientRevenuePieChartProps) {
  if (data.length === 0) {
    return <p className="flex h-[280px] items-center justify-center text-sm text-muted">Aucune facture pour établir une répartition.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="montant" nameKey="clientNom" innerRadius={60} outerRadius={100} paddingAngle={2}>
          {data.map((entry, index) => (
            <Cell key={entry.clientId} fill={chartColors[index % chartColors.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [formatEuros(Number(value)), name]}
          contentStyle={{ background: 'var(--theme-surface)', border: '1px solid var(--theme-border-subtle)', borderRadius: 12, color: 'var(--theme-text-body)' }}
        />
        <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ color: 'var(--theme-text-body)', fontSize: 13 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
