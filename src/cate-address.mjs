import { publicKeyFromSecret, hash160, validSecret } from './cate-keylib.mjs';

export const networks = Object.freeze({
  devnet: { name: 'DEVNET', address: [0x1f, 0xc0], wif: 0xf0, notice: 'Development network · provisional address format' },
  testnet: { name: 'TESTNET', address: [0x07, 0x84], wif: 0xd3, notice: 'Test network · private rehearsal format' },
  mainnet: { name: 'MAINNET CANDIDATE', address: [0x06, 0x84], wif: 0xd2, notice: 'Mainnet candidate · no public launch verified' },
});

const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let result = '';
  while (value > 0n) {
    result = alphabet[Number(value % 58n)] + result;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    result = `1${result}`;
  }
  return result;
}

async function sha256(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}

async function base58Check(payload) {
  const first = await sha256(payload);
  const second = await sha256(first);
  first.fill(0);
  const checked = new Uint8Array(payload.length + 4);
  checked.set(payload);
  checked.set(second.subarray(0, 4), payload.length);
  const result = base58(checked);
  checked.fill(0);
  second.fill(0);
  return result;
}

export async function addressAndWif(secret, networkId) {
  const network = networks[networkId];
  if (!network || !validSecret(secret)) throw new Error('Invalid network or private key');
  const publicKey = publicKeyFromSecret(secret);
  const publicHash = hash160(await sha256(publicKey));
  const addressPayload = new Uint8Array(22);
  addressPayload.set(network.address);
  addressPayload.set(publicHash, 2);
  const address = await base58Check(addressPayload);
  const wifPayload = new Uint8Array(34);
  wifPayload[0] = network.wif;
  wifPayload.set(secret, 1);
  wifPayload[33] = 1;
  const wif = await base58Check(wifPayload);
  wifPayload.fill(0);
  addressPayload.fill(0);
  publicHash.fill(0);
  publicKey.fill(0);
  return { address, wif };
}

export function newSecret() {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto?.subtle) {
    throw new Error('Secure browser cryptography unavailable');
  }
  let secret;
  do {
    secret = crypto.getRandomValues(new Uint8Array(32));
  } while (!validSecret(secret));
  return secret;
}
