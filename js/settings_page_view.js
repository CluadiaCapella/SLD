/**
 * Settings Page View, Profiles & Collections Manager Subsystem
 */

async function renderSettingsPage() {
  const currentTheme = (await db.getSetting('theme')) || 'dark';
  document.getElementById('themeSelect').value = currentTheme;

  document.getElementById('goldPointValueInput').value = currentMedalSettings.goldPts ?? 1.0;
  document.getElementById('silverPointValueInput').value = currentMedalSettings.silverPts ?? 0.3;
  document.getElementById('bronzePointValueInput').value = currentMedalSettings.bronzePts ?? 0.1;

  document.getElementById('maxGoldPerHeartInput').value = currentMedalSettings.maxGold ?? 1;
  document.getElementById('maxSilverPerHeartInput').value = currentMedalSettings.maxSilver ?? 2;
  document.getElementById('maxBronzePerHeartInput').value = currentMedalSettings.maxBronze ?? 5;

  renderCollectionsManagerList();
  renderProfilesManagerList();
  if (typeof renderIpConnectionsList === 'function') renderIpConnectionsList();

  const addIpBtn = document.getElementById('addIpConnectionBtn');
  if (addIpBtn && !addIpBtn.dataset.bound) {
    addIpBtn.dataset.bound = 'true';
    addIpBtn.onclick = () => {
      if (typeof addIpConnection === 'function') addIpConnection();
    };
  }
}

async function renderCollectionsManagerList() {
  const container = document.getElementById('collectionsListContainer');
  if (!container) return;

  const collections = await db.getAll('collections');
  const activeCollectionId = await db.getActiveCollectionId();

  container.innerHTML = collections.map((c, idx) => `
    <div class="leader-item collection-row-item" data-id="${c.id}" data-name="${c.name}" draggable="true" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
      <div style="display:flex; align-items:center; gap:8px; min-width:0;">
        <span style="cursor:grab; font-size:1.1rem; flex-shrink:0;">≡</span>
        <strong class="collection-row-name" title="${c.name}">🖼️ ${c.name}</strong>
        ${c.id === activeCollectionId ? '<span class="badge" style="background:var(--accent-blue); color:#fff; flex-shrink:0;">Active</span>' : ''}
      </div>
      <div style="display:flex; gap:6px; flex-shrink:0;">
        ${c.id !== activeCollectionId ? `<button class="btn btn-secondary btn-sm switch-collection-btn" data-id="${c.id}">Switch</button>` : ''}
        <button class="btn btn-secondary btn-sm dup-collection-btn" data-id="${c.id}">📋 Duplicate</button>
        <button class="btn btn-danger btn-sm delete-collection-btn" data-id="${c.id}" data-name="${c.name}">🗑️</button>
      </div>
    </div>`).join('') || '<p class="text-muted">No collections found.</p>';

  container.querySelectorAll('.switch-collection-btn').forEach(btn => {
    btn.onclick = async () => {
      await db.setActiveCollectionId(btn.getAttribute('data-id'));
      await loadAppState();
      renderCurrentView();
    };
  });

  container.querySelectorAll('.dup-collection-btn').forEach(btn => {
    btn.onclick = async () => {
      const cId = btn.getAttribute('data-id');
      const source = collections.find(c => c.id === cId);
      if (!source) return;
      const newId = 'col-' + Date.now();
      const newCol = { id: newId, name: `${source.name} (Copy)`, createdAt: new Date().toISOString() };
      await db.put('collections', newCol);

      const allMedia = await db.getAll('media');
      for (const m of allMedia.filter(m => m.collectionId === cId)) {
        const cloned = { ...m, id: 'media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), collectionId: newId };
        await db.put('media', cloned);
      }

      renderCollectionsManagerList();
    };
  });

  container.querySelectorAll('.delete-collection-btn').forEach(btn => {
    btn.onclick = async () => {
      const cId = btn.getAttribute('data-id');
      const cName = btn.getAttribute('data-name');
      if (cId === activeCollectionId) {
        alert('Cannot delete the currently active collection.');
        return;
      }
      if (promptStringentDeleteConfirmation('Collection', cName)) {
        const allMedia = await db.getAll('media');
        for (const m of allMedia.filter(item => item.collectionId === cId)) {
          await db.delete('media', m.id);
        }
        await db.delete('collections', cId);
        await loadAppState();
        renderSettingsPage();
      }
    };
  });

  setupDragToMergeRows(container, 'Collection', async (sourceId, targetId, sourceName, targetName) => {
    const allMedia = await db.getAll('media');
    for (const m of allMedia.filter(item => item.collectionId === sourceId)) {
      m.collectionId = targetId;
      await db.put('media', m);
    }
    await db.delete('collections', sourceId);
    await loadAppState();
    renderSettingsPage();
  });
}

async function renderProfilesManagerList() {
  const container = document.getElementById('profilesListContainer');
  if (!container) return;

  const profiles = await db.getAll('profiles');
  const activeProfileId = await db.getActiveProfileId();

  container.innerHTML = profiles.map(p => `
    <div class="leader-item profile-row-item" data-id="${p.id}" data-name="${p.name}" draggable="true" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
      <div style="display:flex; align-items:center; gap:8px; min-width:0;">
        <span style="cursor:grab; font-size:1.1rem; flex-shrink:0;">≡</span>
        <strong class="profile-row-name" title="${p.name}">📁 ${p.name}</strong>
        ${p.id === activeProfileId ? '<span class="badge" style="background:var(--accent-pink); color:#fff; flex-shrink:0;">Active</span>' : ''}
      </div>
      <div style="display:flex; gap:6px; flex-shrink:0;">
        ${p.id !== activeProfileId ? `<button class="btn btn-secondary btn-sm switch-profile-btn" data-id="${p.id}">Switch</button>` : ''}
        <button class="btn btn-secondary btn-sm dup-profile-btn" data-id="${p.id}">📋 Duplicate</button>
        <button class="btn btn-danger btn-sm delete-profile-btn" data-id="${p.id}" data-name="${p.name}">🗑️</button>
      </div>
    </div>`).join('') || '<p class="text-muted">No profiles found.</p>';

  container.querySelectorAll('.switch-profile-btn').forEach(btn => {
    btn.onclick = async () => {
      await db.setActiveProfileId(btn.getAttribute('data-id'));
      await loadAppState();
      renderCurrentView();
    };
  });

  container.querySelectorAll('.dup-profile-btn').forEach(btn => {
    btn.onclick = async () => {
      const pId = btn.getAttribute('data-id');
      const source = profiles.find(p => p.id === pId);
      if (!source) return;
      const newId = 'profile-' + Date.now();
      const newProf = { id: newId, name: `${source.name} (Copy)`, createdAt: new Date().toISOString() };
      await db.put('profiles', newProf);

      const allMedia = await db.getAll('media');
      for (const m of allMedia.filter(m => m.profileId === pId)) {
        await db.put('media', { ...m, id: 'media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), profileId: newId });
      }
      const allSubs = await db.getAll('subjects');
      for (const s of allSubs.filter(s => s.profileId === pId)) {
        await db.put('subjects', { ...s, id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), profileId: newId });
      }
      const allEvts = await db.getAll('events');
      for (const e of allEvts.filter(e => e.profileId === pId)) {
        await db.put('events', { ...e, id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), profileId: newId });
      }

      renderProfilesManagerList();
    };
  });

  container.querySelectorAll('.delete-profile-btn').forEach(btn => {
    btn.onclick = async () => {
      const pId = btn.getAttribute('data-id');
      const pName = btn.getAttribute('data-name');
      if (pId === activeProfileId) {
        alert('Cannot delete currently active profile.');
        return;
      }
      if (promptStringentDeleteConfirmation('Profile', pName)) {
        await db.delete('profiles', pId);
        await loadAppState();
        renderSettingsPage();
      }
    };
  });

  setupDragToMergeRows(container, 'Profile', async (sourceId, targetId, sourceName, targetName) => {
    const allMedia = await db.getAll('media');
    for (const m of allMedia.filter(item => item.profileId === sourceId)) {
      m.profileId = targetId;
      await db.put('media', m);
    }
    const allSubs = await db.getAll('subjects');
    for (const s of allSubs.filter(item => item.profileId === sourceId)) {
      s.profileId = targetId;
      await db.put('subjects', s);
    }
    const allEvts = await db.getAll('events');
    for (const e of allEvts.filter(item => item.profileId === sourceId)) {
      e.profileId = targetId;
      await db.put('events', e);
    }
    await db.delete('profiles', sourceId);
    await loadAppState();
    renderSettingsPage();
  });
}

function setupDragToMergeRows(container, itemType, onMerge) {
  let draggedId = null;
  let draggedName = null;

  container.querySelectorAll('.leader-item').forEach(row => {
    row.addEventListener('dragstart', (e) => {
      draggedId = row.getAttribute('data-id');
      draggedName = row.getAttribute('data-name');
      e.dataTransfer.effectAllowed = 'move';
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      const targetId = row.getAttribute('data-id');
      const targetName = row.getAttribute('data-name');

      if (draggedId && targetId && draggedId !== targetId) {
        if (confirm(`Merge ${itemType} "${draggedName}" into "${targetName}"?\n\nAll items will be reassigned to "${targetName}".`)) {
          await onMerge(draggedId, targetId, draggedName, targetName);
        }
      }
    });
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function showArchiveProgressModal(title = 'Packaging Archive...') {
  const modal = document.getElementById('archiveProgressModal');
  const titleEl = document.getElementById('archiveProgressTitle');
  const msgEl = document.getElementById('archiveProgressMessage');
  const barEl = document.getElementById('archiveProgressBar');
  const pctEl = document.getElementById('archiveProgressPercent');

  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = 'Preparing files for packaging. Please wait...';
  if (barEl) barEl.style.width = '0%';
  if (pctEl) pctEl.textContent = '0%';

  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  }
}

window.renderSettingsPage = renderSettingsPage;
window.renderCollectionsManagerList = renderCollectionsManagerList;
window.renderProfilesManagerList = renderProfilesManagerList;
