export const CATE_NETWORKS = Object.freeze({
  mainnet: { label: 'Mainnet candidate', chain: 'catecash-mainnet', genesis: '050bf7476db81684aeb38337fc931bd8bc4480fde43fb0a14fef172f85c5c323', explorer: 'https://scan.catecash.com' },
  testnet: { label: 'Testnet', chain: 'catecash-testnet', genesis: '15999c77e978a180c2f3fe2ec8478f8123e5c923f20bedaaf1b156fc38c4dda2', explorer: 'https://scan-testnet.catecash.com' },
  devnet: { label: 'Devnet', chain: 'catecash-devnet', genesis: '6b9c4d783359202111571c123309b2c0511d1bf9036f74dee4921f04e1f0a9cf', explorer: 'https://scan-devnet.catecash.com' }
});
export function formatUnits(raw, places) {
  if (!/^(0|[1-9]\d*)$/.test(String(raw))) throw new Error('Invalid balance from network.');
  const value = BigInt(raw);
  const divisor = 10n ** BigInt(places);
  const whole = value / divisor;
  const fraction = String(value % divisor).padStart(places, '0').replace(/0+$/, '');
  return `${whole}${fraction ? '.' + fraction : ''}`;
}
export async function cateBalance(networkId, address, fetchImpl = fetch) {
  const network = CATE_NETWORKS[networkId];
  if (!network) throw new Error('Unknown Catecash network.');
  const statusResponse = await fetchImpl(network.explorer + '/api/status', { cache: 'no-store' });
  if (!statusResponse.ok) throw new Error('Catecash explorer is unavailable.');
  const status = await statusResponse.json();
  if (status.chain !== network.chain || status.genesisHash?.toLowerCase() !== network.genesis) throw new Error('Catecash explorer network identity does not match.');
  const response = await fetchImpl(network.explorer + '/api/address/' + encodeURIComponent(address), { cache: 'no-store' });
  if (!response.ok) throw new Error('Catecash balance is unavailable.');
  const data = await response.json();
  if (data.address !== address || data.unit !== 'catemoto' || !/^(0|[1-9]\d*)$/.test(String(data.balance))) throw new Error('Catecash explorer returned invalid balance data.');
  return data.balance;
}
