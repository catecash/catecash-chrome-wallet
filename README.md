# Catecash Chrome Wallet (alpha)

For repository SSH setup, push checks, and required post-push reporting, see [GitHub push requirements](docs/GITHUB-PUSH.md).

Manifest V3 Chrome extension with a transparent Catecash account and an independent Ironwood shielded account. It can receive and send CATE on devnet, testnet, and the current mainnet candidate. Transactions and Ironwood proofs are built locally in a Web Worker, then signed bytes are broadcast through the selected network gateway.

The transparent key and independent Ironwood seed are stored together in an AES-256-GCM encrypted backup in `chrome.storage.local`; PBKDF2-SHA256 uses 600,000 iterations and a random salt. Scanned Ironwood notes and witnesses are separately encrypted with a key derived from that seed. The password and decrypted keys remain only in the open wallet view. The wallet locks after five minutes of inactivity by default; Settings offers up to eight hours. Closing the view also ends the unlocked session. This browser wallet has its own password and keys; the iOS app password does not unlock it. Export an encrypted backup immediately after creation or after an older wallet is upgraded. Older backups remain readable, but **a new backup is required before shielding** because the old file cannot recover the new Ironwood seed.

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

Clicking the toolbar icon opens the wallet in Chrome's side panel by default. In Wallet Settings, **Open wallet in** can switch the toolbar icon to a popup. The selection is stored locally and applies to the next toolbar click.

## What works

- Create, lock, unlock, back up, and restore an encrypted Catecash wallet.
- Show transparent CATE (including mined rewards) separately from the locally scanned Ironwood balance. Mainnet is the default for new installs; saved network choices remain in place. The network selector is in Settings. CateScan responses are checked against the expected chain name and genesis hash.
- Copy the receive address. Review destination, network, amount, fee, and input count before a send.
- Shield one mature mining reward at a time into the plugin-owned Ironwood account. Its address and seed are in the encrypted backup. Shielding directly to another wallet is temporarily disabled.
- Scan Ironwood blocks locally, verify commitment tree states, maintain note witnesses, and send from a confirmed Ironwood note to a transparent or Ironwood recipient.
- Build and sign devnet, testnet, and mainnet transactions locally in WebAssembly, then broadcast through the selected network gateway.
- Reveal the Catecash compressed WIF for external recovery while unlocked.

## Current limits

An Ironwood send currently uses one confirmed note; amounts that require combining multiple notes need a later update. Shielding also moves one mature reward per transaction. The wallet can rebuild its encrypted scan cache from the chain checkpoint in its backup. CateScan reports only transparent activity; shielded balance appears after block scanning. Mainnet Catecash network and address parameters are still candidate values. This is an alpha build, not a production audited wallet. Synthetic proof tests pass, but a live mainnet shield or send has not been exercised as part of this change.

## Catecash gateways

The extension uses `http://127.0.0.1:34777` for devnet, `https://plugin-wallet-test.catecash.com` for testnet, and `https://wallet.catecash.com` for mainnet. The hosted HTTP gateways are separate from the Zaino gRPC services. The extension verifies chain and genesis on every response. The CATE private key stays in the extension; only signed transaction bytes are broadcast.

For local devnet development, run Zebra JSON-RPC on loopback and start the gateway:

```sh
CATE_GATEWAY_NETWORK=devnet CATE_RPC_URL=http://127.0.0.1:34342/ CATE_RPC_COOKIE_FILE=/path/to/devnet/.cookie npm run gateway
```

The hosted service runs on the testnet explorer VM using the existing restricted RPC tunnel; see `deploy/`. The gateway listens only on loopback and Caddy publishes `/status`, `/utxos/*`, `/shield-checkpoint`, `/shield-setup/*`, `/shield-block/*`, and `/broadcast`. Read routes return only public chain data. It accepts broadcasts only from `chrome-extension://`, `moz-extension://`, or `safari-web-extension://` origins, has no CORS allowance for web pages, and exposes no general RPC method. An Origin header is a browser boundary, not client authentication, so this endpoint must never receive private keys or unsigned transaction requests.

The mainnet gateway uses the same routes, runs as a Podman container via `deploy/catecash-mainnet-browser-gateway.service`, and mounts the node's RPC cookie read-only. Its Caddy configuration is in `../../utilities/mainnet-wallet-Caddyfile`.

The transparent account is a single key, not a Zcash-style seed wallet. The Ironwood account has its own seed. Importing the transparent WIF into another wallet does **not** recover Ironwood funds; restore the encrypted backup instead. RPC and explorer services see queried transparent addresses. Before using real funds, test backup restoration in a clean browser profile and verify the network details with current project release notes.

Catecash address derivation is copied from `website/dist/paper-wallet/` and uses bundled MIT-licensed noble code; see `NOBLE-LICENSE.txt`.
