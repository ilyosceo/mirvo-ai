const DEFAULT_URL = 'http://localhost:3000';

const urlInput = document.getElementById('platform-url');
const extractBtn = document.getElementById('extract-btn');
const statusEl = document.getElementById('status');

chrome.storage.sync.get(['uz3dPlatformUrl'], (res) => {
  urlInput.value = res?.uz3dPlatformUrl || DEFAULT_URL;
});

urlInput.addEventListener('change', () => {
  const cleaned = urlInput.value.trim().replace(/\/+$/, '') || DEFAULT_URL;
  urlInput.value = cleaned;
  chrome.storage.sync.set({ uz3dPlatformUrl: cleaned });
});

extractBtn.addEventListener('click', () => {
  const cleaned = urlInput.value.trim().replace(/\/+$/, '') || DEFAULT_URL;
  chrome.storage.sync.set({ uz3dPlatformUrl: cleaned });
  statusEl.textContent = 'YouTube subtitrlar o‘qilmoqda...';
  extractBtn.disabled = true;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (!activeTab?.id || !activeTab.url?.includes('youtube.com/watch')) {
      statusEl.textContent = 'Iltimos, avval YouTube video sahifasini oching.';
      extractBtn.disabled = false;
      return;
    }

    chrome.tabs.sendMessage(activeTab.id, { action: 'EXTRACT_AND_SEND' }, (resp) => {
      extractBtn.disabled = false;
      if (chrome.runtime.lastError || !resp?.ok) {
        statusEl.textContent =
          resp?.error || chrome.runtime.lastError?.message || 'Sahifani yangilab qayta urinib ko‘ring.';
        return;
      }
      statusEl.textContent = `Tayyor: ${resp.title}`;
    });
  });
});
