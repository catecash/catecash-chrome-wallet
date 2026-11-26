import { addressAndWif, newSecret } from './cate-address.mjs';
const secretPattern = /^[0-9a-f]{64}$/i;
export async function createAccounts() {
  const cate = newSecret();
  const shield = crypto.getRandomValues(new Uint8Array(32));
  try { return { cateKey: Array.from(cate, b => b.toString(16).padStart(2, '0')).join(''),
    shieldSeed: Array.from(shield, b => b.toString(16).padStart(2, '0')).join('') }; }
  finally { cate.fill(0); shield.fill(0); }
}
export function withShieldAccount(secrets) {
  if (!secrets || !secretPattern.test(secrets.cateKey)) throw new Error('Wallet contains an invalid Catecash key.');
  if (secretPattern.test(secrets.shieldSeed ?? '')) return { secrets, upgraded: false };
  if (secrets.shieldSeed != null) throw new Error('Wallet contains an invalid Ironwood key.');
  const seed = crypto.getRandomValues(new Uint8Array(32));
  try { return { secrets: { ...secrets, shieldSeed: Array.from(seed, b => b.toString(16).padStart(2, '0')).join('') }, upgraded: true }; }
  finally { seed.fill(0); }
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
