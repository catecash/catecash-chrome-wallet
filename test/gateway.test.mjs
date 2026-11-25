import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway } from '../gateway.mjs';
const genesis = '6b9c4d783359202111571c123309b2c0511d1bf9036f74dee4921f04e1f0a9cf';
const address = 'yPeC241BhV8S3oRB58xPobSFzJXkhYxwhKK';

test('local gateway verifies devnet and passes only public UTXOs and signed bytes', async () => {
  const methods = [];
  const rpc = async (method, params) => {
    methods.push(method);
    if (method === 'getblockchaininfo') return { chain: 'catecash-devnet', blocks: 300 };
    if (method === 'getblockhash') return genesis;
    if (method === 'getaddressutxos') return [
      { address, txid: '02'.repeat(32), outputIndex: 0, script: '76a914' + '11'.repeat(20) + '88ac', satoshis: '9007199254740993', height: 1 },
      { address, txid: '04'.repeat(32), outputIndex: 0, script: '76a914' + '11'.repeat(20) + '88ac', satoshis: '9999999999999999', height: 290 }
    ];
    if (method === 'getrawtransaction') return { vin: [{ coinbase: 'abcd' }] };
    if (method === 'sendrawtransaction') { assert.equal(params[0], '00'.repeat(10)); return '03'.repeat(32); }
    throw new Error('Unexpected RPC method.');
  };
  const server = createGateway({ rpc });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const data = await (await fetch(base + '/utxos/' + address)).json();
    assert.equal(data.chain, 'catecash-devnet');
    assert.equal(data.utxos[0].value, '9007199254740993');
    assert.equal(data.utxos[0].coinbase, true);
    assert.equal(data.utxos.length, 1);
    const rejected = await fetch(base + '/broadcast', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ raw_hex: '00'.repeat(10), chain: 'catecash-devnet', genesis }) });
    assert.equal(rejected.status, 403);
    const preflight = await fetch(base + '/broadcast', { method: 'OPTIONS', headers: { origin: 'safari-web-extension://12345678-1234-1234-1234-123456789abc', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });
    assert.equal(preflight.status, 200);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'safari-web-extension://12345678-1234-1234-1234-123456789abc');
    const webPreflight = await fetch(base + '/broadcast', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } });
    assert.equal(webPreflight.status, 403);
    assert.equal(webPreflight.headers.get('access-control-allow-origin'), null);
    const broadcast = await fetch(base + '/broadcast', { method: 'POST', headers: { origin: 'chrome-extension://test', 'content-type': 'application/json' }, body: JSON.stringify({ raw_hex: '00'.repeat(10), chain: 'catecash-devnet', genesis }) });
    for (const origin of ['moz-extension://12345678-1234-1234-1234-123456789abc', 'safari-web-extension://12345678-1234-1234-1234-123456789abc']) {
      const accepted = await fetch(base + '/broadcast', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ raw_hex: '00'.repeat(10), chain: 'catecash-devnet', genesis }) });
      assert.equal(accepted.status, 200);
    }
    const spoofed = await fetch(base + '/broadcast', { method: 'POST', headers: { origin: 'chrome-extension://test.evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ raw_hex: '00'.repeat(10), chain: 'catecash-devnet', genesis }) });
    assert.equal(spoofed.status, 403);
    const submitted = await broadcast.json();
    assert.equal(submitted.txid, '03'.repeat(32));
    assert.equal(submitted.height, 300);
    assert.ok(methods.includes('sendrawtransaction'));
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('testnet gateway rejects a devnet node before serving wallet data', async () => {
  const rpc = async method => method === 'getblockchaininfo'
    ? { chain: 'catecash-devnet', blocks: 300 }
    : genesis;
  const server = createGateway({ rpc, network: 'testnet' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/status');
    assert.equal(response.status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('testnet gateway reports its own verified chain identity', async () => {
  const testnetGenesis = '15999c77e978a180c2f3fe2ec8478f8123e5c923f20bedaaf1b156fc38c4dda2';
  const rpc = async method => method === 'getblockchaininfo'
    ? { chain: 'catecash-testnet', blocks: 300 }
    : testnetGenesis;
  const server = createGateway({ rpc, network: 'testnet' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/status');
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.chain, 'catecash-testnet');
    assert.equal(data.genesis, testnetGenesis);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
