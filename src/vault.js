const encoder = new TextEncoder();
const decoder = new TextDecoder();
const ITERATIONS = 600_000;
const toBase64 = bytes => btoa(String.fromCharCode(...bytes));
const fromBase64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));

async function keyFor(password, salt) {
  const base = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptVault(secrets, password) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('Use a password of at least 12 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFor(password, salt);
  const payload = encoder.encode(JSON.stringify(secrets));
  try {
    const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload));
    return { format: 'catecash-chrome-wallet', version: 1, kdf: 'PBKDF2-SHA256', iterations: ITERATIONS, cipher: 'AES-256-GCM', salt: toBase64(salt), iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
  } finally { payload.fill(0); }
}

export async function decryptVault(vault, password) {
  if (!vault || vault.format !== 'catecash-chrome-wallet' || vault.version !== 1 || vault.kdf !== 'PBKDF2-SHA256' || vault.iterations !== ITERATIONS || vault.cipher !== 'AES-256-GCM') throw new Error('Unsupported wallet backup.');
  let salt, iv, ciphertext;
  try { salt = fromBase64(vault.salt); iv = fromBase64(vault.iv); ciphertext = fromBase64(vault.ciphertext); }
  catch { throw new Error('Wallet backup is damaged.'); }
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17) throw new Error('Wallet backup is damaged.');
  try {
    const key = await keyFor(password, salt);
    const plaintext = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext));
    try { return JSON.parse(decoder.decode(plaintext)); }
    finally { plaintext.fill(0); }
  } catch { throw new Error('Wrong password or damaged wallet backup.'); }
}
