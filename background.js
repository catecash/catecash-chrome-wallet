const preferenceKey = 'openMode';

async function applyOpenMode(mode) {
  if (mode === 'popup') {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
    await chrome.action.setPopup({ popup: 'popup.html' });
  } else {
    await chrome.action.setPopup({ popup: '' });
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }
}

let update = Promise.resolve();
function queueOpenMode(mode) {
  update = update.catch(() => {}).then(() => applyOpenMode(mode));
  return update;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[preferenceKey]) queueOpenMode(changes[preferenceKey].newValue);
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(preferenceKey).then(saved => queueOpenMode(saved[preferenceKey]));
});
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(preferenceKey).then(saved => queueOpenMode(saved[preferenceKey]));
});
chrome.storage.local.get(preferenceKey).then(saved => queueOpenMode(saved[preferenceKey]));
