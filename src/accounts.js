import { addressAndWif, newSecret } from './cate-address.mjs';
const secretPattern = /^[0-9a-f]{64}$/i;
export async function createAccounts() {
  const cate = newSecret();
  try { return { cateKey: Array.from(cate, b => b.toString(16).padStart(2, '0')).join('') }; }
  finally { cate.fill(0); }
}
export async function accountAddresses(secrets, network) {
  if (!secrets || !secretPattern.test(secrets.cateKey)) throw new Error('Wallet contains an invalid Catecash key.');
  const cate = Uint8Array.from(secrets.cateKey.match(/.{2}/g), byte => parseInt(byte, 16));
  try { return { cateAddress: (await addressAndWif(cate, network)).address }; }
  finally { cate.fill(0); }
}
export async function cateWif(secrets, network) {
  if (!secretPattern.test(secrets?.cateKey ?? '')) throw new Error('Wallet contains invalid Catecash key.');
  const cate = Uint8Array.from(secrets.cateKey.match(/.{2}/g), byte => parseInt(byte, 16));
  try { return (await addressAndWif(cate, network)).wif; }
  finally { cate.fill(0); }
}
