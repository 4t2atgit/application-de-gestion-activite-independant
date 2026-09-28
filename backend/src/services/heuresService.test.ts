import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHeure, listHeures, updateHeure } from './heuresService';

const clientsCsv = `id,nom,email
1,Acme Corp,contact@acme.com
2,StartUp XYZ,hello@startup.com
`;
const projetsCsv = `id,nom,client_id,taux_journalier,statut,date_creation
1,Site web refonte,1,400,actif,2026-01-15
2,API REST,2,360,actif,2026-02-01
3,Maintenance,1,450,actif,2026-03-10
`;
const heuresCsv = `id,date,projet_id,duree,taux_applique
1,2026-09-22,1,0.5,400
`;
const facturesCsv = `id,numero_facture,client_id,mois_facture,montant_ht,date_creation,statut,emetteur_raison_sociale,emetteur_nom_commercial,emetteur_adresse_postale,emetteur_siret,emetteur_numero_tva,emetteur_email,emetteur_telephone,emetteur_iban,emetteur_conditions_paiement,destinataire_nom,destinataire_contact_name,destinataire_contact_role,destinataire_email,destinataire_phone,destinataire_billing_address,lignes_json,deleted_at
1,2026-0001,1,2026-09,200,2026-09-01T00:00:00.000Z,envoyée,,,,,,,,,,,,,,,,[],
`;

async function withTemporaryData(run: () => Promise<void>, options?: { withFactures?: boolean }) {
  const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mes-heures-test-'));
  const dataDirectory = path.join(temporaryDirectory, 'data');
  await fs.promises.mkdir(dataDirectory, { recursive: true });
  await fs.promises.writeFile(path.join(dataDirectory, 'clients.csv'), clientsCsv, 'utf8');
  await fs.promises.writeFile(path.join(dataDirectory, 'projets.csv'), projetsCsv, 'utf8');
  await fs.promises.writeFile(path.join(dataDirectory, 'heures.csv'), heuresCsv, 'utf8');
  if (options?.withFactures) {
    await fs.promises.writeFile(path.join(dataDirectory, 'factures.csv'), facturesCsv, 'utf8');
  }

  const previousWorkingDirectory = process.cwd();
  process.chdir(temporaryDirectory);

  try {
    await run();
  } finally {
    process.chdir(previousWorkingDirectory);
  }
}

test('createHeure complète une journée avec une seconde demi-journée', async () => {
  await withTemporaryData(async () => {
    const heure = await createHeure({
      date: '2026-09-22',
      projet_id: '2',
      duree: 0.5,
    });

    assert.equal(heure.taux_applique, 360);

    const heures = await listHeures();
    assert.equal(heures.length, 2);
    assert.equal(heures.reduce((sum, item) => sum + item.duree, 0), 1);
  });
});

test('createHeure refuse de dépasser une journée sur la même date', async () => {
  await withTemporaryData(async () => {
    await assert.rejects(
      createHeure({
        date: '2026-09-22',
        projet_id: '2',
        duree: 1,
      }),
      /dépasser une journée de travail/,
    );
  });
});

test('createHeure refuse un troisième projet sur une même journée', async () => {
  await withTemporaryData(async () => {
    await createHeure({
      date: '2026-09-22',
      projet_id: '2',
      duree: 0.5,
    });

    await assert.rejects(
      createHeure({
        date: '2026-09-22',
        projet_id: '3',
        duree: 0.5,
      }),
      /deux projets maximum/,
    );
  });
});

test('updateHeure met à jour une activité existante', async () => {
  await withTemporaryData(async () => {
    const updated = await updateHeure('1', {
      date: '2026-09-23',
      projet_id: '1',
      duree: 1,
    });

    assert.ok(updated);
    assert.equal(updated?.duree, 1);
    assert.equal((await listHeures()).find((heure) => heure.id === '1')?.date, '2026-09-23');
  });
});

test('createHeure écrit les colonnes d’activité sans description', async () => {
  await withTemporaryData(async () => {
    const created = await createHeure({
      date: '2026-09-23',
      projet_id: '2',
      duree: 1,
    });

    const csv = await fs.promises.readFile(path.join(process.cwd(), 'data', 'heures.csv'), 'utf8');
    assert.equal(created.taux_applique, 360);
    assert.match(csv, /^id,date,projet_id,duree,taux_applique,deleted_at\r?$/m);
  });
});

test('createHeure et updateHeure refusent toute modification sur un mois déjà facturé (non brouillon) pour ce client', async () => {
  await withTemporaryData(async () => {
    await assert.rejects(
      createHeure({
        date: '2026-09-24',
        projet_id: '1',
        duree: 0.5,
      }),
      /facture non brouillon/,
    );

    await assert.rejects(
      updateHeure('1', {
        date: '2026-09-25',
        projet_id: '1',
        duree: 1,
      }),
      /facture non brouillon/,
    );
  }, { withFactures: true });
});

test('createHeure reste possible pour un autre client dont le mois n’est pas facturé', async () => {
  await withTemporaryData(async () => {
    const created = await createHeure({
      date: '2026-09-24',
      projet_id: '2',
      duree: 0.5,
    });

    assert.equal(created.projet_id, '2');
  }, { withFactures: true });
});
