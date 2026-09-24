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
          normalTags: meta.normalTags || []
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

/**
 * Export full Portable SLD Package (.sldpack / .zip)
 */
async function exportPortableSldPackage() {
  if (!window.JSZip) {
    alert('JSZip library is unavailable.');
    return;
  }
  showArchiveProgressModal('📦 Exporting Portable SLD Package...');

  try {
    const zip = new window.JSZip();
    updateArchiveProgress(10, 'Gathering database records...');

    const activeProfileId = await db.getActiveProfileId();
    const activeMedia = await db.getActiveMedia();
    const activeSubjects = await db.getActiveSubjects();
    const activeEvents = await db.getActiveEvents();
    const allSldEntries = await db.getAll('sld_entries');
    const allTags = await db.getAll('tags');

    updateArchiveProgress(25, 'Stripping device-specific crops & formatting metadata...');

    // Exclude device-specific media crop coordinates (viewTransform, crop, cropRect)
    const cleanMediaMetadata = activeMedia.map(m => {
      const copy = { ...m };
      delete copy.viewTransform;
      delete copy.crop;
      delete copy.cropRect;
      return copy;
    });

    const exportTimestamp = Date.now();
    const isoDate = new Date().toISOString();
    const deviceId = (await db.getSetting('myDeviceShortCode')) || 'SLD-APP';

    const manifest = {
      formatVersion: 2,
      appVersion: '260924.0100',
      exportDate: isoDate,
      exportTimestamp: exportTimestamp,
      deviceId: deviceId,
      counts: {
        media: cleanMediaMetadata.length,
        subjects: activeSubjects.length,
        events: activeEvents.length,
        sldEntries: allSldEntries.length,
        tags: allTags.length
      }
    };

    const sldDatabase = {
      manifest,
      activeProfileId,
      profiles: await db.getAll('profiles'),
      subjects: activeSubjects,
      events: activeEvents,
      sldEntries: allSldEntries,
      tags: allTags,
      mediaMetadata: cleanMediaMetadata,
      settings: {
        actionPointsMap: await db.getSetting('actionPointsMap'),
        medalSettings: await db.getSetting('medalSettings'),
        scoringWeights: await db.getSetting('scoringWeights'),
        subjectGroups: await db.getSetting('subjectGroups'),
        tagPrefixSettings: await db.getSetting('tagPrefixSettings'),
        alikeSettings: await db.getSetting('alikeSettings')
      }
    };

    zip.file('sld_manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('sld_database.json', JSON.stringify(sldDatabase, null, 2));

    const mediaFolder = zip.folder('media');
    const totalMedia = activeMedia.length;

    for (let i = 0; i < totalMedia; i++) {
      const m = activeMedia[i];
      updateArchiveProgress(30 + (i / Math.max(1, totalMedia)) * 50, m.filename || `Media ${i + 1}`);

      if (m.dataUrl && m.dataUrl.includes(',')) {
        const parts = m.dataUrl.split(',');
        if (parts.length > 1) {
          const safeName = (m.filename || `${m.id}.bin`).replace(/[/\\?%*:|"<>]/g, '_');
          mediaFolder.file(safeName, parts[1], { base64: true });
        }
      }
    }

    updateArchiveProgress(85, 'Compressing archive...');
    const todayStr = isoDate.split('T')[0];
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, (meta) => {
      updateArchiveProgress(85 + (meta.percent * 0.14), 'Finalizing archive...');
    });

    updateArchiveProgress(100, 'Complete! Downloading package...');
    setTimeout(() => {
      downloadBlob(blob, `SLD_Package_${todayStr}_${deviceId}.sldpack`);
      hideArchiveProgressModal();
      if (typeof showToastNotification === 'function') {
        showToastNotification('📦 Portable SLD Package exported successfully!');
      }
    }, 400);

  } catch (err) {
    hideArchiveProgressModal();
    console.error('Portable SLD package export error:', err);
    alert(`Export Error: ${err.message || err}`);
  }
}

/**
 * Import & Smart Delta Merge Portable SLD Package
 * @param {File} file - .sldpack / .zip / .json file
 * @param {string} importMode - 'merge' (default) or 'new'
 */
async function importAndMergeSldPackage(file, importMode = 'merge') {
  if (!file) return;
  showArchiveProgressModal('📥 Reading SLD Package...');

  try {
    let jsonStr = '';
    let zipContents = null;

    if (file.name.endsWith('.json')) {
      jsonStr = await file.text();
    } else if (window.JSZip) {
      const zip = new window.JSZip();
      zipContents = await zip.loadAsync(file);

      const dbFile = zipContents.file('sld_database.json') || zipContents.file('backup_data.json') || zipContents.file('data.json');
      if (dbFile) {
        jsonStr = await dbFile.async('text');
      } else {
        const firstJson = Object.values(zipContents.files).find(f => f.name.endsWith('.json'));
        if (firstJson) jsonStr = await firstJson.async('text');
      }
    }

    if (!jsonStr) throw new Error('No valid database payload found in archive.');
    const packageData = JSON.parse(jsonStr);

    updateArchiveProgress(20, 'Analyzing package contents...');

    let targetProfileId = await db.getActiveProfileId();
    if (importMode === 'new') {
      const todayTag = getTodaySmartDateTag();
      targetProfileId = 'profile-' + Date.now();
      const newProfile = {
        id: targetProfileId,
        name: `Imported Package (${todayTag})`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.put('profiles', newProfile);
      await db.setActiveProfileId(targetProfileId);
    }

    const report = {
      addedMedia: 0,
      mergedMedia: 0,
      skippedMediaDuplicates: 0,
      addedSubjects: 0,
      updatedSubjects: 0,
      addedEvents: 0,
      updatedEvents: 0,
      addedSldEntries: 0,
      updatedSldEntries: 0,
      addedTags: 0,
      updatedTags: 0
    };

    // 1. Merge Subjects
    updateArchiveProgress(30, 'Merging subjects...');
    const localSubjects = await db.getActiveSubjects();
    for (const incSub of (packageData.subjects || [])) {
      const existing = localSubjects.find(s => s.id === incSub.id || (s.name && incSub.name && s.name.toLowerCase() === incSub.name.toLowerCase()));
      if (!existing) {
        await db.put('subjects', { ...incSub, profileId: targetProfileId, updatedAt: incSub.updatedAt || new Date().toISOString() });
        report.addedSubjects++;
      } else {
        const incTime = new Date(incSub.updatedAt || 0).getTime();
        const locTime = new Date(existing.updatedAt || 0).getTime();
        if (incTime >= locTime || importMode === 'new') {
          const merged = {
            ...existing,
            ...incSub,
            id: existing.id,
            profileId: targetProfileId,
            avatarUrl: incSub.avatarUrl || existing.avatarUrl,
            updatedAt: new Date().toISOString()
          };
          await db.put('subjects', merged);
          report.updatedSubjects++;
        }
      }
    }

    // 2. Merge Events
    updateArchiveProgress(45, 'Merging events...');
    const localEvents = await db.getActiveEvents();
    for (const incEvt of (packageData.events || [])) {
      const existing = localEvents.find(e => e.id === incEvt.id || (e.eventCode === incEvt.eventCode && e.dateTag === incEvt.dateTag));
      if (!existing) {
        await db.put('events', { ...incEvt, profileId: targetProfileId, updatedAt: incEvt.updatedAt || new Date().toISOString() });
        report.addedEvents++;
      } else {
        const incTime = new Date(incEvt.updatedAt || 0).getTime();
        const locTime = new Date(existing.updatedAt || 0).getTime();

        const mergedSubjectCounts = { ...(existing.subjectCounts || {}) };
        if (incEvt.subjectCounts) {
          for (const [sId, count] of Object.entries(incEvt.subjectCounts)) {
            mergedSubjectCounts[sId] = Math.max(mergedSubjectCounts[sId] || 0, count || 0);
          }
        }

        const mergedEvt = {
          ...existing,
          ...(incTime >= locTime ? incEvt : {}),
          id: existing.id,
          profileId: targetProfileId,
          subjectCounts: mergedSubjectCounts,
          where: incTime >= locTime ? (incEvt.where || existing.where) : (existing.where || incEvt.where),
          updatedAt: new Date().toISOString()
        };
        await db.put('events', mergedEvt);
        report.updatedEvents++;
      }
    }

    // 3. Merge SLD Log Entries
    updateArchiveProgress(55, 'Merging SLD log entries...');
    const localSldEntries = await db.getAll('sld_entries');
    for (const incEntry of (packageData.sldEntries || [])) {
      const existing = localSldEntries.find(e => e.id === incEntry.id || (e.dateTag === incEntry.dateTag && e.actionCode === incEntry.actionCode));
      if (!existing) {
        await db.put('sld_entries', { ...incEntry, profileId: targetProfileId });
        report.addedSldEntries++;
      } else {
        const incTime = new Date(incEntry.updatedAt || 0).getTime();
        const locTime = new Date(existing.updatedAt || 0).getTime();
        if (incTime >= locTime) {
          await db.put('sld_entries', { ...existing, ...incEntry, id: existing.id, profileId: targetProfileId });
          report.updatedSldEntries++;
        }
      }
    }

    // 4. Merge Tags
    updateArchiveProgress(65, 'Merging tags...');
    const localTags = await db.getAll('tags');
    for (const incTag of (packageData.tags || [])) {
      const existing = localTags.find(t => t.id === incTag.id || (t.name && incTag.name && t.name.toLowerCase() === incTag.name.toLowerCase()));
      if (!existing) {
        await db.put('tags', incTag);
        report.addedTags++;
      } else {
        await db.put('tags', { ...existing, ...incTag, id: existing.id });
        report.updatedTags++;
      }
    }

    // 5. Merge Media & Binary Assets
    updateArchiveProgress(75, 'Merging media files & deduplicating content...');
    const localMedia = await db.getActiveMedia();
    const mediaFolder = zipContents ? zipContents.folder('media') : null;

    const mediaListToProcess = packageData.mediaMetadata || packageData.media || [];
    const totalMedia = mediaListToProcess.length;

    for (let i = 0; i < totalMedia; i++) {
      const incMeta = mediaListToProcess[i];
      updateArchiveProgress(75 + (i / Math.max(1, totalMedia)) * 20, incMeta.filename || `Media ${i + 1}`);

      let dataUrl = incMeta.dataUrl || null;
      const safeFilename = (incMeta.filename || `${incMeta.id}.bin`).replace(/[/\\?%*:|"<>]/g, '_');

      if (!dataUrl && mediaFolder) {
        const mediaFile = mediaFolder.file(safeFilename) || mediaFolder.file(incMeta.filename);
        if (mediaFile) {
          const base64 = await mediaFile.async('base64');
          const mime = incMeta.type || (safeFilename.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg');
          dataUrl = `data:${mime};base64,${base64}`;
        }
      }

      const fileHash = incMeta.hash || (dataUrl ? await calculateContentHash(dataUrl) : null);

      // Match existing media by content hash, ID, or filename
      const existing = localMedia.find(m => (fileHash && m.hash === fileHash) || m.id === incMeta.id || (m.filename && incMeta.filename && m.filename === incMeta.filename));

      if (!existing) {
        if (dataUrl) {
          const thumb = incMeta.customThumbnail || await createCompressedThumbnail(incMeta.type || 'image/jpeg', dataUrl);
          const newMediaItem = {
            ...incMeta,
            id: incMeta.id || ('media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)),
            profileId: targetProfileId,
            collectionId: await db.getActiveCollectionId(),
            dataUrl,
            thumbnailUrl: thumb,
            hash: fileHash,
            updatedAt: incMeta.updatedAt || new Date().toISOString()
          };
          delete newMediaItem.viewTransform;
          delete newMediaItem.crop;
          delete newMediaItem.cropRect;

          await db.put('media', newMediaItem);
          report.addedMedia++;
        }
      } else {
        // MERGE existing media: PRESERVE LOCAL DEVICE-SPECIFIC CROPS!
        const incSubjectTags = incMeta.subjectTags || [];
        const incNormalTags = incMeta.normalTags || [];
        const incHeartTags = incMeta.heartTags || [];
        const incEvents = incMeta.blueBookEvents || [];

        const unionSubjectTags = Array.from(new Set([...(existing.subjectTags || []), ...incSubjectTags]));
        const unionNormalTags = Array.from(new Set([...(existing.normalTags || []), ...incNormalTags]));
        const unionHeartTags = Array.from(new Set([...(existing.heartTags || []), ...incHeartTags]));
        const unionEvents = Array.from(new Set([...(existing.blueBookEvents || []), ...incEvents]));

        const mergedMediaItem = {
          ...existing,
          profileId: targetProfileId,
          subjectTags: unionSubjectTags,
          normalTags: unionNormalTags,
          heartTags: unionHeartTags,
          blueBookEvents: unionEvents,
          dateTag: incMeta.dateTag || existing.dateTag,
          customThumbnail: incMeta.customThumbnail || existing.customThumbnail,
          updatedAt: new Date().toISOString()
        };

        // Retain local device-specific crop preferences (`viewTransform`)
        if (existing.viewTransform) {
          mergedMediaItem.viewTransform = existing.viewTransform;
        }

        await db.put('media', mergedMediaItem);
        report.mergedMedia++;
      }
    }

    // 6. Merge Settings Configurations
    if (packageData.settings) {
      if (packageData.settings.actionPointsMap) await db.setSetting('actionPointsMap', packageData.settings.actionPointsMap);
      if (packageData.settings.medalSettings) await db.setSetting('medalSettings', packageData.settings.medalSettings);
      if (packageData.settings.scoringWeights) await db.setSetting('scoringWeights', packageData.settings.scoringWeights);
      if (packageData.settings.subjectGroups) await db.setSetting('subjectGroups', packageData.settings.subjectGroups);
      if (packageData.settings.tagPrefixSettings) await db.setSetting('tagPrefixSettings', packageData.settings.tagPrefixSettings);
      if (packageData.settings.alikeSettings) await db.setSetting('alikeSettings', packageData.settings.alikeSettings);
    }

    updateArchiveProgress(100, 'Finalizing import...');
    await loadAppState();
    renderCurrentView();

    setTimeout(() => {
      hideArchiveProgressModal();
      const summaryMsg = `
✅ Smart Delta Merge Complete!
• Media: ${report.addedMedia} added, ${report.mergedMedia} merged (Device crops preserved)
• Subjects: ${report.addedSubjects} added, ${report.updatedSubjects} updated
• Events: ${report.addedEvents} added, ${report.updatedEvents} updated
• SLD Logs: ${report.addedSldEntries} added, ${report.updatedSldEntries} updated
• Tags: ${report.addedTags} added, ${report.updatedTags} updated`;

      alert(summaryMsg.trim());
    }, 400);

  } catch (err) {
    hideArchiveProgressModal();
    console.error('SLD package import error:', err);
    alert(`Import Error: ${err.message || err}`);
  }
}

async function exportDataAndSettingsZip() {
  return exportPortableSldPackage();
}

async function importDataAndSettingsZip(file) {
  return importAndMergeSldPackage(file, 'merge');
}

window.showArchiveProgressModal = showArchiveProgressModal;
window.updateArchiveProgress = updateArchiveProgress;
window.hideArchiveProgressModal = hideArchiveProgressModal;
window.exportMediaCollectionZip = exportMediaCollectionZip;
window.importMediaCollectionZip = importMediaCollectionZip;
window.exportDataAndSettingsZip = exportDataAndSettingsZip;
window.importDataAndSettingsZip = importDataAndSettingsZip;
window.exportPortableSldPackage = exportPortableSldPackage;
window.importAndMergeSldPackage = importAndMergeSldPackage;
