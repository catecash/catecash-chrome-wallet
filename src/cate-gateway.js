import { CATE_NETWORKS } from './networks.js';
const URLS = {
  devnet: 'http://127.0.0.1:34777',
  testnet: 'https://plugin-wallet-test.catecash.com'
};
function gatewayUrl(network) {
  const url = URLS[network];
  if (!url) throw new Error('CATE sending supports devnet and testnet.');
  return url;
}
function assertNetwork(data, network) {
  const expected = CATE_NETWORKS[network];
  if (!['devnet', 'testnet'].includes(network)) throw new Error('CATE sending supports devnet and testnet.');
  if (data?.chain !== expected.chain || data?.genesis !== expected.genesis || !Number.isSafeInteger(data.height)) throw new Error('Gateway has the wrong Catecash chain.');
  return data;
}
async function json(response) {
  if (!response.ok) throw new Error('Catecash gateway is unavailable.');
  return response.json();
}
export async function spendableUtxos(network, address) {
  const url = gatewayUrl(network);
  const [status, data] = await Promise.all([
    fetch(url + '/status').then(json),
    fetch(url + '/utxos/' + encodeURIComponent(address)).then(json)
  ]);
  assertNetwork(status, network); assertNetwork(data, network);
  if (data.address !== address || !Array.isArray(data.utxos) || Math.abs(status.height - data.height) > 2) throw new Error('Gateway returned inconsistent UTXOs.');
  return data;
}
export async function broadcastCate(network, rawHex) {
  const url = gatewayUrl(network);
  const expected = CATE_NETWORKS[network];
  if (!['devnet', 'testnet'].includes(network)) throw new Error('CATE sending supports devnet and testnet.');
  const result = await json(await fetch(url + '/broadcast', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ raw_hex: rawHex, chain: expected.chain, genesis: expected.genesis })
  }));
  assertNetwork(result, network);
  if (!/^[0-9a-fA-F]{64}$/.test(result.txid)) throw new Error('Gateway returned an invalid transaction ID.');
  return result.txid;
}
