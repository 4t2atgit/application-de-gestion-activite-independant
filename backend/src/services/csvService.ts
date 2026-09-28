import fs from 'node:fs';
import path from 'node:path';
import csv from 'csv-parser';

function getDataDirectory(): string {
  return path.resolve(process.cwd(), 'data');
}

function escapeCsvValue(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/** Construit un document CSV complet (en-tête + lignes échappées) pour l'écriture ou l'export. */
export function buildCsvDocument(headers: string[], rows: Array<Record<string, unknown>>): string {
  const content = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(String(row[header] ?? ''))).join(',')),
  ].join('\n');

  return `${content}\n`;
}

export async function ensureCsvFile(fileName: string, headers: string[]): Promise<string> {
  const dataDirectory = getDataDirectory();
  await fs.promises.mkdir(dataDirectory, { recursive: true });
  const filePath = path.join(dataDirectory, fileName);

  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
  } catch {
    await fs.promises.writeFile(filePath, `${headers.join(',')}\n`, 'utf8');
  }

  return filePath;
}

export async function readCsv<T>(fileName: string, headers: string[]): Promise<T[]> {
  const filePath = await ensureCsvFile(fileName, headers);

  return new Promise<T[]>((resolve, reject) => {
    const rows: T[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row as T))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

export async function writeCsv<T>(
  fileName: string,
  headers: string[],
  rows: T[],
): Promise<void> {
  const filePath = await ensureCsvFile(fileName, headers);
  const content = buildCsvDocument(headers, rows as Array<Record<string, unknown>>);

  const temporaryFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.promises.writeFile(temporaryFilePath, content, 'utf8');
  await fs.promises.rename(temporaryFilePath, filePath);
}

export function getNextId(rows: Array<{ id: string }>): string {
  const nextId = rows.reduce((maxId, row) => {
    const currentId = Number.parseInt(row.id, 10);
    return Number.isNaN(currentId) ? maxId : Math.max(maxId, currentId);
  }, 0);

  return String(nextId + 1);
}

export interface SoftDeletable {
  id: string;
  deleted_at?: string;
}

export interface CsvRepository<T extends SoftDeletable> {
  /** Toutes les lignes, y compris celles supprimées logiquement. */
  listAll: () => Promise<T[]>;
  /** Uniquement les lignes actives (non supprimées). */
  list: () => Promise<T[]>;
  /** Réécrit l'intégralité du fichier CSV avec les lignes fournies. */
  writeAll: (rows: T[]) => Promise<void>;
}

/**
 * Fabrique un accès CSV standard (lecture/écriture/filtrage des suppressions
 * logiques) pour une collection métier. Centralise le trio
 * `listAll`/`list`/`writeAll` commun à toutes les entités CSV avec `deleted_at`.
 */
export function createCsvRepository<T extends SoftDeletable>(
  fileName: string,
  headers: string[],
  parse: (row: Record<string, string>) => T,
  serialize: (item: T) => object,
): CsvRepository<T> {
  async function listAll(): Promise<T[]> {
    const rows = await readCsv<Record<string, string>>(fileName, headers);
    return rows.map(parse);
  }

  return {
    listAll,
    list: async () => (await listAll()).filter((row) => !row.deleted_at),
    async writeAll(rows) {
      await writeCsv(fileName, headers, rows.map(serialize));
    },
  };
}
