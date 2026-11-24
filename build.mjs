import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
const out = new URL('./dist/', import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await build({ entryPoints: [new URL('./src/popup.js', import.meta.url).pathname], bundle: true, format: 'iife', platform: 'browser', target: 'chrome120', outfile: new URL('./dist/popup.js', import.meta.url).pathname, legalComments: 'none' });
await cp(new URL('./engine/pkg/catecash_browser_engine.wasm', import.meta.url), new URL('./dist/catecash_browser_engine.wasm', import.meta.url));
await cp(new URL('./icons/', import.meta.url), new URL('./dist/icons/', import.meta.url), { recursive: true });
for (const file of ['manifest.json', 'popup.html', 'popup.css', 'NOBLE-LICENSE.txt']) await cp(new URL(`./${file}`, import.meta.url), new URL(`./dist/${file}`, import.meta.url));
