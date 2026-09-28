import assert from 'node:assert/strict';
import test from 'node:test';
import { AddressInfo } from 'node:net';
import { app } from '../server';

test('POST /api/factures retourne 400 pour un statut invalide', async () => {
  const server = app.listen(0);

  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/api/factures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: '1',
        mois_facture: '2026-09',
        statut: 'annulée',
      }),
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.message, 'Champs facture invalides.');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
