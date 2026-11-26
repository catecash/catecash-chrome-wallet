import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('toolbar opens the side panel by default and follows a saved popup preference', async () => {
  const listeners = {};
  const calls = [];
  let savedMode;
  const chrome = {
    action: { setPopup: async value => { calls.push(['popup', value.popup]); } },
    sidePanel: { setPanelBehavior: async value => { calls.push(['panel', value.openPanelOnActionClick]); } },
    storage: {
      local: { get: async () => ({ openMode: savedMode }) },
      onChanged: { addListener: fn => { listeners.change = fn; } },
    },
    runtime: {
      onInstalled: { addListener: fn => { listeners.install = fn; } },
      onStartup: { addListener: fn => { listeners.startup = fn; } },
    },
  };
  vm.runInNewContext(await readFile(new URL('../background.js', import.meta.url), 'utf8'), { chrome });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [['popup', ''], ['panel', true]]);

  calls.length = 0;
  savedMode = 'popup';
  listeners.change({ openMode: { newValue: 'popup' } }, 'local');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [['panel', false], ['popup', 'popup.html']]);

  calls.length = 0;
  listeners.startup();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [['panel', false], ['popup', 'popup.html']]);

  calls.length = 0;
  listeners.change({ openMode: { newValue: 'sidepanel' } }, 'local');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, [['popup', ''], ['panel', true]]);
});
