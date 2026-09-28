import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildAnnualFacturesExportCsv, createAvoir, createFacture, deleteFacture, listAllFactures, updateFacture } from './factureService';
import { saveIssuerProfile } from './issuerService';
import { updateClient } from './clientService';
import { updateProject } from './projectService';

const clientsCsv = `id,nom,email
1,Acme Corp,contact@acme.com
2,StartUp XYZ,hello@startup.com
`;
const projetsCsv = `id,nom,client_id,taux_journalier,statut,date_creation
1,Site web,1,400,actif,2026-01-15
2,API,1,400,actif,2026-02-01
3,Autre client,2,360,actif,2026-02-01
`;
const heuresCsv = `id,date,projet_id,duree,taux_applique
1,2026-09-20,1,1,400
2,2026-09-21,2,0.5,400
3,2026-09-22,3,1,360
4,2026-10-01,1,1,400
`;
const emetteurCsv = 'raison_sociale,nom_commercial,adresse_postale,siret,numero_tva,email,telephone,iban,conditions_paiement\n'
  + 'Atelier par défaut,,12 rue des Écoles,12345678901234,,contact@atelier.fr,,,\n';

async function withTemporaryData(run: () => Promise<void>, options?: { withIssuerProfile?: boolean }) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mes-facture-test-'));
  const dataDirectory = path.join(directory, 'data');
  await fs.promises.mkdir(dataDirectory);
  await Promise.all([
    fs.promises.writeFile(path.join(dataDirectory, 'clients.csv'), clientsCsv),
    fs.promises.writeFile(path.join(dataDirectory, 'projets.csv'), projetsCsv),
    fs.promises.writeFile(path.join(dataDirectory, 'heures.csv'), heuresCsv),
    fs.promises.writeFile(path.join(dataDirectory, 'factures.csv'), 'id,numero_facture,client_id,mois_facture,montant_ht,date_creation,statut,deleted_at\n'),
    options?.withIssuerProfile === false
      ? Promise.resolve()
      : fs.promises.writeFile(path.join(dataDirectory, 'emetteur.csv'), emetteurCsv),
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

test('une facture client-mois agrège tous les projets et numérote avec les factures supprimées', async () => {
  await withTemporaryData(async () => {
    const year = String(new Date().getFullYear());
    const invoicePath = path.join(process.cwd(), 'data', 'factures.csv');
    await fs.promises.appendFile(invoicePath, `1,${year}-001,2,2026-08,360,${year}-08-01T00:00:00.000Z,brouillon,${year}-08-02T00:00:00.000Z\n`);

    const facture = await createFacture({ client_id: '1', mois_facture: '2026-09' });
    assert.equal(facture.numero_facture, `${year}-0002`);
    assert.equal(facture.montant_ht, 600);
    assert.equal(facture.statut, 'brouillon');
    assert.match(facture.date_creation, /^\d{4}-\d{2}-\d{2}T/);
    const legacy = (await listAllFactures()).find((item) => item.numero_facture === `${year}-001`);
    assert.equal(legacy?.emetteur.raison_sociale, '');
    assert.deepEqual(legacy?.lignes, []);
  });
});

test('createFacture refuse de générer une facture si les coordonnées de l’entreprise ne sont pas renseignées', async () => {
  await withTemporaryData(async () => {
    await assert.rejects(
      createFacture({ client_id: '1', mois_facture: '2026-09' }),
      /coordonnées de l’entreprise/,
    );
  }, { withIssuerProfile: false });
});

test('une facture client-mois, même supprimée, interdit une double facturation', async () => {
  await withTemporaryData(async () => {
    const facture = await createFacture({ client_id: '1', mois_facture: '2026-09' });
    await deleteFacture(facture.id);
    await assert.rejects(
      createFacture({ client_id: '1', mois_facture: '2026-09' }),
      /existe déjà pour ce client et ce mois/,
    );
    assert.equal((await listAllFactures()).length, 1);
    assert.equal((await listAllFactures())[0]?.emetteur.raison_sociale, 'Atelier par défaut');
  });
});

test('le brouillon est recalculable puis les statuts envoyée et payée sont verrouillés', async () => {
  await withTemporaryData(async () => {
    const facture = await createFacture({ client_id: '1', mois_facture: '2026-09' });
    const updated = await updateFacture(facture.id, { mois_facture: '2026-10' });
    assert.equal(updated?.montant_ht, 400);
    assert.equal(updated?.numero_facture, facture.numero_facture);
    assert.equal(updated?.date_creation, facture.date_creation);

    const sent = await updateFacture(facture.id, { statut: 'envoyée' });
    assert.equal(sent?.statut, 'envoyée');
    await assert.rejects(updateFacture(facture.id, { mois_facture: '2026-09' }), /envoyée/);
    const paid = await updateFacture(facture.id, { statut: 'payée' });
    assert.equal(paid?.statut, 'payée');
    await assert.rejects(updateFacture(facture.id, { statut: 'payée' }), /entièrement verrouillée/);
  });
});

test('le recalcul d’un brouillon actualise le nom du projet', async () => {
  await withTemporaryData(async () => {
    const facture = await createFacture({ client_id: '1', mois_facture: '2026-09' });
    await updateProject('1', {
      nom: 'Site vitrine',
      client_id: '1',
      taux_journalier: 400,
      statut: 'actif',
      date_creation: '2026-01-15',
    });

    const updated = await updateFacture(facture.id, { mois_facture: '2026-09' });
    assert.equal(updated?.lignes[0]?.projet, 'Site vitrine');
  });
});

test('la facture capture les coordonnées et lignes, les brouillons se rafraîchissent puis les instantanés sont verrouillés', async () => {
  await withTemporaryData(async () => {
    await saveIssuerProfile({
      raison_sociale: 'Atelier Étoilé',
      nom_commercial: 'Atelier',
      adresse_postale: '12 rue des Écoles\n75005 Paris',
      siret: '12345678901234',
      numero_tva: 'FR00123456789',
      email: 'factures@atelier.fr',
      telephone: '0102030405',
      iban: 'FR7630006000011234567890189',
      conditions_paiement: '30 jours, par virement',
      delai_paiement_jours: 30,
      tva_non_applicable: false,
      plafond_annuel: 0,
    });
    await updateClient('1', {
      nom: 'Acme Corp',
      email: 'billing@acme.com',
      contact_name: 'Camille Martin',
      contact_role: 'Direction',
      phone: '0601020304',
      billing_address: '10 avenue Victor-Hugo\n75016 Paris',
    });

    const facture = await createFacture({ client_id: '1', mois_facture: '2026-09' });
    assert.equal(facture.emetteur.raison_sociale, 'Atelier Étoilé');
    assert.equal(facture.emetteur.adresse_postale, '12 rue des Écoles\n75005 Paris');
    assert.equal(facture.destinataire.contact_name, 'Camille Martin');
    assert.deepEqual(facture.lignes.map((line) => [line.projet, line.jours, line.taux_journalier, line.montant_ht]), [
      ['Site web', 1, 400, 400],
      ['API', 0.5, 400, 200],
    ]);
    assert.equal(facture.montant_ht, 600);

    await saveIssuerProfile({ ...facture.emetteur, raison_sociale: 'Nouvelle raison sociale' });
    assert.equal((await listAllFactures())[0]?.emetteur.raison_sociale, 'Atelier Étoilé');

    const revisedDraft = await updateFacture(facture.id, { mois_facture: '2026-10' });
    assert.equal(revisedDraft?.emetteur.raison_sociale, 'Nouvelle raison sociale');
    assert.equal(revisedDraft?.montant_ht, 400);
    assert.equal(revisedDraft?.lignes[0]?.date, '2026-10-01');

    const sent = await updateFacture(facture.id, { statut: 'envoyée' });
    await saveIssuerProfile({ ...facture.emetteur, raison_sociale: 'Encore une autre raison sociale' });
    const paid = await updateFacture(facture.id, { statut: 'payée' });
    assert.equal(paid?.emetteur.raison_sociale, sent?.emetteur.raison_sociale);
    assert.deepEqual(paid?.lignes, sent?.lignes);
    assert.deepEqual(paid?.destinataire, sent?.destinataire);
  });
});

test('l’envoi d’une facture calcule son échéance à partir du délai de paiement de l’émetteur', async () => {
  await withTemporaryData(async () => {
    await saveIssuerProfile({
      raison_sociale: 'Atelier Étoilé',
      nom_commercial: '',
      adresse_postale: '12 rue des Écoles',
      siret: '12345678901234',
      numero_tva: '',
      email: 'factures@atelier.fr',
      telephone: '',
      iban: '',
      conditions_paiement: '',
      delai_paiement_jours: 45,
      tva_non_applicable: false,
      plafond_annuel: 0,
    });
    const facture = await createFacture({ client_id: '1', mois_facture: '2026-09' });
    const sent = await updateFacture(facture.id, { statut: 'envoyée' });
    assert.ok(sent?.date_envoi);
    assert.ok(sent?.date_echeance);
    const expected = new Date(sent!.date_envoi!);
    expected.setUTCDate(expected.getUTCDate() + 45);
    assert.equal(sent?.date_echeance, expected.toISOString());
  });
});

test('un avoir annule une facture envoyée, ne peut être dupliqué et libère le mois pour une nouvelle facture', async () => {
  await withTemporaryData(async () => {
    const facture = await createFacture({ client_id: '1', mois_facture: '2026-09' });
    await assert.rejects(createAvoir(facture.id), /envoyée ou payée/);

    const sent = await updateFacture(facture.id, { statut: 'envoyée' });
    const avoir = await createAvoir(sent!.id);
    assert.equal(avoir.type, 'avoir');
    assert.equal(avoir.facture_origine_id, facture.id);
    assert.equal(avoir.montant_ht, -600);
    assert.equal(avoir.statut, 'envoyée');
    assert.match(avoir.numero_facture, /^AV-\d{4}-0001$/);
    assert.deepEqual(avoir.lignes.map((line) => line.montant_ht), sent!.lignes.map((line) => -line.montant_ht));

    await assert.rejects(createAvoir(sent!.id), /existe déjà/);
    await assert.rejects(updateFacture(avoir.id, { statut: 'payée' }), /document définitif/);

    const reFacture = await createFacture({ client_id: '1', mois_facture: '2026-09' });
    assert.equal(reFacture.montant_ht, 600);
    assert.equal((await listAllFactures()).filter((item) => item.type === 'facture' && item.mois_facture === '2026-09').length, 2);
  });
});

test('l’export CSV annuel liste les factures et avoirs triés par mois', async () => {
  await withTemporaryData(async () => {
    const facture = await createFacture({ client_id: '1', mois_facture: '2026-09' });
    const sent = await updateFacture(facture.id, { statut: 'envoyée' });
    await createAvoir(sent!.id);

    const csv = await buildAnnualFacturesExportCsv('2026');
    const lines = csv.trim().split('\n');
    assert.equal(lines[0], 'numero_facture,type,client,mois_facture,montant_ht,date_creation,date_envoi,date_echeance,statut');
    assert.equal(lines.length, 3);
    assert.match(lines[1]!, /^\d{4}-0001,facture,Acme Corp,2026-09,600\.00/);
    assert.match(lines[2]!, /^AV-\d{4}-0001,avoir,Acme Corp,2026-09,-600\.00/);
  });
});
