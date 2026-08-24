<!-- Device 2 Device Connections View Partial Template -->
<div id="connectionsView" class="view-section" style="display:none; padding:16px;">
  <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:12px;">
    <div style="display:flex; align-items:center; gap:10px;">
      <button class="btn btn-secondary btn-sm" onclick="switchView('settingsView')">← Settings</button>
      <h2 style="margin:0; font-size:1.4rem; color:var(--text-primary);">📱 Device 2 Device Connections</h2>
    </div>
    <span id="p2pSyncStatusBadge" class="subject-stat-badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid #38bdf8; font-weight:800;">📱 0 Connected</span>
  </div>

  <div style="margin-bottom:16px; background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.25); padding:12px 16px; border-radius:var(--radius-md); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
    <div>
      <span style="font-size:0.88rem; color:var(--text-primary);">📱 Your Device Code: </span>
      <strong id="myDeviceCodeDisplay" style="font-family:monospace; font-size:1.15rem; color:#38bdf8; letter-spacing:1px; background:rgba(15,23,42,0.6); padding:2px 8px; border-radius:4px; border:1px solid #38bdf8;">Loading...</strong>
    </div>
    <span class="text-muted" style="font-size:0.78rem;">Zero-config auto-discovers devices on LAN & Tailscale. Data syncing is OFF by default.</span>
  </div>

  <div style="margin-bottom:20px;">
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
      <h3 style="font-size:1.05rem; font-weight:800; margin:0; color:var(--text-primary);">📱 Discovered Devices</h3>
      <button class="btn btn-secondary btn-sm" id="openBlockedIpsModalBtn" style="font-size:0.8rem;">🚫 View / Edit Blocked IPs</button>
    </div>
    <div id="connectedPeersList" style="display:flex; flex-direction:column; gap:10px;">
      <p class="text-muted" style="font-size:0.85rem;">Searching for nearby devices on LAN & Tailscale network...</p>
    </div>
  </div>

  <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:16px;">
    <h4 style="margin:0 0 10px 0; font-size:0.95rem; font-weight:800;">➕ Manual Device / IP Connection Fallback</h4>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
      <div>
        <label class="form-label" style="font-size:0.78rem; margin-bottom:4px;">Device Name</label>
        <input type="text" id="syncConnectionNameInput" class="input-text btn-sm" placeholder="e.g. Laptop" style="width:100%;">
      </div>
      <div>
        <label class="form-label" style="font-size:0.78rem; margin-bottom:4px;">Device IP or Code</label>
        <input type="text" id="syncIpAddressInput" class="input-text btn-sm" placeholder="e.g. 100.115.92.40 or SLD-8492" style="width:100%;">
      </div>
      <div style="display:flex; align-items:flex-end;">
        <button class="btn btn-primary btn-sm" id="addIpConnectionBtn" style="width:100%;">➕ Add Device</button>
      </div>
    </div>
  </div>
</div>
