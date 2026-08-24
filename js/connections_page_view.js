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
  if (codeEl) {
    if (typeof localPeer !== 'undefined' && localPeer && !localPeer.destroyed && localPeer.id) {
      const shortCode = localPeer.id.replace(/^sld-device-/, 'SLD-').toUpperCase();
      codeEl.innerHTML = `<span style="color:#22c55e; font-weight:800;">🟢 Active</span> (${shortCode})`;
    } else {
      codeEl.textContent = 'Broadcasting is trying to activate...';
    }
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
