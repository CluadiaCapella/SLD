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

  const codeEl = document.getElementById('myDeviceCodeDisplay');
  if (codeEl && typeof myDeviceShortCode !== 'undefined' && myDeviceShortCode) {
    codeEl.textContent = `SLD-${myDeviceShortCode}`;
  }

  const addIpBtn = document.getElementById('addIpConnectionBtn');
  if (addIpBtn && !addIpBtn.dataset.bound) {
    addIpBtn.dataset.bound = 'true';
    addIpBtn.onclick = () => {
      if (typeof addIpConnection === 'function') addIpConnection();
    };
  }

  const openBlockBtn = document.getElementById('openBlockedIpsModalBtn');
  if (openBlockBtn && !openBlockBtn.dataset.bound) {
    openBlockBtn.dataset.bound = 'true';
    openBlockBtn.onclick = () => {
      if (typeof openBlockedIpsModal === 'function') openBlockedIpsModal();
    };
  }
}

window.renderConnectionsPage = renderConnectionsPage;
