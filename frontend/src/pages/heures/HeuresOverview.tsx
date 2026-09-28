import { AlertTriangle, Pencil } from 'lucide-react';
import { Pagination } from '../../components/Pagination';
import { formatDuration, formatMonthLabel, getExpectedBusinessDays } from '../../utils/heuresCalendar';

interface HeuresOverviewProps {
  overviewMonths: string[];
  totalsByMonth: Map<string, number>;
  creatableMonths: string[];
  monthToCreate: string;
  onMonthToCreateChange: (month: string) => void;
  onCreateMonth: () => void;
  onOpenMonth: (month: string) => void;
  overviewPage: number;
  overviewPageCount: number;
  onOverviewPageChange: (page: number) => void;
}

/** Vue « annuelle » : liste paginée des fiches mensuelles déjà saisies, avec création d'une nouvelle fiche. */
export function HeuresOverview({
  overviewMonths,
  totalsByMonth,
  creatableMonths,
  monthToCreate,
  onMonthToCreateChange,
  onCreateMonth,
  onOpenMonth,
  overviewPage,
  overviewPageCount,
  onOverviewPageChange,
}: HeuresOverviewProps) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl bg-surface p-6 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-heading">Compte rendu d&apos;activité</h2>
          <p className="text-sm text-muted">
            Toutes les fiches mensuelles enregistrées. Un mois surligné signifie qu&apos;il manque des jours ouvrés à compléter.
          </p>
        </div>
        {creatableMonths.length > 0 ? (
          <div className="flex flex-col gap-2 text-sm font-medium text-body">
            <label htmlFor="heures-month-to-create">Créer une fiche mensuelle</label>
            <div className="flex items-center gap-2">
              <select
                id="heures-month-to-create"
                className="rounded-xl border border-subtle px-3 py-2"
                value={monthToCreate}
                onChange={(event) => onMonthToCreateChange(event.target.value)}
              >
                {creatableMonths.map((month) => (
                  <option key={month} value={month}>{formatMonthLabel(month)}</option>
                ))}
              </select>
              <button
                className="inline-flex items-center gap-2 rounded-xl bg-success-strong px-4 py-2 text-sm font-medium text-white hover:bg-success-strong-hover"
                type="button"
                onClick={onCreateMonth}
              >
                Créer
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-2xl bg-surface shadow-sm">
        <table className="min-w-full divide-y divide-subtle text-left text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="px-4 py-3 font-semibold text-body">Mois</th>
              <th className="px-4 py-3 font-semibold text-body">Jours ouvrés</th>
              <th className="px-4 py-3 font-semibold text-body">Total saisi</th>
              <th className="px-4 py-3 font-semibold text-body">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {overviewMonths.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-muted" colSpan={4}>
                  Aucune fiche mensuelle enregistrée.
                </td>
              </tr>
            ) : null}
            {overviewMonths.map((month) => {
              const expectedDays = getExpectedBusinessDays(month);
              const total = totalsByMonth.get(month) ?? 0;
              const isIncomplete = total < expectedDays;

              return (
                <tr key={month} className={isIncomplete ? 'bg-warning-soft' : undefined}>
                  <td className="px-4 py-3 font-medium text-heading">
                    <span className="flex items-center gap-2">
                      {isIncomplete ? (
                        <AlertTriangle size={16} className="text-amber-600" aria-hidden="true" />
                      ) : null}
                      {formatMonthLabel(month)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-body">{expectedDays} j</td>
                  <td className={`px-4 py-3 ${isIncomplete ? 'font-semibold text-warning-soft-text' : 'text-body'}`}>
                    {formatDuration(total)}
                    {isIncomplete ? <span className="ml-2 text-xs font-normal text-amber-600">Saisie incomplète</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      title={`Éditer ${formatMonthLabel(month)}`}
                      aria-label={`Éditer ${formatMonthLabel(month)}`}
                      className="inline-flex items-center justify-center rounded-full bg-surface-hover p-2 text-body hover:opacity-80"
                      type="button"
                      onClick={() => onOpenMonth(month)}
                    >
                      <Pencil size={15} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination page={overviewPage} pageCount={overviewPageCount} onPageChange={onOverviewPageChange} />
      </div>
    </section>
  );
}
