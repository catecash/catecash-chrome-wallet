const encoder = new TextEncoder();
const decoder = new TextDecoder();
let signerPromise;

export async function createSigner(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const { memory, alloc, dealloc, sign_json: signJson } = instance.exports;
  return request => {
    if (!['devnet', 'testnet'].includes(request?.network)) throw new Error('CATE sending supports devnet and testnet.');
    const input = encoder.encode(JSON.stringify({
      ...request,
      entropy_hex: Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('')
    }));
    const inputLength = input.length;
    const pointer = alloc(inputLength);
    if (!pointer) throw new Error('Catecash signer could not allocate memory.');
    new Uint8Array(memory.buffer, pointer, inputLength).set(input);
    input.fill(0);
    let resultPointer;
    try {
      resultPointer = signJson(pointer, inputLength);
      if (!resultPointer) throw new Error('Catecash signer rejected the request.');
      const view = new DataView(memory.buffer);
      const size = view.getUint32(resultPointer, true);
      if (size > 500_000) throw new Error('Catecash signer returned an oversized result.');
      const response = JSON.parse(decoder.decode(new Uint8Array(memory.buffer, resultPointer + 4, size)));
      if (response.error) throw new Error(response.error);
      if (!response.ok?.raw_hex) throw new Error('Catecash signer returned no transaction.');
      return response.ok;
    } finally {
      dealloc(pointer, inputLength);
      if (resultPointer) {
        const size = new DataView(memory.buffer).getUint32(resultPointer, true);
        if (size <= 500_000) dealloc(resultPointer, size + 4);
      }
    }
  };
}

export async function loadSigner() {
  signerPromise ??= fetch(chrome.runtime.getURL('catecash_browser_engine.wasm'))
    .then(async response => {
      if (!response.ok) throw new Error('Catecash signer module is missing.');
      return createSigner(await response.arrayBuffer());
    });
  return signerPromise;
}
