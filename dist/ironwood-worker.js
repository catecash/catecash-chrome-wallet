(() => {
  // src/cate-signer.js
  var encoder = new TextEncoder();
  var decoder = new TextDecoder();
  async function createSigner(bytes) {
    const { instance } = await WebAssembly.instantiate(bytes, {});
    const {
      memory,
      alloc,
      dealloc,
      sign_json: signJson,
      shield_json: shieldJson,
      shield_address_json: shieldAddressJson,
      scan_ironwood_json: scanIronwoodJson,
      shielded_send_json: shieldedSendJson
    } = instance.exports;
    const invoke = (operation, request, needsEntropy, expectsTransaction, maxResult = 5e5) => {
      if (!["devnet", "testnet", "mainnet"].includes(request?.network)) throw new Error("Unknown Catecash network.");
      const input = encoder.encode(JSON.stringify({
        ...request,
        ...needsEntropy ? { entropy_hex: Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("") } : {}
      }));
      const inputLength = input.length;
      const pointer = alloc(inputLength);
      if (!pointer) throw new Error("Catecash signer could not allocate memory.");
      new Uint8Array(memory.buffer, pointer, inputLength).set(input);
      input.fill(0);
      let resultPointer;
      try {
        resultPointer = operation(pointer, inputLength);
        if (!resultPointer) throw new Error("Catecash signer rejected the request.");
        const view = new DataView(memory.buffer);
        const size = view.getUint32(resultPointer, true);
        if (size > maxResult) throw new Error("Catecash signer returned an oversized result.");
        const response = JSON.parse(decoder.decode(new Uint8Array(memory.buffer, resultPointer + 4, size)));
        if (response.error) throw new Error(response.error);
        if (!response.ok || expectsTransaction && !response.ok.raw_hex) throw new Error("Catecash signer returned no result.");
        return response.ok;
      } finally {
        dealloc(pointer, inputLength);
        if (resultPointer) {
          const size = new DataView(memory.buffer).getUint32(resultPointer, true);
          if (size <= 16e6) dealloc(resultPointer, size + 4);
        }
      }
    };
    const sign = (request) => invoke(signJson, request, true, true);
    sign.shield = (request) => invoke(shieldJson, request, true, true);
    sign.shieldAddress = (request) => invoke(shieldAddressJson, request, false, false).address;
    sign.scanIronwood = (request) => invoke(scanIronwoodJson, request, false, false, 16e6);
    sign.shieldedSend = (request) => invoke(shieldedSendJson, request, true, true);
    return sign;
  }

  // src/networks.js
  var CATE_NETWORKS = Object.freeze({
    mainnet: { label: "Mainnet candidate", chain: "catecash-mainnet", genesis: "050bf7476db81684aeb38337fc931bd8bc4480fde43fb0a14fef172f85c5c323", explorer: "https://scan.catecash.com" },
    testnet: { label: "Testnet", chain: "catecash-testnet", genesis: "15999c77e978a180c2f3fe2ec8478f8123e5c923f20bedaaf1b156fc38c4dda2", explorer: "https://scan-testnet.catecash.com" },
    devnet: { label: "Devnet", chain: "catecash-devnet", genesis: "6b9c4d783359202111571c123309b2c0511d1bf9036f74dee4921f04e1f0a9cf", explorer: "https://scan-devnet.catecash.com" }
  });

  // src/cate-gateway.js
  var URLS = {
    devnet: "http://127.0.0.1:34777",
    testnet: "https://plugin-wallet-test.catecash.com",
    mainnet: "https://wallet.catecash.com"
  };
  function gatewayUrl(network) {
    const url = URLS[network];
    if (!url) throw new Error("Unknown Catecash network.");
    return url;
  }
  function assertNetwork(data, network) {
    const expected = CATE_NETWORKS[network];
    if (!expected) throw new Error("Unknown Catecash network.");
    if (data?.chain !== expected.chain || data?.genesis !== expected.genesis || !Number.isSafeInteger(data.height)) throw new Error("Gateway has the wrong Catecash chain.");
    return data;
  }
  async function json(response) {
    if (!response.ok) {
      if (response.status === 422) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Catecash node rejected the transaction.");
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
        if (attempt === 2) throw new Error("Cannot reach the Catecash gateway. Try again shortly.", { cause: error });
      }
      if (response?.ok) return response.json();
      if (response && (![502, 503, 504].includes(response.status) || attempt === 2)) return json(response);
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  async function shieldBlock(network, height) {
    if (!Number.isSafeInteger(height) || height < 1) throw new Error("Invalid scan height.");
    const data = assertNetwork(await readJson(gatewayUrl(network) + "/shield-block/" + height), network);
    if (data.height !== height || !/^[0-9a-fA-F]{64}$/.test(data.hash) || typeof data.raw_hex !== "string" || !/^[0-9a-fA-F]+$/.test(data.raw_hex) || typeof data.tree_state_hex !== "string" || !/^[0-9a-fA-F]+$/.test(data.tree_state_hex)) {
      throw new Error("Gateway returned invalid Ironwood block.");
    }
    return data;
  }

  // src/ironwood-worker.js
  var signerPromise;
  function signer(url) {
    signerPromise ??= fetch(url).then(async (response) => {
      if (!response.ok) throw new Error("Ironwood engine is missing.");
      return createSigner(await response.arrayBuffer());
    });
    return signerPromise;
  }
  self.onmessage = async ({ data }) => {
    const { id, operation, request, wasmUrl } = data;
    try {
      const engine = await signer(wasmUrl);
      let result;
      if (operation === "address") result = engine.shieldAddress(request);
      else if (operation === "shield") result = engine.shield(request);
      else if (operation === "send") result = engine.shieldedSend(request);
      else if (operation === "scan") {
        const { network, shield_seed_hex: seed, state, targetHeight, maxBlocks = 25 } = request;
        if (!state || !Number.isSafeInteger(targetHeight) || maxBlocks < 1 || maxBlocks > 50) throw new Error("Invalid scan request.");
        result = state;
        const end = Math.min(targetHeight, state.height + maxBlocks);
        for (let height = state.height + 1; height <= end; height++) {
          const block = await shieldBlock(network, height);
          result = engine.scanIronwood({
            network,
            shield_seed_hex: seed,
            previous_height: result.height,
            previous_hash: result.hash,
            previous_tree_hex: result.tree_hex,
            notes: result.notes,
            block_hex: block.raw_hex,
            block_hash: block.hash,
            expected_tree_hex: block.tree_state_hex
          });
          self.postMessage({ id, progress: { height, targetHeight } });
        }
      } else throw new Error("Unknown Ironwood operation.");
      self.postMessage({ id, result });
    } catch (error) {
      self.postMessage({ id, error: error?.message || "Ironwood operation failed." });
    }
  };
})();
