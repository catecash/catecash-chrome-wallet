import test from 'node:test';
import assert from 'node:assert/strict';
import { spendableUtxos, broadcastCate } from '../src/cate-gateway.js';
import { CATE_NETWORKS } from '../src/networks.js';

test('gateway reads recover from temporary HTTP 503 responses', async () => {
  const originalFetch = globalThis.fetch;
  const calls = new Map();
  globalThis.fetch = async url => {
    const path = new URL(url).pathname;
    const count = (calls.get(path) ?? 0) + 1;
    calls.set(path, count);
    if (count === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({
      chain: CATE_NETWORKS.mainnet.chain, genesis: CATE_NETWORKS.mainnet.genesis,
      height: 100, address: 'CaExampleAddress', utxos: []
    }) };
  };
  try {
    assert.deepEqual((await spendableUtxos('mainnet', 'CaExampleAddress')).utxos, []);
    assert.equal(calls.get('/status'), 2);
    assert.equal(calls.get('/utxos/CaExampleAddress'), 2);
  } finally { globalThis.fetch = originalFetch; }
});

test('broadcast failure is reported without retrying the transaction', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return { ok: false, status: 503 }; };
  try {
    await assert.rejects(broadcastCate('mainnet', '00'.repeat(10)), /HTTP 503/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = originalFetch; }
});

test('coinbase rewards are excluded from transparent sends', async () => {
  const originalFetch = globalThis.fetch;
  const network = CATE_NETWORKS.mainnet;
  let utxos = [{ txid: 'aa', coinbase: true }];
  globalThis.fetch = async url => ({ ok: true, json: async () => ({
    chain: network.chain, genesis: network.genesis, height: 100,
    address: 'CaExampleAddress', utxos: url.endsWith('/status') ? undefined : utxos
  }) });
  try {
    await assert.rejects(spendableUtxos('mainnet', 'CaExampleAddress'), /mined rewards/);
    utxos = [...utxos, { txid: 'bb', coinbase: false }];
    assert.deepEqual((await spendableUtxos('mainnet', 'CaExampleAddress')).utxos,
      [{ txid: 'bb', coinbase: false }]);
  } finally { globalThis.fetch = originalFetch; }
});

test('node transaction rejection is distinct from gateway unavailability', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 422, json: async () => ({ error: 'Catecash node rejected the transaction.' }) });
  try {
    await assert.rejects(broadcastCate('mainnet', '00'.repeat(10)), /node rejected the transaction/);
  } finally { globalThis.fetch = originalFetch; }
});
