# Catecash Chrome Wallet (alpha)

For repository SSH setup, push checks, and required post-push reporting, see [GitHub push requirements](docs/GITHUB-PUSH.md).

Manifest V3 Chrome extension for a single transparent Catecash account. It can receive CATE on devnet, testnet, and the current mainnet candidate. It can build, review, sign, and broadcast CATE sends on devnet and testnet. Mainnet sending remains disabled while those paths are tested.

The Catecash private key is stored in an AES-256-GCM encrypted backup in `chrome.storage.local`; PBKDF2-SHA256 uses 600,000 iterations and a random salt. The password and decrypted key remain only in the popup session. This browser wallet has its own password and key; the iOS app password does not unlock it. Export an encrypted backup immediately after creation. The password cannot be reset without the key. Backups from earlier two-key versions can still be restored; they retain their original encrypted contents, but this extension uses only the Catecash key.

## Build and load

Requires Node.js 22 or later.

```sh
npm ci
rustup target add wasm32-unknown-unknown --toolchain 1.99.0
npm run build:engine   # Rust 1.99, wasm32-unknown-unknown target, LLVM clang with WASM support
npm run build
npm test
```

The checked-in `engine/pkg/catecash_browser_engine.wasm` can be packaged with `npm run build` without rebuilding Rust. `npm run build:engine` rebuilds it from the patched Catecash crates in `../catecash-zebra/vendor/`. On macOS with Homebrew LLVM, the script selects `/opt/homebrew/opt/llvm/bin/clang`. On other systems set `CC_wasm32_unknown_unknown` to a WASM-capable clang. The Rust build receives its random seed from browser WebCrypto through an explicit input. Its other crates' implicit OS randomness is disabled in the WASM build.

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this directory's `dist/`. `dist/` is the generated extension package and is included for direct loading. There are no content scripts, injected providers, dapp connection permissions, analytics, or relay calls.

## What works

- Create, lock, unlock, back up, and restore an encrypted Catecash wallet.
- Show a transparent Catecash address and balance for the selected network. CateScan responses are checked against the expected chain name and genesis hash.
- Copy the receive address. Review destination, network, amount, fee, and input count before a send.
- Build and sign devnet and testnet transactions locally in WebAssembly, then broadcast through the devnet local gateway or the hosted testnet gateway.
- Reveal the Catecash compressed WIF for external recovery while unlocked.

## Current limits

Shielded accounts require more browser wallet work. CateScan is read only and only reports transparent activity. Mainnet CATE sending is disabled. Mainnet Catecash network and address parameters are still candidate values. This is an alpha build, not a production audited wallet.

## Catecash gateways

The extension uses `http://127.0.0.1:34777` for devnet and `https://plugin-wallet-test.catecash.com` for testnet. The hosted testnet HTTP gateway is separate from the Zaino gRPC endpoint at `wallet-testnet.catecash.com`. The extension verifies chain and genesis on every response. The CATE private key stays in the extension; only signed transaction bytes are broadcast.

For local devnet development, run Zebra JSON-RPC on loopback and start the gateway:

```sh
CATE_GATEWAY_NETWORK=devnet CATE_RPC_URL=http://127.0.0.1:34342/ CATE_RPC_COOKIE_FILE=/path/to/devnet/.cookie npm run gateway
```

The hosted service runs on the testnet explorer VM using the existing restricted RPC tunnel; see `deploy/`. The gateway listens only on loopback and Caddy publishes three HTTP routes. It accepts broadcasts only from a `chrome-extension://` origin, has no CORS allowance for web pages, and exposes no general RPC method. An Origin header is a browser boundary, not client authentication, so this endpoint must never receive private keys or unsigned transaction requests.

The CATE account is a single transparent key, not a Zcash-style seed wallet. Importing its WIF into another wallet requires that wallet to support the selected Catecash network and address format. RPC and explorer services see queried addresses. Before using real funds, test backup restoration in a clean browser profile and verify the network details with current project release notes.

Catecash address derivation is copied from `website/dist/paper-wallet/` and uses bundled MIT-licensed noble code; see `NOBLE-LICENSE.txt`.
