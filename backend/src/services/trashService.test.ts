import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { deleteClient } from './clientService';
import { createFrais, listFrais } from './fraisService';
import { createEncaissement, listEncaissements } from './encaissementService';
import { deleteFacture, listFactures } from './factureService';
import { listHeures } from './heuresService';
import { listProjects } from './projectService';
import { deleteProject } from './projectService';
import { emptyTrash, getTrash, purgeTrashEntity, restoreTrashEntity } from './trashService';

const clientsCsv = `id,nom,email
1,Acme,contact@acme.test
`;
const projetsCsv = `id,nom,client_id,taux_journalier,statut,date_creation
1,Projet Acme,1,400,actif,2026-09-01
`;
const heuresCsv = `id,date,projet_id,duree,taux_applique
1,2026-09-02,1,1,400
`;
const emptyHeuresCsv = 'id,date,projet_id,duree,taux_applique\n';
const invoiceLines = JSON.stringify([{
  date: '2026-09-02',
  projet: 'Projet Acme',
  jours: 1,
  taux_journalier: 400,
  montant_ht: 400,
}]);
const factureHeaders = [
  'id', 'numero_facture', 'client_id', 'mois_facture', 'montant_ht', 'date_creation', 'date_envoi', 'date_echeance',
  'statut', 'type', 'facture_origine_id', 'emetteur_raison_sociale', 'emetteur_nom_commercial', 'emetteur_adresse_postale',
  'emetteur_siret', 'emetteur_numero_tva', 'emetteur_email', 'emetteur_telephone', 'emetteur_iban',
  'emetteur_conditions_paiement', 'emetteur_delai_paiement_jours', 'emetteur_tva_non_applicable', 'emetteur_plafond_annuel',
  'destinataire_nom', 'destinataire_contact_name', 'destinataire_contact_role', 'destinataire_email', 'destinataire_phone',
  'destinataire_billing_address', 'lignes_json', 'deleted_at',
];
const factureValues: Record<string, string> = {
  id: '1',
  numero_facture: '2026-0001',
  client_id: '1',
  mois_facture: '2026-09',
  montant_ht: '400',
  date_creation: '2026-09-03T00:00:00.000Z',
  statut: 'brouillon',
  type: 'facture',
  lignes_json: invoiceLines,
};
const facturesCsvValue = (value: string) => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
const facturesCsv = `${factureHeaders.join(',')}\n${factureHeaders.map((header) => facturesCsvValue(factureValues[header] ?? '')).join(',')}\n`;

async function withTemporaryData(run: () => Promise<void>) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mes-corbeille-test-'));
  const dataDirectory = path.join(directory, 'data');
  await fs.promises.mkdir(dataDirectory);
  await Promise.all([
    fs.promises.writeFile(path.join(dataDirectory, 'clients.csv'), clientsCsv),
    fs.promises.writeFile(path.join(dataDirectory, 'projets.csv'), projetsCsv),
    fs.promises.writeFile(path.join(dataDirectory, 'heures.csv'), heuresCsv),
    fs.promises.writeFile(path.join(dataDirectory, 'factures.csv'), facturesCsv),
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

test('la suppression d’un client cascade dans la corbeille et la restauration d’une activité rétablit ses parents', async () => {
  await withTemporaryData(async () => {
    await createFrais({ date: '2026-09-02', libelle: 'Frais de test', categorie: 'autre', montant_ttc: 25, deductible: false, projet_id: '1' });

    await deleteClient('1');
    assert.deepEqual(await Promise.all([listProjects(), listHeures(), listFactures(), listFrais()]), [[], [], [], []]);
    const trash = await getTrash();
    assert.equal(trash.clients.length, 1);
    assert.equal(trash.projets.length, 1);
    assert.equal(trash.heures.length, 1);
    assert.equal(trash.factures.length, 1);
    assert.equal(trash.frais.length, 1);

    assert.equal(await restoreTrashEntity('heures', '1'), true);
    assert.equal((await listProjects()).length, 1);
    assert.equal((await listHeures()).length, 1);
    assert.equal((await getTrash()).factures.length, 1);

    assert.equal(await restoreTrashEntity('frais', '1'), true);
    assert.equal((await listFrais()).length, 1);
  });
});

test('un projet lié à une facture non brouillon peut être supprimé et purgé sans altérer l’instantané de la facture', async () => {
  await withTemporaryData(async () => {
    const facturePath = path.join(process.cwd(), 'data', 'factures.csv');
    await fs.promises.writeFile(facturePath, facturesCsv.replace('brouillon', 'envoyée'));
    const [invoiceBefore] = await listFactures();

    assert.equal(await deleteProject('1'), true);
    assert.deepEqual(await Promise.all([listProjects(), listHeures()]), [[], []]);
    assert.equal(await purgeTrashEntity('projets', '1'), true);
    assert.deepEqual(await listProjects(), []);
    assert.deepEqual(await listHeures(), []);

    const [invoiceAfter] = await listFactures();
    assert.deepEqual(invoiceAfter?.lignes, invoiceBefore?.lignes);
    assert.equal(invoiceAfter?.montant_ht, invoiceBefore?.montant_ht);
    assert.equal(invoiceAfter?.lignes[0]?.projet, 'Projet Acme');
    assert.equal(Object.hasOwn(invoiceAfter?.lignes[0] ?? {}, 'projet_id'), false);
    assert.equal(Object.hasOwn(invoiceAfter?.lignes[0] ?? {}, 'heure_id'), false);
  });
});

test('une facture non brouillon sans activité ne bloque pas la suppression du projet', async () => {
  await withTemporaryData(async () => {
    await fs.promises.writeFile(path.join(process.cwd(), 'data', 'heures.csv'), emptyHeuresCsv);
    await fs.promises.writeFile(
      path.join(process.cwd(), 'data', 'factures.csv'),
      facturesCsv.replace('brouillon', 'envoyée'),
    );

    assert.equal(await deleteProject('1'), true);
  });
});

test('les factures de la corbeille ne peuvent pas être purgées et bloquent atomiquement son vidage', async () => {
  await withTemporaryData(async () => {
    await deleteClient('1');
    await assert.rejects(purgeTrashEntity('factures', '1'), /numérotation doit être conservée/);
    await assert.rejects(emptyTrash(), /factures doivent être conservées/);
    const trash = await getTrash();
    assert.equal(trash.clients.length, 1);
    assert.equal(trash.projets.length, 1);
    assert.equal(trash.heures.length, 1);
    assert.equal(trash.factures.length, 1);
  });
});

test('la suppression d’une facture cascade sur ses encaissements et leur restauration réactive la facture', async () => {
  await withTemporaryData(async () => {
    await fs.promises.writeFile(path.join(process.cwd(), 'data', 'factures.csv'), facturesCsv.replace('brouillon', 'envoyée'));

    await createEncaissement({ facture_id: '1', date: '2026-09-05', montant: 100 });
    assert.equal((await listEncaissements()).length, 1);

    assert.equal(await deleteFacture('1'), true);
    assert.equal((await listEncaissements()).length, 0);
    const trash = await getTrash();
    assert.equal(trash.factures.length, 1);
    assert.equal(trash.encaissements.length, 1);

    assert.equal(await restoreTrashEntity('encaissements', '1'), true);
    assert.equal((await listFactures()).length, 1);
    assert.equal((await listEncaissements()).length, 1);
  });
});
