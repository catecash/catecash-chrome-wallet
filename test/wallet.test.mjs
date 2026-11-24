import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptVault, decryptVault } from '../src/vault.js';
import { createAccounts, accountAddresses, cateWif } from '../src/accounts.js';
import { cateBalance, formatUnits, CATE_NETWORKS } from '../src/networks.js';
const secrets = { cateKey: '00'.repeat(31) + '01' };

test('new wallets contain only a Catecash key and legacy backups remain readable', async () => {
  const created = await createAccounts();
  assert.deepEqual(Object.keys(created), ['cateKey']);
  assert.match(created.cateKey, /^[0-9a-f]{64}$/);
  const legacy = { ...secrets, ethKey: '0x' + '00'.repeat(31) + '01' };
  assert.deepEqual(await accountAddresses(legacy, 'testnet'), await accountAddresses(secrets, 'testnet'));
});

test('encrypted backup round trips and rejects a wrong password or modified ciphertext', async () => {
  const backup = await encryptVault(secrets, 'correct horse battery staple');
  assert.deepEqual(await decryptVault(backup, 'correct horse battery staple'), secrets);
  await assert.rejects(decryptVault(backup, 'wrong password'));
  const altered = { ...backup, ciphertext: backup.ciphertext.slice(0, -4) + 'AAAA' };
  await assert.rejects(decryptVault(altered, 'correct horse battery staple'));
  assert.equal(JSON.stringify(backup).includes(secrets.cateKey), false);
});

test('the same Catecash key derives distinct network addresses and matching WIFs', async () => {
  const main = await accountAddresses(secrets, 'mainnet');
  const testnet = await accountAddresses(secrets, 'testnet');
  assert.notEqual(main.cateAddress, testnet.cateAddress);
  assert.notEqual(await cateWif(secrets, 'mainnet'), await cateWif(secrets, 'testnet'));
  await assert.rejects(accountAddresses(secrets, 'invalid'));
});

test('Catecash balance lookup checks chain identity and preserves atomic precision', async () => {
  const address = (await accountAddresses(secrets, 'testnet')).cateAddress;
  const network = CATE_NETWORKS.testnet;
  const fetchOk = async url => ({ ok: true, json: async () => url.endsWith('/api/status')
    ? { chain: network.chain, genesisHash: network.genesis }
    : { address, unit: 'catemoto', balance: '9007199254740993' } });
  assert.equal(formatUnits(await cateBalance('testnet', address, fetchOk), 8), '90071992.54740993');
  const wrongChain = async () => ({ ok: true, json: async () => ({ chain: 'catecash-mainnet', genesisHash: network.genesis }) });
  await assert.rejects(cateBalance('testnet', address, wrongChain), /identity/);
});
