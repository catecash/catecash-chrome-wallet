const encoder = new TextEncoder();
const decoder = new TextDecoder();
let signerPromise;

export async function createSigner(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const { memory, alloc, dealloc, sign_json: signJson, shield_json: shieldJson,
    shield_address_json: shieldAddressJson, scan_ironwood_json: scanIronwoodJson,
    shielded_send_json: shieldedSendJson } = instance.exports;
  const invoke = (operation, request, needsEntropy, expectsTransaction, maxResult = 500_000) => {
    if (!['devnet', 'testnet', 'mainnet'].includes(request?.network)) throw new Error('Unknown Catecash network.');
    const input = encoder.encode(JSON.stringify({
      ...request,
      ...(needsEntropy ? { entropy_hex: Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('') } : {})
    }));
    const inputLength = input.length;
    const pointer = alloc(inputLength);
    if (!pointer) throw new Error('Catecash signer could not allocate memory.');
    new Uint8Array(memory.buffer, pointer, inputLength).set(input);
    input.fill(0);
    let resultPointer;
    try {
      resultPointer = operation(pointer, inputLength);
      if (!resultPointer) throw new Error('Catecash signer rejected the request.');
      const view = new DataView(memory.buffer);
      const size = view.getUint32(resultPointer, true);
      if (size > maxResult) throw new Error('Catecash signer returned an oversized result.');
      const response = JSON.parse(decoder.decode(new Uint8Array(memory.buffer, resultPointer + 4, size)));
      if (response.error) throw new Error(response.error);
      if (!response.ok || (expectsTransaction && !response.ok.raw_hex)) throw new Error('Catecash signer returned no result.');
      return response.ok;
    } finally {
      dealloc(pointer, inputLength);
      if (resultPointer) {
        const size = new DataView(memory.buffer).getUint32(resultPointer, true);
      if (size <= 16_000_000) dealloc(resultPointer, size + 4);
      }
    }
  };
  const sign = request => invoke(signJson, request, true, true);
  sign.shield = request => invoke(shieldJson, request, true, true);
  sign.shieldAddress = request => invoke(shieldAddressJson, request, false, false).address;
  sign.scanIronwood = request => invoke(scanIronwoodJson, request, false, false, 16_000_000);
  sign.shieldedSend = request => invoke(shieldedSendJson, request, true, true);
  return sign;
}

export async function loadSigner() {
  signerPromise ??= fetch(chrome.runtime.getURL('catecash_browser_engine.wasm'))
    .then(async response => {
      if (!response.ok) throw new Error('Catecash signer module is missing.');
      return createSigner(await response.arrayBuffer());
    });
  return signerPromise;
}
