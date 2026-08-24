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
    msgEl.textContent = `Device "${pairReq.fromName || 'Unnamed Device'}" wants to connect and sync with this app.`;
  }
  if (ipEl) {
    ipEl.textContent = `Device Address: ${pairReq.fromUrl || pairReq.fromIp}`;
  }

  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
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
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
  }
}

let localPeer = null;
let activePeerConnections = new Map();
let myDevicePeerId = null;
let myDeviceShortCode = null;
let lanBroadcastChannel = null;

function sanitizePeerId(ipOrCode) {
  if (!ipOrCode) return 'sld-device-unknown';
  const clean = ipOrCode.replace(/^https?:\/\//, '').replace(/^SLD-/i, '').split(':')[0].split('/')[0].replace(/[^a-zA-Z0-9]/g, '-').toLowerCase().trim();
  return 'sld-device-' + clean;
}

function ipOrUrlClean(input) {
  if (!input) return '';
  return input.replace(/^https?:\/\//, '').replace(/^SLD-/i, '').split(':')[0].split('/')[0].trim().toLowerCase();
}

async function registerDiscoveredDevice(remoteCode, remoteName) {
  if (!remoteCode || remoteCode === myDeviceShortCode) return;
  const cleanCode = ipOrUrlClean(remoteCode);

  let match = ipConnectionsList.find(c =>
    ipOrUrlClean(c.ip) === cleanCode ||
    ipOrUrlClean(c.url) === cleanCode ||
    c.peerId === sanitizePeerId(remoteCode)
  );

  if (!match) {
    match = {
      id: 'conn-' + Date.now(),
      name: remoteName || `Device SLD-${remoteCode}`,
      ip: remoteCode,
      url: formatPeerUrl(remoteCode),
      peerId: sanitizePeerId(remoteCode),
      status: 'online',
      allowSync: false,
      remoteAllowSync: false,
      lastPing: Date.now()
    };
    ipConnectionsList.push(match);

    if (typeof addNotification === 'function') {
      addNotification('Device Discovered', `Device "${match.name}" auto-discovered on network.`, 'success');
    }
  } else {
    match.status = 'online';
    match.peerId = sanitizePeerId(remoteCode);
    if (remoteName && (!match.name || match.name.startsWith('Device SLD-'))) {
      match.name = remoteName;
    }
  }

  await db.setSetting('ipConnectionsList', ipConnectionsList);
  renderIpConnectionsList();
  updateNavP2pStatusIndicator();

  let activeConn = activePeerConnections.get(match.peerId);
  if (!activeConn || !activeConn.open) {
    sendPairRequestToDevice(match);
  }
}

function broadcastLocalPresence() {
  if (lanBroadcastChannel && myDeviceShortCode) {
    lanBroadcastChannel.postMessage({
      type: 'LAN_HELLO',
      code: myDeviceShortCode,
      name: p2pDeviceName || 'App Device'
    });
  }
}

let presenceHubConn = null;
let hubFallbackPeer = null;
const hubConnectedClients = new Map();

function initPresenceRoomHub() {
  if (!localPeer || localPeer.destroyed) return;

  const roomPeerId = 'sld-room-hub-v1';
  if (myDevicePeerId === roomPeerId) return;

  try {
    const hubConn = localPeer.connect(roomPeerId, { reliable: true });
    hubConn.on('open', () => {
      presenceHubConn = hubConn;
      hubConn.send({
        type: 'PRESENCE_ANNOUNCE',
        code: myDeviceShortCode,
        name: p2pDeviceName || 'App Device',
        peerId: myDevicePeerId
      });
    });

    hubConn.on('data', async (data) => {
      if (data && data.type === 'PRESENCE_LIST' && Array.isArray(data.devices)) {
        for (const dev of data.devices) {
          if (dev.code && dev.code !== myDeviceShortCode) {
            await registerDiscoveredDevice(dev.code, dev.name);
          }
        }
      } else if (data && data.type === 'PRESENCE_ANNOUNCE') {
        if (data.code && data.code !== myDeviceShortCode) {
          await registerDiscoveredDevice(data.code, data.name);
        }
      }
    });

    hubConn.on('error', () => {
      createHubFallbackPeer();
    });
  } catch (e) {
    createHubFallbackPeer();
  }
}

function createHubFallbackPeer() {
  if (hubFallbackPeer || typeof Peer === 'undefined') return;
  try {
    hubFallbackPeer = new Peer('sld-room-hub-v1', {
      debug: 0,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });

    hubFallbackPeer.on('connection', (clientConn) => {
      clientConn.on('data', (msg) => {
        if (msg && msg.type === 'PRESENCE_ANNOUNCE') {
          hubConnectedClients.set(msg.peerId, { code: msg.code, name: msg.name, peerId: msg.peerId, conn: clientConn });

          const deviceList = Array.from(hubConnectedClients.values()).map(c => ({ code: c.code, name: c.name, peerId: c.peerId }));
          clientConn.send({ type: 'PRESENCE_LIST', devices: deviceList });

          hubConnectedClients.forEach((client) => {
            if (client.peerId !== msg.peerId && client.conn.open) {
              client.conn.send({ type: 'PRESENCE_ANNOUNCE', code: msg.code, name: msg.name, peerId: msg.peerId });
            }
          });
        }
      });

      clientConn.on('close', () => {
        for (const [pid, client] of hubConnectedClients.entries()) {
          if (client.conn === clientConn) {
            hubConnectedClients.delete(pid);
            break;
          }
        }
      });
    });

    hubFallbackPeer.on('error', () => {});
  } catch (e) {}
}

async function initLocalPeerServer() {
  if (localPeer && !localPeer.destroyed) return;

  let savedCode = (await db.getSetting('myDeviceShortCode')) || '';
  if (!savedCode) {
    savedCode = Math.floor(1000 + Math.random() * 9000).toString();
    await db.setSetting('myDeviceShortCode', savedCode);
  }
  myDeviceShortCode = savedCode;
  myDevicePeerId = sanitizePeerId(savedCode);

  const codeEl = document.getElementById('myDeviceCodeDisplay');
  if (codeEl) {
    codeEl.textContent = 'Broadcasting is trying to activate...';
  }

  if (typeof BroadcastChannel !== 'undefined' && !lanBroadcastChannel) {
    try {
      lanBroadcastChannel = new BroadcastChannel('sld_d2d_lan_channel');
      lanBroadcastChannel.onmessage = async (evt) => {
        if (!evt.data) return;
        if (evt.data.type === 'LAN_HELLO') {
          const remoteCode = evt.data.code;
          const remoteName = evt.data.name;
          if (remoteCode && remoteCode !== myDeviceShortCode) {
            await registerDiscoveredDevice(remoteCode, remoteName);
          }
        }
      };
      setInterval(broadcastLocalPresence, 2000);
      broadcastLocalPresence();
    } catch (e) {}
  }

  initGlobalWebSocketPresenceRelay();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      broadcastLocalPresence();
      if (presenceHubConn && presenceHubConn.open) {
        presenceHubConn.send({
          type: 'PRESENCE_ANNOUNCE',
          code: myDeviceShortCode,
          name: p2pDeviceName || 'App Device',
          peerId: myDevicePeerId
        });
      }
      if (ipConnectionsList && ipConnectionsList.length > 0) {
        ipConnectionsList.forEach((c, idx) => pingIpConnection(idx, true));
      }
    }
  });

  if (typeof Peer !== 'undefined') {
    try {
      localPeer = new Peer(myDevicePeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun.services.mozilla.com' },
            { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }
          ]
        }
      });

      localPeer.on('open', (id) => {
        myDevicePeerId = id;
        const displayEl = document.getElementById('myDeviceCodeDisplay');
        if (displayEl) {
          const shortCode = id.replace(/^sld-device-/, 'SLD-').toUpperCase();
          displayEl.innerHTML = `<span style="color:#22c55e; font-weight:800;">🟢 Active</span> (${shortCode})`;
        }
        broadcastLocalPresence();
        initPresenceRoomHub();
      });

      localPeer.on('connection', (conn) => {
        setupPeerConnectionHandlers(conn);
      });

      localPeer.on('error', (err) => {
        console.warn('Local Peer Warning:', err);
        createHubFallbackPeer();
      });
    } catch (e) {
      console.warn('Failed to initialize Peer server:', e);
    }
  }
}

function setupPeerConnectionHandlers(conn) {
  activePeerConnections.set(conn.peer, conn);

  const keepaliveTimer = setInterval(() => {
    if (conn && conn.open) {
      try { conn.send({ type: 'KEEPALIVE', fromPeerId: myDevicePeerId }); } catch (e) {}
    } else {
      clearInterval(keepaliveTimer);
    }
  }, 4000);

  conn.on('open', () => {
    conn.send({
      type: 'DISCOVERY_HELLO',
      fromPeerId: myDevicePeerId,
      fromName: p2pDeviceName || 'Mobile Device'
    });
  });

  conn.on('data', async (data) => {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'KEEPALIVE') {
      const match = ipConnectionsList.find(c => c.peerId === conn.peer || c.ip.includes(data.fromPeerId || ''));
      if (match && match.status !== 'online') {
        match.status = 'online';
        await db.setSetting('ipConnectionsList', ipConnectionsList);
        renderIpConnectionsList();
        updateNavP2pStatusIndicator();
      }
      return;
    }

    if (data.type === 'PAIR_REQUEST' || data.type === 'DISCOVERY_HELLO') {
      const remoteIp = ipOrUrlClean(data.fromIp || data.fromPeerId || '');

      if (isBlockedIp(remoteIp)) {
        conn.send({ type: 'PAIR_RESPONSE', status: 'blocked' });
        return;
      }

      // Auto-accept & register incoming connection
      let reciprocalConn = ipConnectionsList.find(c =>
        ipOrUrlClean(c.ip) === remoteIp ||
        ipOrUrlClean(c.url) === remoteIp ||
        c.peerId === conn.peer
      );

      if (!reciprocalConn) {
        reciprocalConn = {
          id: 'conn-' + Date.now(),
          name: data.fromName || `Device ${remoteIp}`,
          ip: remoteIp,
          url: formatPeerUrl(remoteIp),
          peerId: conn.peer,
          status: 'online',
          allowSync: false,
          remoteAllowSync: false,
          lastPing: Date.now()
        };
        appendSyncHistoryLog(reciprocalConn, `Auto-discovered & connected on network.`);
        ipConnectionsList.push(reciprocalConn);
      } else {
        reciprocalConn.status = 'online';
        reciprocalConn.peerId = conn.peer;
        if (data.fromName) reciprocalConn.name = data.fromName;
      }

      await db.setSetting('ipConnectionsList', ipConnectionsList);
      renderIpConnectionsList();
      updateNavP2pStatusIndicator();

      if (data.type === 'PAIR_REQUEST') {
        conn.send({
          type: 'PAIR_RESPONSE',
          status: 'accepted',
          fromName: p2pDeviceName || 'This Device',
          autoAccepted: true
        });
      }
      showToastNotification(`🟢 Connected with ${reciprocalConn.name}!`);
      if (typeof addNotification === 'function') {
        addNotification('Device Connected', `Device "${reciprocalConn.name}" connected.`, 'success');
      }
      return;
    } else if (data.type === 'PAIR_RESPONSE') {
      const match = ipConnectionsList.find(c => c.ip.includes(data.fromIp || '') || c.peerId === conn.peer);
      if (match) {
        if (data.status === 'accepted') {
          match.status = 'online';
          match.peerId = conn.peer;
          if (data.fromName) match.name = data.fromName;
          appendSyncHistoryLog(match, `WebRTC pairing accepted.`);
          showToastNotification(`🟢 Connected with ${match.name}!`);
          if (typeof addNotification === 'function') {
            addNotification('Device Connected', `Connected with device "${match.name}".`, 'success');
          }
        } else if (data.status === 'declined') {
          match.status = 'offline';
          showToastNotification(`🔴 Connection declined by ${match.name}`);
        } else if (data.status === 'blocked') {
          match.status = 'blocked';
          showToastNotification(`🚫 Blocked by ${match.name}`);
        }
        await db.setSetting('ipConnectionsList', ipConnectionsList);
        renderIpConnectionsList();
        updateNavP2pStatusIndicator();
      }
    } else if (data.type === 'SYNC_PERMISSION_UPDATE') {
      const match = ipConnectionsList.find(c => c.peerId === conn.peer || c.ip.includes(data.fromIp || ''));
      if (match) {
        match.remoteAllowSync = data.allowSync === true;
        appendSyncHistoryLog(match, `Remote device ${data.allowSync ? 'granted' : 'revoked'} sync permission.`);
        await db.setSetting('ipConnectionsList', ipConnectionsList);
        renderIpConnectionsList();
        if (match.allowSync && match.remoteAllowSync) {
          performAutoDatabaseSync(match);
        }
      }
    } else if (data.type === 'PING') {
      conn.send({ type: 'PONG', fromPeerId: myDevicePeerId });
    } else if (data.type === 'PONG') {
      const match = ipConnectionsList.find(c => c.peerId === conn.peer || c.ip.includes(data.fromIp || ''));
      if (match) {
        match.status = 'online';
        await db.setSetting('ipConnectionsList', ipConnectionsList);
        renderIpConnectionsList();
        updateNavP2pStatusIndicator();
      }
      showToastNotification(`🟢 Device is active and connected!`);
    } else if (data.type === 'SYNC_PAYLOAD') {
      if (data.payload) {
        p2pActiveSyncing = true;
        updateNavP2pStatusIndicator();
        try {
          if (data.payload.subjects) {
            for (const s of data.payload.subjects) await db.put('subjects', s);
          }
          if (data.payload.events) {
            for (const e of data.payload.events) await db.put('events', e);
          }
          if (data.payload.media) {
            for (const m of data.payload.media) await db.put('media', m);
          }
          await loadAppState();
          renderCurrentView();
          showToastNotification('📥 Received & merged sync payload!');
          if (typeof addNotification === 'function') {
            addNotification('Sync Completed', 'Successfully received and merged database payload.', 'success');
          }
        } catch (err) {
          console.error('Error applying sync payload:', err);
        } finally {
          p2pActiveSyncing = false;
          updateNavP2pStatusIndicator();
        }
      }
    }
  });

  conn.on('close', () => {
    activePeerConnections.delete(conn.peer);
    const match = ipConnectionsList.find(c => c.peerId === conn.peer);
    if (match) {
      match.status = 'offline';
      db.setSetting('ipConnectionsList', ipConnectionsList);
      renderIpConnectionsList();
      updateNavP2pStatusIndicator();
    }
  });
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
      const { fromName, fromIp, fromUrl, fromPeerId, _conn } = pendingPairRequest;

      let existing = ipConnectionsList.find(c => c.ip === fromIp || c.peerId === fromPeerId);
      if (existing) {
        existing.status = 'online';
        existing.name = fromName || existing.name;
        if (fromPeerId) existing.peerId = fromPeerId;
      } else {
        ipConnectionsList.push({
          id: 'conn-' + Date.now(),
          name: fromName || fromIp,
          ip: fromIp,
          peerId: fromPeerId,
          url: fromUrl || formatPeerUrl(fromIp),
          status: 'online',
          lastPing: Date.now()
        });
      }
      await db.setSetting('ipConnectionsList', ipConnectionsList);

      if (_conn && _conn.open) {
        _conn.send({
          type: 'PAIR_RESPONSE',
          status: 'accepted',
          fromName: p2pDeviceName || 'This Device'
        });
      }

      hideDevicePairingModal();
      renderIpConnectionsList();
      updateNavP2pStatusIndicator();
      showToastNotification(`Accepted connection with ${fromName || fromIp}`);
    };
  }

  if (declineBtn) {
    declineBtn.onclick = async () => {
      if (pendingPairRequest && pendingPairRequest._conn && pendingPairRequest._conn.open) {
        pendingPairRequest._conn.send({ type: 'PAIR_RESPONSE', status: 'declined' });
      }
      hideDevicePairingModal();
    };
  }

  if (blockBtn) {
    blockBtn.onclick = async () => {
      if (pendingPairRequest) {
        await blockIpAddress(pendingPairRequest.fromIp);
        if (pendingPairRequest._conn && pendingPairRequest._conn.open) {
          pendingPairRequest._conn.send({ type: 'PAIR_RESPONSE', status: 'blocked' });
        }
      }
      hideDevicePairingModal();
      showToastNotification(`Blocked IP ${pendingPairRequest?.fromIp}`);
    };
  }
}

async function loadIpConnections() {
  await loadBlockedIps();
  ipConnectionsList = (await db.getSetting('ipConnectionsList')) || [];
  renderIpConnectionsList();
  updateNavP2pStatusIndicator();
  setupDevicePairingModalEvents();
  initLocalPeerServer();

  if (!p2pHeartbeatTimer) {
    p2pHeartbeatTimer = setInterval(async () => {
      if (ipConnectionsList && ipConnectionsList.length > 0) {
        for (let i = 0; i < ipConnectionsList.length; i++) {
          await pingIpConnection(i, true);
        }
      }
    }, 12000);
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
    if (indicator) indicator.title = 'Click to view Device 2 Device Connections';
  }

  if (indicator) {
    indicator.onclick = () => switchView('connectionsView');
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

function appendSyncHistoryLog(conn, logMessage) {
  if (!conn) return;
  if (!conn.history) conn.history = [];
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  conn.history.unshift({ time: timestamp, msg: logMessage });
  if (conn.history.length > 25) conn.history.pop();
}

async function performAutoDatabaseSync(conn) {
  if (!conn || conn.status !== 'online' || !conn.allowSync || !conn.remoteAllowSync) return;

  let activeConn = activePeerConnections.get(conn.peerId);
  if (!activeConn || !activeConn.open) return;

  try {
    p2pActiveSyncing = true;
    updateNavP2pStatusIndicator();

    const subjects = await db.getAll('subjects');
    const events = await db.getAll('events');
    const media = await db.getAll('media');

    activeConn.send({
      type: 'SYNC_PAYLOAD',
      payload: { subjects, events, media },
      fromIp: conn.ip
    });

    appendSyncHistoryLog(conn, `Auto-synced ${subjects.length} subjects, ${events.length} events, ${media.length} media.`);
    await db.setSetting('ipConnectionsList', ipConnectionsList);
    renderIpConnectionsList();
    showToastNotification(`⚡ Auto-synced data with ${conn.name}!`);
  } catch (e) {
    console.warn('Auto sync error:', e);
  } finally {
    p2pActiveSyncing = false;
    updateNavP2pStatusIndicator();
  }
}

let deletedDevicesList = [];

async function loadDeletedDevices() {
  deletedDevicesList = (await db.getSetting('deletedDevicesList')) || [];
  updateDeletedDevicesBadge();
}

function updateDeletedDevicesBadge() {
  const badgeEl = document.getElementById('deletedDevicesCountBadge');
  if (badgeEl) badgeEl.textContent = deletedDevicesList.length;
}

function openDeletedDevicesModal() {
  const modal = document.getElementById('deletedDevicesModal');
  if (modal) {
    modal.style.display = 'flex';
    renderDeletedDevicesList();
  }
}

function closeDeletedDevicesModal() {
  const modal = document.getElementById('deletedDevicesModal');
  if (modal) modal.style.display = 'none';
}

function renderDeletedDevicesList() {
  const container = document.getElementById('deletedDevicesListContainer');
  if (!container) return;

  updateDeletedDevicesBadge();

  if (deletedDevicesList.length === 0) {
    container.innerHTML = `<p class="text-muted" style="font-size:0.85rem;">No deleted devices recorded.</p>`;
    return;
  }

  container.innerHTML = deletedDevicesList.map((item, idx) => `
    <div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-tertiary); border:1px solid var(--border-color); padding:10px 14px; border-radius:var(--radius-md);">
      <div>
        <div style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">📱 ${item.name || 'Unnamed Device'}</div>
        <div style="font-size:0.78rem; color:var(--text-muted); font-family:monospace; margin-top:2px;">${item.ip || item.url || item.peerId || ''}</div>
      </div>
      <button class="btn btn-primary btn-sm restore-device-btn" data-idx="${idx}" style="font-size:0.8rem; font-weight:700;">↩️ Restore</button>
    </div>
  `).join('');

  container.querySelectorAll('.restore-device-btn').forEach(btn => {
    btn.onclick = async () => {
      const delIdx = parseInt(btn.getAttribute('data-idx'), 10);
      const restoredItem = deletedDevicesList.splice(delIdx, 1)[0];
      if (restoredItem) {
        restoredItem.status = 'online';
        appendSyncHistoryLog(restoredItem, `Restored from Deleted Devices history.`);
        ipConnectionsList.push(restoredItem);

        await db.setSetting('ipConnectionsList', ipConnectionsList);
        await db.setSetting('deletedDevicesList', deletedDevicesList);

        renderIpConnectionsList();
        renderDeletedDevicesList();
        updateNavP2pStatusIndicator();
        showToastNotification(`↩️ Restored device "${restoredItem.name}"`);
      }
    };
  });
}

function renderIpConnectionsList() {
  const container = document.getElementById('connectedPeersList') || document.getElementById('ipConnectionsListContainer');
  if (!container) return;

  updateDeletedDevicesBadge();

  if (ipConnectionsList.length === 0) {
    container.innerHTML = `<p class="text-muted" style="font-size:0.85rem;">Searching for nearby devices on LAN & Tailscale network...</p>`;
    return;
  }

  container.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:12px; width:100%;">
      ${ipConnectionsList.map((conn, idx) => {
        const targetUrl = conn.url || formatPeerUrl(conn.ip);
        const localSync = conn.allowSync === true;
        const remoteSync = conn.remoteAllowSync === true;
        const fullyReadyToSync = localSync && remoteSync;
        const historyCount = conn.history ? conn.history.length : 0;

        let statusBadge = `<span class="badge" style="background:rgba(239,68,68,0.2); color:#ef4444; border:1px solid #ef4444; font-size:0.7rem;">🔴 Disconnected</span>`;
        if (conn.status === 'online') {
          statusBadge = `<span class="badge" style="background:rgba(34,197,94,0.2); color:#22c55e; border:1px solid #22c55e; font-size:0.7rem;">🟢 Connected</span>`;
        } else if (conn.status === 'pending') {
          statusBadge = `<span class="badge" style="background:rgba(234,179,8,0.2); color:#eab308; border:1px solid #eab308; font-size:0.7rem;">🟡 Discovered</span>`;
        }

        let syncPermissionBadge = `<span class="badge" style="background:rgba(255,255,255,0.08); color:var(--text-muted); border:1px solid var(--border-color); font-size:0.7rem;">⚪ Sync Off</span>`;
        if (fullyReadyToSync) {
          syncPermissionBadge = `<span class="badge" style="background:rgba(34,197,94,0.2); color:#22c55e; border:1px solid #22c55e; font-size:0.7rem;">🟢 Ready & Auto-Syncing</span>`;
        } else if (localSync && !remoteSync) {
          syncPermissionBadge = `<span class="badge" style="background:rgba(234,179,8,0.25); color:#eab308; border:1px solid #eab308; font-size:0.7rem;">🟡 Awaiting other device sync permission</span>`;
        }

        return `
        <div style="background:var(--bg-secondary); border:1px solid var(--border-color); padding:14px 16px; border-radius:var(--radius-md); position:relative;">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div>
              <div style="font-weight:800; font-size:0.95rem; color:var(--text-primary); display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <span>📱 ${conn.name || 'Unnamed Device'}</span>
                <button class="btn btn-link edit-device-name-btn" data-idx="${idx}" style="padding:0; border:none; background:none; color:var(--text-muted); cursor:pointer; font-size:0.85rem;" title="Rename Device">✏️</button>
                ${statusBadge}
                ${syncPermissionBadge}
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted); font-family:monospace; margin-top:3px;">🌐 Address: ${targetUrl}</div>
            </div>
            <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
              <button class="btn btn-sm sync-toggle-btn" data-idx="${idx}" style="${localSync ? 'background:#22c55e; color:#fff; border:none; font-weight:800;' : 'background:var(--bg-tertiary); color:var(--text-muted); font-weight:800;'}">
                ${localSync ? '⚡ Sync: ON' : '🔒 Sync: OFF'}
              </button>
              <div style="position:relative;">
                <button class="btn btn-secondary btn-sm device-menu-btn" data-idx="${idx}" style="font-weight:bold; font-size:0.9rem; padding:4px 10px;">•••</button>
                <div class="device-menu-dropdown" id="deviceMenu-${idx}" style="display:none; position:absolute; right:0; top:36px; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:var(--radius-md); box-shadow:0 8px 24px rgba(0,0,0,0.5); z-index:100; min-width:130px; overflow:hidden;">
                  <button class="rename-device-menu-btn" data-idx="${idx}" style="width:100%; text-align:left; padding:8px 12px; background:none; border:none; color:var(--text-primary); cursor:pointer; font-size:0.82rem; display:flex; align-items:center; gap:8px;">✏️ Rename</button>
                  <button class="remove-device-menu-btn" data-idx="${idx}" style="width:100%; text-align:left; padding:8px 12px; background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.82rem; display:flex; align-items:center; gap:8px;">🗑️ Remove</button>
                </div>
              </div>
            </div>
          </div>

          <div style="margin-top:10px; border-top:1px solid var(--border-color); padding-top:8px; display:flex; align-items:center; justify-content:space-between;">
            <button class="btn btn-link btn-sm toggle-history-btn" data-idx="${idx}" style="font-size:0.78rem; text-decoration:none; padding:0; color:#38bdf8; font-weight:700;">
              📜 View Sync History (${historyCount}) ▼
            </button>
          </div>

          <div id="syncHistoryContainer-${idx}" style="display:none; margin-top:8px; background:rgba(15,23,42,0.6); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 14px; font-family:monospace; font-size:0.78rem; max-height:160px; overflow-y:auto;">
            ${conn.history && conn.history.length > 0 ?
              conn.history.map(h => `<div style="margin-bottom:4px; line-height:1.4;"><span style="color:var(--text-muted); font-weight:700;">[${h.time}]</span> ${h.msg}</div>`).join('') :
              '<div style="color:var(--text-muted);">No sync activity recorded yet.</div>'
            }
          </div>
        </div>`;
      }).join('')}
    </div>`;

  const handleRename = async (idx) => {
    const connItem = ipConnectionsList[idx];
    if (connItem) {
      const newName = prompt('Enter a new name for this device:', connItem.name || '');
      if (newName && newName.trim()) {
        connItem.name = newName.trim();
        appendSyncHistoryLog(connItem, `Renamed device to "${connItem.name}".`);
        await db.setSetting('ipConnectionsList', ipConnectionsList);
        renderIpConnectionsList();
        showToastNotification(`✏️ Renamed device to "${connItem.name}"`);
      }
    }
  };

  const handleRemove = async (idx) => {
    const removedItem = ipConnectionsList.splice(idx, 1)[0];
    if (removedItem) {
      deletedDevicesList.push(removedItem);
      await db.setSetting('ipConnectionsList', ipConnectionsList);
      await db.setSetting('deletedDevicesList', deletedDevicesList);
      renderIpConnectionsList();
      updateDeletedDevicesBadge();
      updateNavP2pStatusIndicator();
      showToastNotification(`🗑️ Device moved to Deleted Devices.`);
    }
  };

  container.querySelectorAll('.edit-device-name-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handleRename(parseInt(btn.getAttribute('data-idx'), 10));
    };
  });

  container.querySelectorAll('.device-menu-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const idx = btn.getAttribute('data-idx');
      const dropdown = document.getElementById(`deviceMenu-${idx}`);
      document.querySelectorAll('.device-menu-dropdown').forEach(d => {
        if (d !== dropdown) d.style.display = 'none';
      });
      if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      }
    };
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.device-menu-dropdown').forEach(d => d.style.display = 'none');
  });

  container.querySelectorAll('.rename-device-menu-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handleRename(parseInt(btn.getAttribute('data-idx'), 10));
    };
  });

  container.querySelectorAll('.remove-device-menu-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handleRemove(parseInt(btn.getAttribute('data-idx'), 10));
    };
  });

  container.querySelectorAll('.sync-toggle-btn').forEach(btn => {
    btn.onclick = async () => {
      const idx = parseInt(btn.getAttribute('data-idx'), 10);
      const connItem = ipConnectionsList[idx];
      if (connItem) {
        connItem.allowSync = !connItem.allowSync;
        appendSyncHistoryLog(connItem, `Toggled local sync permission ${connItem.allowSync ? 'ON' : 'OFF'}.`);
        await db.setSetting('ipConnectionsList', ipConnectionsList);
        renderIpConnectionsList();

        let activeConn = activePeerConnections.get(connItem.peerId);
        if (activeConn && activeConn.open) {
          activeConn.send({
            type: 'SYNC_PERMISSION_UPDATE',
            allowSync: connItem.allowSync,
            fromIp: connItem.ip
          });
        }

        if (connItem.allowSync && connItem.remoteAllowSync) {
          performAutoDatabaseSync(connItem);
        }
      }
    };
  });

  container.querySelectorAll('.toggle-history-btn').forEach(btn => {
    btn.onclick = () => {
      const idx = btn.getAttribute('data-idx');
      const histEl = document.getElementById(`syncHistoryContainer-${idx}`);
      if (histEl) {
        const isHidden = histEl.style.display === 'none';
        histEl.style.display = isHidden ? 'block' : 'none';
        btn.textContent = `📜 View Sync History (${ipConnectionsList[idx]?.history ? ipConnectionsList[idx].history.length : 0}) ${isHidden ? '▲' : '▼'}`;
      }
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
  const targetPeerId = sanitizePeerId(rawIp);

  let conn = ipConnectionsList.find(c => c.ip === rawIp || c.url === formattedUrl);
  if (!conn) {
    conn = {
      id: 'conn-' + Date.now(),
      name: name || rawIp,
      ip: rawIp,
      url: formattedUrl,
      peerId: targetPeerId,
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

  showToastNotification(`Sending connection request to ${conn.name}...`);
  sendPairRequestToDevice(conn);
}

async function testDeviceConnection(idx) {
  const conn = ipConnectionsList[idx];
  if (!conn) return;

  if (conn.status === 'online') {
    // Send live ping
    showToastNotification(`⚡ Testing connection with ${conn.name}...`);
    let activeConn = activePeerConnections.get(conn.peerId);
    if (activeConn && activeConn.open) {
      activeConn.send({ type: 'PING' });
    } else {
      pingIpConnection(idx, false);
    }
  } else {
    // Not connected -> Send Pair Request Prompt to target device!
    showToastNotification(`📨 Sending pair request prompt to ${conn.name}...`);
    conn.status = 'pending';
    await db.setSetting('ipConnectionsList', ipConnectionsList);
    renderIpConnectionsList();
    sendPairRequestToDevice(conn);
  }
}

let globalPresenceWs = null;

function initGlobalWebSocketPresenceRelay() {
  if (globalPresenceWs && (globalPresenceWs.readyState === WebSocket.CONNECTING || globalPresenceWs.readyState === WebSocket.OPEN)) {
    return;
  }

  try {
    globalPresenceWs = new WebSocket('wss://free.websocket.in/v3/sld-presence-channel-v1?apiKey=public');

    globalPresenceWs.onopen = () => {
      broadcastGlobalPresenceWs();
    };

    globalPresenceWs.onmessage = async (evt) => {
      try {
        if (typeof evt.data === 'string') {
          const msg = JSON.parse(evt.data);
          if (msg && msg.type === 'PRESENCE_ANNOUNCE' && msg.code && msg.code !== myDeviceShortCode) {
            await registerDiscoveredDevice(msg.code, msg.name);
          }
        }
      } catch (e) {}
    };

    globalPresenceWs.onerror = () => {};
    globalPresenceWs.onclose = () => {
      setTimeout(initGlobalWebSocketPresenceRelay, 5000);
    };
  } catch (e) {}
}

function broadcastGlobalPresenceWs() {
  if (globalPresenceWs && globalPresenceWs.readyState === WebSocket.OPEN && myDeviceShortCode) {
    try {
      globalPresenceWs.send(JSON.stringify({
        type: 'PRESENCE_ANNOUNCE',
        code: myDeviceShortCode,
        name: p2pDeviceName || 'SLD Device',
        peerId: myDevicePeerId
      }));
    } catch (e) {}
  }
}

function sendPairRequestToDevice(conn) {
  const targetPeerId = conn.peerId || sanitizePeerId(conn.ip);

  const doConnect = () => {
    if (!localPeer || localPeer.destroyed) return;
    try {
      const peerConn = localPeer.connect(targetPeerId, { reliable: true });
      setupPeerConnectionHandlers(peerConn);

      peerConn.on('open', () => {
        peerConn.send({
          type: 'PAIR_REQUEST',
          fromName: p2pDeviceName || 'Remote Device',
          fromIp: conn.ip,
          fromUrl: conn.url || formatPeerUrl(conn.ip),
          fromPeerId: myDevicePeerId
        });
      });

      peerConn.on('error', (err) => {
        conn.status = 'offline';
        db.setSetting('ipConnectionsList', ipConnectionsList);
        renderIpConnectionsList();
        updateNavP2pStatusIndicator();
      });
    } catch (e) {
      conn.status = 'offline';
      db.setSetting('ipConnectionsList', ipConnectionsList);
      renderIpConnectionsList();
      updateNavP2pStatusIndicator();
    }
  };

  if (!localPeer || localPeer.destroyed) {
    initLocalPeerServer();
    setTimeout(doConnect, 1500);
  } else if (!localPeer.open) {
    localPeer.once('open', doConnect);
  } else {
    doConnect();
  }
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

  let activeConn = activePeerConnections.get(conn.peerId);
  if (activeConn && activeConn.open) {
    conn.status = 'online';
  } else {
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
    let activeConn = activePeerConnections.get(conn.peerId);
    const subjects = await db.getAll('subjects');
    const events = await db.getAll('events');
    const activeMedia = await db.getActiveMedia();
    const payload = { subjects, events, media: activeMedia };

    if (activeConn && activeConn.open) {
      activeConn.send({ type: 'SYNC_PAYLOAD', payload });
      showToastNotification(`Sync payload sent to ${conn.name}!`);
    } else {
      const formattedUrl = conn.url || formatPeerUrl(conn.ip);
      await fetch(`${formattedUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'no-cors'
      });
      showToastNotification(`Sync payload sent to ${conn.name}!`);
    }
  } catch (e) {
    showToastNotification(`Sync payload sent to ${conn.name}.`);
  } finally {
    p2pActiveSyncing = false;
    updateNavP2pStatusIndicator();
  }
}

function disconnectP2p() {
  ipConnectionsList.forEach(c => c.status = 'offline');
  activePeerConnections.forEach(c => c.close());
  activePeerConnections.clear();
  updateNavP2pStatusIndicator();
}

window.updateP2pStatusUI = updateP2pStatusUI;
window.setupDataChannelEvents = setupDataChannelEvents;
window.renderConnectedPeersUI = renderConnectedPeersUI;
window.loadIpConnections = loadIpConnections;
window.updateNavP2pStatusIndicator = updateNavP2pStatusIndicator;
window.renderIpConnectionsList = renderIpConnectionsList;
window.addIpConnection = addIpConnection;
window.testDeviceConnection = testDeviceConnection;
window.pingIpConnection = pingIpConnection;
window.syncWithIpConnection = syncWithIpConnection;
window.disconnectP2p = disconnectP2p;
window.openBlockedIpsModal = openBlockedIpsModal;
window.closeBlockedIpsModal = closeBlockedIpsModal;
window.blockIpAddress = blockIpAddress;
window.unblockIpAddress = unblockIpAddress;
window.showDevicePairingModal = showDevicePairingModal;
window.hideDevicePairingModal = hideDevicePairingModal;


