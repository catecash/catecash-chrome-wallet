import { createSigner } from './cate-signer.js';
import { shieldBlock } from './cate-gateway.js';

let signerPromise;
function signer(url) {
  signerPromise ??= fetch(url).then(async response => {
    if (!response.ok) throw new Error('Ironwood engine is missing.');
    return createSigner(await response.arrayBuffer());
  });
  return signerPromise;
}

self.onmessage = async ({ data }) => {
  const { id, operation, request, wasmUrl } = data;
  try {
    const engine = await signer(wasmUrl);
    let result;
    if (operation === 'address') result = engine.shieldAddress(request);
    else if (operation === 'shield') result = engine.shield(request);
    else if (operation === 'send') result = engine.shieldedSend(request);
    else if (operation === 'scan') {
      const { network, shield_seed_hex: seed, state, targetHeight, maxBlocks = 25 } = request;
      if (!state || !Number.isSafeInteger(targetHeight) || maxBlocks < 1 || maxBlocks > 50) throw new Error('Invalid scan request.');
      result = state;
      const end = Math.min(targetHeight, state.height + maxBlocks);
      for (let height = state.height + 1; height <= end; height++) {
        const block = await shieldBlock(network, height);
        result = engine.scanIronwood({ network, shield_seed_hex: seed,
          previous_height: result.height, previous_hash: result.hash,
          previous_tree_hex: result.tree_hex, notes: result.notes,
          block_hex: block.raw_hex, block_hash: block.hash,
          expected_tree_hex: block.tree_state_hex });
        self.postMessage({ id, progress: { height, targetHeight } });
      }
    } else throw new Error('Unknown Ironwood operation.');
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: error?.message || 'Ironwood operation failed.' });
  }
};
