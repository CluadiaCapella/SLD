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

function updateArchiveProgress(percent, currentFile = '') {
  const barEl = document.getElementById('archiveProgressBar');
  const pctEl = document.getElementById('archiveProgressPercent');
  const msgEl = document.getElementById('archiveProgressMessage');

  const rounded = Math.min(100, Math.max(0, Math.floor(percent)));
  if (barEl) barEl.style.width = `${rounded}%`;
  if (pctEl) pctEl.textContent = `${rounded}%`;
  if (msgEl && currentFile) msgEl.textContent = `Packaging: ${currentFile}`;
}

function hideArchiveProgressModal() {
  const modal = document.getElementById('archiveProgressModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

async function exportMediaCollectionZip() {
  if (!window.JSZip) { alert('JSZip library loading failed.'); return; }
  const mediaFiles = await db.getActiveMedia();

  if (mediaFiles.length === 0) {
    alert('No media files found in active collection to export.');
    return;
  }

  showArchiveProgressModal('💾 Packaging Collection Archive...');
  const zip = new window.JSZip();
  const manifestMedia = [];

  try {
    for (let i = 0; i < mediaFiles.length; i++) {
      const m = mediaFiles[i];
      updateArchiveProgress((i / mediaFiles.length) * 50, m.filename);
      if (m.dataUrl) {
        const parts = m.dataUrl.split(',');
        if (parts.length > 1) {
          const safeFilename = m.filename.replace(/[/\\?%*:|"<>]/g, '_');
          zip.file(safeFilename, parts[1], { base64: true });

          manifestMedia.push({
            id: m.id,
            filename: safeFilename,
            originalFilename: m.filename,
            type: m.type,
            hash: m.hash,
            blueBookEvents: m.blueBookEvents || [],
            subjectTags: m.subjectTags || [],
            normalTags: m.normalTags || [],
            viewTransform: m.viewTransform || {},
            customThumbnail: m.customThumbnail || null
          });
        }
      }
    }

    zip.file('collection_manifest.json', JSON.stringify({ version: DB_VERSION, exportDate: new Date().toISOString(), media: manifestMedia }, null, 2));

    const todayStr = new Date().toISOString().split('T')[0];
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, (metadata) => {
      updateArchiveProgress(50 + (metadata.percent / 2), metadata.currentFile || 'Generating ZIP archive...');
    });

    updateArchiveProgress(100, 'Complete! Opening download window...');
    setTimeout(() => {
      downloadBlob(blob, `SLD Collection ${todayStr}.zip`);
      hideArchiveProgressModal();
    }, 400);
  } catch (err) {
    hideArchiveProgressModal();
    console.error('Export collection archive error:', err);
    alert(`Error packaging collection archive: ${err.message || err}`);
  }
}

async function importMediaCollectionZip(file) {
  if (!window.JSZip) { alert('JSZip library loading failed.'); return; }
  try {
    const zip = new window.JSZip();
    const contents = await zip.loadAsync(file);
    const activeProfileId = await db.getActiveProfileId();
    const activeCollectionId = await db.getActiveCollectionId();
    const existingMedia = await db.getActiveMedia();
    const existingHashes = new Set(existingMedia.map(m => m.hash).filter(Boolean));

    let manifestData = null;
    const manifestFile = contents.file('collection_manifest.json');
    if (manifestFile) {
      try {
        const jsonText = await manifestFile.async('text');
        manifestData = JSON.parse(jsonText);
      } catch (e) {
        console.warn('Could not parse collection_manifest.json:', e);
      }
    }

    const manifestMap = new Map();
    if (manifestData && Array.isArray(manifestData.media)) {
      manifestData.media.forEach(item => {
        manifestMap.set(item.filename, item);
        if (item.originalFilename) manifestMap.set(item.originalFilename, item);
      });
    }

    let addedCount = 0;
    let duplicateCount = 0;

    const fileEntries = [];
    contents.forEach((relativePath, zipEntry) => {
      if (zipEntry.dir) return;
      const cleanName = relativePath.split('/').pop().toLowerCase();
      if (relativePath.includes('__MACOSX') || cleanName.startsWith('.') || cleanName === 'thumbs.db' || relativePath === 'collection_manifest.json') {
        return;
      }
      fileEntries.push({ relativePath, zipEntry });
    });

    for (const { relativePath, zipEntry } of fileEntries) {
      try {
        const base64 = await zipEntry.async('base64');
        const ext = relativePath.split('.').pop().toLowerCase();
        let mime = 'image/jpeg';
        if (ext === 'png') mime = 'image/png';
        else if (ext === 'gif') mime = 'image/gif';
        else if (ext === 'webp') mime = 'image/webp';
        else if (ext === 'svg') mime = 'image/svg+xml';
        else if (ext === 'mp4') mime = 'video/mp4';
        else if (ext === 'webm') mime = 'video/webm';
        else if (ext === 'mov') mime = 'video/quicktime';

        const dataUrl = `data:${mime};base64,${base64}`;
        const fileHash = await calculateContentHash(dataUrl);

        if (existingHashes.has(fileHash)) {
          duplicateCount++;
          continue;
        }
        existingHashes.add(fileHash);
        addedCount++;

        const compressedThumb = await createCompressedThumbnail(mime, dataUrl);
        const meta = manifestMap.get(relativePath) || manifestMap.get(relativePath.split('/').pop()) || {};

        const mediaItem = {
          id: meta.id || ('media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)),
          profileId: activeProfileId,
          collectionId: activeCollectionId,
          filename: relativePath.split('/').pop(),
          type: mime,
          dataUrl: dataUrl,
          thumbnailUrl: meta.customThumbnail || compressedThumb,
          customThumbnail: meta.customThumbnail || null,
          hash: fileHash,
          blueBookEvents: meta.blueBookEvents || [],
          subjectTags: meta.subjectTags || [],
          normalTags: meta.normalTags || [],
          viewTransform: meta.viewTransform || { rotate: 0, clipStart: 0, clipEnd: null }
        };
        await db.put('media', mediaItem);
      } catch (itemErr) {
        console.warn('Skipped unreadable item in ZIP:', relativePath, itemErr);
      }
    }

    await loadAppState();
    renderCurrentView();
    let msg = `Successfully imported ${addedCount} media file(s).`;
    if (duplicateCount > 0) msg += ` Skipped ${duplicateCount} duplicate file(s).`;
    alert(msg);
  } catch (err) {
    console.error('Import error:', err);
    alert(`Error importing collection file: ${err.message || err}`);
  }
}

async function exportDataAndSettingsZip() {
  if (!window.JSZip) return;
  showArchiveProgressModal('💾 Packaging Profile Archive...');

  try {
    const zip = new window.JSZip();
    const activeMedia = await db.getActiveMedia();
    updateArchiveProgress(20, 'Gathering metadata & settings...');

    const mediaMetadata = activeMedia.map(m => ({
      id: m.id,
      filename: m.filename,
      hash: m.hash,
      blueBookEvents: m.blueBookEvents || [],
      subjectTags: m.subjectTags || [],
      normalTags: m.normalTags || [],
      viewTransform: m.viewTransform || {},
      customThumbnail: m.customThumbnail || null
    }));

    const backupData = {
      version: DB_VERSION,
      exportDate: new Date().toISOString(),
      activeProfileId: await db.getActiveProfileId(),
      profiles: await db.getAll('profiles'),
      subjects: await db.getActiveSubjects(),
      events: await db.getActiveEvents(),
      mediaMetadata: mediaMetadata,
      settings: {
        actionPointsMap: await db.getSetting('actionPointsMap'),
        medalSettings: await db.getSetting('medalSettings'),
        scoringWeights: await db.getSetting('scoringWeights'),
        subjectGroups: await db.getSetting('subjectGroups')
      }
    };

    zip.file('backup_data.json', JSON.stringify(backupData, null, 2));
    const todayStr = new Date().toISOString().split('T')[0];

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, (metadata) => {
      updateArchiveProgress(40 + (metadata.percent * 0.6), 'Compressing profile backup...');
    });

    updateArchiveProgress(100, 'Complete! Opening download window...');
    setTimeout(() => {
      downloadBlob(blob, `SLD Profile ${todayStr}.zip`);
      hideArchiveProgressModal();
    }, 400);
  } catch (err) {
    hideArchiveProgressModal();
    console.error('Export profile error:', err);
    alert(`Error packaging profile backup: ${err.message || err}`);
  }
}

async function importDataAndSettingsZip(file) {
  if (!window.JSZip) return;
  try {
    let jsonStr = '';
    if (file.name.endsWith('.json')) {
      jsonStr = await file.text();
    } else {
      const zip = new window.JSZip();
      const contents = await zip.loadAsync(file);
      const dataFile = contents.file('backup_data.json') || Object.values(contents.files)[0];
      if (dataFile) jsonStr = await dataFile.async('text');
    }

    if (!jsonStr) throw new Error('No data found in backup file');
    const backup = JSON.parse(jsonStr);

    const todayTag = getTodaySmartDateTag();
    const newProfileId = 'profile-' + Date.now();
    const newProfile = { id: newProfileId, name: `Profile ${todayTag}`, createdAt: new Date().toISOString() };
    await db.put('profiles', newProfile);

    for (const s of (backup.subjects || [])) {
      await db.put('subjects', { ...s, profileId: newProfileId });
    }

    for (const e of (backup.events || [])) {
      await db.put('events', { ...e, profileId: newProfileId });
    }

    if (backup.mediaMetadata && Array.isArray(backup.mediaMetadata)) {
      const allMedia = await db.getAll('media');
      for (const meta of backup.mediaMetadata) {
        const m = allMedia.find(item => item.id === meta.id || (item.hash && item.hash === meta.hash) || item.filename === meta.filename);
        if (m) {
          m.blueBookEvents = meta.blueBookEvents || m.blueBookEvents || [];
          m.subjectTags = meta.subjectTags || m.subjectTags || [];
          m.normalTags = meta.normalTags || m.normalTags || [];
          if (meta.viewTransform) m.viewTransform = meta.viewTransform;
          if (meta.customThumbnail) m.customThumbnail = meta.customThumbnail;
          await db.put('media', m);
        }
      }
    }

    if (backup.settings) {
      if (backup.settings.actionPointsMap) await db.setSetting('actionPointsMap', backup.settings.actionPointsMap);
      if (backup.settings.medalSettings) await db.setSetting('medalSettings', backup.settings.medalSettings);
      if (backup.settings.subjectGroups) await db.setSetting('subjectGroups', backup.settings.subjectGroups);
    }

    await db.setActiveProfileId(newProfileId);
    await loadAppState();
    renderCurrentView();
    alert(`Data imported successfully into new profile: "${newProfile.name}"!`);
  } catch (err) {
    alert('Error importing data and settings file.');
  }
}

window.renderSettingsPage = renderSettingsPage;
window.renderCollectionsManagerList = renderCollectionsManagerList;
window.renderProfilesManagerList = renderProfilesManagerList;
window.exportMediaCollectionZip = exportMediaCollectionZip;
window.importMediaCollectionZip = importMediaCollectionZip;
window.exportDataAndSettingsZip = exportDataAndSettingsZip;
window.importDataAndSettingsZip = importDataAndSettingsZip;
