/**
 * Progressive Web App & OTA Update Engine
 */

let isAutoUpdateEnabled = true;
let hasCheckedUpdatesThisSession = false;

async function initPWAandUpdates() {
  const savedAutoUpdate = await db.getSetting('autoUpdateEnabled');
  if (savedAutoUpdate !== undefined) {
    isAutoUpdateEnabled = Boolean(savedAutoUpdate);
  }

  const autoToggle = document.getElementById('autoUpdateToggle');
  if (autoToggle) {
    autoToggle.checked = isAutoUpdateEnabled;
    autoToggle.onchange = async () => {
      isAutoUpdateEnabled = autoToggle.checked;
      await db.setSetting('autoUpdateEnabled', isAutoUpdateEnabled);
    };
  }

  const checkBtn = document.getElementById('checkForUpdatesBtn');
  if (checkBtn) {
    checkBtn.onclick = () => checkForAppUpdates(true);
  }

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              handleNewVersionDetected();
            }
          });
        }
      });
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  }

  if (isAutoUpdateEnabled) {
    checkForAppUpdates(false);
  }
}

async function checkForAppUpdates(userTriggered = false) {
  if (!userTriggered && hasCheckedUpdatesThisSession) return;
  hasCheckedUpdatesThisSession = true;

  let data = null;

  try {
    const remoteRes = await fetch('https://raw.githubusercontent.com/CluadiaCapella/SLD/main/version.json?t=' + Date.now());
    if (remoteRes.ok) {
      data = await remoteRes.json();
    }
  } catch (err) {
    console.warn('Remote GitHub version check failed:', err);
  }

  if (!data) {
    try {
      const res = await fetch('./version.json?t=' + Date.now());
      if (res.ok) data = await res.json();
    } catch (err) {}
  }

  if (data && data.version) {
    const currentLocalVersion = (await db.getSetting('appVersion')) || '1.0.0';

    if (currentLocalVersion !== data.version) {
      showUpdateAvailableBanner(data.version, data.apkUrl);
    } else {
      if (userTriggered) {
        showToastNotification(`Your app is up to date! (v${data.version})`);
      }
    }
  } else {
    if (userTriggered) {
      showToastNotification('Unable to check for updates. Please check your internet connection.');
    }
  }
}

async function performOtaHotUpdate(newVersion) {
  showToastNotification('🚀 Updating web assets...');
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
    showToastNotification('✅ App updated successfully! Reloading...');
    setTimeout(() => {
      window.location.reload(true);
    }, 800);
  } catch (e) {
    window.location.reload(true);
  }
}

async function handleNewVersionDetected(newVer = '') {
  if (isAutoUpdateEnabled) {
    performOtaHotUpdate(newVer);
  } else {
    showUpdateAvailableBanner(newVer);
  }
}

function showUpdateAvailableBanner(newVer = '', apkUrl = '') {
  let banner = document.getElementById('appUpdateBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'appUpdateBanner';
    banner.style.cssText = `
      position: fixed; top: 70px; left: 50%; transform: translateX(-50%); z-index: 9999;
      background: linear-gradient(135deg, #ec4899, #3b82f6);
      color: #fff; padding: 10px 18px; border-radius: 30px; font-weight: 800; font-size: 0.85rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;
    `;
    document.body.appendChild(banner);
  }

  const directApkLink = apkUrl || 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/SLD.apk';

  banner.innerHTML = `
    <span>🚀 New Update Available! ${newVer ? '(v' + newVer + ')' : ''}</span>
    <button class="btn btn-secondary btn-sm" id="otaHotUpdateBtn" style="background:#fff; color:#000; font-weight:800; border:none; padding:4px 10px; border-radius:12px; cursor:pointer;">⚡ Hot Reload</button>
    <a href="${directApkLink}" target="_blank" download="SLD.apk" class="btn btn-primary btn-sm" style="background:#10b981; color:#fff; font-weight:800; text-decoration:none; padding:4px 10px; border-radius:12px;">📥 Direct APK</a>
    <button style="background:none; border:none; color:#fff; cursor:pointer; font-weight:bold; font-size:1.1rem; margin-left:4px;" onclick="this.parentElement.remove()">✖</button>
  `;

  document.getElementById('otaHotUpdateBtn').onclick = () => performOtaHotUpdate(newVer);
}

window.initPWAandUpdates = initPWAandUpdates;
window.checkForAppUpdates = checkForAppUpdates;
window.handleNewVersionDetected = handleNewVersionDetected;
window.showUpdateAvailableBanner = showUpdateAvailableBanner;
window.performOtaHotUpdate = performOtaHotUpdate;
