import fs from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';
import { Facture, FactureLine, IssuerProfile } from '../types';

const margin = 15;
const pageWidth = 210;
const contentWidth = pageWidth - margin * 2;
const tableColumns = [
  { text: 'Date', x: margin, width: 20 },
  { text: 'Projet', x: margin + 20, width: 94 },
  { text: 'Jours', x: margin + 114, width: 13 },
  { text: 'Taux/jour', x: margin + 127, width: 24 },
  { text: 'Montant HT', x: margin + 151, width: 29 },
];
const missing = 'Information manquante';

function getFontsDirectory(): string {
  // Anchored to this module's own location (not process.cwd()) so the fonts are found
  // regardless of the working directory the service is invoked from (e.g. isolated tests).
  return path.resolve(__dirname, '../../assets/fonts');
}

function getPdfDirectory(): string {
  return path.resolve(process.cwd(), 'data', 'factures-pdf');
}

function readFontBinary(fileName: string): string {
  return fs.readFileSync(path.join(getFontsDirectory(), fileName)).toString('binary');
}

function registerUnicodeFonts(doc: jsPDF): void {
  doc.addFileToVFS('DejaVuSans.ttf', readFontBinary('DejaVuSans.ttf'));
  doc.addFont('DejaVuSans.ttf', 'DejaVuSans', 'normal');
  doc.addFileToVFS('DejaVuSans-Bold.ttf', readFontBinary('DejaVuSans-Bold.ttf'));
  doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold');
}

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} €`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? missing : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(date);
}

function formatActivityDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? missing : new Intl.DateTimeFormat('fr-FR').format(date);
}

function formatMonth(value: string): string {
  const date = new Date(`${value}-01T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(date);
}

function present(value: string | undefined): string {
  return value?.trim() || missing;
}

function documentLabel(facture: Facture): string {
  return facture.type === 'avoir' ? 'AVOIR' : 'FACTURE';
}

function wrap(doc: jsPDF, text: string, width: number, size = 9): string[] {
  doc.setFontSize(size);
  return doc.splitTextToSize(text, width) as string[];
}

function partyBlock(
  doc: jsPDF,
  title: string,
  lines: string[],
  x: number,
  y: number,
  width: number,
): number {
  doc.setFont('DejaVuSans', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(16, 89, 81);
  doc.text(title, x, y);
  let cursor = y + 6;
  for (const [index, line] of lines.entries()) {
    doc.setFont('DejaVuSans', index === 0 ? 'bold' : 'normal');
    doc.setFontSize(index === 0 ? 10 : 8.5);
    doc.setTextColor(51, 65, 85);
    const wrapped = wrap(doc, line, width, index === 0 ? 10 : 8.5);
    doc.text(wrapped, x, cursor);
    cursor += wrapped.length * (index === 0 ? 4.5 : 4);
  }
  return cursor;
}

function issuerLines(issuer: IssuerProfile): string[] {
  return [
    present(issuer.raison_sociale),
    ...(issuer.nom_commercial ? [issuer.nom_commercial] : []),
    present(issuer.adresse_postale),
    `SIRET : ${present(issuer.siret)}`,
    issuer.tva_non_applicable ? 'TVA non applicable, art. 293 B du CGI' : `N° TVA : ${present(issuer.numero_tva)}`,
    `Email : ${present(issuer.email)}`,
    `Téléphone : ${present(issuer.telephone)}`,
    `IBAN : ${present(issuer.iban)}`,
    `Conditions de paiement : ${present(issuer.conditions_paiement)}`,
  ];
}

function drawDraftBanner(doc: jsPDF): void {
  doc.setFillColor(153, 27, 27);
  doc.rect(margin, 10, contentWidth, 12, 'F');
  doc.setFont('DejaVuSans', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('BROUILLON — DOCUMENT NON DÉFINITIF', pageWidth / 2, 18, { align: 'center' });
}

function drawTableHeader(doc: jsPDF, y: number): number {
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, contentWidth, 9, 'F');
  doc.setFont('DejaVuSans', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.2);
  for (const column of tableColumns) {
    doc.rect(column.x, y, column.width, 9);
  }
  for (const column of tableColumns) {
    doc.text(column.text, column.x + column.width / 2, y + 5.7, { align: 'center' });
  }
  return y + 9;
}

function addContinuationPage(doc: jsPDF, facture: Facture, withTableHeader: boolean): number {
  doc.addPage();
  if (facture.statut === 'brouillon') drawDraftBanner(doc);
  const y = facture.statut === 'brouillon' ? 31 : 20;
  doc.setFont('DejaVuSans', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`${documentLabel(facture)} ${facture.numero_facture} — suite`, margin, y);
  return withTableHeader ? drawTableHeader(doc, y + 8) : y + 8;
}

function drawLine(doc: jsPDF, line: FactureLine, y: number, facture: Facture): number {
  const columns = [
    { ...tableColumns[0]!, text: formatActivityDate(line.date) },
    { ...tableColumns[1]!, text: line.projet },
  ];
  const wrapped = columns.map((column) => wrap(doc, column.text, column.width - 2, 7.5));
  const rowHeight = Math.max(8, Math.max(...wrapped.map((parts) => parts.length)) * 3.7 + 4);
  if (y + rowHeight > 278) {
    y = addContinuationPage(doc, facture, true);
  }
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.2);
  for (const column of tableColumns) {
    doc.rect(column.x, y, column.width, rowHeight);
  }
  doc.setFont('DejaVuSans', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  wrapped.forEach((parts, index) => doc.text(parts, columns[index]!.x + 1, y + 3.5));
  const numeric = [
    { column: tableColumns[2]!, value: `${line.jours}` },
    { column: tableColumns[3]!, value: formatMoney(line.taux_journalier) },
    { column: tableColumns[4]!, value: formatMoney(line.montant_ht) },
  ];
  for (const value of numeric) {
    doc.text(value.value, value.column.x + value.column.width - 1, y + 3.5, { align: 'right' });
  }
  return y + rowHeight;
}

export function buildInvoicePdfBuffer(facture: Facture): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  // jsPDF's built-in fonts are ASCII-only; embed DejaVu Sans for French and euro glyphs.
  registerUnicodeFonts(doc);
  doc.setProperties({
    title: `Facture ${facture.numero_facture}`,
    subject: `Facture de ${facture.mois_facture}`,
    creator: 'Suivi d’activité local',
  });

  const draft = facture.statut === 'brouillon';
  if (draft) drawDraftBanner(doc);
  let y = draft ? 32 : 22;

  doc.setFont('DejaVuSans', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(15, 23, 42);
  doc.text(documentLabel(facture), margin, y);
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(facture.numero_facture, pageWidth - margin, y, { align: 'right' });
  y += 7;
  doc.setFont('DejaVuSans', 'normal');
  doc.setFontSize(9);
  doc.text(`Date d’émission : ${formatDate(facture.date_creation)}`, pageWidth - margin, y, { align: 'right' });
  doc.setTextColor(51, 65, 85);
  doc.text(`Période facturée : ${formatMonth(facture.mois_facture)}`, margin, y);
  doc.text(`Statut : ${facture.statut.toLocaleUpperCase('fr-FR')}`, pageWidth - margin, y + 4, { align: 'right' });
  y += 12;
  if (facture.type === 'avoir' && facture.facture_origine_id) {
    doc.setFont('DejaVuSans', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Cet avoir annule la facture correspondante émise précédemment.', margin, y - 3);
  }

  const issuerBottom = partyBlock(doc, 'ÉMETTEUR', issuerLines(facture.emetteur), margin, y, 83);
  const recipient = facture.destinataire;
  const recipientBottom = partyBlock(doc, 'CLIENT / DESTINATAIRE', [
    present(recipient.nom),
    `À l’attention de : ${present(recipient.contact_name)}`,
    `Fonction : ${present(recipient.contact_role)}`,
    present(recipient.billing_address),
    `Email : ${present(recipient.email)}`,
    `Téléphone : ${present(recipient.phone)}`,
  ], margin + 94, y, 84);
  y = Math.max(issuerBottom, recipientBottom) + 9;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.7);
  doc.line(margin, y, pageWidth - margin, y);
  y += 9;

  y = drawTableHeader(doc, y);
  const hadLines = facture.lignes.length > 0;
  for (const line of facture.lignes) y = drawLine(doc, line, y, facture);
  if (!hadLines) {
    doc.setFont('DejaVuSans', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    const legacy = !facture.destinataire.nom && Object.values(facture.emetteur).every((value) => !value);
    doc.text(
      legacy ? 'Détail des activités indisponible pour cette facture héritée.' : 'Aucune activité facturable enregistrée pour cette période.',
      margin + 2,
      y + 3,
    );
    y += 11;
  }

  if (y + 25 > 278) {
    y = addContinuationPage(doc, facture, false);
  }
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(pageWidth - margin - 72, y + 3, 72, 15, 2, 2, 'F');
  doc.setFont('DejaVuSans', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL HT', pageWidth - margin - 68, y + 12);
  doc.text(formatMoney(facture.montant_ht), pageWidth - margin - 4, y + 12, { align: 'right' });
  doc.setFont('DejaVuSans', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Montant hors taxes', margin, y + 12);

  return Buffer.from(doc.output('arraybuffer'));
}

function sanitizeFileNamePart(value: string): string {
  const sanitized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return sanitized || 'client';
}

export function getInvoicePdfFileName(facture: Facture): string {
  const prefix = facture.type === 'avoir' ? 'avoir' : 'facture';
  return `${prefix}_${sanitizeFileNamePart(facture.destinataire.nom)}_${facture.mois_facture}.pdf`;
}

export function getInvoicePdfPath(facture: Facture): string {
  return path.join(getPdfDirectory(), getInvoicePdfFileName(facture));
}

export async function persistInvoicePdf(facture: Facture, buffer: Buffer): Promise<string> {
  const pdfDirectory = getPdfDirectory();
  await fs.promises.mkdir(pdfDirectory, { recursive: true });
  const filePath = getInvoicePdfPath(facture);
  const temporaryFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(temporaryFilePath, buffer);
  await fs.promises.rename(temporaryFilePath, filePath);
  return filePath;
}

export async function readPersistedInvoicePdf(facture: Facture): Promise<Buffer | undefined> {
  try {
    return await fs.promises.readFile(getInvoicePdfPath(facture));
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}
