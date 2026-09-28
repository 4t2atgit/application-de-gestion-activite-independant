import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { Client, Facture, Heure, Project } from '../types';
import {
  getCellKey,
  getCreationWindowMonths,
  getCurrentMonthToken,
  getMonthWeeks,
  sortByName,
  sortMonthsDescending,
} from '../utils/heuresCalendar';
import { HeuresMonthEditor, type ProjectGroup } from './heures/HeuresMonthEditor';
import { HeuresOverview } from './heures/HeuresOverview';

const OVERVIEW_PAGE_SIZE = 10;

export function Heures() {
  const [heures, setHeures] = useState<Heure[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [factures, setFactures] = useState<Facture[]>([]);
  const [view, setView] = useState<'overview' | 'edit'>('overview');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthToken);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [overviewPage, setOverviewPage] = useState(1);
  const [monthToCreate, setMonthToCreate] = useState<string>('');

  const loadData = useCallback(async () => {
    const [heuresData, projectsData, clientsData, facturesData] = await Promise.all([
      api.getHeures(),
      api.getProjects(),
      api.getClients(),
      api.getFactures(),
    ]);

    setHeures(heuresData);
    setProjects(projectsData);
    setClients(clientsData);
    setFactures(facturesData);
  }, []);

  useEffect(() => {
    void loadData().catch(console.error);
  }, [loadData]);

  const totalsByMonth = useMemo(() => {
    const totals = new Map<string, number>();
    heures.forEach((heure) => {
      const month = heure.date.slice(0, 7);
      totals.set(month, Number(((totals.get(month) ?? 0) + heure.duree).toFixed(2)));
    });
    return totals;
  }, [heures]);

  const existingMonths = useMemo(() => new Set(heures.map((heure) => heure.date.slice(0, 7))), [heures]);

  const allMonthsWithData = useMemo(() => sortMonthsDescending([...existingMonths]), [existingMonths]);

  const overviewPageCount = Math.max(Math.ceil(allMonthsWithData.length / OVERVIEW_PAGE_SIZE), 1);

  useEffect(() => {
    if (overviewPage > overviewPageCount) {
      setOverviewPage(overviewPageCount);
    }
  }, [overviewPage, overviewPageCount]);

  const overviewMonths = useMemo(
    () => allMonthsWithData.slice((overviewPage - 1) * OVERVIEW_PAGE_SIZE, overviewPage * OVERVIEW_PAGE_SIZE),
    [allMonthsWithData, overviewPage],
  );

  const creationWindowMonths = useMemo(() => getCreationWindowMonths(), []);

  const creatableMonths = useMemo(
    () => creationWindowMonths.filter((month) => !existingMonths.has(month)),
    [creationWindowMonths, existingMonths],
  );

  useEffect(() => {
    if (!creatableMonths.includes(monthToCreate)) {
      setMonthToCreate(creatableMonths[0] ?? '');
    }
  }, [creatableMonths, monthToCreate]);

  const monthHeures = useMemo(
    () => heures.filter((heure) => heure.date.startsWith(selectedMonth)),
    [heures, selectedMonth],
  );

  const canAddEntriesToSelectedMonth = monthHeures.length > 0 || creationWindowMonths.includes(selectedMonth);

  const lockedClientMonths = useMemo(() => {
    const locked = new Set<string>();
    factures.forEach((facture) => {
      if (facture.statut !== 'brouillon') {
        locked.add(`${facture.client_id}:${facture.mois_facture}`);
      }
    });
    return locked;
  }, [factures]);

  const isClientMonthLocked = useCallback(
    (clientId: string, month: string) => lockedClientMonths.has(`${clientId}:${month}`),
    [lockedClientMonths],
  );

  const weeks = useMemo(() => getMonthWeeks(selectedMonth), [selectedMonth]);

  const heuresByCell = useMemo(() => {
    const entries = new Map<string, Heure>();
    monthHeures.forEach((heure) => {
      entries.set(getCellKey(heure.projet_id, heure.date), heure);
    });
    return entries;
  }, [monthHeures]);

  const totalsByDay = useMemo(() => {
    const totals = new Map<string, number>();
    monthHeures.forEach((heure) => {
      totals.set(heure.date, Number(((totals.get(heure.date) ?? 0) + heure.duree).toFixed(2)));
    });
    return totals;
  }, [monthHeures]);

  const totalsByProject = useMemo(() => {
    const totals = new Map<string, number>();
    monthHeures.forEach((heure) => {
      totals.set(heure.projet_id, Number(((totals.get(heure.projet_id) ?? 0) + heure.duree).toFixed(2)));
    });
    return totals;
  }, [monthHeures]);

  const totalMonth = useMemo(
    () => Number(monthHeures.reduce((sum, heure) => sum + heure.duree, 0).toFixed(2)),
    [monthHeures],
  );

  const clientsById = useMemo(
    () => new Map(sortByName(clients).map((client) => [client.id, client] as const)),
    [clients],
  );

  const activeProjects = useMemo(
    () => sortByName(projects.filter((project) => project.statut === 'actif')),
    [projects],
  );

  const projectsWithActivity = useMemo(
    () => new Set(monthHeures.map((heure) => heure.projet_id)),
    [monthHeures],
  );

  const visibleProjectIds = useMemo(
    () => new Set([...selectedProjectIds, ...projectsWithActivity]),
    [selectedProjectIds, projectsWithActivity],
  );

  const groupedProjects = useMemo<ProjectGroup[]>(() => {
    const groups = new Map<string, Project[]>();
    sortByName(projects.filter((project) => visibleProjectIds.has(project.id))).forEach((project) => {
      const group = groups.get(project.client_id) ?? [];
      group.push(project);
      groups.set(project.client_id, group);
    });

    return Array.from(groups.entries())
      .map(([clientId, items]) => ({ client: clientsById.get(clientId), projects: items }))
      .filter((group): group is ProjectGroup => Boolean(group.client))
      .sort((left, right) => left.client.nom.localeCompare(right.client.nom, 'fr-FR'));
  }, [projects, visibleProjectIds, clientsById]);

  const availableProjects = activeProjects
    .filter((project) => !visibleProjectIds.has(project.id) && !isClientMonthLocked(project.client_id, selectedMonth))
    .sort((a, b) => {
      const clientCompare = (clientsById.get(a.client_id)?.nom ?? '').localeCompare(clientsById.get(b.client_id)?.nom ?? '', 'fr-FR');
      return clientCompare !== 0 ? clientCompare : a.nom.localeCompare(b.nom, 'fr-FR');
    });

  function openMonth(month: string) {
    setSelectedMonth(month);
    setSelectedProjectIds([]);
    setErrorMessage(null);
    setView('edit');
  }

  function backToOverview() {
    setView('overview');
    setSelectedProjectIds([]);
    setErrorMessage(null);
  }

  function changeMonth(month: string) {
    setSelectedMonth(month);
    setSelectedProjectIds([]);
  }

  function addProject(projectId: string) {
    setSelectedProjectIds((current) => [...new Set([...current, projectId])]);
  }

  function removeProject(projectId: string) {
    setSelectedProjectIds((current) => current.filter((id) => id !== projectId));
  }

  function createMonth() {
    if (!monthToCreate || existingMonths.has(monthToCreate)) return;
    openMonth(monthToCreate);
  }

  function isValueAllowed(projectId: string, date: string, candidate: number): boolean {
    const current = heuresByCell.get(getCellKey(projectId, date));
    const otherEntries = monthHeures.filter(
      (heure) => heure.date === date && heure.id !== current?.id,
    );

    if (candidate === 0) {
      return true;
    }

    if (otherEntries.some((heure) => heure.projet_id === projectId)) {
      return false;
    }

    const entryCount = otherEntries.length + 1;
    if (entryCount > 2) {
      return false;
    }

    const total = otherEntries.reduce((sum, heure) => sum + heure.duree, 0) + candidate;
    if (total > 1) {
      return false;
    }

    if (entryCount === 2) {
      return candidate === 0.5 && otherEntries.every((heure) => heure.duree === 0.5);
    }

    return candidate === 0.5 || candidate === 1;
  }

  async function handleCellUpdate(project: Project, date: string, nextValue: number) {
    const key = getCellKey(project.id, date);
    const existingEntry = heuresByCell.get(key);

    setErrorMessage(null);

    if (isClientMonthLocked(project.client_id, date.slice(0, 7))) {
      setErrorMessage('Impossible de modifier ce compte rendu : la facture de ce client a déjà été envoyée pour ce mois.');
      return;
    }

    setSavingKey(key);

    try {
      if (existingEntry && nextValue === 0) {
        await api.deleteHeure(existingEntry.id);
      } else if (existingEntry) {
        await api.updateHeure(existingEntry.id, {
          date,
          projet_id: project.id,
          duree: nextValue,
          taux_applique: existingEntry.taux_applique,
        });
      } else if (nextValue > 0) {
        if (!canAddEntriesToSelectedMonth) {
          setErrorMessage('Impossible de créer une nouvelle activité pour ce mois : la création est limitée à 2 mois dans le passé et 1 mois dans le futur.');
          return;
        }
        await api.createHeure({
          date,
          projet_id: project.id,
          duree: nextValue,
        });
      }

      await loadData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Mise à jour impossible.');
    } finally {
      setSavingKey(null);
    }
  }

  if (view === 'overview') {
    return (
      <HeuresOverview
        overviewMonths={overviewMonths}
        totalsByMonth={totalsByMonth}
        creatableMonths={creatableMonths}
        monthToCreate={monthToCreate}
        onMonthToCreateChange={setMonthToCreate}
        onCreateMonth={createMonth}
        onOpenMonth={openMonth}
        overviewPage={overviewPage}
        overviewPageCount={overviewPageCount}
        onOverviewPageChange={setOverviewPage}
      />
    );
  }

  return (
    <HeuresMonthEditor
      selectedMonth={selectedMonth}
      weeks={weeks}
      groupedProjects={groupedProjects}
      heuresByCell={heuresByCell}
      totalsByDay={totalsByDay}
      totalsByProject={totalsByProject}
      totalMonth={totalMonth}
      selectedProjectIds={selectedProjectIds}
      projectsWithActivity={projectsWithActivity}
      availableProjects={availableProjects}
      clientsById={clientsById}
      canAddEntriesToSelectedMonth={canAddEntriesToSelectedMonth}
      isClientMonthLocked={isClientMonthLocked}
      savingKey={savingKey}
      errorMessage={errorMessage}
      onBack={backToOverview}
      onChangeMonth={changeMonth}
      onAddProject={addProject}
      onRemoveProject={removeProject}
      onCellUpdate={(project, date, nextValue) => void handleCellUpdate(project, date, nextValue)}
      onInvalidCell={() => setErrorMessage('Valeur non autorisée : 1 j maximum par jour, réparti sur 2 projets au plus en 0,5 j.')}
      isValueAllowed={isValueAllowed}
    />
  );
}
