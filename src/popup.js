import { createAccounts, accountAddresses, cateWif } from './accounts.js';
import { encryptVault, decryptVault } from './vault.js';
import { CATE_NETWORKS, cateBalance, formatUnits } from './networks.js';
import { loadSigner } from './cate-signer.js';
import { spendableUtxos, broadcastCate } from './cate-gateway.js';

const $ = id => document.getElementById(id);
const screens = ['home', 'asset', 'send', 'review', 'receive', 'settings'];
const titles = { home: 'Catecash', asset: 'Catecash', send: 'Send', review: 'Review send', receive: 'Receive', settings: 'Settings' };
let vault = null, secrets = null, network = 'testnet', addresses = null;
let currentScreen = 'home', reviewResolver = null;

function notice(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); }
function view(name) {
  for (const id of ['setup', 'locked', 'wallet']) $(id).hidden = id !== name;
  $('refresh').hidden = name !== 'wallet'; $('lock').hidden = name !== 'wallet'; $('back').hidden = name !== 'wallet' || currentScreen === 'home';
  if (name !== 'wallet') { $('header-title').textContent = 'Catecash'; $('header-subtitle').textContent = 'Wallet 1'; $('unlock-password').type = 'password'; $('toggle-unlock-password').textContent = 'Show'; $('toggle-unlock-password').setAttribute('aria-label', 'Show password'); }
}
function navigate(screen) {
  if (!screens.includes(screen) || !secrets) return;
  if (currentScreen === 'review' && screen !== 'review' && reviewResolver) { const resolve = reviewResolver; reviewResolver = null; resolve(false); }
  currentScreen = screen;
  for (const name of screens) $('screen-' + name).hidden = name !== screen;
  $('header-title').textContent = titles[screen];
  $('header-subtitle').textContent = screen === 'asset' ? CATE_NETWORKS[network].label : 'Wallet 1';
  $('back').hidden = screen === 'home';
  document.querySelectorAll('.bottom-nav [data-screen]').forEach(button => button.classList.toggle('selected', button.dataset.screen === screen));
  notice('');
  $('wallet').scrollIntoView({ block: 'start' });
}
async function run(button, action) { button.disabled = true; try { await action(); } catch (error) { notice(error?.message || 'Something went wrong.', true); } finally { button.disabled = false; } }
function updateDetail() {
  if (!addresses) return;
  $('detail-network').textContent = ('Catecash ' + CATE_NETWORKS[network].label).toUpperCase();
  $('detail-balance').textContent = $('cate-balance').textContent + ' CATE';
  $('detail-address').textContent = addresses.cateAddress;
  $('cate-row-network').textContent = CATE_NETWORKS[network].label;
}
function updateSendForm() {
  $('cate-send-form').hidden = network === 'mainnet';
  $('send-disabled').hidden = network !== 'mainnet';
  $('send-network-note').textContent = 'Catecash ' + CATE_NETWORKS[network].label + ' · transparent';
}
function updateReceive() {
  if (!addresses) return;
  $('receive-network').textContent = 'Catecash ' + CATE_NETWORKS[network].label;
  $('receive-address').textContent = addresses.cateAddress;
}
function reviewTransfer({ amount, to, networkName, fee, inputs }) {
  if (!secrets || currentScreen !== 'send') return Promise.resolve(false);
  $('review-amount').textContent = amount + ' CATE';
  $('review-network').textContent = networkName;
  $('review-to').textContent = to;
  $('review-fee').textContent = fee;
  $('review-inputs-row').hidden = inputs == null;
  $('review-inputs').textContent = inputs ?? '—';
  return new Promise(resolve => { reviewResolver = resolve; navigate('review'); });
}
async function copyAddress() { if (!secrets || !addresses) return; await navigator.clipboard.writeText(addresses.cateAddress); notice('Address copied.'); }

async function enterWallet(nextSecrets) {
  secrets = nextSecrets; $('keys').hidden = true; $('keys').textContent = '';
  $('cate-network').value = network;
  addresses = await accountAddresses(secrets, network);
  updateSendForm(); updateReceive(); updateDetail();
  view('wallet'); navigate('home'); notice('Wallet unlocked. Save an encrypted backup before funding.');
  await refresh();
}
async function refresh() {
  if (!secrets || !addresses) return;
  $('cate-balance').textContent = 'Loading…';
  try { $('cate-balance').textContent = formatUnits(await cateBalance(network, addresses.cateAddress), 8); }
  catch { $('cate-balance').textContent = 'Unavailable'; notice('Catecash balance service is unavailable. Address is still shown.', true); }
  updateDetail();
}

$('create-form').addEventListener('submit', event => { event.preventDefault(); run(event.submitter, async () => {
  const password = $('create-password').value;
  if (password !== $('confirm-password').value) throw new Error('Passwords do not match.');
  if (vault) throw new Error('A wallet already exists.');
  const created = await createAccounts(); const encrypted = await encryptVault(created, password);
  await chrome.storage.local.set({ vault: encrypted, cateNetwork: network }); vault = encrypted;
  $('create-password').value = ''; $('confirm-password').value = ''; await enterWallet(created);
}); });
$('unlock-form').addEventListener('submit', event => { event.preventDefault(); run(event.submitter, async () => {
  const opened = await decryptVault(vault, $('unlock-password').value); await accountAddresses(opened, network);
  $('unlock-password').value = ''; await enterWallet(opened);
}); });
$('toggle-unlock-password').addEventListener('click', () => {
  const input = $('unlock-password'), button = $('toggle-unlock-password');
  const show = input.type === 'password'; input.type = show ? 'text' : 'password';
  button.textContent = show ? 'Hide' : 'Show'; button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});
$('restore-locked').addEventListener('click', () => $('restore-file').click());
$('restore-file').addEventListener('change', event => { run($('restore-locked'), async () => {
  const file = event.target.files?.[0]; if (!file || file.size > 100_000) throw new Error('Choose a small encrypted wallet backup.');
  const candidate = JSON.parse(await file.text()); const password = prompt('Enter the password for this encrypted backup:');
  if (password === null) return;
  const opened = await decryptVault(candidate, password); await accountAddresses(opened, network);
  if (vault && !confirm('Replace this browser’s existing wallet with the imported backup? Save its backup first.')) return;
  await chrome.storage.local.set({ vault: candidate, cateNetwork: network }); vault = candidate; await enterWallet(opened);
}); event.target.value = ''; });
$('lock').addEventListener('click', () => {
  if (reviewResolver) { const resolve = reviewResolver; reviewResolver = null; resolve(false); }
  secrets = null; addresses = null; $('keys').textContent = ''; $('keys').hidden = true;
  $('cate-balance').textContent = '—';
  currentScreen = 'home'; view('locked'); notice('Wallet locked.');
});
$('refresh').addEventListener('click', event => run(event.currentTarget, refresh));
$('back').addEventListener('click', () => navigate(currentScreen === 'review' ? 'send' : currentScreen === 'asset' ? 'home' : 'home'));
document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.screen)));
document.querySelectorAll('[data-asset]').forEach(button => button.addEventListener('click', () => { updateDetail(); navigate('asset'); }));
$('asset-send').addEventListener('click', () => { updateSendForm(); navigate('send'); });
$('asset-receive').addEventListener('click', () => { updateReceive(); navigate('receive'); });
$('detail-copy').addEventListener('click', () => run($('detail-copy'), copyAddress));
$('receive-copy').addEventListener('click', () => run($('receive-copy'), copyAddress));
$('cate-network').addEventListener('change', event => run(event.currentTarget, async () => {
  network = $('cate-network').value; if (!CATE_NETWORKS[network]) throw new Error('Unknown network.');
  await chrome.storage.local.set({ cateNetwork: network }); addresses = await accountAddresses(secrets, network);
  $('cate-balance').textContent = 'Loading…'; updateSendForm(); updateReceive(); updateDetail();
  try { $('cate-balance').textContent = formatUnits(await cateBalance(network, addresses.cateAddress), 8); updateDetail(); notice(`Viewing ${CATE_NETWORKS[network].label}.`); }
  catch { $('cate-balance').textContent = 'Unavailable'; updateDetail(); notice('Catecash balance service is unavailable.', true); }
}));
$('review-confirm').addEventListener('click', () => { if (reviewResolver) { const resolve = reviewResolver; reviewResolver = null; navigate('send'); resolve(true); } });
$('review-cancel').addEventListener('click', () => navigate('send'));
function cateAtoms(text) {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(text)) throw new Error('Enter a CATE amount with at most 8 decimals.');
  const [whole, fraction = ''] = text.split('.');
  const atoms = BigInt(whole) * 100_000_000n + BigInt(fraction.padEnd(8, '0'));
  if (atoms <= 0n) throw new Error('Amount must be greater than zero.');
  return atoms.toString();
}
$('cate-send-form').addEventListener('submit', event => { event.preventDefault(); run(event.submitter, async () => {
  if (!secrets || network === 'mainnet') throw new Error('Select Catecash devnet or testnet and unlock the wallet.');
  const sendNetwork = network, sourceAddress = addresses.cateAddress, secretHex = secrets.cateKey;
  const to = $('cate-send-to').value.trim(); const amount = cateAtoms($('cate-send-amount').value.trim());
  const data = await spendableUtxos(sendNetwork, sourceAddress);
  const sign = await loadSigner();
  const transaction = sign({ network: sendNetwork, secret_hex: secretHex, destination: to, amount, tip_height: data.height, utxos: data.utxos });
  const approved = await reviewTransfer({ amount: formatUnits(amount, 8), to, networkName: 'Catecash ' + CATE_NETWORKS[sendNetwork].label,
    fee: formatUnits(transaction.fee, 8) + ' CATE', inputs: transaction.input_count });
  if (!approved) { notice('Catecash transaction canceled.'); return; }
  const txid = await broadcastCate(sendNetwork, transaction.raw_hex);
  $('cate-send-form').reset(); navigate('home'); await refresh(); notice(`Catecash ${sendNetwork} transaction submitted: ${txid}`);
}); });
$('download-backup').addEventListener('click', () => {
  if (!vault) return; const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'catecash-wallet-backup.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); notice('Encrypted backup downloaded. Keep its password separately.');
});
$('show-keys').addEventListener('click', event => run(event.currentTarget, async () => {
  if (!secrets || !confirm('Reveal private keys on screen? Anyone who sees these can spend your funds.')) return;
  $('keys').textContent = `Catecash ${CATE_NETWORKS[network].label} compressed WIF:\n${await cateWif(secrets, network)}`;
  $('keys').hidden = false;
}));
(async () => { try {
  const saved = await chrome.storage.local.get(['vault', 'cateNetwork']); vault = saved.vault ?? null;
  network = CATE_NETWORKS[saved.cateNetwork] ? saved.cateNetwork : 'testnet'; view(vault ? 'locked' : 'setup');
} catch { notice('Browser storage is unavailable.', true); view('setup'); } })();
