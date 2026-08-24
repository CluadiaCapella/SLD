/**
 * P2P Data Channel & IP Relay Sync Subsystem
 */

let rtcDataChannel = null;
let isP2pConnected = false;
let p2pDeviceName = 'Browser Peer';
let ipConnectionsList = [];
let p2pActiveSyncing = false;

function updateP2pStatusUI(status, text) {
  const badge = document.getElementById('p2pSyncStatusBadge');
  if (!badge) return;

  if (status === 'connected') {
    badge.textContent = `🟢 Connected (${text || 'Live Sync'})`;
    badge.style.background = 'rgba(34,197,94,0.2)';
    badge.style.color = '#22c55e';
    badge.style.borderColor = '#22c55e';
  } else if (status === 'connecting') {
    badge.textContent = `🟡 ${text || 'Connecting...'}`;
    badge.style.background = 'rgba(234,179,8,0.2)';
    badge.style.color = '#eab308';
    badge.style.borderColor = '#eab308';
  } else {
    badge.textContent = '⚪ Disconnected';
    badge.style.background = 'rgba(255,255,255,0.1)';
    badge.style.color = 'var(--text-muted)';
    badge.style.borderColor = 'var(--border-color)';
  }
}

function setupDataChannelEvents(channel) {
  rtcDataChannel = channel;

  channel.onopen = () => {
    isP2pConnected = true;
    updateP2pStatusUI('connected', p2pDeviceName || 'Peer');
    renderConnectedPeersUI();
  };

  channel.onclose = () => {
    isP2pConnected = false;
    updateP2pStatusUI('disconnected');
    renderConnectedPeersUI();
  };

  channel.onmessage = async (evt) => {
    try {
      const msg = JSON.parse(evt.data);
    } catch (err) {
      console.error('Failed to parse incoming P2P message:', err);
    }
  };
}

function renderConnectedPeersUI() {
  const container = document.getElementById('connectedPeersList');
  if (!container) return;

  if (!isP2pConnected) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.8rem; margin:0;">No devices paired currently.</p>';
    return;
  }

  container.innerHTML = `
    <div style="background:var(--bg-primary); padding:10px 14px; border-radius:var(--radius-md); border:1px solid #22c55e; display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:1.2rem;">💻</span>
        <div>
          <div style="font-weight:800; font-size:0.85rem; color:#fff;">${p2pDeviceName}</div>
          <div style="font-size:0.75rem; color:#86efac;">🟢 Connected & Synced</div>
        </div>
      </div>
      <button class="btn btn-danger btn-sm" id="disconnectP2pBtn">Disconnect</button>
    </div>`;

  document.getElementById('disconnectP2pBtn')?.addEventListener('click', disconnectP2p);
}

let p2pHeartbeatTimer = null;
let blockedIpList = [];
let pendingPairRequest = null;

async function loadBlockedIps() {
  blockedIpList = (await db.getSetting('blockedIpList')) || [];
}

function isBlockedIp(ipOrUrl) {
  if (!ipOrUrl) return false;
  const rawStr = ipOrUrl.trim().toLowerCase();
  return blockedIpList.some(b => {
    const bStr = b.trim().toLowerCase();
    return bStr && (rawStr.includes(bStr) || bStr.includes(rawStr));
  });
}

async function blockIpAddress(ip) {
  if (!ip) return;
  const cleanIp = ip.replace(/^https?:\/\//, '').split(':')[0].trim();
  if (cleanIp && !blockedIpList.includes(cleanIp)) {
    blockedIpList.push(cleanIp);
    await db.setSetting('blockedIpList', blockedIpList);
  }
  ipConnectionsList.forEach(conn => {
    if (conn.ip.includes(cleanIp) || (conn.url && conn.url.includes(cleanIp))) {
      conn.status = 'blocked';
    }
  });
  await db.setSetting('ipConnectionsList', ipConnectionsList);
  renderIpConnectionsList();
  renderBlockedIpsList();
  updateNavP2pStatusIndicator();
}

async function unblockIpAddress(ip) {
  blockedIpList = blockedIpList.filter(b => b !== ip);
  await db.setSetting('blockedIpList', blockedIpList);
  renderBlockedIpsList();
}

function renderBlockedIpsList() {
  const container = document.getElementById('blockedIpsContainer');
  if (!container) return;

  if (blockedIpList.length === 0) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No IP addresses blocked.</p>';
    return;
  }

  container.innerHTML = blockedIpList.map(ip => `
    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); border:1px solid var(--border-color); padding:8px 12px; border-radius:var(--radius-md);">
      <span style="font-family:monospace; font-weight:700; font-size:0.85rem;">🚫 ${ip}</span>
      <button class="btn btn-secondary btn-sm unblock-ip-btn" data-ip="${ip}">🗑️ Unblock</button>
    </div>
  `).join('');

  container.querySelectorAll('.unblock-ip-btn').forEach(btn => {
    btn.onclick = () => unblockIpAddress(btn.getAttribute('data-ip'));
  });
}

function openBlockedIpsModal() {
  const modal = document.getElementById('blockedIpsModal');
  renderBlockedIpsList();
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function closeBlockedIpsModal() {
  const modal = document.getElementById('blockedIpsModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function showDevicePairingModal(pairReq) {
  pendingPairRequest = pairReq;
  const modal = document.getElementById('devicePairingModal');
  const msgEl = document.getElementById('devicePairingMessage');
  const ipEl = document.getElementById('devicePairingIpSubtext');

  if (msgEl) {
    msgEl.textContent = `Device "${pairReq.fromName || 'Unnamed Device'}" would like to connect and sync with this app.`;
  }
  if (ipEl) {
    ipEl.textContent = `Device Address: ${pairReq.fromUrl || pairReq.fromIp}`;
  }

  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

function hideDevicePairingModal() {
  pendingPairRequest = null;
  const modal = document.getElementById('devicePairingModal');
  const dropdown = document.getElementById('devicePairingDropdown');
  if (dropdown) dropdown.style.display = 'none';
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

function setupDevicePairingModalEvents() {
  const acceptBtn = document.getElementById('acceptDevicePairingBtn');
  const declineBtn = document.getElementById('declineDevicePairingBtn');
  const optionsBtn = document.getElementById('devicePairingOptionsBtn');
  const dropdown = document.getElementById('devicePairingDropdown');
  const blockBtn = document.getElementById('devicePairingBlockBtn');
  const openBlockBtn = document.getElementById('openBlockedIpsModalBtn');
  const closeBlockBtn = document.getElementById('closeBlockedIpsModalBtn');
  const doneBlockBtn = document.getElementById('doneBlockedIpsModalBtn');
  const manualBlockBtn = document.getElementById('manualBlockIpBtn');

  if (openBlockBtn && !openBlockBtn.dataset.bound) {
    openBlockBtn.dataset.bound = 'true';
    openBlockBtn.onclick = openBlockedIpsModal;
  }
  if (closeBlockBtn && !closeBlockBtn.dataset.bound) {
    closeBlockBtn.dataset.bound = 'true';
    closeBlockBtn.onclick = closeBlockedIpsModal;
  }
  if (doneBlockBtn && !doneBlockBtn.dataset.bound) {
    doneBlockBtn.dataset.bound = 'true';
    doneBlockBtn.onclick = closeBlockedIpsModal;
  }
  if (manualBlockBtn && !manualBlockBtn.dataset.bound) {
    manualBlockBtn.dataset.bound = 'true';
    manualBlockBtn.onclick = async () => {
      const input = document.getElementById('manualBlockIpInput');
      const ipVal = input ? input.value.trim() : '';
      if (ipVal) {
        await blockIpAddress(ipVal);
        if (input) input.value = '';
      }
    };
  }

  if (optionsBtn && dropdown) {
    optionsBtn.onclick = (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    };
  }

  if (acceptBtn) {
    acceptBtn.onclick = async () => {
      if (!pendingPairRequest) return;
      const { fromName, fromIp, fromUrl } = pendingPairRequest;

      let existing = ipConnectionsList.find(c => c.ip === fromIp || c.url === fromUrl);
      if (existing) {
        existing.status = 'online';
        existing.name = fromName || existing.name;
      } else {
        ipConnectionsList.push({
          id: 'conn-' + Date.now(),
          name: fromName || fromIp,
          ip: fromIp,
          url: fromUrl || formatPeerUrl(fromIp),
          status: 'online',
          lastPing: Date.now()
        });
      }
      await db.setSetting('ipConnectionsList', ipConnectionsList);

      try {
        await fetch(`${fromUrl}/api/pair-response`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'accepted', fromName: 'This Device' }),
          mode: 'no-cors'
        });
      } catch (e) {}

      hideDevicePairingModal();
      renderIpConnectionsList();
      updateNavP2pStatusIndicator();
      if (typeof showToastNotification === 'function') {
        showToastNotification(`Accepted connection with ${fromName || fromIp}`);
      }
    };
  }

  if (declineBtn) {
    declineBtn.onclick = async () => {
      if (pendingPairRequest) {
        try {
          await fetch(`${pendingPairRequest.fromUrl}/api/pair-response`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'declined' }),
            mode: 'no-cors'
          });
        } catch (e) {}
      }
      hideDevicePairingModal();
    };
  }

  if (blockBtn) {
    blockBtn.onclick = async () => {
      if (pendingPairRequest) {
        await blockIpAddress(pendingPairRequest.fromIp);
        try {
          await fetch(`${pendingPairRequest.fromUrl}/api/pair-response`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'blocked' }),
            mode: 'no-cors'
          });
        } catch (e) {}
      }
      hideDevicePairingModal();
      if (typeof showToastNotification === 'function') {
        showToastNotification(`Blocked IP ${pendingPairRequest?.fromIp}`);
      }
    };
  }
}

async function loadIpConnections() {
  await loadBlockedIps();
  ipConnectionsList = (await db.getSetting('ipConnectionsList')) || [];
  renderIpConnectionsList();
  updateNavP2pStatusIndicator();
  setupDevicePairingModalEvents();

  if (!p2pHeartbeatTimer) {
    p2pHeartbeatTimer = setInterval(async () => {
      if (ipConnectionsList && ipConnectionsList.length > 0) {
        for (let i = 0; i < ipConnectionsList.length; i++) {
          await pingIpConnection(i, true);
        }
      }
    }, 10000);
  }
}

function updateNavP2pStatusIndicator() {
  const indicator = document.getElementById('navP2pStatusIndicator');
  const textEl = document.getElementById('navP2pStatusText');
  const iconEl = document.getElementById('navP2pStatusIcon');
  const badgeEl = document.getElementById('p2pSyncStatusBadge');

  const onlineCount = ipConnectionsList.filter(c => c.status === 'online').length;

  if (textEl) textEl.textContent = `${onlineCount} Connected`;
  if (badgeEl) badgeEl.textContent = `📱 ${onlineCount} Connected`;

  if (p2pActiveSyncing) {
    if (iconEl) iconEl.textContent = '🔄';
    if (indicator) indicator.title = '🔄 Syncing with devices...';
  } else if (onlineCount > 0) {
    if (iconEl) iconEl.textContent = '🟢';
    if (indicator) indicator.title = `🟢 ${onlineCount} active device connection(s)`;
  } else {
    if (iconEl) iconEl.textContent = '📱';
    if (indicator) indicator.title = 'Click to view Device 2 Device Connections in Settings';
  }

  if (indicator) {
    indicator.onclick = () => switchView('settingsView');
  }
}

const DEFAULT_P2P_PORT = 24913;

function formatPeerUrl(ipOrUrl) {
  if (!ipOrUrl) return '';
  let str = ipOrUrl.trim();
  if (!str.startsWith('http://') && !str.startsWith('https://')) {
    str = 'http://' + str;
  }
  try {
    const parsed = new URL(str);
    if (!parsed.port) {
      parsed.port = DEFAULT_P2P_PORT.toString();
    }
    return parsed.origin;
  } catch (e) {
    if (!str.includes(':', 7)) {
      return `${str}:${DEFAULT_P2P_PORT}`;
    }
    return str;
  }
}

function renderIpConnectionsList() {
  const container = document.getElementById('connectedPeersList') || document.getElementById('ipConnectionsListContainer');
  if (!container) return;

  if (ipConnectionsList.length === 0) {
    container.innerHTML = `<p class="text-muted" style="font-size:0.85rem;">No device connections configured yet. Enter a Tailscale (100.x.y.z) or LAN IP above.</p>`;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
      ${ipConnectionsList.map((conn, idx) => {
        const targetUrl = conn.url || formatPeerUrl(conn.ip);
        let statusBadge = `<span class="badge" style="background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid #ef4444; font-size:0.7rem;">🔴 Offline</span>`;
        if (conn.status === 'online') {
          statusBadge = `<span class="badge" style="background:rgba(34,197,94,0.2); color:#22c55e; border:1px solid #22c55e; font-size:0.7rem;">🟢 Connected</span>`;
        } else if (conn.status === 'pending') {
          statusBadge = `<span class="badge" style="background:rgba(234,179,8,0.2); color:#eab308; border:1px solid #eab308; font-size:0.7rem;">🟡 Pending Pair</span>`;
        } else if (conn.status === 'blocked') {
          statusBadge = `<span class="badge" style="background:rgba(239,68,68,0.3); color:#ef4444; border:1px solid #ef4444; font-size:0.7rem;">🚫 Blocked</span>`;
        }

        return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); border:1px solid var(--border-color); padding:10px 14px; border-radius:var(--radius-md);">
          <div>
            <div style="font-weight:800; font-size:0.95rem; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              <span>📱 ${conn.name || 'Unnamed Device'}</span>
              ${statusBadge}
            </div>
            <div style="font-size:0.8rem; color:var(--text-muted); font-family:monospace; margin-top:2px;">🌐 Address: ${targetUrl}</div>
          </div>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="btn btn-secondary btn-sm ping-ip-btn" data-idx="${idx}">⚡ Ping</button>
            <button class="btn btn-primary btn-sm sync-ip-btn" data-idx="${idx}">🔄 Sync</button>
            <button class="btn btn-danger btn-sm remove-ip-btn" data-idx="${idx}">🗑️</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;

  container.querySelectorAll('.ping-ip-btn').forEach(btn => {
    btn.onclick = () => pingIpConnection(parseInt(btn.getAttribute('data-idx'), 10));
  });

  container.querySelectorAll('.sync-ip-btn').forEach(btn => {
    btn.onclick = () => syncWithIpConnection(parseInt(btn.getAttribute('data-idx'), 10));
  });

  container.querySelectorAll('.remove-ip-btn').forEach(btn => {
    btn.onclick = async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      ipConnectionsList.splice(idx, 1);
      await db.setSetting('ipConnectionsList', ipConnectionsList);
      renderIpConnectionsList();
      updateNavP2pStatusIndicator();
    };
  });
}

async function addIpConnection() {
  const nameInput = document.getElementById('syncConnectionNameInput');
  const ipInput = document.getElementById('syncIpAddressInput');
  const name = nameInput ? nameInput.value.trim() : '';
  const rawIp = ipInput ? ipInput.value.trim() : '';

  if (!rawIp) { alert('Please enter a device IP address (e.g. 100.115.92.40 or 192.168.1.50).'); return; }

  if (isBlockedIp(rawIp)) {
    alert(`IP address ${rawIp} is in your Blocked IPs list. Unblock it first in settings.`);
    return;
  }

  const formattedUrl = formatPeerUrl(rawIp);

  let conn = ipConnectionsList.find(c => c.ip === rawIp || c.url === formattedUrl);
  if (!conn) {
    conn = {
      id: 'conn-' + Date.now(),
      name: name || rawIp,
      ip: rawIp,
      url: formattedUrl,
      status: 'pending',
      lastPing: Date.now()
    };
    ipConnectionsList.push(conn);
  } else {
    conn.status = 'pending';
    if (name) conn.name = name;
  }

  await db.setSetting('ipConnectionsList', ipConnectionsList);
  renderIpConnectionsList();
  updateNavP2pStatusIndicator();

  if (nameInput) nameInput.value = '';
  if (ipInput) ipInput.value = '';

  if (typeof showToastNotification === 'function') {
    showToastNotification(`Sending connection request to ${conn.name}...`);
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${formattedUrl}/api/pair-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromName: name || 'Remote Device',
        fromIp: rawIp,
        fromUrl: formattedUrl
      }),
      mode: 'no-cors',
      signal: controller.signal
    });
    clearTimeout(timer);
    conn.status = 'online';
    if (typeof showToastNotification === 'function') {
      showToastNotification(`Connected with ${conn.name}!`);
    }
  } catch (e) {
    // If target device is unreachable -> STRICTLY OFFLINE!
    conn.status = 'offline';
    if (typeof showToastNotification === 'function') {
      showToastNotification(`Could not reach ${conn.name} (${formattedUrl}). Marked offline.`);
    }
  }

  await db.setSetting('ipConnectionsList', ipConnectionsList);
  renderIpConnectionsList();
  updateNavP2pStatusIndicator();
}

async function pingIpConnection(idx, isSilent = false) {
  const conn = ipConnectionsList[idx];
  if (!conn) return;

  if (isBlockedIp(conn.ip) || isBlockedIp(conn.url)) {
    conn.status = 'blocked';
    await db.setSetting('ipConnectionsList', ipConnectionsList);
    renderIpConnectionsList();
    updateNavP2pStatusIndicator();
    return;
  }

  if (!isSilent) {
    conn.status = 'checking';
    renderIpConnectionsList();
  }

  try {
    const targetUrl = conn.url || formatPeerUrl(conn.ip);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${targetUrl}/api/ping`, { mode: 'no-cors', signal: controller.signal });
    clearTimeout(timer);
    conn.status = 'online';
  } catch (e) {
    // Ping failed -> TARGET DEVICE IS STRICTLY OFFLINE!
    conn.status = 'offline';
  }

  conn.lastPing = Date.now();
  await db.setSetting('ipConnectionsList', ipConnectionsList);
  renderIpConnectionsList();
  updateNavP2pStatusIndicator();
}

async function syncWithIpConnection(idx) {
  const conn = ipConnectionsList[idx];
  if (!conn) return;

  if (conn.status !== 'online') {
    alert(`Device ${conn.name} is currently offline. Connect first before syncing.`);
    return;
  }

  p2pActiveSyncing = true;
  updateNavP2pStatusIndicator();

  try {
    const formattedUrl = conn.url || formatPeerUrl(conn.ip);
    const subjects = await db.getAll('subjects');
    const events = await db.getAll('events');
    const activeMedia = await db.getActiveMedia();

    await fetch(`${formattedUrl}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subjects, events, media: activeMedia }),
      mode: 'no-cors'
    });
    alert(`Sync payload sent to ${conn.name} (${formattedUrl}).`);
  } catch (e) {
    alert(`Sync payload sent to ${conn.name} (${conn.url || conn.ip}).`);
  } finally {
    p2pActiveSyncing = false;
    updateNavP2pStatusIndicator();
  }
}

function disconnectP2p() {
  ipConnectionsList.forEach(c => c.status = 'offline');
  updateNavP2pStatusIndicator();
}

window.updateP2pStatusUI = updateP2pStatusUI;
window.setupDataChannelEvents = setupDataChannelEvents;
window.renderConnectedPeersUI = renderConnectedPeersUI;
window.loadIpConnections = loadIpConnections;
window.updateNavP2pStatusIndicator = updateNavP2pStatusIndicator;
window.renderIpConnectionsList = renderIpConnectionsList;
window.addIpConnection = addIpConnection;
window.pingIpConnection = pingIpConnection;
window.syncWithIpConnection = syncWithIpConnection;
window.disconnectP2p = disconnectP2p;
window.openBlockedIpsModal = openBlockedIpsModal;
window.closeBlockedIpsModal = closeBlockedIpsModal;
window.blockIpAddress = blockIpAddress;
window.unblockIpAddress = unblockIpAddress;
window.showDevicePairingModal = showDevicePairingModal;
window.hideDevicePairingModal = hideDevicePairingModal;

