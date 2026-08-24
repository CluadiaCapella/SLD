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
}

window.renderConnectionsPage = renderConnectionsPage;
