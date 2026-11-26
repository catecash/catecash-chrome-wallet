import { CATE_NETWORKS } from './networks.js';
const URLS = {
  devnet: 'http://127.0.0.1:34777',
  testnet: 'https://plugin-wallet-test.catecash.com',
  mainnet: 'https://wallet.catecash.com'
};
function gatewayUrl(network) {
  const url = URLS[network];
  if (!url) throw new Error('Unknown Catecash network.');
  return url;
}
function assertNetwork(data, network) {
  const expected = CATE_NETWORKS[network];
  if (!expected) throw new Error('Unknown Catecash network.');
  if (data?.chain !== expected.chain || data?.genesis !== expected.genesis || !Number.isSafeInteger(data.height)) throw new Error('Gateway has the wrong Catecash chain.');
  return data;
}
async function json(response) {
  if (!response.ok) {
    if (response.status === 422) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error ?? 'Catecash node rejected the transaction.');
    }
    throw new Error(`Catecash gateway returned HTTP ${response.status}.`);
  }
  return response.json();
}
async function readJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetch(url);
    } catch (error) {
      if (attempt === 2) throw new Error('Cannot reach the Catecash gateway. Try again shortly.', { cause: error });
    }
    if (response?.ok) return response.json();
    if (response && (![502, 503, 504].includes(response.status) || attempt === 2)) return json(response);
    await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
  }
}
export async function spendableUtxos(network, address) {
  const url = gatewayUrl(network);
  const [status, data] = await Promise.all([
    readJson(url + '/status'),
    readJson(url + '/utxos/' + encodeURIComponent(address))
  ]);
  assertNetwork(status, network); assertNetwork(data, network);
  if (data.address !== address || !Array.isArray(data.utxos) || Math.abs(status.height - data.height) > 2) throw new Error('Gateway returned inconsistent UTXOs.');
  const spendable = data.utxos.filter(utxo => !utxo.coinbase);
  if (data.utxos.length > 0 && spendable.length === 0) {
    throw new Error('These funds are mined rewards. Catecash requires them to be shielded before a transparent send.');
  }
  return { ...data, utxos: spendable };
}
export async function shieldSetup(network, address) {
  const data = assertNetwork(await readJson(gatewayUrl(network) + '/shield-setup/' + encodeURIComponent(address)), network);
  if (data.address !== address || !/^[0-9a-fA-F]{64}$/.test(data.hash) ||
      typeof data.tree_state_hex !== 'string' || !/^[0-9a-fA-F]+$/.test(data.tree_state_hex) ||
      !Array.isArray(data.rewards) || data.rewards.length > 20) throw new Error('Gateway returned invalid shield setup.');
  return data;
}
export async function shieldCheckpoint(network) {
  const data = assertNetwork(await readJson(gatewayUrl(network) + '/shield-checkpoint'), network);
  if (!/^[0-9a-fA-F]{64}$/.test(data.hash) || typeof data.tree_state_hex !== 'string' ||
      !/^[0-9a-fA-F]+$/.test(data.tree_state_hex)) throw new Error('Gateway returned invalid Ironwood checkpoint.');
  return { height: data.height, hash: data.hash, tree_hex: data.tree_state_hex, notes: [], balance: '0' };
}
export async function gatewayStatus(network) {
  return assertNetwork(await readJson(gatewayUrl(network) + '/status'), network);
}
export async function shieldBlock(network, height) {
  if (!Number.isSafeInteger(height) || height < 1) throw new Error('Invalid scan height.');
  const data = assertNetwork(await readJson(gatewayUrl(network) + '/shield-block/' + height), network);
  if (data.height !== height || !/^[0-9a-fA-F]{64}$/.test(data.hash) ||
      typeof data.raw_hex !== 'string' || !/^[0-9a-fA-F]+$/.test(data.raw_hex) ||
      typeof data.tree_state_hex !== 'string' || !/^[0-9a-fA-F]+$/.test(data.tree_state_hex)) {
    throw new Error('Gateway returned invalid Ironwood block.');
  }
  return data;
}
export async function broadcastCate(network, rawHex) {
  const url = gatewayUrl(network);
  const expected = CATE_NETWORKS[network];
  if (!expected) throw new Error('Unknown Catecash network.');
  const result = await json(await fetch(url + '/broadcast', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ raw_hex: rawHex, chain: expected.chain, genesis: expected.genesis })
  }));
  assertNetwork(result, network);
  if (!/^[0-9a-fA-F]{64}$/.test(result.txid)) throw new Error('Gateway returned an invalid transaction ID.');
  return result.txid;
}
