let activeWorkers = new Map();
let nextId = 0;

export function stopIronwoodWork() {
  for (const [worker, reject] of activeWorkers) { worker.terminate(); reject(new Error('Ironwood work stopped.')); }
  activeWorkers.clear();
}

export function runIronwood(operation, request, onProgress) {
  const worker = new Worker(chrome.runtime.getURL('ironwood-worker.js'));
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    activeWorkers.set(worker, reject);
    worker.onmessage = ({ data }) => {
      if (data.id !== id) return;
      if (data.progress) { onProgress?.(data.progress); return; }
      activeWorkers.delete(worker); worker.terminate();
      if (data.error) reject(new Error(data.error)); else resolve(data.result);
    };
    worker.onerror = () => { activeWorkers.delete(worker); worker.terminate(); reject(new Error('Ironwood worker failed.')); };
    worker.postMessage({ id, operation, request, wasmUrl: chrome.runtime.getURL('catecash_browser_engine.wasm') });
  });
}
