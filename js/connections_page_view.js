/**
 * Connections Page View Subsystem
 */

async function renderConnectionsPage() {
  if (typeof loadIpConnections === 'function' && (!window.myDeviceShortCode || !window.ipConnectionsList)) {
    await loadIpConnections();
  } else if (typeof initLocalPeerServer === 'function' && !window.myDeviceShortCode) {
    await initLocalPeerServer();
  }

  if (typeof renderIpConnectionsList === 'function') {
    renderIpConnectionsList();
  }
  if (typeof updateNavP2pStatusIndicator === 'function') {
    updateNavP2pStatusIndicator();
  }
  if (typeof updateBroadcastingUI === 'function') {
    updateBroadcastingUI();
  }
  if (typeof updateDiagnosticsDashboardUI === 'function') {
    updateDiagnosticsDashboardUI();
  }

  const broadcastToggleBtn = document.getElementById('toggleBroadcastingBtn');
  if (broadcastToggleBtn && !broadcastToggleBtn.dataset.bound) {
    broadcastToggleBtn.dataset.bound = 'true';
    broadcastToggleBtn.onclick = () => {
      if (typeof setBroadcastingEnabled === 'function') {
        setBroadcastingEnabled(!window.isBroadcastingEnabled);
      }
    };
  }

  const openDelBtn = document.getElementById('openDeletedDevicesModalBtn');
  if (openDelBtn && !openDelBtn.dataset.bound) {
    openDelBtn.dataset.bound = 'true';
    openDelBtn.onclick = () => {
      if (typeof openDeletedDevicesModal === 'function') openDeletedDevicesModal();
    };
  }

  const closeDelBtn = document.getElementById('closeDeletedDevicesModalBtn');
  if (closeDelBtn && !closeDelBtn.dataset.bound) {
    closeDelBtn.dataset.bound = 'true';
    closeDelBtn.onclick = () => {
      if (typeof closeDeletedDevicesModal === 'function') closeDeletedDevicesModal();
    };
  }

  const runDiagBtn = document.getElementById('runNetworkDiagBtn');
  if (runDiagBtn && !runDiagBtn.dataset.bound) {
    runDiagBtn.dataset.bound = 'true';
    runDiagBtn.onclick = () => {
      if (typeof runP2pDiagnosticTest === 'function') runP2pDiagnosticTest();
    };
  }

  const copyDiagBtn = document.getElementById('copyDiagLogsBtn');
  if (copyDiagBtn && !copyDiagBtn.dataset.bound) {
    copyDiagBtn.dataset.bound = 'true';
    copyDiagBtn.onclick = () => {
      const consoleEl = document.getElementById('diagConsoleLog');
      if (consoleEl) {
        const text = consoleEl.innerText || consoleEl.textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(() => {
            if (typeof showToastNotification === 'function') showToastNotification('📋 Diagnostics log copied to clipboard!');
          });
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          if (typeof showToastNotification === 'function') showToastNotification('📋 Diagnostics log copied to clipboard!');
        }
      }
    };
  }

  const clearDiagBtn = document.getElementById('clearDiagLogsBtn');
  if (clearDiagBtn && !clearDiagBtn.dataset.bound) {
    clearDiagBtn.dataset.bound = 'true';
    clearDiagBtn.onclick = () => {
      const consoleEl = document.getElementById('diagConsoleLog');
      if (consoleEl) consoleEl.innerHTML = '<div>[INFO] Log cleared.</div>';
    };
  }
}

window.renderConnectionsPage = renderConnectionsPage;
