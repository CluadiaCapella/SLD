/* Collections & Profiles Backup / Export Manager Module */

function showArchiveProgressModal(title) {
  const modal = document.getElementById('archiveProgressModal');
  const titleEl = document.getElementById('archiveProgressTitle');
  if (modal) {
    if (titleEl) titleEl.textContent = title || 'Packaging Archive...';
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

window.showArchiveProgressModal = showArchiveProgressModal;
window.updateArchiveProgress = updateArchiveProgress;
window.hideArchiveProgressModal = hideArchiveProgressModal;
window.exportMediaCollectionZip = exportMediaCollectionZip;
window.importMediaCollectionZip = importMediaCollectionZip;
window.exportDataAndSettingsZip = exportDataAndSettingsZip;
window.importDataAndSettingsZip = importDataAndSettingsZip;
