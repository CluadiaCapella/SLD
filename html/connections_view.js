/* Device 2 Device Connections View Component Template */
(function() {
  const container = document.querySelector('main.main-content') || document.body;
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <section id="connectionsView" class="view-page" style="display:none; padding:16px;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <button class="btn btn-secondary btn-sm" onclick="switchView('settingsView')">← Settings</button>
          <h2 style="margin:0; font-size:1.4rem; color:var(--text-primary);">📱 Device 2 Device Connections</h2>
        </div>
        <span id="p2pSyncStatusBadge" class="subject-stat-badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid #38bdf8; font-weight:800;">📱 0 Connected</span>
      </div>

      <div style="margin-bottom:16px; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.25); padding:12px 16px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
          <span style="font-size:0.88rem; color:var(--text-primary); font-weight:700;">📡 Network Broadcasting: </span>
          <button class="btn btn-sm" id="toggleBroadcastingBtn" style="background:#22c55e; color:#fff; font-weight:800; border:none; border-radius:14px; padding:4px 12px; cursor:pointer;">📡 ON</button>
          <strong id="myDeviceCodeDisplay" style="font-family:monospace; font-size:0.95rem; color:#38bdf8; padding:4px 10px; border-radius:6px; background:rgba(15,23,42,0.6); border:1px solid #38bdf8;">Broadcasting is trying to activate...</strong>
        </div>
        <span class="text-muted" style="font-size:0.78rem;">Auto-discovers devices on LAN & Tailscale. Data syncing is OFF by default.</span>
      </div>

      <div style="margin-bottom:20px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
          <h3 style="font-size:1.05rem; font-weight:800; margin:0; color:var(--text-primary);">📱 Discovered Devices</h3>
          <button class="btn btn-secondary btn-sm" id="openDeletedDevicesModalBtn" style="font-size:0.8rem; font-weight:700;">🗑️ Deleted Devices (<span id="deletedDevicesCountBadge">0</span>)</button>
        </div>
        <div id="connectedPeersList" style="display:flex; flex-direction:column; gap:10px;">
          <p class="text-muted" style="font-size:0.85rem;">Searching for nearby devices on LAN & Tailscale network...</p>
        </div>
      </div>

      <!-- Deleted Devices Modal -->
      <div id="deletedDevicesModal" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:10000; align-items:center; justify-content:center;">
        <div class="modal-content" style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-lg); width:90%; max-width:480px; padding:20px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
            <h3 style="margin:0; font-size:1.15rem; color:var(--text-primary);">🗑️ Deleted Devices History</h3>
            <button class="btn btn-secondary btn-sm" id="closeDeletedDevicesModalBtn" style="padding:2px 8px;">✖</button>
          </div>
          <div id="deletedDevicesListContainer" style="display:flex; flex-direction:column; gap:10px; max-height:300px; overflow-y:auto;">
            <p class="text-muted" style="font-size:0.85rem;">No deleted devices recorded.</p>
          </div>
        </div>
      </div>
    </section>
  `);
})();
