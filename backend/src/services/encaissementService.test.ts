import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createFacture, updateFacture } from './factureService';
import { saveIssuerProfile } from './issuerService';
import {
  createEncaissement,
  EncaissementValidationError,
  getMontantEncaisse,
  listAllEncaissements,
  listEncaissements,
  softDeleteEncaissement,
} from './encaissementService';

const clientsCsv = `id,nom,email
1,Acme Corp,contact@acme.com
`;
const projetsCsv = `id,nom,client_id,taux_journalier,statut,date_creation
1,Site web,1,400,actif,2026-01-15
`;
const heuresCsv = `id,date,projet_id,duree,taux_applique
1,2026-09-20,1,1,400
2,2026-09-21,1,1,400
`;
const emetteurCsv = 'raison_sociale,nom_commercial,adresse_postale,siret,numero_tva,email,telephone,iban,conditions_paiement\n'
  + 'Atelier par défaut,,12 rue des Écoles,12345678901234,,contact@atelier.fr,,,\n';

async function withTemporaryData(run: () => Promise<void>) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mes-encaissements-test-'));
  const dataDirectory = path.join(directory, 'data');
  await fs.promises.mkdir(dataDirectory, { recursive: true });
  await Promise.all([
    fs.promises.writeFile(path.join(dataDirectory, 'clients.csv'), clientsCsv),
    fs.promises.writeFile(path.join(dataDirectory, 'projets.csv'), projetsCsv),
    fs.promises.writeFile(path.join(dataDirectory, 'heures.csv'), heuresCsv),
    fs.promises.writeFile(path.join(dataDirectory, 'factures.csv'), 'id,numero_facture,client_id,mois_facture,montant_ht,date_creation,statut,deleted_at\n'),
    fs.promises.writeFile(path.join(dataDirectory, 'emetteur.csv'), emetteurCsv),
  ]);
  const previousDirectory = process.cwd();
  process.chdir(directory);
  try {
    await run();
  } finally {
    process.chdir(previousDirectory);
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
}

test('createEncaissement refuse une facture en brouillon, un avoir et un montant dépassant le solde', async () => {
  await withTemporaryData(async () => {
    const facture = await createFacture({ client_id: '1', mois_facture: '2026-09' });
    assert.equal(facture.montant_ht, 800);

    await assert.rejects(
      createEncaissement({ facture_id: facture.id, date: '2026-09-25', montant: 100 }),
      EncaissementValidationError,
    );

    await updateFacture(facture.id, { statut: 'envoyée' });
    await assert.rejects(
      createEncaissement({ facture_id: facture.id, date: 'invalide', montant: 100 }),
      EncaissementValidationError,
    );
    await assert.rejects(
      createEncaissement({ facture_id: facture.id, date: '2026-09-25', montant: -10 }),
      EncaissementValidationError,
    );
    await assert.rejects(
      createEncaissement({ facture_id: facture.id, date: '2026-09-25', montant: 900 }),
      /solde restant dû/,
    );
  });
});

test('les encaissements partiels cumulent le solde et la facture passe automatiquement payée une fois soldée', async () => {
  await withTemporaryData(async () => {
    const facture = await createFacture({ client_id: '1', mois_facture: '2026-09' });
    await updateFacture(facture.id, { statut: 'envoyée' });

    const first = await createEncaissement({ facture_id: facture.id, date: '2026-09-25', montant: 300, moyen_paiement: 'virement', note: 'Acompte' });
    assert.equal(first.montant, 300);
    assert.equal(await getMontantEncaisse(facture.id), 300);
    assert.equal((await listEncaissements()).length, 1);

    await assert.rejects(
      createEncaissement({ facture_id: facture.id, date: '2026-09-26', montant: 600 }),
      /solde restant dû/,
    );

    await createEncaissement({ facture_id: facture.id, date: '2026-09-30', montant: 500, moyen_paiement: 'chèque' });
    assert.equal(await getMontantEncaisse(facture.id), 800);

    await assert.rejects(
      createEncaissement({ facture_id: facture.id, date: '2026-10-01', montant: 1 }),
      /déjà entièrement payée/,
    );
  });
});

test('un encaissement peut être supprimé logiquement avant que la facture soit payée, mais plus après', async () => {
  await withTemporaryData(async () => {
    const facture = await createFacture({ client_id: '1', mois_facture: '2026-09' });
    await updateFacture(facture.id, { statut: 'envoyée' });

    const partial = await createEncaissement({ facture_id: facture.id, date: '2026-09-25', montant: 300 });
    assert.equal(await softDeleteEncaissement(partial.id), true);
    assert.equal((await listEncaissements()).length, 0);
    assert.equal((await listAllEncaissements()).length, 1);

    const full = await createEncaissement({ facture_id: facture.id, date: '2026-09-26', montant: 800 });
    await assert.rejects(softDeleteEncaissement(full.id), /facture déjà payée/);
  });
});
