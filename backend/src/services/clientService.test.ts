import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { listClients, updateClient } from './clientService';

test('les coordonnées client sont persistées', async () => {
  const directory = await fs.promises.mkdtemp(path.join(process.cwd(), '.client-service-test-'));
  const previousDirectory = process.cwd();
  try {
    const dataDirectory = path.join(directory, 'data');
    await fs.promises.mkdir(dataDirectory);
    await fs.promises.writeFile(
      path.join(dataDirectory, 'clients.csv'),
      'id,nom,email\n1,Client historique,contact@example.fr\n',
      'utf8',
    );
    process.chdir(directory);
    const [legacyClient] = await listClients();
    assert.equal(legacyClient?.contact_name, '');
    assert.equal(legacyClient?.billing_address, '');

    const updated = await updateClient('1', {
      nom: 'Client historique',
      email: 'facturation@example.fr',
      contact_name: 'Élodie Martin',
      contact_role: 'Comptabilité',
      phone: '+33 6 12 34 56 78',
      billing_address: '5 rue des Fleurs\n75000 Paris',
    });
    assert.equal(updated?.contact_name, 'Élodie Martin');
    assert.equal((await listClients())[0]?.billing_address, '5 rue des Fleurs\n75000 Paris');
  } finally {
    process.chdir(previousDirectory);
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
