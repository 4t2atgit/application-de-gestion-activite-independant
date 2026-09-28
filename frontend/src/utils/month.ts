export function shiftMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(year, monthNumber - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

const shortMonthLabelFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' });

/** Formate un mois `AAAA-MM` en libellé court (ex. « sept. 26 ») pour les axes de graphiques. */
export function formatMonthShortLabel(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  return shortMonthLabelFormatter.format(new Date(year, monthNumber - 1, 1));
}
