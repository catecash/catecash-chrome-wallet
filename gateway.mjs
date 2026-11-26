import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const NETWORKS = {
  devnet: { chain: 'catecash-devnet', genesis: '6b9c4d783359202111571c123309b2c0511d1bf9036f74dee4921f04e1f0a9cf', rpc: 'http://127.0.0.1:34342/' },
  testnet: { chain: 'catecash-testnet', genesis: '15999c77e978a180c2f3fe2ec8478f8123e5c923f20bedaaf1b156fc38c4dda2', rpc: 'http://127.0.0.1:34352/' },
  mainnet: { chain: 'catecash-mainnet', genesis: '050bf7476db81684aeb38337fc931bd8bc4480fde43fb0a14fef172f85c5c323', rpc: 'http://127.0.0.1:34332/' }
};
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{20,100}$/;
const HEX = /^[0-9a-fA-F]+$/;
const EXTENSION_ORIGIN = /^(?:chrome-extension|moz-extension|safari-web-extension):\/\/[a-zA-Z0-9-]+$/;

class RpcRejection extends Error {
  constructor(method, code, reason) {
    super(`Zebra RPC rejected ${method}: ${reason}`);
    this.method = method;
    this.code = code;
    this.reason = reason;
  }
}

export function createRpc({ url = 'http://127.0.0.1:34342/', cookieFile, user, password, fetchImpl = fetch }) {
  return async (method, params = []) => {
    let authorization;
    if (cookieFile) {
      const cookie = (await readFile(cookieFile, 'utf8')).trim();
      if (!/^[^:\s]+:.+$/.test(cookie)) throw new Error('Invalid Zebra RPC cookie.');
      authorization = 'Basic ' + Buffer.from(cookie).toString('base64');
    } else if (user && password) authorization = 'Basic ' + Buffer.from(`${user}:${password}`).toString('base64');
    const response = await fetchImpl(url, {
      method: 'POST', headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'cate-browser-gateway', method, params }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error(`Zebra RPC HTTP ${response.status}.`);
    const raw = await response.text();
    const body = JSON.parse(raw.replace(/"satoshis"\s*:\s*(\d+)/g, '"satoshis":"$1"'));
    if (body.error) {
      const code = Number.isInteger(body.error.code) ? body.error.code : null;
      const reason = String(body.error.message ?? 'Unknown RPC error.').slice(0, 500);
      throw new RpcRejection(method, code, reason);
    }
    return body.result;
  };
}

export function createGateway({ rpc, network = 'devnet' }) {
  const config = NETWORKS[network];
  if (!config) throw new Error('Choose a Catecash network.');
  async function verifiedTip() {
    const [info, genesis] = await Promise.all([rpc('getblockchaininfo'), rpc('getblockhash', [0])]);
    if (info?.chain !== config.chain || String(genesis).toLowerCase() !== config.genesis) throw new Error('Wrong Catecash chain or genesis.');
    if (!Number.isSafeInteger(info.blocks) || info.blocks < 1) throw new Error('Invalid chain height.');
    return info.blocks;
  }
  async function addressUtxos(address, height) {
    const data = await rpc('getaddressutxos', [{ addresses: [address] }]);
    if (!Array.isArray(data) || data.length > 10_000) throw new Error('Invalid UTXO response.');
    return data.map(item => {
      if (String(item.address) !== address || !/^[0-9a-fA-F]{64}$/.test(item.txid) ||
        !HEX.test(item.script) || !Number.isSafeInteger(item.outputIndex) || item.outputIndex < 0 ||
        !Number.isSafeInteger(item.height) || item.height > height ||
        !/^(0|[1-9]\d*)$/.test(String(item.satoshis))) throw new Error('Invalid UTXO data.');
      return { txid: item.txid, index: item.outputIndex, script_hex: item.script,
        value: String(item.satoshis), height: item.height, coinbase: false };
    });
  }
  async function classifyCoinbase(batch, transactions) {
    const txids = [...new Set(batch.map(utxo => utxo.txid))].filter(txid => !transactions.has(txid));
    for (let j = 0; j < txids.length; j += 10) {
      const results = await Promise.all(txids.slice(j, j + 10).map(async txid => {
        const tx = await rpc('getrawtransaction', [txid, 1]);
        return [txid, Boolean(tx?.vin?.[0]?.coinbase)];
      }));
      for (const pair of results) transactions.set(...pair);
    }
    for (const utxo of batch) utxo.coinbase = transactions.get(utxo.txid);
  }
  return createServer(async (request, response) => {
    const origin = String(request.headers.origin ?? '');
    const extensionOrigin = EXTENSION_ORIGIN.test(origin);
    if (extensionOrigin) {
      response.setHeader('access-control-allow-origin', origin);
      response.setHeader('vary', 'Origin');
    }
    const send = (code, data) => {
      response.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(JSON.stringify(data));
    };
    try {
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'OPTIONS' && url.pathname === '/broadcast') {
        if (!extensionOrigin) return send(403, { error: 'Browser extension origin required.' });
        response.setHeader('access-control-allow-methods', 'POST');
        response.setHeader('access-control-allow-headers', 'content-type');
        return send(200, { ok: true });
      }
      if (request.method === 'GET' && url.pathname === '/status') {
        return send(200, { chain: config.chain, genesis: config.genesis, height: await verifiedTip() });
      }
      if (request.method === 'GET' && url.pathname === '/shield-checkpoint') {
        const height = Math.max(1, (await verifiedTip()) - 10);
        const [hash, tree] = await Promise.all([
          rpc('getblockhash', [height]), rpc('z_gettreestate', [String(height)])
        ]);
        const treeState = tree?.ironwood?.commitments?.finalState;
        if (!/^[0-9a-fA-F]{64}$/.test(String(hash)) ||
          String(tree?.hash).toLowerCase() !== String(hash).toLowerCase() ||
          Number(tree?.height) !== height || typeof treeState !== 'string' ||
          treeState.length > 8192 || treeState.length % 2 || !HEX.test(treeState)) {
          throw new Error('Invalid Ironwood checkpoint.');
        }
        return send(200, { chain: config.chain, genesis: config.genesis, height,
          hash, tree_state_hex: treeState });
      }
      const match = url.pathname.match(/^\/utxos\/([^/]+)$/);
      if (request.method === 'GET' && match) {
        const address = decodeURIComponent(match[1]);
        if (!ADDRESS.test(address)) return send(400, { error: 'Invalid address.' });
        const height = await verifiedTip();
        const utxos = await addressUtxos(address, height);
        const confirmations = utxo => height - utxo.height + 1;
        const byValue = (a, b) => BigInt(a.value) > BigInt(b.value) ? -1 : BigInt(a.value) < BigInt(b.value) ? 1 : 0;
        const candidates = utxos.filter(utxo => confirmations(utxo) >= 10).sort(byValue);
        const transactions = new Map();
        const spendable = [];
        const mined = [];
        for (let i = 0; i < candidates.length && spendable.length < 20; i += 20) {
          const batch = candidates.slice(i, i + 20);
          await classifyCoinbase(batch, transactions);
          for (const utxo of batch) {
            if (!utxo.coinbase) spendable.push(utxo);
            else if (confirmations(utxo) >= 240) mined.push(utxo);
          }
        }
        const selected = spendable.length ? spendable.slice(0, 20) : mined.slice(0, 20);
        return send(200, { chain: config.chain, genesis: config.genesis, height, address, utxos: selected });
      }
      const shieldMatch = url.pathname.match(/^\/shield-setup\/([^/]+)$/);
      if (request.method === 'GET' && shieldMatch) {
        const address = decodeURIComponent(shieldMatch[1]);
        if (!ADDRESS.test(address)) return send(400, { error: 'Invalid address.' });
        const height = await verifiedTip();
        const utxos = await addressUtxos(address, height);
        const candidates = utxos.filter(utxo => height - utxo.height + 1 >= 240)
          .sort((a, b) => a.height - b.height || a.txid.localeCompare(b.txid) || a.index - b.index);
        const transactions = new Map();
        const rewards = [];
        for (let i = 0; i < candidates.length && rewards.length < 20; i += 20) {
          const batch = candidates.slice(i, i + 20);
          await classifyCoinbase(batch, transactions);
          rewards.push(...batch.filter(utxo => utxo.coinbase).slice(0, 20 - rewards.length));
        }
        const [hash, tree] = await Promise.all([
          rpc('getblockhash', [height]), rpc('z_gettreestate', [String(height)])
        ]);
        const treeState = tree?.ironwood?.commitments?.finalState;
        if (String(tree?.hash).toLowerCase() !== String(hash).toLowerCase() ||
          Number(tree?.height) !== height || typeof treeState !== 'string' ||
          treeState.length > 8192 || treeState.length % 2 || !HEX.test(treeState)) {
          throw new Error('Invalid Ironwood tree state.');
        }
        return send(200, { chain: config.chain, genesis: config.genesis, height, hash,
          address, tree_state_hex: treeState, rewards });
      }
      const blockMatch = url.pathname.match(/^\/shield-block\/(\d{1,10})$/);
      if (request.method === 'GET' && blockMatch) {
        const blockHeight = Number(blockMatch[1]);
        const tip = await verifiedTip();
        if (!Number.isSafeInteger(blockHeight) || blockHeight < 1 || blockHeight > tip) {
          return send(400, { error: 'Invalid block height.' });
        }
        const hash = await rpc('getblockhash', [blockHeight]);
        const [rawHex, tree] = await Promise.all([
          rpc('getblock', [hash, 0]), rpc('z_gettreestate', [String(blockHeight)])
        ]);
        const treeState = tree?.ironwood?.commitments?.finalState;
        if (!/^[0-9a-fA-F]{64}$/.test(String(hash)) || typeof rawHex !== 'string' ||
          rawHex.length < 160 || rawHex.length > 8_000_000 || rawHex.length % 2 || !HEX.test(rawHex) ||
          String(tree?.hash).toLowerCase() !== hash.toLowerCase() || Number(tree?.height) !== blockHeight ||
          typeof treeState !== 'string' || treeState.length > 8192 || treeState.length % 2 || !HEX.test(treeState)) {
          throw new Error('Invalid Ironwood scan block.');
        }
        return send(200, { chain: config.chain, genesis: config.genesis, height: blockHeight,
          hash, raw_hex: rawHex, tree_state_hex: treeState });
      }
      if (request.method === 'POST' && url.pathname === '/broadcast') {
        if (!extensionOrigin) return send(403, { error: 'Browser extension origin required.' });
        if (request.headers['content-type']?.split(';')[0] !== 'application/json') return send(415, { error: 'JSON required.' });
        let text = '';
        for await (const chunk of request) {
          text += chunk;
          if (text.length > 220_000) return send(413, { error: 'Transaction too large.' });
        }
        const body = JSON.parse(text);
        if (body?.chain !== config.chain || body?.genesis !== config.genesis) return send(409, { error: 'Wrong Catecash network.' });
        const raw = body.raw_hex;
        if (typeof raw !== 'string' || raw.length < 20 || raw.length > 200_000 || raw.length % 2 || !HEX.test(raw)) return send(400, { error: 'Invalid raw transaction.' });
        const height = await verifiedTip();
        const txid = await rpc('sendrawtransaction', [raw]);
        if (!/^[0-9a-fA-F]{64}$/.test(String(txid))) throw new Error('Invalid broadcast result.');
        return send(200, { chain: config.chain, genesis: config.genesis, height, txid });
      }
      return send(404, { error: 'Unknown route.' });
    } catch (error) {
      console.error('Catecash gateway request failed:', error?.message ?? error);
      if (error instanceof RpcRejection && error.method === 'sendrawtransaction') {
        return send(422, { error: 'Catecash node rejected the transaction.' });
      }
      return send(503, { error: 'Catecash gateway or node is unavailable.' });
    }
  });
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const network = process.env.CATE_GATEWAY_NETWORK ?? 'devnet';
  if (!NETWORKS[network]) throw new Error('Choose a Catecash network.');
  const rpc = createRpc({
    url: process.env.CATE_RPC_URL ?? NETWORKS[network].rpc,
    cookieFile: process.env.CATE_RPC_COOKIE_FILE,
    user: process.env.CATE_RPC_USER,
    password: process.env.CATE_RPC_PASSWORD
  });
  const gateway = createGateway({ rpc, network });
  const port = Number(process.env.CATE_GATEWAY_PORT ?? 34777);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid gateway port.');
  gateway.listen(port, '127.0.0.1', () => console.log(`Catecash ${network} gateway listening on 127.0.0.1:${port}`));
}
