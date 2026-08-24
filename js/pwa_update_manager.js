/**
 * Progressive Web App & Seamless Background OTA Engine
 */

let hasCheckedUpdatesThisSession = false;

async function initPWAandUpdates() {
  // Perform silent background update check on app launch
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
        // Initialize version tracking
        await db.setSetting('appVersion', data.version);
        return;
      }

      if (storedVersion !== data.version) {
        // SILENT AUTOMATIC OTA HOT RELOAD
        await applyBackgroundOtaUpdate(data.version);
      }
    }
  } catch (err) {
    // Network offline or fetch unavailable - silent fallback
  }
}

async function applyBackgroundOtaUpdate(newVersion) {
  try {
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
    console.log(`[OTA] Silently updated app to version ${newVersion}`);
  } catch (e) {
    console.warn('[OTA] Background update warning:', e);
  }
}

window.initPWAandUpdates = initPWAandUpdates;
window.checkForAppUpdates = checkForAppUpdates;
