import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  buildAnnualFraisExportCsv,
  createFrais,
  FraisValidationError,
  getFraisCeMois,
  listAllFrais,
  listFrais,
  readJustificatif,
  saveJustificatif,
  softDeleteFrais,
  updateFrais,
} from './fraisService';

const clientsCsv = `id,nom,email
1,Acme Corp,contact@acme.com
`;
const projetsCsv = `id,nom,client_id,taux_journalier,statut,date_creation
1,Site web,1,400,actif,2026-01-15
`;

async function withTemporaryData(run: () => Promise<void>) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mes-frais-test-'));
  const dataDirectory = path.join(directory, 'data');
  await fs.promises.mkdir(dataDirectory, { recursive: true });
  await fs.promises.writeFile(path.join(dataDirectory, 'clients.csv'), clientsCsv);
  await fs.promises.writeFile(path.join(dataDirectory, 'projets.csv'), projetsCsv);
  const previousDirectory = process.cwd();
  process.chdir(directory);
  try {
    await run();
  } finally {
    process.chdir(previousDirectory);
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
}

test('createFrais valide les champs obligatoires et le rattachement projet', async () => {
  await withTemporaryData(async () => {
    await assert.rejects(
      createFrais({ date: 'invalide', libelle: 'Test', categorie: 'autre', montant_ttc: 10, deductible: false }),
      FraisValidationError,
    );
    await assert.rejects(
      createFrais({ date: '2026-09-10', libelle: 'Test', categorie: 'inexistante' as never, montant_ttc: 10, deductible: false }),
      FraisValidationError,
    );
    await assert.rejects(
      createFrais({ date: '2026-09-10', libelle: 'Test', categorie: 'autre', montant_ttc: -5, deductible: false }),
      FraisValidationError,
    );
    await assert.rejects(
      createFrais({ date: '2026-09-10', libelle: 'Test', categorie: 'autre', montant_ttc: 10, deductible: false, projet_id: '99' }),
      /Projet introuvable/,
    );

    const frais = await createFrais({ date: '2026-09-10', libelle: 'Abonnement logiciel', categorie: 'logiciel/abonnement', montant_ttc: 29.99, deductible: true, projet_id: '1' });
    assert.equal(frais.id, '1');
    assert.equal((await listFrais()).length, 1);
  });
});

test('updateFrais conserve le justificatif existant et la suppression logique le préserve dans la corbeille', async () => {
  await withTemporaryData(async () => {
    const frais = await createFrais({ date: '2026-09-10', libelle: 'Matériel', categorie: 'matériel', montant_ttc: 120, deductible: true });
    const withJustificatif = await saveJustificatif(frais.id, Buffer.from('%PDF-1.4 test'), 'recu.pdf');
    assert.equal(withJustificatif.justificatif_nom_fichier, 'recu.pdf');

    const updated = await updateFrais(frais.id, { date: '2026-09-11', libelle: 'Matériel bureau', categorie: 'matériel', montant_ttc: 150, deductible: true });
    assert.equal(updated?.justificatif_nom_fichier, 'recu.pdf');
    assert.equal(updated?.montant_ttc, 150);

    const buffer = await readJustificatif(updated!);
    assert.ok(buffer);
    assert.equal(buffer!.toString(), '%PDF-1.4 test');

    assert.equal(await softDeleteFrais(frais.id), true);
    assert.equal((await listFrais()).length, 0);
    assert.equal((await listAllFrais()).length, 1);
  });
});

test('saveJustificatif refuse un format non pris en charge', async () => {
  await withTemporaryData(async () => {
    const frais = await createFrais({ date: '2026-09-10', libelle: 'Repas client', categorie: 'repas', montant_ttc: 45, deductible: false });
    await assert.rejects(saveJustificatif(frais.id, Buffer.from('test'), 'note.docx'), FraisValidationError);
  });
});

test('getFraisCeMois et l’export CSV annuel agrègent les frais par période', async () => {
  await withTemporaryData(async () => {
    await createFrais({ date: '2026-09-05', libelle: 'Essence', categorie: 'déplacement', montant_ttc: 60, deductible: true });
    await createFrais({ date: '2026-09-20', libelle: 'Casque audio', categorie: 'matériel', montant_ttc: 89.5, deductible: true });
    await createFrais({ date: '2026-08-15', libelle: 'Hors période', categorie: 'autre', montant_ttc: 500, deductible: false });

    const total = await getFraisCeMois(new Date('2026-09-27T12:00:00Z'));
    assert.equal(total, 149.5);

    const csv = await buildAnnualFraisExportCsv('2026');
    const lines = csv.trim().split('\n');
    assert.equal(lines.length, 4);
    assert.equal(lines[0], 'date,libelle,categorie,montant_ttc,deductible,justificatif');
    assert.ok(lines[1]!.startsWith('2026-08-15'));
    assert.ok(lines[3]!.startsWith('2026-09-20'));
  });
});
