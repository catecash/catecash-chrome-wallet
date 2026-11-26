import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScanState, saveScanState } from '../src/ironwood-state.js';

test('Ironwood scan state is encrypted, bound to the wallet seed, and restores note witnesses', async () => {
  const records = new Map();
  globalThis.chrome = { storage: { local: {
    get: async key => ({ [key]: records.get(key) }),
    set: async data => { for (const [key, value] of Object.entries(data)) records.set(key, value); }
  } } };
  const seed = '01'.repeat(32);
  const state = { height: 242, hash: 'ab'.repeat(32), tree_hex: '000000', balance: '500000000000',
    notes: [{ transaction_hex: 'feedcafe', witness_hex: 'deadbeef', nullifier_hex: 'cd'.repeat(32),
      action_index: 0, value: '500000000000', received_height: 242 }] };
  await saveScanState(seed, 'mainnet', state);
  assert.equal(JSON.stringify(records.get('ironwoodScan_mainnet')).includes('feedcafe'), false);
  assert.deepEqual(await loadScanState(seed, 'mainnet'), state);
  await assert.rejects(loadScanState('02'.repeat(32), 'mainnet'), /Cannot open saved Ironwood scan/);
  assert.equal(await loadScanState(seed, 'testnet'), null);
});
