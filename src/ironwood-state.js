const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keyName = network => `ironwoodScan_${network}`;

async function scanKey(seedHex, network) {
  if (!/^[0-9a-fA-F]{64}$/.test(seedHex ?? '')) throw new Error('Wallet has no valid Ironwood key.');
  const seed = Uint8Array.from(seedHex.match(/../g), item => parseInt(item, 16));
  try {
    const material = await crypto.subtle.importKey('raw', seed, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256',
      salt: encoder.encode('Catecash browser Ironwood scan state v1'),
      info: encoder.encode(network) }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  } finally { seed.fill(0); }
}

export async function saveScanState(seedHex, network, state) {
  const key = await scanKey(seedHex, network);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const clear = encoder.encode(JSON.stringify(state));
  try {
    const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
      additionalData: encoder.encode(keyName(network)) }, key, clear));
    await chrome.storage.local.set({ [keyName(network)]: {
      version: 1, iv: Array.from(iv), cipher: Array.from(cipher) } });
  } finally { clear.fill(0); }
}

export async function loadScanState(seedHex, network) {
  const record = (await chrome.storage.local.get(keyName(network)))[keyName(network)];
  if (!record) return null;
  if (record.version !== 1 || !Array.isArray(record.iv) || record.iv.length !== 12 ||
      !Array.isArray(record.cipher) || record.cipher.length < 17) throw new Error('Saved Ironwood scan is damaged.');
  const key = await scanKey(seedHex, network);
  let clear;
  try {
    clear = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM',
      iv: Uint8Array.from(record.iv), additionalData: encoder.encode(keyName(network)) },
      key, Uint8Array.from(record.cipher)));
    const state = JSON.parse(decoder.decode(clear));
    if (!Number.isSafeInteger(state.height) || !/^[0-9a-fA-F]{64}$/.test(state.hash) ||
        typeof state.tree_hex !== 'string' || !Array.isArray(state.notes) ||
        !/^(0|[1-9]\d*)$/.test(state.balance)) throw new Error('Saved Ironwood scan is damaged.');
    return state;
  } catch { throw new Error('Cannot open saved Ironwood scan. Restore the wallet backup and rescan.'); }
  finally { clear?.fill(0); }
}
