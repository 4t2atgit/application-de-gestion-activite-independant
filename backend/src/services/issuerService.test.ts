import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { getIssuerProfile, saveIssuerProfile, validateIssuerProfile } from './issuerService';

test('le profil émetteur est durable et accepte les accents et retours à la ligne CSV', async () => {
  const directory = await fs.promises.mkdtemp(path.join(process.cwd(), '.issuer-service-test-'));
  const previousDirectory = process.cwd();
  try {
    await fs.promises.mkdir(path.join(directory, 'data'));
    process.chdir(directory);
    const initial = await getIssuerProfile();
    assert.equal(initial.raison_sociale, '');

    const profile = {
      raison_sociale: 'Société "Étoile"',
      nom_commercial: 'Atelier',
      adresse_postale: '12 rue des Écoles\n75005 Paris',
      siret: '12345678901234',
      numero_tva: 'FR00123456789',
      email: 'factures@example.fr',
      telephone: '+33 1 02 03 04 05',
      iban: 'FR7630006000011234567890189',
      conditions_paiement: '30 jours, par virement',
      delai_paiement_jours: 45,
      tva_non_applicable: true,
      plafond_annuel: 77700,
    };
    assert.equal(validateIssuerProfile(profile), true);
    assert.equal(validateIssuerProfile({ ...profile, siret: '123' }), false);
    assert.equal(validateIssuerProfile({ ...profile, email: 'not-an-email' }), false);
    assert.equal(validateIssuerProfile({ ...profile, delai_paiement_jours: '30' }), false);
    assert.equal(validateIssuerProfile({ ...profile, tva_non_applicable: 'true' }), false);
    assert.deepEqual(await saveIssuerProfile(profile), profile);
    assert.deepEqual(await getIssuerProfile(), profile);
  } finally {
    process.chdir(previousDirectory);
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
