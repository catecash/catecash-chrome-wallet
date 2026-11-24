import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { addressAndWif } from '../src/cate-address.mjs';
import { publicKeyFromSecret, hash160 } from '../src/cate-keylib.mjs';
import { createSigner } from '../src/cate-signer.js';

const key = new Uint8Array(32); key[31] = 1;
const secret_hex = Buffer.from(key).toString('hex');
const source = (await addressAndWif(key, 'devnet')).address;
const publicKey = publicKeyFromSecret(key);
const script_hex = '76a914' + Buffer.from(hash160(createHash('sha256').update(publicKey).digest())).toString('hex') + '88ac';
const wasm = await readFile(new URL('../engine/pkg/catecash_browser_engine.wasm', import.meta.url));

test('browser WebAssembly signs a Catecash devnet transaction using the existing key format', async () => {
  const sign = await createSigner(wasm);
  const request = { network: 'devnet', secret_hex, destination: source, amount: '500000', tip_height: 300,
    utxos: [{ txid: '02'.repeat(32), index: 0, value: '1000000', script_hex, height: 1, coinbase: true }] };
  const result = sign(request);
  assert.equal(result.source_address, source);
  assert.equal(result.fee, '10000');
  assert.equal(result.change, '490000');
  assert.equal(result.input_count, 1);
  assert.match(result.raw_hex, /^[0-9a-f]+$/);
  assert.ok(result.raw_hex.length > 100);
  assert.throws(() => sign({ ...request, utxos: [{ ...request.utxos[0], script_hex: '00' }] }), /script/);
  assert.throws(() => sign({ ...request, tip_height: 100 }), /confirmations/);
  assert.throws(() => sign({ ...request, amount: '999999' }), /insufficient/);
});

test('browser WebAssembly signs Catecash testnet and rejects cross-network destinations', async () => {
  const sign = await createSigner(wasm);
  const testnetAddress = (await addressAndWif(key, 'testnet')).address;
  const request = { network: 'testnet', secret_hex, destination: testnetAddress, amount: '500000', tip_height: 300,
    utxos: [{ txid: '02'.repeat(32), index: 0, value: '1000000', script_hex, height: 1, coinbase: true }] };
  const result = sign(request);
  assert.equal(result.network, 'testnet');
  assert.equal(result.source_address, testnetAddress);
  assert.throws(() => sign({ ...request, destination: source }), /selected network/);
  assert.throws(() => sign({ ...request, network: 'mainnet' }), /devnet and testnet/);
});
