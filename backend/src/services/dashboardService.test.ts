import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { getDashboardStats } from './dashboardService';

const clientsCsv = `id,nom,email
1,Acme Corp,contact@acme.com
2,StartUp XYZ,hello@startup.com
`;
const projetsCsv = `id,nom,client_id,taux_journalier,statut,date_creation
1,Site web refonte,1,400,actif,2026-01-15
2,API REST,2,360,actif,2026-02-01
`;
const heuresCsv = `id,date,projet_id,duree,taux_applique
1,2026-09-20,1,4,400
2,2026-09-21,2,3,360
3,2026-08-21,1,2,400
4,2026-10-05,1,1,400
`;
const facturesCsv = `id,numero_facture,client_id,projet_id,montant_ht,date_facture,statut
1,FAC-001,1,1,1600,2026-09-25,brouillon
2,FAC-002,2,2,1080,2026-09-26,envoyée
3,FAC-003,1,1,800,2026-08-01,payée
`;
const encaissementsCsv = `id,facture_id,date,montant,moyen_paiement,note,deleted_at
1,2,2026-09-28,500,virement,,
2,1,2026-10-10,300,virement,,
`;

async function withTemporaryData(run: () => Promise<void>) {
  const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mes-dashboard-test-'));
  const dataDirectory = path.join(temporaryDirectory, 'data');
  await fs.promises.mkdir(dataDirectory, { recursive: true });
  await fs.promises.writeFile(path.join(dataDirectory, 'clients.csv'), clientsCsv, 'utf8');
  await fs.promises.writeFile(path.join(dataDirectory, 'projets.csv'), projetsCsv, 'utf8');
  await fs.promises.writeFile(path.join(dataDirectory, 'heures.csv'), heuresCsv, 'utf8');
  await fs.promises.writeFile(path.join(dataDirectory, 'factures.csv'), facturesCsv, 'utf8');
  await fs.promises.writeFile(path.join(dataDirectory, 'encaissements.csv'), encaissementsCsv, 'utf8');

  const RealDate = Date;
  class MockDate extends Date {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super('2026-09-27T12:00:00Z');
      } else {
        super(...(args as ConstructorParameters<typeof Date>));
      }
    }

    static now() {
      return new RealDate('2026-09-27T12:00:00Z').getTime();
    }
  }

  const previousWorkingDirectory = process.cwd();
  process.chdir(temporaryDirectory);
  // @ts-expect-error test double for deterministic current month
  global.Date = MockDate;

  try {
    await run();
  } finally {
    process.chdir(previousWorkingDirectory);
    global.Date = RealDate;
  }
}

test('getDashboardStats agrège uniquement le mois courant et compte les factures en attente', async () => {
  await withTemporaryData(async () => {
    const stats = await getDashboardStats();

    assert.equal(stats.joursCeMois, 7);
    assert.equal(stats.chiffreAffairesCeMois, 2680);
    assert.equal(stats.facturesEnAttente, 2);
    assert.equal(stats.facturesEnRetard, 0);
    assert.equal(stats.chiffreAffairesAnnuel, 3480);
    assert.equal(stats.plafondAnnuel, 0);
    assert.equal(stats.fraisCeMois, 0);
  });
});

test('getDashboardStats construit une évolution mensuelle sur 12 mois glissants se terminant au dernier mois d’activité, avec le CA basé sur les encaissements', async () => {
  await withTemporaryData(async () => {
    const stats = await getDashboardStats();

    assert.equal(stats.evolutionMensuelle.length, 12);
    assert.equal(stats.evolutionMensuelle.at(-1)?.mois, '2026-10');
    assert.equal(stats.evolutionMensuelle.at(-1)?.chiffreAffaires, 300);
    assert.equal(stats.evolutionMensuelle.at(-1)?.montantFacture, 0);
    assert.equal(stats.evolutionMensuelle.at(-1)?.joursTravailles, 1);

    const septembre = stats.evolutionMensuelle.find((point) => point.mois === '2026-09');
    assert.equal(septembre?.chiffreAffaires, 500);
    assert.equal(septembre?.montantFacture, 2680);
    assert.equal(septembre?.montantFactureEncaisse, 800);
    assert.equal(septembre?.montantFactureResteDu, 1880);
    assert.equal(septembre?.joursTravailles, 7);

    const aout = stats.evolutionMensuelle.find((point) => point.mois === '2026-08');
    assert.equal(aout?.chiffreAffaires, 0);
    assert.equal(aout?.montantFacture, 800);
    assert.equal(aout?.montantFactureEncaisse, 0);
    assert.equal(aout?.montantFactureResteDu, 800);
    assert.equal(aout?.joursTravailles, 2);

    assert.deepEqual(stats.repartitionParClient, [
      { clientId: '1', clientNom: 'Acme Corp', montant: 2400 },
      { clientId: '2', clientNom: 'StartUp XYZ', montant: 1080 },
    ]);
  });
});
