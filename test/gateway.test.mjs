import test from 'node:test';
import assert from 'node:assert/strict';
import { createGateway, createRpc } from '../gateway.mjs';
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

test('mainnet gateway verifies the candidate genesis before serving wallet data', async () => {
  const mainnetGenesis = '050bf7476db81684aeb38337fc931bd8bc4480fde43fb0a14fef172f85c5c323';
  let genesis = mainnetGenesis;
  const rpc = async method => method === 'getblockchaininfo'
    ? { chain: 'catecash-mainnet', blocks: 300 }
    : genesis;
  const server = createGateway({ rpc, network: 'mainnet' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const response = await fetch(base + '/status');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).genesis, mainnetGenesis);
    genesis = '00'.repeat(32);
    assert.equal((await fetch(base + '/status')).status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('mainnet gateway selects mature coins from addresses with over 100 UTXOs', async () => {
  const mainnetGenesis = '050bf7476db81684aeb38337fc931bd8bc4480fde43fb0a14fef172f85c5c323';
  const publicAddress = 'CaW9SGDziC187NEtCixMYktjYDyQG5HLvnr';
  let transactionLookups = 0;
  const rpc = async method => {
    if (method === 'getblockchaininfo') return { chain: 'catecash-mainnet', blocks: 600 };
    if (method === 'getblockhash') return mainnetGenesis;
    if (method === 'getaddressutxos') return Array.from({ length: 150 }, (_, index) => ({
      address: publicAddress, txid: index.toString(16).padStart(64, '0'), outputIndex: 0,
      script: '76a914' + '11'.repeat(20) + '88ac', satoshis: String(1000 + index), height: 1,
    }));
    if (method === 'getrawtransaction') { transactionLookups++; return { vin: [{ coinbase: 'abcd' }] }; }
    throw new Error('Unexpected RPC method.');
  };
  const server = createGateway({ rpc, network: 'mainnet' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/utxos/' + publicAddress);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.utxos.length, 20);
    assert.ok(data.utxos.every(utxo => utxo.coinbase));
    assert.equal(transactionLookups, 150);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('mainnet gateway finds an ordinary UTXO behind many mining rewards', async () => {
  const publicAddress = 'CaW9SGDziC187NEtCixMYktjYDyQG5HLvnr';
  const ordinaryTxid = 'ff'.repeat(32);
  const rpc = async (method, params) => {
    if (method === 'getblockchaininfo') return { chain: 'catecash-mainnet', blocks: 600 };
    if (method === 'getblockhash') return '050bf7476db81684aeb38337fc931bd8bc4480fde43fb0a14fef172f85c5c323';
    if (method === 'getaddressutxos') return [
      ...Array.from({ length: 150 }, (_, index) => ({
        address: publicAddress, txid: index.toString(16).padStart(64, '0'), outputIndex: 0,
        script: '76a914' + '11'.repeat(20) + '88ac', satoshis: '100000000', height: 1,
      })),
      { address: publicAddress, txid: ordinaryTxid, outputIndex: 0,
        script: '76a914' + '11'.repeat(20) + '88ac', satoshis: '50000000', height: 580 },
    ];
    if (method === 'getrawtransaction') return { vin: [params[0] === ordinaryTxid ? { txid: 'aa' } : { coinbase: 'abcd' }] };
    throw new Error('Unexpected RPC method.');
  };
  const server = createGateway({ rpc, network: 'mainnet' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/utxos/' + publicAddress);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.utxos.map(utxo => [utxo.txid, utxo.coinbase]), [[ordinaryTxid, false]]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('shield setup returns mature coinbase rewards and the matching Ironwood tree', async () => {
  const publicAddress = 'CaW9SGDziC187NEtCixMYktjYDyQG5HLvnr';
  const hash = 'ab'.repeat(32);
  const rewardTxid = '01'.repeat(32);
  const ordinaryTxid = '02'.repeat(32);
  const rpc = async (method, params) => {
    if (method === 'getblockchaininfo') return { chain: 'catecash-mainnet', blocks: 300 };
    if (method === 'getblockhash') return params[0] === 0
      ? '050bf7476db81684aeb38337fc931bd8bc4480fde43fb0a14fef172f85c5c323' : hash;
    if (method === 'getaddressutxos') return [
      { address: publicAddress, txid: ordinaryTxid, outputIndex: 0,
        script: '76a914' + '11'.repeat(20) + '88ac', satoshis: '100000000', height: 1 },
      { address: publicAddress, txid: rewardTxid, outputIndex: 0,
        script: '76a914' + '11'.repeat(20) + '88ac', satoshis: '500000000000', height: 1 },
    ];
    if (method === 'getrawtransaction') return { vin: [params[0] === rewardTxid ? { coinbase: 'abcd' } : { txid: 'ff' }] };
    if (method === 'z_gettreestate') return { hash, height: 300, ironwood: { commitments: { finalState: '000000' } } };
    throw new Error('Unexpected RPC method.');
  };
  const server = createGateway({ rpc, network: 'mainnet' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/shield-setup/' + publicAddress);
    assert.equal(response.status, 200);
    const setup = await response.json();
    assert.equal(setup.tree_state_hex, '000000');
    assert.deepEqual(setup.rewards.map(reward => reward.txid), [rewardTxid]);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('Ironwood checkpoint and scan block are bound to the verified chain', async () => {
  const hash = 'ab'.repeat(32), parent = 'cd'.repeat(32);
  const rpc = async (method, params) => {
    if (method === 'getblockchaininfo') return { chain: 'catecash-devnet', blocks: 300 };
    if (method === 'getblockhash') return params[0] === 0 ? genesis : params[0] === 290 ? parent : hash;
    if (method === 'z_gettreestate') return { hash: params[0] === '290' ? parent : hash,
      height: Number(params[0]), ironwood: { commitments: { finalState: '000000' } } };
    if (method === 'getblock') return '00'.repeat(100);
    throw new Error('Unexpected RPC method.');
  };
  const server = createGateway({ rpc });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const checkpoint = await (await fetch(base + '/shield-checkpoint')).json();
    assert.equal(checkpoint.height, 290);
    assert.equal(checkpoint.hash, parent);
    const block = await (await fetch(base + '/shield-block/300')).json();
    assert.equal(block.height, 300);
    assert.equal(block.hash, hash);
    assert.equal(block.raw_hex, '00'.repeat(100));
    assert.equal((await fetch(base + '/shield-block/301')).status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('a rejected signed transaction returns 422 while the gateway stays healthy', async () => {
  const rpc = createRpc({ fetchImpl: async (_url, request) => {
    const { method } = JSON.parse(request.body);
    const result = method === 'getblockchaininfo' ? { chain: 'catecash-mainnet', blocks: 300 }
      : method === 'getblockhash' ? '050bf7476db81684aeb38337fc931bd8bc4480fde43fb0a14fef172f85c5c323' : null;
    return { ok: true, text: async () => JSON.stringify(method === 'sendrawtransaction'
      ? { error: { code: -26, message: 'unshielded transparent coinbase spend' } }
      : { result }) };
  } });
  const server = createGateway({ rpc, network: 'mainnet' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const response = await fetch(base + '/broadcast', { method: 'POST',
      headers: { origin: 'chrome-extension://test', 'content-type': 'application/json' },
      body: JSON.stringify({ raw_hex: '00'.repeat(10), chain: 'catecash-mainnet',
        genesis: '050bf7476db81684aeb38337fc931bd8bc4480fde43fb0a14fef172f85c5c323' }) });
    assert.equal(response.status, 422);
    assert.equal((await response.json()).error, 'Catecash node rejected the transaction.');
    assert.equal((await fetch(base + '/status')).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
