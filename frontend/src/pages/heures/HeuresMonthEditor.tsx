import { ChevronLeft, ChevronRight, Lock, X } from 'lucide-react';
import { DurationInput } from '../../components/heures/DurationInput';
import type { Client, Heure, Project } from '../../types';
import { formatProjectLabel } from '../../utils/projectLabel';
import { shiftMonth } from '../../utils/month';
import { formatDayHeader, formatDuration, formatMonthLabel, getCellKey, isWeekendIndex } from '../../utils/heuresCalendar';

export interface ProjectGroup {
  client: Client;
  projects: Project[];
}

interface HeuresMonthEditorProps {
  selectedMonth: string;
  weeks: Array<Array<string | null>>;
  groupedProjects: ProjectGroup[];
  heuresByCell: Map<string, Heure>;
  totalsByDay: Map<string, number>;
  totalsByProject: Map<string, number>;
  totalMonth: number;
  selectedProjectIds: string[];
  projectsWithActivity: Set<string>;
  availableProjects: Project[];
  clientsById: Map<string, Client>;
  canAddEntriesToSelectedMonth: boolean;
  isClientMonthLocked: (clientId: string, month: string) => boolean;
  savingKey: string | null;
  errorMessage: string | null;
  onBack: () => void;
  onChangeMonth: (month: string) => void;
  onAddProject: (projectId: string) => void;
  onRemoveProject: (projectId: string) => void;
  onCellUpdate: (project: Project, date: string, nextValue: number) => void;
  onInvalidCell: () => void;
  isValueAllowed: (projectId: string, date: string, candidate: number) => boolean;
}

/** Vue « édition » : grille de saisie des jours travaillés pour un mois donné, groupée par client puis par projet. */
export function HeuresMonthEditor({
  selectedMonth,
  weeks,
  groupedProjects,
  heuresByCell,
  totalsByDay,
  totalsByProject,
  totalMonth,
  selectedProjectIds,
  projectsWithActivity,
  availableProjects,
  clientsById,
  canAddEntriesToSelectedMonth,
  isClientMonthLocked,
  savingKey,
  errorMessage,
  onBack,
  onChangeMonth,
  onAddProject,
  onRemoveProject,
  onCellUpdate,
  onInvalidCell,
  isValueAllowed,
}: HeuresMonthEditorProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-2xl bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button
              className="mb-2 text-sm font-medium text-muted hover:text-body"
              type="button"
              onClick={onBack}
            >
              ← Retour à la vue annuelle
            </button>
            <h2 className="text-xl font-semibold text-heading">{formatMonthLabel(selectedMonth)}</h2>
            <p className="text-sm text-muted">
              Chaque journée est limitée à 1 j, avec un partage possible sur 2 projets en 0,5 j.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm font-medium text-body">
            <label htmlFor="heures-month">Mois</label>
            <div className="flex items-center gap-2">
              <button
                className="rounded-xl border border-subtle px-3 py-2 hover:bg-surface-muted"
                type="button"
                title="Mois précédent"
                aria-label="Mois précédent"
                onClick={() => onChangeMonth(shiftMonth(selectedMonth, -1))}
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <input
                id="heures-month"
                className="rounded-xl border border-subtle px-3 py-2"
                type="month"
                value={selectedMonth}
                onChange={(event) => onChangeMonth(event.target.value)}
              />
              <button
                className="rounded-xl border border-subtle px-3 py-2 hover:bg-surface-muted"
                type="button"
                title="Mois suivant"
                aria-label="Mois suivant"
                onClick={() => onChangeMonth(shiftMonth(selectedMonth, 1))}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
        {errorMessage ? (
          <p className="mt-4 rounded-xl border border-danger-soft-border bg-danger-soft px-4 py-3 text-sm text-danger-soft-text">{errorMessage}</p>
        ) : null}
      </div>

      <div className="rounded-2xl bg-surface shadow-sm">
        <div className="flex flex-col gap-3 border-b border-subtle px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="font-semibold text-heading">Saisie du mois</h3>
            <p className="text-sm text-muted">Ajoutez uniquement les projets à renseigner ce mois-ci.</p>
            {!canAddEntriesToSelectedMonth ? (
              <p className="mt-1 text-sm text-warning-soft-text">
                Ce mois n&apos;a pas encore de fiche : la création est limitée à 2 mois dans le passé et 1 mois dans le futur.
              </p>
            ) : null}
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-body">
            Ajouter un projet actif
            <select
              className="rounded-xl border border-subtle px-3 py-2"
              value=""
              disabled={availableProjects.length === 0 || !canAddEntriesToSelectedMonth}
              onChange={(event) => {
                if (event.target.value) {
                  onAddProject(event.target.value);
                }
              }}
            >
              <option value="">
                {availableProjects.length === 0 ? 'Aucun projet actif disponible' : 'Choisir un projet'}
              </option>
              {availableProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {formatProjectLabel(project, clientsById)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-surface-muted">
              <tr>
                <th className="sticky left-0 z-10 min-w-28 border-b border-subtle bg-surface-muted px-2 py-2 font-semibold text-body">Client</th>
                <th className="sticky left-28 z-10 min-w-36 border-b border-subtle bg-surface-muted px-2 py-2 font-semibold text-body">Projet</th>
                {weeks.map((week, weekIndex) =>
                  week.map((date, dayIndex) => {
                    const weekend = isWeekendIndex(dayIndex);
                    const header = date ? formatDayHeader(date) : null;
                    return (
                      <th
                        key={date ?? `empty-${weekIndex}-${dayIndex}`}
                        className={`min-w-11 border-b border-subtle px-0.5 py-2 text-center font-semibold text-body ${weekend ? 'bg-surface-hover' : ''}`}
                      >
                        {header ? (
                          <span className="flex flex-col items-center leading-tight">
                            <span className="text-[10px] font-medium uppercase text-faint">{header.weekday}</span>
                            <span>{header.day}</span>
                          </span>
                        ) : '—'}
                      </th>
                    );
                  }),
                )}
                <th className="min-w-20 border-b border-subtle px-2 py-2 font-semibold text-body">Total mois</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {groupedProjects.length === 0 ? (
                <tr>
                  <td colSpan={weeks.length * 7 + 3} className="px-4 py-6 text-muted">
                    Sélectionnez un projet actif pour commencer la saisie de ce mois.
                  </td>
                </tr>
              ) : (
                groupedProjects.flatMap(({ client, projects: clientProjects }) => [
                  <tr key={`${client.id}-header`} className="bg-surface-muted/70">
                    <td className="sticky left-0 z-10 bg-surface-muted/70 px-2 py-2 font-semibold text-heading">{client.nom}</td>
                    <td colSpan={weeks.length * 7 + 1} className="px-2 py-2 text-muted">
                      {clientProjects.length} projet{clientProjects.length > 1 ? 's' : ''}
                    </td>
                  </tr>,
                  ...clientProjects.map((project) => {
                    const clientLocked = isClientMonthLocked(project.client_id, selectedMonth);
                    return (
                    <tr key={`${client.id}-${project.id}`} className="align-top">
                      <td className="sticky left-0 z-10 bg-surface px-2 py-2 text-faint">
                        {clientLocked ? (
                          <span title="Facture envoyée : verrouillé">
                            <Lock size={14} className="text-warning-soft-text" aria-label="Facture envoyée : verrouillé" />
                          </span>
                        ) : (
                          <>&nbsp;</>
                        )}
                      </td>
                      <td className="sticky left-28 z-10 bg-surface px-2 py-2 text-body">
                        <div className="font-medium text-heading">{project.nom}</div>
                        <div className="text-xs text-faint">{project.statut}</div>
                        {selectedProjectIds.includes(project.id) && !projectsWithActivity.has(project.id) ? (
                          <button
                            title="Retirer du mois"
                            aria-label="Retirer du mois"
                            className="mt-2 text-xs font-medium text-danger-soft-text"
                            type="button"
                            onClick={() => onRemoveProject(project.id)}
                          >
                            <X size={13} aria-hidden="true" />
                          </button>
                        ) : null}
                      </td>
                      {weeks.map((week, weekIndex) =>
                        week.map((date, dayIndex) => {
                          const weekend = isWeekendIndex(dayIndex);
                          const key = date ? getCellKey(project.id, date) : `${project.id}:empty-${weekIndex}-${dayIndex}`;
                          const entry = date ? heuresByCell.get(key) : undefined;
                          const cellValue = entry?.duree ?? 0;
                          const dayTotal = date ? totalsByDay.get(date) ?? 0 : 0;
                          const dayLabel = date ? formatDayHeader(date).day : '';
                          const isIncomplete = dayTotal > 0 && dayTotal < 1;

                          return (
                            <td key={key} className={`px-0.5 py-1 text-body ${weekend && !isIncomplete ? 'bg-surface-muted' : ''}`}>
                              <DurationInput
                                value={cellValue}
                                disabled={!date || savingKey === key || clientLocked || (!entry && !canAddEntriesToSelectedMonth)}
                                ariaLabel={date ? `Durée pour ${project.nom} le ${dayLabel}` : undefined}
                                isIncomplete={isIncomplete}
                                isAllowed={(candidate) => (date ? isValueAllowed(project.id, date, candidate) : false)}
                                onCommit={(nextValue) => {
                                  if (date) onCellUpdate(project, date, nextValue);
                                }}
                                onInvalid={onInvalidCell}
                              />
                            </td>
                          );
                        }),
                      )}
                      <td className="px-2 py-2 font-semibold text-body">{formatDuration(totalsByProject.get(project.id) ?? 0)}</td>
                    </tr>
                    );
                  }),
                ])
              )}
              {groupedProjects.length > 0 ? (
                <tr className="bg-surface-muted">
                  <td className="sticky left-0 z-10 bg-surface-muted px-2 py-2 font-semibold text-heading">Synthèse</td>
                  <td className="sticky left-28 z-10 bg-surface-muted px-2 py-2 font-semibold text-heading">Total jour</td>
                  {weeks.map((week, weekIndex) =>
                    week.map((date, dayIndex) => {
                      const weekend = isWeekendIndex(dayIndex);
                      const total = date ? totalsByDay.get(date) ?? 0 : 0;
                      const isIncomplete = total > 0 && total < 1;
                      return (
                        <td
                          key={`total-${date ?? `empty-${weekIndex}-${dayIndex}`}`}
                          className={`px-0.5 py-2 text-center font-semibold ${isIncomplete ? 'text-warning-soft-text' : 'text-body'} ${weekend && !isIncomplete ? 'bg-surface-muted' : ''}`}
                        >
                          {!date || total === 0 ? '—' : formatDuration(total)}
                        </td>
                      );
                    }),
                  )}
                  <td className="px-2 py-2 font-semibold text-body">
                    {formatDuration(totalMonth)}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
