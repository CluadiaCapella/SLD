/* Settings View Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <section id="settingsView" class="view-page">
      <div class="page-header">
        <div class="page-title-group">
          <h1>⚙️ Settings & System Rules</h1>
          <p>Scoring, theme preferences, backup archives, and profiles.</p>
        </div>
      </div>

      <div class="settings-grid" style="display:flex; flex-direction:column; gap:24px; width:100%;">
        <div class="chart-card">
          <h3>🎨 Interface Theme</h3>
          <div class="form-group" style="margin-top:12px;">
            <select id="themeSelect" class="select-input" style="width:100%; max-width:300px;">
              <option value="dark">🌙 Dark Mode</option>
              <option value="midnight">🌌 Midnight Mode</option>
              <option value="light">☀️ Light Mode</option>
            </select>
          </div>
        </div>

        <div class="chart-card">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <h3 style="margin:0;">🏆 Trophy Matrix Values / Limits</h3>
            <span class="subject-stat-badge" style="background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid #c084fc; font-size:0.75rem;">🌐 Synced Across Devices</span>
          </div>
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:12px; margin-top:12px;">
            <div class="form-group" style="display:flex; flex-direction:column; align-items:center;">
              <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">🥇 3 Hearts Pts</label>
              <input type="number" step="0.1" id="goldPointValueInput" class="input-text btn-sm" value="1.0" style="width:75px; text-align:center;">
            </div>
            <div class="form-group" style="display:flex; flex-direction:column; align-items:center;">
              <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">🥇 Max Limit</label>
              <input type="number" id="maxGoldPerHeartInput" class="input-text btn-sm" value="1" style="width:75px; text-align:center;">
            </div>
            <div class="form-group" style="display:flex; flex-direction:column; align-items:center;">
              <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">🥈 2 Hearts Pts</label>
              <input type="number" step="0.1" id="silverPointValueInput" class="input-text btn-sm" value="0.3" style="width:75px; text-align:center;">
            </div>
            <div class="form-group" style="display:flex; flex-direction:column; align-items:center;">
              <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">🥈 Max Limit</label>
              <input type="number" id="maxSilverPerHeartInput" class="input-text btn-sm" value="2" style="width:75px; text-align:center;">
            </div>
            <div class="form-group" style="display:flex; flex-direction:column; align-items:center;">
              <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">🥉 1 Heart Pts</label>
              <input type="number" step="0.1" id="bronzePointValueInput" class="input-text btn-sm" value="0.1" style="width:75px; text-align:center;">
            </div>
            <div class="form-group" style="display:flex; flex-direction:column; align-items:center;">
              <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">🥉 Max Limit</label>
              <input type="number" id="maxBronzePerHeartInput" class="input-text btn-sm" value="5" style="width:75px; text-align:center;">
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <h3 style="margin:0;">🪞 Alike Tags & Points Settings</h3>
            <span class="subject-stat-badge" style="background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid #c084fc; font-size:0.75rem;">🌐 Synced Across Devices</span>
          </div>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px;">Configure percentage points shared to reminded subjects when an Alike tag is attached.</p>
          <div style="display:flex; flex-wrap:wrap; align-items:center; gap:16px; margin-top:12px;">
            <div class="form-group" style="display:flex; flex-direction:column;">
              <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">Faint Alike Points %</label>
              <input type="number" id="alikeFaintPctInput" class="input-text btn-sm" value="15" style="width:90px; text-align:center;">
            </div>
            <div class="form-group" style="display:flex; flex-direction:column;">
              <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">Medium Alike Points %</label>
              <input type="number" id="alikeMediumPctInput" class="input-text btn-sm" value="30" style="width:90px; text-align:center;">
            </div>
            <div class="form-group" style="display:flex; flex-direction:column;">
              <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">Strong Alike Points %</label>
              <input type="number" id="alikeStrongPctInput" class="input-text btn-sm" value="45" style="width:90px; text-align:center;">
            </div>
            <div class="form-group" style="display:flex; flex-direction:column;">
              <label class="form-label" style="font-size:0.8rem; margin-bottom:4px;">Global SLD Points View Mode</label>
              <select id="globalPointsDisplayModeSelect" class="select-input btn-sm" style="min-width:200px;">
                <option value="points">Points Only (e.g. 100 pts)</option>
                <option value="pointsWithAlike">Points (Alikes) (e.g. 100 (15) pts)</option>
                <option value="pointsPlusAlike">Points + Alikes (e.g. 115 pts)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <h3 style="margin:0;">🏷️ Tag Import Metadata & Prefix Rules</h3>
            <span class="subject-stat-badge" style="background:rgba(168,85,247,0.15); color:#c084fc; border:1px solid #c084fc; font-size:0.75rem;">🌐 Synced Across Devices</span>
          </div>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px;">Define comma-separated prefix symbols to automatically recognize subjects, normal tags, action tags, hearts, and SLD dates when importing media metadata/tags.</p>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-top:12px;">
            <div class="form-group">
              <label class="form-label">Subject Tag Prefixes</label>
              <input type="text" id="prefixSubjectInput" class="input-text btn-sm" value="🔴,🟠,🟡,🟢,🔵,🟣,🟤,🖤,⚪">
            </div>
            <div class="form-group">
              <label class="form-label">Normal Tag Prefixes</label>
              <input type="text" id="prefixNormalTagInput" class="input-text btn-sm" value="🧿">
            </div>
            <div class="form-group">
              <label class="form-label">Action Tag Prefixes</label>
              <input type="text" id="prefixActionTagInput" class="input-text btn-sm" value="🧿">
            </div>
            <div class="form-group">
              <label class="form-label">Heart Points Prefixes</label>
              <input type="text" id="prefixHeartInput" class="input-text btn-sm" value="🩷,🩵,🩶">
            </div>
            <div class="form-group">
              <label class="form-label">SLD Tag Prefixes</label>
              <input type="text" id="prefixSldInput" class="input-text btn-sm" value="🪾">
            </div>
          </div>
        </div>

        <div class="chart-card">
          <h3>🖼️ Thumbnail Management</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px;">Re-generate top-centered cropped 200x200 thumbnails for all media files. Manual custom thumbnails will not be replaced.</p>
          <button class="btn btn-secondary btn-sm" id="regenerateThumbnailsBtn" style="margin-top:10px;">🔄 Regenerate All Thumbnails</button>
        </div>

        <!-- 📱 Device 2 Device Connections Shortcut Card -->
        <div class="chart-card">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
            <div>
              <h3 style="margin:0;">📱 Device 2 Device Connections</h3>
              <p class="text-muted" style="font-size:0.85rem; margin-top:4px;">Manage auto-discovered devices on LAN & Tailscale, toggle data syncing per device, and configure connection blocklists.</p>
            </div>
            <button class="btn btn-primary" onclick="switchView('connectionsView')">📱 Manage Device Connections →</button>
          </div>
        </div>

        <!-- 💾 Storage Allowance & Limits Card -->
        <div class="chart-card">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <h3 style="margin:0;">💾 Device Storage Allowance & Limits</h3>
            <span class="subject-stat-badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid #38bdf8; font-size:0.75rem;">📱 Device Specific</span>
          </div>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px;">Set maximum IndexedDB disk space allowance for background high-resolution media sync on this device.</p>
          <div style="display:flex; align-items:center; gap:16px; margin-top:12px; flex-wrap:wrap;">
            <div class="form-group" style="min-width:200px;">
              <label class="form-label" style="font-size:0.8rem;">Max Media Storage Limit</label>
              <select id="maxStorageLimitSelect" class="select-input btn-sm">
                <option value="1">1 GB</option>
                <option value="2">2 GB</option>
                <option value="5" selected>5 GB</option>
                <option value="10">10 GB</option>
                <option value="50">50 GB</option>
                <option value="unlimited">Unlimited (No Limit)</option>
              </select>
            </div>
            <div style="flex:1; min-width:220px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 14px;">
              <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:700; margin-bottom:4px;">
                <span>Disk Usage:</span>
                <span id="storageUsageText" style="color:var(--accent-pink);">Calculating...</span>
              </div>
              <div style="background:rgba(0,0,0,0.3); border-radius:6px; height:8px; overflow:hidden;">
                <div id="storageUsageBar" style="width:0%; height:100%; background:linear-gradient(90deg, var(--accent-blue), var(--accent-pink)); transition:width 0.3s ease;"></div>
              </div>
            </div>
          </div>
        </div>



        <!-- 📜 System Error Logs & Diagnostics Card -->
        <div class="chart-card">
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
            <div style="display:flex; align-items:center; gap:10px;">
              <h3 style="margin:0;">📜 System Error Logs & Diagnostics</h3>
              <span id="errorLogCountBadge" class="badge" style="background:rgba(239,68,68,0.2); color:#f87171; border:1px solid #ef4444; font-size:0.75rem;">0 errors</span>
            </div>
            <span class="subject-stat-badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid #38bdf8; font-size:0.75rem;">📱 Device Specific</span>
          </div>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px;">Automatically captures runtime JavaScript errors, failed promises, and stack tracebacks for easy copy-pasting & debugging.</p>

          <div style="margin-top:12px;">
            <div id="systemErrorLogsContainer" style="max-height:220px; overflow-y:auto; background:rgba(0,0,0,0.5); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:12px; font-family:monospace; font-size:0.78rem; color:#fca5a5; white-space:pre-wrap; word-break:break-word;">
              No runtime errors recorded on this device.
            </div>

            <div style="display:flex; gap:10px; margin-top:10px; flex-wrap:wrap;">
              <button class="btn btn-secondary btn-sm" id="copyErrorLogsBtn">📋 Copy Error Log</button>
              <button class="btn btn-danger btn-sm" id="clearErrorLogsBtn">🗑️ Clear Error Log</button>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <h3>🖼️ Collections Manager</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px;">Manage, export, import, duplicate, or drag-and-merge media collections.</p>
          <div style="display:flex; gap:10px; margin-top:12px; margin-bottom:8px; flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="createNewCollectionBtn">+ New Collection</button>
            <button class="btn btn-secondary btn-sm" id="exportCollectionZipBtn">💾 Save Collection Archive (.zip)</button>
            <label class="btn btn-secondary btn-sm" style="cursor:pointer;">
              📥 Add Collection Archive (.zip)
              <input type="file" id="importCollectionFileInput" accept=".zip,.7z" style="display:none;">
            </label>
          </div>
          <p class="text-muted" style="font-size:0.75rem; color:var(--text-muted); margin-bottom:12px;">⚠️ <em>Packaging takes time for large datasets. The download window may take minutes to appear.</em></p>
          <div id="collectionsListContainer" style="margin-top:12px;"></div>
        </div>

        <div class="chart-card">
          <h3>📁 Profile Manager</h3>
          <p class="text-muted" style="font-size:0.85rem; margin-top:4px;">Backup & import full workspace settings, duplicate, or drag-to-merge profiles.</p>
          <div style="display:flex; gap:10px; margin-top:12px; margin-bottom:8px; flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" id="createNewProfileBtn">+ New Profile</button>
            <button class="btn btn-secondary btn-sm" id="exportDataSettingsBtn">💾 Backup Profile (.zip)</button>
            <label class="btn btn-accent-blue btn-sm" style="cursor:pointer;">
              📥 Import Profile (.zip)
              <input type="file" id="importDataSettingsFileInput" accept=".zip,.7z,.json" style="display:none;">
            </label>
          </div>
          <p class="text-muted" style="font-size:0.75rem; color:var(--text-muted); margin-bottom:12px;">⚠️ <em>Packaging takes time for large datasets. The download window may take minutes to appear.</em></p>
          <div id="profilesListContainer" style="margin-top:12px;"></div>
        </div>
      </div>
    </section>
  `);
})();
