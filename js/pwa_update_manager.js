/**
 * Progressive Web App & Seamless Background OTA Engine
 */

const CURRENT_BUILD_VERSION = '260902.0252';
let isCheckingOtaUpdate = false;

async function updateNavVersionTag() {
  const tag = document.getElementById('navVersionTag');
  if (tag) {
    let ver = await db.getSetting('appVersion');
    if (!ver || ver < CURRENT_BUILD_VERSION) {
      ver = CURRENT_BUILD_VERSION;
      await db.setSetting('appVersion', CURRENT_BUILD_VERSION);
    }
    tag.textContent = `v${ver}`;
  }
}

async function initPWAandUpdates() {
  await updateNavVersionTag();
  checkForAppUpdates(false);
}

async function checkForAppUpdates(userTriggered = false) {
  if (isCheckingOtaUpdate) return;
  isCheckingOtaUpdate = true;

  if (userTriggered && typeof showToastNotification === 'function') {
    showToastNotification('⚡ Checking GitHub for OTA updates...');
  }

  try {
    const remoteRes = await fetch('https://raw.githubusercontent.com/CluadiaCapella/SLD/main/version.json?t=' + Date.now());
    if (!remoteRes.ok) {
      if (userTriggered && typeof showToastNotification === 'function') {
        showToastNotification('⚠️ Could not connect to GitHub version server.');
      }
      await updateNavVersionTag();
      isCheckingOtaUpdate = false;
      return;
    }

    const data = await remoteRes.json();

    if (data && data.version) {
      const storedVersion = (await db.getSetting('appVersion')) || CURRENT_BUILD_VERSION;

      if (storedVersion !== data.version) {
        await applyBackgroundOtaUpdate(data.version);
      } else {
        await db.setSetting('appVersion', data.version);
        await updateNavVersionTag();
        if (userTriggered && typeof showToastNotification === 'function') {
          showToastNotification(`✅ App is up to date (v${data.version}).`);
        }
      }
    }
  } catch (err) {
    await updateNavVersionTag();
    if (userTriggered && typeof showToastNotification === 'function') {
      showToastNotification('⚠️ OTA update check failed: Network offline.');
    }
  }

  isCheckingOtaUpdate = false;
}

async function applyBackgroundOtaUpdate(newVersion) {
  try {
    if (typeof showToastNotification === 'function') {
      showToastNotification(`⚡ Applying OTA update to v${newVersion}...`);
    }

    const filesToUpdate = [
      { key: 'ota_code_p2p_sync_network', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/p2p_sync_network.js' },
      { key: 'ota_code_connections_page_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/connections_page_view.js' },
      { key: 'ota_code_connections_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/html/connections_view.js' },
      { key: 'ota_code_events_page_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/events_page_view.js' },
      { key: 'ota_code_event_details_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/event_details_view.js' },
      { key: 'ota_code_sld_list_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/sld_list_view.js' },
      { key: 'ota_code_sld_details_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/sld_details_view.js' },
      { key: 'ota_code_subjects_page_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/subjects_page_view.js' },
      { key: 'ota_code_subject_details_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/subject_details_view.js' },
      { key: 'ota_code_tags_page_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/tags_page_view.js' },
      { key: 'ota_code_tag_details_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/tag_details_view.js' },
      { key: 'ota_code_settings_page_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/settings_page_view.js' },
      { key: 'ota_code_settings_view', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/html/settings_view.js' },
      { key: 'ota_code_database', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/database.js' },
      { key: 'ota_code_router_views', url: 'https://raw.githubusercontent.com/CluadiaCapella/SLD/main/js/router_views.js' }
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
    await updateNavVersionTag();

    if (typeof showToastNotification === 'function') {
      showToastNotification('✅ App updated successfully! Reloading...');
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
window.updateNavVersionTag = updateNavVersionTag;
