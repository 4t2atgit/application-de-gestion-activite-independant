import { shiftMonth } from './month';

const dayHeaderFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
const monthLabelFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

export function getCurrentMonthToken(): string {
  return new Date().toISOString().slice(0, 7);
}

export function parseDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

export function formatMonthLabel(month: string): string {
  const label = monthLabelFormatter.format(parseDate(`${month}-01`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatDayHeader(value: string): { weekday: string; day: string } {
  const date = parseDate(value);
  return {
    weekday: dayHeaderFormatter.format(date).replace('.', ''),
    day: String(date.getDate()).padStart(2, '0'),
  };
}

export function getMonthDays(month: string): string[] {
  const [year, monthIndex] = month.split('-').map(Number);
  const lastDay = new Date(year, monthIndex, 0).getDate();

  return Array.from({ length: lastDay }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`);
}

export function getMonthWeeks(month: string): Array<Array<string | null>> {
  const days = getMonthDays(month);
  const firstDay = parseDate(days[0] ?? `${month}-01`);
  const leadingEmptyDays = (firstDay.getDay() + 6) % 7;
  const paddedDays = [
    ...Array.from({ length: leadingEmptyDays }, () => null),
    ...days,
  ];

  while (paddedDays.length % 7 !== 0) {
    paddedDays.push(null);
  }

  return paddedDays.reduce<Array<Array<string | null>>>((weeks, day, index) => {
    const weekIndex = Math.floor(index / 7);
    weeks[weekIndex] ??= [];
    weeks[weekIndex]?.push(day);
    return weeks;
  }, []);
}

export function isWeekendIndex(dayIndex: number): boolean {
  return dayIndex === 5 || dayIndex === 6;
}

export function isBusinessDay(value: string): boolean {
  const day = parseDate(value).getDay();
  return day !== 0 && day !== 6;
}

export function getExpectedBusinessDays(month: string): number {
  return getMonthDays(month).filter(isBusinessDay).length;
}

export function formatDuration(value: number): string {
  return `${value.toLocaleString('fr-FR', { minimumFractionDigits: value % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 })} j`;
}

export function getCellKey(projectId: string, date: string): string {
  return `${projectId}:${date}`;
}

export function sortByName<T extends { nom: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => left.nom.localeCompare(right.nom, 'fr-FR'));
}

/** Mois éligibles à la création d'une fiche mensuelle : 2 mois passés, le mois courant et 1 mois futur. */
export function getCreationWindowMonths(): string[] {
  const current = getCurrentMonthToken();
  return [-2, -1, 0, 1].map((offset) => shiftMonth(current, offset));
}

export function sortMonthsDescending(monthList: string[]): string[] {
  return [...monthList].sort((left, right) => right.localeCompare(left));
}
