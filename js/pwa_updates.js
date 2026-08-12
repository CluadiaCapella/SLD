/**
 * Section 7: PWA Installation & Auto-Update Manager Subsystem
 */

let deferredPrompt = null;
let isAutoUpdateEnabled = true;
let hasCheckedUpdatesThisSession = false;

async function initPWAandUpdates() {
  const toggleEl = document.getElementById('autoUpdateToggle');
  const checkBtn = document.getElementById('checkForUpdatesBtn');
  const installBtn = document.getElementById('installPwaBtn');

  const savedAutoUpdate = await db.getSetting('isAutoUpdateEnabled');
  if (savedAutoUpdate !== null && savedAutoUpdate !== undefined) {
    isAutoUpdateEnabled = !!savedAutoUpdate;
  }
  if (toggleEl) {
    toggleEl.checked = isAutoUpdateEnabled;
    toggleEl.onchange = async () => {
      isAutoUpdateEnabled = toggleEl.checked;
      await db.setSetting('isAutoUpdateEnabled', isAutoUpdateEnabled);
    };
  }

  if (checkBtn) {
    checkBtn.onclick = () => checkForAppUpdates(true);
  }

  const isApkMode = window.isNativeApk || window.location.protocol === 'file:' || window.navigator.userAgent.includes('SLDAndroidAPK');
  const badgeEl = document.getElementById('appEnvironmentBadge');
  if (badgeEl) {
    if (isApkMode) {
      badgeEl.textContent = '🤖 Native Android APK V1.2.0';
      badgeEl.style.background = 'rgba(16, 185, 129, 0.2)';
      badgeEl.style.color = '#34d399';
      badgeEl.style.borderColor = '#10b981';
    } else {
      badgeEl.textContent = '🌐 Web PWA & APK Available';
    }
  }

  if (installBtn) {
    installBtn.onclick = () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            installBtn.style.display = 'none';
          }
          deferredPrompt = null;
        });
      } else {
        alert('📲 How to Install SLD App on your phone:\n\n• Android (Chrome/Firefox): Tap browser menu ⋮ → "Add to Home screen" or "Install app".\n\n• iPhone (Safari): Tap Share ⎋ → "Add to Home Screen".');
      }
    };
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) {
      installBtn.style.display = 'inline-block';
    }
  });

  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      reg.onupdatefound = () => {
        const installingWorker = reg.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              handleNewVersionDetected();
            }
          };
        }
      };
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

  if (window.location.protocol !== 'file:') {
    try {
      const res = await fetch('./version.json?t=' + Date.now());
      if (res.ok) {
        data = await res.json();
      }
    } catch (err) {
      console.warn('Local version check failed, attempting remote GitHub check...', err);
    }
  }

  if (!data) {
    try {
      const remoteRes = await fetch('https://raw.githubusercontent.com/CluadiaCapella/SLD/main/version.json?t=' + Date.now());
      if (remoteRes.ok) {
        data = await remoteRes.json();
      }
    } catch (err) {
      console.warn('Remote GitHub version check failed:', err);
    }
  }

  if (data && data.version) {
    const currentLocalVersion = await db.getSetting('appVersion');

    await db.setSetting('appVersion', data.version);

    if (currentLocalVersion && currentLocalVersion !== data.version) {
      showUpdateAvailableBanner(data.version);
    } else {
      if (userTriggered) alert(`Your app is up to date! (V${data.version})`);
    }
  } else {
    if (userTriggered) alert('Unable to check for updates. Please check your internet connection.');
  }
}

async function handleNewVersionDetected(newVer = '') {
  if (isAutoUpdateEnabled) {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
    setTimeout(() => window.location.reload(), 500);
  } else {
    showUpdateAvailableBanner(newVer);
  }
}

function showUpdateAvailableBanner(newVer = '') {
  let banner = document.getElementById('appUpdateBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'appUpdateBanner';
    banner.style.cssText = `
      position: fixed; top: 70px; left: 50%; transform: translateX(-50%); z-index: 9999;
      background: linear-gradient(135deg, var(--accent-pink), var(--accent-blue));
      color: #fff; padding: 10px 20px; border-radius: 30px; font-weight: 800; font-size: 0.85rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 12px;
    `;
    document.body.appendChild(banner);
  }
  banner.innerHTML = `
    <span>🚀 New Version Available! ${newVer ? '(V' + newVer + ')' : ''}</span>
    <button class="btn btn-secondary btn-sm" id="reloadUpdateBtn" style="background:#fff; color:#000; font-weight:800;">Update Now</button>
    <button style="background:none; border:none; color:#fff; cursor:pointer; font-weight:bold;" onclick="this.parentElement.remove()">✖</button>
  `;
  document.getElementById('reloadUpdateBtn').onclick = () => window.location.reload();
}

window.initPWAandUpdates = initPWAandUpdates;
window.checkForAppUpdates = checkForAppUpdates;
window.handleNewVersionDetected = handleNewVersionDetected;
window.showUpdateAvailableBanner = showUpdateAvailableBanner;
