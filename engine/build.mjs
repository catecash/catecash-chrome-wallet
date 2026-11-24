import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, stat } from 'node:fs/promises';
const env = { ...process.env, RUSTFLAGS: '--cfg getrandom_backend="unsupported"' };
if (process.platform === 'darwin' && !env.CC_wasm32_unknown_unknown) {
  try { await stat('/opt/homebrew/opt/llvm/bin/clang'); env.CC_wasm32_unknown_unknown = '/opt/homebrew/opt/llvm/bin/clang'; } catch {}
}
const args = ['+1.99.0', 'build', '--manifest-path', new URL('./Cargo.toml', import.meta.url).pathname, '--target', 'wasm32-unknown-unknown', '--release', '--locked'];
const result = spawnSync('cargo', args, { stdio: 'inherit', env });
if (result.status !== 0) process.exit(result.status ?? 1);
await mkdir(new URL('./pkg/', import.meta.url), { recursive: true });
await copyFile(new URL('./target/wasm32-unknown-unknown/release/catecash_browser_engine.wasm', import.meta.url), new URL('./pkg/catecash_browser_engine.wasm', import.meta.url));
