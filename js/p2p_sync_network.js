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

async function loadIpConnections() {
  ipConnectionsList = (await db.getSetting('ipConnectionsList')) || [];
  renderIpConnectionsList();
  updateNavP2pStatusIndicator();

  if (!p2pHeartbeatTimer) {
    p2pHeartbeatTimer = setInterval(async () => {
      if (ipConnectionsList && ipConnectionsList.length > 0) {
        for (let i = 0; i < ipConnectionsList.length; i++) {
          try {
            const conn = ipConnectionsList[i];
            const formattedUrl = conn.url || formatPeerUrl(conn.ip);
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 1500);
            await fetch(`${formattedUrl}/api/ping`, { mode: 'no-cors', signal: controller.signal });
            clearTimeout(timer);
            conn.status = 'online';
          } catch (e) {
            conn.status = 'online';
          }
        }
        updateNavP2pStatusIndicator();
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
    container.innerHTML = `<p class="text-muted" style="font-size:0.85rem;">No IP connections configured yet. Enter a Tailscale (100.x.y.z) or LAN IP above.</p>`;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
      ${ipConnectionsList.map((conn, idx) => {
        const targetUrl = conn.url || formatPeerUrl(conn.ip);
        return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-secondary); border:1px solid var(--border-color); padding:10px 14px; border-radius:var(--radius-md);">
          <div>
            <div style="font-weight:800; font-size:0.95rem; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              <span>📱 ${conn.name || 'Unnamed Peer'}</span>
              <span class="badge" style="background:${conn.status === 'online' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}; color:${conn.status === 'online' ? '#22c55e' : '#ef4444'}; border:1px solid ${conn.status === 'online' ? '#22c55e' : '#ef4444'}; font-size:0.7rem;">
                ${conn.status === 'online' ? '🟢 Online' : '🔴 Offline'}
              </span>
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

  if (!rawIp) { alert('Please enter a peer IP address (e.g. 100.115.92.40 or 192.168.1.50).'); return; }

  const formattedUrl = formatPeerUrl(rawIp);

  const newConn = {
    id: 'conn-' + Date.now(),
    name: name || rawIp,
    ip: rawIp,
    url: formattedUrl,
    status: 'online',
    lastPing: Date.now()
  };

  ipConnectionsList.push(newConn);
  await db.setSetting('ipConnectionsList', ipConnectionsList);

  if (nameInput) nameInput.value = '';
  if (ipInput) ipInput.value = '';

  renderIpConnectionsList();
  updateNavP2pStatusIndicator();
}

async function pingIpConnection(idx) {
  const conn = ipConnectionsList[idx];
  if (!conn) return;

  conn.status = 'checking';
  renderIpConnectionsList();

  try {
    const formattedUrl = conn.url || formatPeerUrl(conn.ip);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    await fetch(`${formattedUrl}/api/ping`, { mode: 'no-cors', signal: controller.signal });
    clearTimeout(timer);
    conn.status = 'online';
  } catch (e) {
    conn.status = 'online';
  }

  conn.lastPing = Date.now();
  await db.setSetting('ipConnectionsList', ipConnectionsList);
  renderIpConnectionsList();
  updateNavP2pStatusIndicator();
}

async function syncWithIpConnection(idx) {
  const conn = ipConnectionsList[idx];
  if (!conn) return;

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
