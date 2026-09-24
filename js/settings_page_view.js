/**
 * Settings Page View & Profile Manager Subsystem
 */

async function renderSettingsPage() {
  const currentTheme = (await db.getSetting('theme')) || 'dark';
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) themeSelect.value = currentTheme;

  const goldInput = document.getElementById('goldPointValueInput');
  if (goldInput) goldInput.value = currentMedalSettings.goldPts ?? 1.0;
  const silverInput = document.getElementById('silverPointValueInput');
  if (silverInput) silverInput.value = currentMedalSettings.silverPts ?? 0.3;
  const bronzeInput = document.getElementById('bronzePointValueInput');
  if (bronzeInput) bronzeInput.value = currentMedalSettings.bronzePts ?? 0.1;

  await updateProfileHeaderUI();
  await renderImportExportProfileChips();
  await renderProfilesManagerList();
  await updateEstimatedExportTimeUI();

  // Export button
  const exportPkgBtn = document.getElementById('exportPortableSldPackageBtn');
  if (exportPkgBtn && !exportPkgBtn.dataset.bound) {
    exportPkgBtn.dataset.bound = 'true';
    exportPkgBtn.onclick = () => {
      if (typeof exportPortableSldPackage === 'function') {
        exportPortableSldPackage();
      }
    };
  }

  // Import button
  const importPkgInput = document.getElementById('importPortableSldPackageFileInput');
  if (importPkgInput && !importPkgInput.dataset.bound) {
    importPkgInput.dataset.bound = 'true';
    importPkgInput.onchange = async (e) => {
      const file = e.target.files ? e.target.files[0] : null;
      if (file) {
        if (typeof importAndMergeSldPackage === 'function') {
          await importAndMergeSldPackage(file);
        }
        e.target.value = '';
      }
    };
  }

  // Include Media Checkbox Listener
  const includeMediaCb = document.getElementById('includeMediaCheckbox');
  if (includeMediaCb && !includeMediaCb.dataset.bound) {
    includeMediaCb.dataset.bound = 'true';
    includeMediaCb.onchange = () => {
      updateEstimatedExportTimeUI();
    };
  }

  // Manage Profiles Link
  const manageLink = document.getElementById('manageProfilesLink');
  if (manageLink && !manageLink.dataset.bound) {
    manageLink.dataset.bound = 'true';
    manageLink.onclick = () => {
      const card = document.getElementById('profileManagerCard');
      if (card) card.scrollIntoView({ behavior: 'smooth' });
    };
  }

  // Create New Profile Button
  const newProfBtn = document.getElementById('createNewProfileBtn');
  if (newProfBtn && !newProfBtn.dataset.bound) {
    newProfBtn.dataset.bound = 'true';
    newProfBtn.onclick = async () => {
      const name = prompt('Enter name for new profile:');
      if (name && name.trim()) {
        const newId = 'profile-' + Date.now();
        const newP = { id: newId, name: name.trim(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        await db.put('profiles', newP);
        await db.setActiveProfileId(newId);
        await loadAppState();
        renderSettingsPage();
        renderCurrentView();
        if (typeof showToastNotification === 'function') {
          showToastNotification(`✨ Created & activated new profile "${newP.name}"`);
        }
      }
    };
  }
}

/**
 * Render Import/Export Selectable Target Profile Chips
 */
async function renderImportExportProfileChips() {
  const container = document.getElementById('importExportProfileChips');
  if (!container) return;

  const profiles = await db.getAll('profiles');
  const activeProfileId = await db.getActiveProfileId();
  if (!activeSelectedExportProfileId) {
    activeSelectedExportProfileId = activeProfileId;
  }

  container.innerHTML = profiles.map(p => {
    const isSelected = p.id === activeSelectedExportProfileId;
    const isActiveProfile = p.id === activeProfileId;

    return `
      <button type="button" class="btn btn-sm ${isSelected ? 'btn-primary' : 'btn-secondary'} profile-target-chip" data-id="${p.id}" style="border-radius:16px; font-weight:700;">
        👤 ${p.name} ${isActiveProfile ? ' <small style="opacity:0.85;">(Active Profile)</small>' : ''}
      </button>`;
  }).join('');

  container.querySelectorAll('.profile-target-chip').forEach(btn => {
    btn.onclick = () => {
      activeSelectedExportProfileId = btn.getAttribute('data-id');
      renderImportExportProfileChips();
      updateEstimatedExportTimeUI();
    };
  });
}

/**
 * Render Profile Manager Card List with '...' Action Menus
 */
async function renderProfilesManagerList() {
  const container = document.getElementById('profilesListContainer');
  if (!container) return;

  const profiles = await db.getAll('profiles');
  const activeProfileId = await db.getActiveProfileId();

  container.innerHTML = profiles.map(p => {
    const isActive = p.id === activeProfileId;
    const avatar = p.avatarIcon || '👤';
    return `
      <div class="leader-item profile-row-item" data-id="${p.id}" style="display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 14px; background:var(--bg-secondary); border:1px solid ${isActive ? 'var(--accent-pink)' : 'var(--border-color)'}; border-radius:var(--radius-md);">
        <div style="display:flex; align-items:center; gap:10px; min-width:0; cursor:pointer;" onclick="switchActiveProfile('${p.id}')">
          <span style="font-size:1.4rem;">${avatar}</span>
          <div>
            <strong style="color:${isActive ? '#fff' : 'var(--text-muted)'}; font-size:0.95rem;">${p.name}</strong>
            ${isActive ? '<span class="badge" style="background:var(--accent-pink); color:#fff; font-size:0.68rem; margin-left:8px;">Active Profile</span>' : ''}
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:8px; flex-shrink:0; position:relative;">
          ${!isActive ? `<button class="btn btn-secondary btn-sm" onclick="switchActiveProfile('${p.id}')">Switch</button>` : ''}
          
          <div class="profile-menu-wrap" style="position:relative;">
            <button class="btn btn-secondary btn-sm profile-menu-trigger" data-id="${p.id}" style="font-weight:800; padding:4px 10px;">•••</button>
            <div class="profile-dropdown-menu" id="profileDropdown-${p.id}" style="display:none; position:absolute; right:0; top:32px; background:rgba(15,23,42,0.98); border:1px solid var(--border-color); border-radius:8px; padding:6px; box-shadow:0 6px 20px rgba(0,0,0,0.6); z-index:100; min-width:140px;">
              <button class="btn btn-secondary btn-sm" onclick="changeProfileAvatar('${p.id}'); document.getElementById('profileDropdown-${p.id}').style.display='none';" style="width:100%; text-align:left; margin-bottom:4px;">🖼️ Avatar</button>
              <button class="btn btn-secondary btn-sm" onclick="cloneProfile('${p.id}'); document.getElementById('profileDropdown-${p.id}').style.display='none';" style="width:100%; text-align:left; margin-bottom:4px;">📋 Clone</button>
              <button class="btn btn-secondary btn-sm" onclick="renameProfile('${p.id}'); document.getElementById('profileDropdown-${p.id}').style.display='none';" style="width:100%; text-align:left; margin-bottom:4px;">✏️ Rename</button>
              <button class="btn btn-danger btn-sm" onclick="deleteProfileStrict('${p.id}'); document.getElementById('profileDropdown-${p.id}').style.display='none';" style="width:100%; text-align:left;">🗑️ Delete</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('') || '<p class="text-muted">No profiles found.</p>';

  // Dropdown menu triggers
  container.querySelectorAll('.profile-menu-trigger').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const pId = btn.getAttribute('data-id');
      container.querySelectorAll('.profile-dropdown-menu').forEach(menu => {
        if (menu.id !== `profileDropdown-${pId}`) menu.style.display = 'none';
      });
      const menu = document.getElementById(`profileDropdown-${pId}`);
      if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      }
    };
  });

  document.addEventListener('click', () => {
    container.querySelectorAll('.profile-dropdown-menu').forEach(menu => {
      menu.style.display = 'none';
    });
  });
}

window.renderSettingsPage = renderSettingsPage;
window.renderImportExportProfileChips = renderImportExportProfileChips;
window.renderProfilesManagerList = renderProfilesManagerList;
