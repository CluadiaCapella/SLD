/**
 * Progressive Web App & Seamless Background OTA Engine
 */

let hasCheckedUpdatesThisSession = false;

async function initPWAandUpdates() {
  checkForAppUpdates(false);
}

async function checkForAppUpdates(userTriggered = false) {
  if (!userTriggered && hasCheckedUpdatesThisSession) return;
  hasCheckedUpdatesThisSession = true;

  try {
    const remoteRes = await fetch('https://raw.githubusercontent.com/CluadiaCapella/SLD/main/version.json?t=' + Date.now());
    if (!remoteRes.ok) return;
    const data = await remoteRes.json();

    if (data && data.version) {
      const storedVersion = await db.getSetting('appVersion');

      if (!storedVersion) {
        await db.setSetting('appVersion', data.version);
        return;
      }

      if (storedVersion !== data.version) {
        await applyBackgroundOtaUpdate(data.version);
      }
    }
  } catch (err) {
    // Network offline or fetch unavailable - silent fallback
  }
}

async function applyBackgroundOtaUpdate(newVersion) {
  try {
    if (typeof showToastNotification === 'function') {
      showToastNotification(`⚡ Updating app code in background to v${newVersion}...`);
    }

    const filesToUpdate = [
      { key: 'ota_code_p2p_sync_network', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/p2p_sync_network.js' },
      { key: 'ota_code_connections_page_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/connections_page_view.js' },
      { key: 'ota_code_connections_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/html/connections_view.js' }
    ];

    for (const item of filesToUpdate) {
      try {
        const res = await fetch(item.url + '?t=' + Date.now());
        if (res.ok) {
          const code = await res.text();
          localStorage.setItem(item.key, code);
        }
      } catch (e) {}
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
    }

    await db.setSetting('appVersion', newVersion);

    if (typeof showToastNotification === 'function') {
      showToastNotification('✅ App updated successfully!');
    }

    setTimeout(() => {
      window.location.reload(true);
    }, 600);
  } catch (e) {
    console.warn('[OTA] Background update warning:', e);
  }
}

window.initPWAandUpdates = initPWAandUpdates;
window.checkForAppUpdates = checkForAppUpdates;
