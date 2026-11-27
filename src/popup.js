import { createAccounts, accountAddresses, cateWif, withShieldAccount } from './accounts.js';
import { encryptVault, decryptVault } from './vault.js';
import { CATE_NETWORKS, cateBalance, formatUnits } from './networks.js';
import { loadSigner } from './cate-signer.js';
import { spendableUtxos, broadcastCate, shieldSetup, shieldBlock, shieldCheckpoint, gatewayStatus } from './cate-gateway.js';
import { runIronwood, stopIronwoodWork } from './ironwood-client.js';
import { loadScanState, saveScanState } from './ironwood-state.js';
import { createIdleLock, lockMinutes } from './idle-lock.js';
import { qrcode } from './qrcode.mjs';

const $ = id => document.getElementById(id);
const screens = ['home', 'asset', 'send', 'review', 'receive', 'shield', 'settings'];
const titles = { home: 'Catecash', asset: 'Catecash', send: 'Send', review: 'Review send', receive: 'Receive', shield: 'Shield', settings: 'Settings' };
let vault = null, secrets = null, network = 'mainnet', addresses = null;
let currentScreen = 'home', reviewResolver = null;
let shieldAddress = null, shieldBackupReady = false, scanPromise = null, scanState = null;
let shieldRewardAvailable = false;
const idleLock = createIdleLock(() => lockWallet('Wallet locked after inactivity.'));

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
  if (screen === 'shield') loadShieldCandidate().catch(error => notice(error.message, true));
}
async function run(button, action) { button.disabled = true; try { await action(); } catch (error) { notice(error?.message || 'Something went wrong.', true); } finally { button.disabled = false; } }
function updateDetail() {
  if (!addresses) return;
  $('detail-network').textContent = ('Catecash ' + CATE_NETWORKS[network].label).toUpperCase();
  $('detail-balance').textContent = $('cate-balance').textContent + ' CATE';
  $('detail-address').textContent = addresses.cateAddress;
  $('cate-row-network').textContent = CATE_NETWORKS[network].label;
  $('total-network').textContent = 'Catecash ' + CATE_NETWORKS[network].label + ' · transparent account';
}
function updateBalance(balance) {
  $('cate-balance').textContent = balance;
  $('total-balance').textContent = balance + ' CATE';
  updateDetail();
}
function showShieldedBalance(state, complete) {
  $('shielded-balance').textContent = state ? formatUnits(state.balance, 8) + ' CATE' : '— CATE';
  $('shielded-sync').textContent = state ? (complete ? `Synced through block ${state.height}.` : `Scanning from block ${state.height}…`) : 'Shielded balance unavailable.';
}
async function initialScanState(activeSecrets, selectedNetwork) {
  const saved = await loadScanState(activeSecrets.shieldSeed, selectedNetwork);
  if (saved) return saved;
  const birth = activeSecrets.shieldBirth?.[selectedNetwork];
  if (birth) return { ...birth, notes: [], balance: '0' };
  const first = await shieldBlock(selectedNetwork, 1);
  return { height: 1, hash: first.hash, tree_hex: first.tree_state_hex, notes: [], balance: '0' };
}
async function syncShielded() {
  if (scanPromise) return scanPromise;
  if (!secrets?.shieldSeed) throw new Error('This wallet has no Ironwood account.');
  const activeSecrets = secrets, selectedNetwork = network;
  const task = (async () => {
    let state = await initialScanState(activeSecrets, selectedNetwork);
    const tip = (await gatewayStatus(selectedNetwork)).height;
    if (state.height > tip) throw new Error('Saved Ironwood scan is ahead of the network.');
    while (state.height < tip) {
      if (secrets !== activeSecrets || network !== selectedNetwork) return null;
      state = await runIronwood('scan', { network: selectedNetwork,
        shield_seed_hex: activeSecrets.shieldSeed, state, targetHeight: tip, maxBlocks: 25 },
      ({ height, targetHeight }) => {
        if (secrets === activeSecrets && network === selectedNetwork) $('shielded-sync').textContent = `Scanning block ${height} of ${targetHeight}…`;
      });
      if (secrets !== activeSecrets || network !== selectedNetwork) return null;
      await saveScanState(activeSecrets.shieldSeed, selectedNetwork, state);
      scanState = state; showShieldedBalance(state, false);
    }
    if (secrets === activeSecrets && network === selectedNetwork) {
      scanState = state; showShieldedBalance(state, true);
    }
    return state;
  })();
  scanPromise = task;
  try { return await task; } finally { if (scanPromise === task) scanPromise = null; }
}
async function prepareShieldSecrets(opened, password, creating = false) {
  const upgraded = withShieldAccount(opened);
  if (!creating && !upgraded.upgraded) return { prepared: upgraded.secrets, changed: false };
  const prepared = { ...upgraded.secrets };
  try {
    const birth = await shieldCheckpoint(network);
    prepared.shieldBirth = { ...(prepared.shieldBirth ?? {}), [network]: birth };
  } catch { /* Recovery can scan from block 1 if the gateway is offline. */ }
  const encrypted = await encryptVault(prepared, password);
  await chrome.storage.local.set({ vault: encrypted, cateNetwork: network, shieldBackupReady: false });
  vault = encrypted; shieldBackupReady = false;
  return { prepared, changed: true };
}
function updateSendForm() {
  $('send-network-note').textContent = 'Catecash ' + CATE_NETWORKS[network].label;
}
function updateReceive() {
  if (!addresses) return;
  $('receive-network').textContent = 'Catecash ' + CATE_NETWORKS[network].label;
  $('receive-address').textContent = addresses.cateAddress;
  const qr = qrcode(0, 'M');
  qr.addData(addresses.cateAddress);
  qr.make();
  const count = qr.getModuleCount();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${count + 8} ${count + 8}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const plate = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  plate.setAttribute('width', String(count + 8));
  plate.setAttribute('height', String(count + 8));
  plate.setAttribute('fill', '#fff');
  svg.append(plate);
  const marks = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  let path = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) path += `M${col + 4} ${row + 4}h1v1h-1z`;
    }
  }
  marks.setAttribute('d', path);
  marks.setAttribute('fill', '#000');
  svg.append(marks);
  $('receive-qr').replaceChildren(svg);
}
function reviewTransfer({ amount, to, networkName, fee, inputs, source = 'Transparent' }) {
  if (!secrets || currentScreen !== 'send') return Promise.resolve(false);
  $('review-amount').textContent = amount + ' CATE';
  $('review-network').textContent = networkName;
  $('review-source').textContent = source;
  $('review-to').textContent = to;
  $('review-fee').textContent = fee;
  $('review-inputs-row').hidden = inputs == null;
  $('review-inputs').textContent = inputs ?? '—';
  return new Promise(resolve => { reviewResolver = resolve; navigate('review'); });
}
async function loadShieldCandidate() {
  if (!secrets || !addresses || currentScreen !== 'shield') return;
  shieldRewardAvailable = false; updateShieldControls();
  $('shield-reward').textContent = 'Checking mature mining rewards…';
  const activeSecrets = secrets, selectedNetwork = network;
  const setup = await shieldSetup(selectedNetwork, addresses.cateAddress);
  if (secrets !== activeSecrets || network !== selectedNetwork || currentScreen !== 'shield') return;
  shieldRewardAvailable = setup.rewards.length > 0;
  $('shield-reward').textContent = setup.rewards.length ? formatUnits(setup.rewards[0].value, 8) + ' CATE' : 'No mature reward available';
  updateShieldControls();
}
function updateShieldControls() {
  $('shield-backup-warning').hidden = shieldBackupReady;
  $('shield-confirm').disabled = !shieldAddress || !shieldRewardAvailable || !shieldBackupReady;
}
async function copyAddress() { if (!secrets || !addresses) return; await navigator.clipboard.writeText(addresses.cateAddress); notice('Address copied.'); }

async function enterWallet(nextSecrets) {
  secrets = nextSecrets; $('keys').hidden = true; $('keys').textContent = '';
  $('cate-network').value = network;
  addresses = await accountAddresses(secrets, network);
  try { shieldAddress = await runIronwood('address', { network, shield_seed_hex: secrets.shieldSeed }); }
  catch { shieldAddress = null; }
  $('shield-address').textContent = shieldAddress ?? 'Ironwood engine unavailable';
  $('shield-copy').disabled = !shieldBackupReady || !shieldAddress;
  updateShieldControls();
  updateSendForm(); updateReceive(); updateDetail();
  idleLock.start();
  view('wallet'); navigate('home');
  if (!shieldAddress) notice('Ironwood engine is unavailable. Transparent funds remain accessible.', true);
  else if (!shieldBackupReady) notice('Download a fresh encrypted backup before shielding.');
  await refresh();
}
async function refresh() {
  if (!secrets || !addresses) return;
  const selectedNetwork = network, selectedAddress = addresses;
  updateBalance('Loading…');
  try {
    const balance = formatUnits(await cateBalance(selectedNetwork, selectedAddress.cateAddress), 8);
    if (secrets && network === selectedNetwork && addresses === selectedAddress) updateBalance(balance);
  } catch {
    if (secrets && network === selectedNetwork && addresses === selectedAddress) {
      updateBalance('Unavailable'); notice('Catecash balance service is unavailable. Address is still shown.', true);
    }
  }
  showShieldedBalance(scanState, false);
  syncShielded().catch(error => { if (secrets && network === selectedNetwork) { showShieldedBalance(null, false); notice(error.message, true); } });
}

$('create-form').addEventListener('submit', event => { event.preventDefault(); run(event.submitter, async () => {
  const password = $('create-password').value;
  if (password !== $('confirm-password').value) throw new Error('Passwords do not match.');
  if (vault) throw new Error('A wallet already exists.');
  const created = await createAccounts();
  const { prepared } = await prepareShieldSecrets(created, password, true);
  $('create-password').value = ''; $('confirm-password').value = ''; await enterWallet(prepared);
}); });
$('unlock-form').addEventListener('submit', event => { event.preventDefault(); run(event.submitter, async () => {
  const password = $('unlock-password').value;
  const opened = await decryptVault(vault, password); await accountAddresses(opened, network);
  const { prepared } = await prepareShieldSecrets(opened, password);
  $('unlock-password').value = ''; await enterWallet(prepared);
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
  await chrome.storage.local.set({ vault: candidate, cateNetwork: network, shieldBackupReady: Boolean(opened.shieldSeed) });
  vault = candidate; shieldBackupReady = Boolean(opened.shieldSeed);
  await chrome.storage.local.remove(['ironwoodScan_mainnet', 'ironwoodScan_testnet', 'ironwoodScan_devnet']);
  await chrome.storage.local.remove(['ironwoodPending_mainnet', 'ironwoodPending_testnet', 'ironwoodPending_devnet']);
  const { prepared } = await prepareShieldSecrets(opened, password);
  await enterWallet(prepared);
}); event.target.value = ''; });
function lockWallet(message = 'Wallet locked.') {
  idleLock.stop();
  stopIronwoodWork(); scanState = null; scanPromise = null; shieldAddress = null; shieldRewardAvailable = false;
  if (reviewResolver) { const resolve = reviewResolver; reviewResolver = null; resolve(false); }
  secrets = null; addresses = null; $('keys').textContent = ''; $('keys').hidden = true;
  $('receive-qr').replaceChildren();
  updateBalance('—');
  $('cate-send-form').reset();
  currentScreen = 'home'; view('locked'); notice(message);
}
$('lock').addEventListener('click', () => lockWallet());
for (const name of ['pointerdown', 'keydown']) document.addEventListener(name, () => idleLock.activity());
document.addEventListener('visibilitychange', () => { if (!document.hidden) idleLock.check(); });
$('refresh').addEventListener('click', event => run(event.currentTarget, refresh));
$('back').addEventListener('click', () => navigate(currentScreen === 'review' ? 'send' : currentScreen === 'asset' ? 'home' : 'home'));
document.querySelectorAll('[data-screen]').forEach(button => button.addEventListener('click', () => navigate(button.dataset.screen)));
document.querySelectorAll('[data-asset]').forEach(button => button.addEventListener('click', () => { updateDetail(); navigate('asset'); }));
$('asset-send').addEventListener('click', () => { updateSendForm(); navigate('send'); });
$('asset-receive').addEventListener('click', () => { updateReceive(); navigate('receive'); });
$('shield-copy').addEventListener('click', event => run(event.currentTarget, async () => {
  if (!shieldBackupReady) throw new Error('Download the encrypted backup before sharing this address.');
  if (!shieldAddress) throw new Error('Ironwood address is unavailable.');
  await navigator.clipboard.writeText(shieldAddress); notice('Ironwood address copied.');
}));
$('shield-confirm').addEventListener('click', event => run(event.currentTarget, async () => {
  if (!shieldBackupReady) throw new Error('Download the updated encrypted backup before shielding.');
  if (!secrets || !addresses || !shieldAddress) throw new Error('Unlock the wallet first.');
  const activeSecrets = secrets, selectedNetwork = network, expectedAddress = shieldAddress;
  const setup = await shieldSetup(selectedNetwork, addresses.cateAddress);
  const utxo = setup.rewards[0];
  if (!utxo) throw new Error('No mature mining reward is available to shield.');
  notice('Generating Ironwood proof. This can take a minute.');
  const transaction = await runIronwood('shield', {
    network: selectedNetwork, secret_hex: activeSecrets.cateKey,
    shield_seed_hex: activeSecrets.shieldSeed, tip_height: setup.height,
    tree_height: setup.height, tree_state_hex: setup.tree_state_hex, utxo,
    destination: null
  });
  if (secrets !== activeSecrets || network !== selectedNetwork || shieldAddress !== expectedAddress) return;
  if (transaction.shielded_address !== expectedAddress || transaction.source_address !== addresses.cateAddress) {
    throw new Error('Shield transaction account does not match the wallet.');
  }
  const approved = confirm(`Shield ${formatUnits(transaction.amount, 8)} CATE from your mining reward?\n\nFee: ${formatUnits(transaction.fee, 8)} CATE\nDestination: ${transaction.shielded_address}`);
  if (!approved) { notice('Shielding canceled.'); return; }
  const txid = await broadcastCate(selectedNetwork, transaction.raw_hex);
  if (secrets !== activeSecrets) return;
  navigate('home'); await refresh(); notice(`Shield transaction submitted: ${txid}. Balance appears after confirmation and scan.`);
}));
$('detail-copy').addEventListener('click', () => run($('detail-copy'), copyAddress));
$('receive-copy').addEventListener('click', () => run($('receive-copy'), copyAddress));
$('cate-network').addEventListener('change', event => run(event.currentTarget, async () => {
  const selectedNetwork = $('cate-network').value;
  if (!CATE_NETWORKS[selectedNetwork]) throw new Error('Unknown network.');
  const selectedAddresses = await accountAddresses(secrets, selectedNetwork);
  stopIronwoodWork(); scanState = null; scanPromise = null; shieldRewardAvailable = false;
  await chrome.storage.local.set({ cateNetwork: selectedNetwork });
  if (!secrets) return;
  network = selectedNetwork; addresses = selectedAddresses;
  try { shieldAddress = await runIronwood('address', { network, shield_seed_hex: secrets.shieldSeed }); }
  catch { shieldAddress = null; }
  $('shield-address').textContent = shieldAddress ?? 'Ironwood engine unavailable';
  $('shield-copy').disabled = !shieldBackupReady || !shieldAddress;
  updateSendForm(); updateReceive(); updateDetail();
  notice(`Viewing ${CATE_NETWORKS[network].label}.`);
  await refresh();
}));
$('lock-minutes').addEventListener('change', event => run(event.currentTarget, async () => {
  const minutes = lockMinutes($('lock-minutes').value);
  await chrome.storage.local.set({ lockMinutes: minutes });
  $('lock-minutes').value = String(minutes);
  idleLock.configure(minutes);
  notice(`Auto-lock set to ${$('lock-minutes').selectedOptions[0].textContent.toLowerCase()}.`);
}));
$('open-mode')?.addEventListener('change', event => run(event.currentTarget, async () => {
  const mode = $('open-mode').value;
  if (mode !== 'sidepanel' && mode !== 'popup') throw new Error('Unknown opening mode.');
  await chrome.storage.local.set({ openMode: mode });
  notice(`Wallet will open in the ${mode === 'popup' ? 'popup' : 'side panel'} next time.`);
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
  if (!secrets) throw new Error('Unlock the wallet before sending.');
  const sendNetwork = network, sourceAddress = addresses.cateAddress, secretHex = secrets.cateKey, activeSecrets = secrets;
  const to = $('cate-send-to').value.trim(); const amount = cateAtoms($('cate-send-amount').value.trim());
  if ($('send-source').value === 'shielded') {
    notice('Scanning and generating the Ironwood spend proof. This can take a minute.');
    const state = await syncShielded();
    if (!state || secrets !== activeSecrets || network !== sendNetwork) return;
    const tip = (await gatewayStatus(sendNetwork)).height;
    if (tip - state.height > 2) throw new Error('Ironwood scan is behind the chain. Refresh and try again.');
    const pendingKey = `ironwoodPending_${sendNetwork}`;
    const pending = (await chrome.storage.local.get(pendingKey))[pendingKey];
    if (pending && (tip > pending.expiry_height || !state.notes.some(note => note.nullifier_hex === pending.nullifier_hex))) {
      await chrome.storage.local.remove(pendingKey);
    }
    const pendingNullifier = pending && tip <= pending.expiry_height ? pending.nullifier_hex : null;
    const candidate = state.notes.filter(note => note.nullifier_hex !== pendingNullifier &&
      tip - note.received_height + 1 >= 10 &&
      BigInt(note.value) >= BigInt(amount) + 11_000n).sort((a, b) => BigInt(a.value) < BigInt(b.value) ? -1 : 1)[0];
    if (!candidate) throw new Error('No confirmed Ironwood note covers this amount plus the fee.');
    const transaction = await runIronwood('send', { network: sendNetwork,
      shield_seed_hex: activeSecrets.shieldSeed, destination: to, amount,
      tip_height: tip, tree_state_hex: state.tree_hex, note: candidate });
    if (secrets !== activeSecrets || network !== sendNetwork) return;
    const approved = await reviewTransfer({ amount: formatUnits(amount, 8), to,
      networkName: 'Catecash ' + CATE_NETWORKS[sendNetwork].label,
      fee: formatUnits(transaction.fee, 8) + ' CATE', source: 'Ironwood shielded account', inputs: 1 });
    if (!approved) { if (secrets === activeSecrets) notice('Catecash transaction canceled.'); return; }
    if (secrets !== activeSecrets || network !== sendNetwork) return;
    const txid = await broadcastCate(sendNetwork, transaction.raw_hex);
    if (secrets !== activeSecrets) return;
    await chrome.storage.local.set({ [pendingKey]: { txid, nullifier_hex: candidate.nullifier_hex,
      expiry_height: transaction.expiry_height } });
    $('cate-send-form').reset(); navigate('home'); await refresh(); notice(`Ironwood send submitted: ${txid}`);
    return;
  }
  if (/^(?:cate[a-z]*|CATE[A-Z]*)1/.test(to)) throw new Error('Transparent funds can only be sent to a transparent address. Choose Ironwood to send to a shielded recipient.');
  const data = await spendableUtxos(sendNetwork, sourceAddress);
  if (secrets !== activeSecrets || network !== sendNetwork) return;
  const sign = await loadSigner();
  if (secrets !== activeSecrets || network !== sendNetwork) return;
  const transaction = sign({ network: sendNetwork, secret_hex: secretHex, destination: to, amount, tip_height: data.height, utxos: data.utxos });
  const approved = await reviewTransfer({ amount: formatUnits(amount, 8), to, networkName: 'Catecash ' + CATE_NETWORKS[sendNetwork].label,
    fee: formatUnits(transaction.fee, 8) + ' CATE', inputs: transaction.input_count, source: 'Ordinary transparent balance' });
  if (!approved) { if (secrets === activeSecrets) notice('Catecash transaction canceled.'); return; }
  if (secrets !== activeSecrets || network !== sendNetwork) return;
  const txid = await broadcastCate(sendNetwork, transaction.raw_hex);
  if (secrets !== activeSecrets) return;
  $('cate-send-form').reset(); navigate('home'); await refresh(); notice(`Catecash ${sendNetwork} transaction submitted: ${txid}`);
}); });
$('download-backup').addEventListener('click', () => {
  if (!vault) return; const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'catecash-wallet-backup.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  shieldBackupReady = true; chrome.storage.local.set({ shieldBackupReady: true });
  $('shield-copy').disabled = false; updateShieldControls();
  notice('Encrypted backup downloaded. Keep its password separately.');
});
$('show-keys').addEventListener('click', event => run(event.currentTarget, async () => {
  if (!secrets || !confirm('Reveal private keys on screen? Anyone who sees these can spend your funds.')) return;
  const activeSecrets = secrets, selectedNetwork = network;
  const wif = await cateWif(activeSecrets, selectedNetwork);
  if (secrets !== activeSecrets || network !== selectedNetwork) return;
  $('keys').textContent = `Catecash ${CATE_NETWORKS[network].label} compressed WIF:\n${wif}`;
  $('keys').hidden = false;
}));
(async () => { try {
  const saved = await chrome.storage.local.get(['vault', 'cateNetwork', 'lockMinutes', 'openMode', 'shieldBackupReady']); vault = saved.vault ?? null;
  shieldBackupReady = saved.shieldBackupReady === true;
  network = CATE_NETWORKS[saved.cateNetwork] ? saved.cateNetwork : 'mainnet';
  const minutes = lockMinutes(saved.lockMinutes);
  $('lock-minutes').value = String(minutes);
  if ($('open-mode')) $('open-mode').value = saved.openMode === 'popup' ? 'popup' : 'sidepanel';
  idleLock.configure(minutes);
  view(vault ? 'locked' : 'setup');
} catch { notice('Browser storage is unavailable.', true); view('setup'); } })();
