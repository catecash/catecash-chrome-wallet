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

test('Ironwood scan accepts the node frontier padding at mainnet block 248', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/mainnet-ironwood-248.json', import.meta.url)));
  const sign = await createSigner(wasm);
  const request = { network: 'mainnet', shield_seed_hex: '02'.repeat(32), notes: [], ...fixture };
  const result = sign.scanIronwood(request);
  assert.equal(result.height, 248);
  assert.equal(result.tree_hex, fixture.expected_tree_hex);
  assert.throws(() => sign.scanIronwood({ ...request, expected_tree_hex: fixture.previous_tree_hex }),
    /Ironwood commitments disagree/);
});

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
  assert.throws(() => sign({ ...request, network: 'mainnet' }), /selected network/);
});

test('browser WebAssembly signs a mainnet transaction with the mainnet address', async () => {
  const sign = await createSigner(wasm);
  const mainnetAddress = (await addressAndWif(key, 'mainnet')).address;
  const result = sign({ network: 'mainnet', secret_hex, destination: mainnetAddress, amount: '500000', tip_height: 300,
    utxos: [{ txid: '02'.repeat(32), index: 0, value: '1000000', script_hex, height: 1, coinbase: true }] });
  assert.equal(result.network, 'mainnet');
  assert.equal(result.source_address, mainnetAddress);
  assert.match(result.raw_hex, /^[0-9a-f]{100,}$/);
});

test('browser WebAssembly shields one mature mining reward to its own Ironwood address', async () => {
  const sign = await createSigner(wasm);
  const shield_seed_hex = '02'.repeat(32);
  const shielded = sign.shieldAddress({ network: 'mainnet', shield_seed_hex });
  const mainnetAddress = (await addressAndWif(key, 'mainnet')).address;
  const shield = sign.shield({ network: 'mainnet', secret_hex, shield_seed_hex,
    tip_height: 241, tree_height: 241, tree_state_hex: '000000',
    utxo: { txid: '04'.repeat(32), index: 0, value: '100000000000', script_hex, height: 1, coinbase: true } });
  assert.equal(shield.source_address, mainnetAddress);
  assert.equal(shield.shielded_address, shielded);
  assert.ok(BigInt(shield.amount) > 0n);
  assert.match(shield.raw_hex, /^[0-9a-f]{100,}$/);
  const external = sign.shieldAddress({ network: 'mainnet', shield_seed_hex: '03'.repeat(32) });
  const externalShield = sign.shield({ network: 'mainnet', secret_hex, shield_seed_hex,
    tip_height: 241, tree_height: 241, tree_state_hex: '000000', destination: external,
    utxo: { txid: '05'.repeat(32), index: 0, value: '100000000000', script_hex, height: 1, coinbase: true } });
  assert.equal(externalShield.shielded_address, external);
  assert.throws(() => sign.shield({ network: 'mainnet', secret_hex, shield_seed_hex,
    tip_height: 241, tree_height: 241, tree_state_hex: '000000', destination: mainnetAddress,
    utxo: { txid: '05'.repeat(32), index: 0, value: '100000000000', script_hex, height: 1, coinbase: true } }),
  /must shield to an Ironwood address/);
});
