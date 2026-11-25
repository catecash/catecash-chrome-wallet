import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const NETWORKS = {
  devnet: { chain: 'catecash-devnet', genesis: '6b9c4d783359202111571c123309b2c0511d1bf9036f74dee4921f04e1f0a9cf', rpc: 'http://127.0.0.1:34342/' },
  testnet: { chain: 'catecash-testnet', genesis: '15999c77e978a180c2f3fe2ec8478f8123e5c923f20bedaaf1b156fc38c4dda2', rpc: 'http://127.0.0.1:34352/' }
};
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{20,100}$/;
const HEX = /^[0-9a-fA-F]+$/;
const EXTENSION_ORIGIN = /^(?:chrome-extension|moz-extension|safari-web-extension):\/\/[a-zA-Z0-9-]+$/;

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
    if (body.error) throw new Error(`Zebra RPC rejected ${method}.`);
    return body.result;
  };
}

export function createGateway({ rpc, network = 'devnet' }) {
  const config = NETWORKS[network];
  if (!config) throw new Error('Choose Catecash devnet or testnet.');
  async function verifiedTip() {
    const [info, genesis] = await Promise.all([rpc('getblockchaininfo'), rpc('getblockhash', [0])]);
    if (info?.chain !== config.chain || String(genesis).toLowerCase() !== config.genesis) throw new Error('Wrong Catecash chain or genesis.');
    if (!Number.isSafeInteger(info.blocks) || info.blocks < 1) throw new Error('Invalid chain height.');
    return info.blocks;
  }
  return createServer(async (request, response) => {
    const send = (code, data) => {
      response.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      response.end(JSON.stringify(data));
    };
    try {
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'GET' && url.pathname === '/status') {
        return send(200, { chain: config.chain, genesis: config.genesis, height: await verifiedTip() });
      }
      const match = url.pathname.match(/^\/utxos\/([^/]+)$/);
      if (request.method === 'GET' && match) {
        const address = decodeURIComponent(match[1]);
        if (!ADDRESS.test(address)) return send(400, { error: 'Invalid address.' });
        const height = await verifiedTip();
        const data = await rpc('getaddressutxos', [{ addresses: [address] }]);
        if (!Array.isArray(data) || data.length > 100) throw new Error('Invalid UTXO response.');
        const utxos = data.map(item => {
          if (String(item.address) !== address || !/^[0-9a-fA-F]{64}$/.test(item.txid) ||
            !HEX.test(item.script) || !Number.isSafeInteger(item.outputIndex) || item.outputIndex < 0 ||
            !Number.isSafeInteger(item.height) || item.height > height ||
            !/^(0|[1-9]\d*)$/.test(String(item.satoshis))) throw new Error('Invalid UTXO data.');
          return { txid: item.txid, index: item.outputIndex, script_hex: item.script,
            value: String(item.satoshis), height: item.height, coinbase: false };
        });
        const uniqueTxids = [...new Set(utxos.map(item => item.txid))];
        const transactions = new Map();
        for (let i = 0; i < uniqueTxids.length; i += 10) {
          const batch = await Promise.all(uniqueTxids.slice(i, i + 10).map(async txid => {
            const tx = await rpc('getrawtransaction', [txid, 1]);
            return [txid, Boolean(tx?.vin?.[0]?.coinbase)];
          }));
          for (const pair of batch) transactions.set(...pair);
        }
        const mature = utxos.filter(utxo => {
          utxo.coinbase = transactions.get(utxo.txid);
          return height - utxo.height + 1 >= (utxo.coinbase ? 240 : 10);
        });
        mature.sort((a, b) => BigInt(a.value) > BigInt(b.value) ? -1 : BigInt(a.value) < BigInt(b.value) ? 1 : 0);
        const selected = mature.slice(0, 20);
        return send(200, { chain: config.chain, genesis: config.genesis, height, address, utxos: selected });
      }
      if (request.method === 'POST' && url.pathname === '/broadcast') {
        if (!EXTENSION_ORIGIN.test(String(request.headers.origin ?? ''))) return send(403, { error: 'Browser extension origin required.' });
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
    } catch {
      return send(503, { error: 'Catecash devnet gateway or node is unavailable.' });
    }
  });
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const network = process.env.CATE_GATEWAY_NETWORK ?? 'devnet';
  if (!NETWORKS[network]) throw new Error('Choose Catecash devnet or testnet.');
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
