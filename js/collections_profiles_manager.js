/* Collections & Profiles Backup / Export Manager Module */

let activeSelectedExportProfileId = null;

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
  if (msgEl && currentFile) msgEl.textContent = `Processing: ${currentFile}`;
}

function hideArchiveProgressModal() {
  const modal = document.getElementById('archiveProgressModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
  }
}

/**
 * Top Header Profile Account Button & Popover Setup
 */
async function updateProfileHeaderUI() {
  const activeProfile = await db.getActiveProfile();
  const iconEl = document.getElementById('headerProfileIcon');
  const nameEl = document.getElementById('headerProfileName');
  const popoverNameEl = document.getElementById('popoverCurrentProfileName');
  const popoverIconEl = document.getElementById('popoverProfileAvatarIcon');

  const pName = activeProfile?.name || 'User Name';
  const pAvatar = activeProfile?.avatarIcon || '👤';

  if (nameEl) nameEl.textContent = pName;
  if (popoverNameEl) popoverNameEl.textContent = pName;
  if (iconEl) iconEl.textContent = pAvatar;
  if (popoverIconEl) popoverIconEl.textContent = pAvatar;

  const btn = document.getElementById('headerProfileAvatarBtn');
  const popover = document.getElementById('profileHeaderPopover');

  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = 'true';
    btn.onclick = (e) => {
      e.stopPropagation();
      renderProfilePopoverList();
      if (popover) {
        popover.style.display = popover.style.display === 'block' ? 'none' : 'block';
      }
    };
  }

  const avatarWrap = document.getElementById('popoverAvatarWrap');
  if (avatarWrap && !avatarWrap.dataset.bound) {
    avatarWrap.dataset.bound = 'true';
    avatarWrap.onclick = async () => {
      const activePId = await db.getActiveProfileId();
      await changeProfileAvatar(activePId);
    };
  }

  document.addEventListener('click', (e) => {
    if (popover && !popover.contains(e.target) && btn && !btn.contains(e.target)) {
      popover.style.display = 'none';
    }
  });
}

async function changeProfileAvatar(profileId) {
  const p = await db.get('profiles', profileId);
  if (!p) return;
  const newAvatar = prompt(`Choose Avatar Icon or Emoji for "${p.name}":`, p.avatarIcon || '👤');
  if (newAvatar !== null && newAvatar.trim()) {
    p.avatarIcon = newAvatar.trim();
    p.updatedAt = new Date().toISOString();
    await db.put('profiles', p);
    await updateProfileHeaderUI();
    if (typeof renderProfilesManagerList === 'function') renderProfilesManagerList();
    if (typeof showToastNotification === 'function') {
      showToastNotification(`👤 Avatar updated for "${p.name}"`);
    }
  }
}

async function renderProfilePopoverList() {
  const container = document.getElementById('popoverProfilesList');
  if (!container) return;

  const profiles = await db.getAll('profiles');
  const activeProfileId = await db.getActiveProfileId();

  container.innerHTML = profiles.map(p => {
    const isActive = p.id === activeProfileId;
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; border-radius:6px; background:${isActive ? 'rgba(236,72,153,0.15)' : 'var(--bg-secondary)'}; border:1px solid ${isActive ? 'var(--accent-pink)' : 'var(--border-color)'}; font-size:0.8rem;">
        <span style="font-weight:${isActive ? '800' : '600'}; color:${isActive ? '#fff' : 'var(--text-muted)'}; cursor:pointer;" onclick="switchActiveProfile('${p.id}')">
          👤 ${p.name} ${isActive ? ' <small style="color:var(--accent-pink);">(Active)</small>' : ''}
        </span>
        ${!isActive ? `<button class="btn btn-sm btn-secondary" onclick="switchActiveProfile('${p.id}')">Switch</button>` : ''}
      </div>`;
  }).join('') || '<p class="text-muted" style="font-size:0.75rem;">No profiles found.</p>';
}

async function switchActiveProfile(profileId) {
  await db.setActiveProfileId(profileId);
  await loadAppState();
  const popover = document.getElementById('profileHeaderPopover');
  if (popover) popover.style.display = 'none';
  await updateProfileHeaderUI();
  renderCurrentView();
  if (typeof showToastNotification === 'function') {
    const p = await db.get('profiles', profileId);
    showToastNotification(`👤 Switched active profile to "${p?.name || 'Profile'}"`);
  }
}

/**
 * Profile Operations: Clone, Rename, Delete Strict
 */
async function cloneProfile(profileId) {
  const profiles = await db.getAll('profiles');
  const source = profiles.find(p => p.id === profileId);
  if (!source) return;

  showArchiveProgressModal(`📋 Cloning Profile "${source.name}"...`);

  try {
    const newProfileId = 'profile-' + Date.now();
    const newProfile = {
      id: newProfileId,
      name: `${source.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await db.put('profiles', newProfile);

    // Clone Subjects
    const subjects = await db.getAll('subjects');
    for (const s of subjects.filter(item => item.profileId === profileId)) {
      await db.put('subjects', { ...s, id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), profileId: newProfileId });
    }

    // Clone Events
    const events = await db.getAll('events');
    for (const e of events.filter(item => item.profileId === profileId)) {
      await db.put('events', { ...e, id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), profileId: newProfileId });
    }

    // Clone SLD Entries
    const sldEntries = await db.getAll('sld_entries');
    for (const entry of sldEntries.filter(item => item.profileId === profileId)) {
      await db.put('sld_entries', { ...entry, id: 'sld-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), profileId: newProfileId });
    }

    hideArchiveProgressModal();
    if (typeof renderProfilesManagerList === 'function') renderProfilesManagerList();
    if (typeof showToastNotification === 'function') {
      showToastNotification(`📋 Cloned profile "${source.name}" to "${newProfile.name}"`);
    }
  } catch (err) {
    hideArchiveProgressModal();
    alert(`Error cloning profile: ${err.message || err}`);
  }
}

async function renameProfile(profileId) {
  const p = await db.get('profiles', profileId);
  if (!p) return;

  const newName = prompt(`Rename Profile "${p.name}":`, p.name);
  if (newName !== null && newName.trim() && newName.trim() !== p.name) {
    p.name = newName.trim();
    p.updatedAt = new Date().toISOString();
    await db.put('profiles', p);
    await updateProfileHeaderUI();
    if (typeof renderProfilesManagerList === 'function') renderProfilesManagerList();
    if (typeof showToastNotification === 'function') {
      showToastNotification(`✏️ Renamed profile to "${p.name}"`);
    }
  }
}

async function deleteProfileStrict(profileId) {
  const activeId = await db.getActiveProfileId();
  const profiles = await db.getAll('profiles');
  const p = profiles.find(item => item.id === profileId);
  if (!p) return;

  if (profiles.length <= 1) {
    alert('Cannot delete the only profile. Create another profile first.');
    return;
  }

  const promptMsg = `⚠️ WARNING: Deleting profile "${p.name}" will delete ALL data and settings for this profile, and UNLINK all media (media files will not be deleted, but you will need to re-assign them if used again).\n\nType "${p.name}" below to confirm deletion:`;
  const inputVal = prompt(promptMsg);

  if (inputVal !== null) {
    if (inputVal.trim() === p.name.trim()) {
      showArchiveProgressModal(`🗑️ Deleting Profile "${p.name}"...`);

      // Delete associated subjects, events, sld_entries
      const subjects = await db.getAll('subjects');
      for (const s of subjects.filter(item => item.profileId === profileId)) {
        await db.delete('subjects', s.id);
      }
      const events = await db.getAll('events');
      for (const e of events.filter(item => item.profileId === profileId)) {
        await db.delete('events', e.id);
      }
      const sldEntries = await db.getAll('sld_entries');
      for (const entry of sldEntries.filter(item => item.profileId === profileId)) {
        await db.delete('sld_entries', entry.id);
      }

      await db.delete('profiles', profileId);

      // If active profile was deleted, switch to first remaining profile
      if (profileId === activeId) {
        const remaining = await db.getAll('profiles');
        if (remaining.length > 0) {
          await db.setActiveProfileId(remaining[0].id);
        }
      }

      await loadAppState();
      hideArchiveProgressModal();
      await updateProfileHeaderUI();
      renderCurrentView();
      if (typeof showToastNotification === 'function') {
        showToastNotification(`🗑️ Deleted profile "${p.name}"`);
      }
    } else {
      alert('Profile name did not match. Deletion cancelled.');
    }
  }
}

/**
 * Calculate Estimated Export Duration Time
 */
async function updateEstimatedExportTimeUI() {
  const estEl = document.getElementById('exportTimeEstText');
  if (!estEl) return;

  const targetProfileId = activeSelectedExportProfileId || (await db.getActiveProfileId());
  const includeMedia = document.getElementById('includeMediaCheckbox')?.checked ?? true;

  if (!includeMedia) {
    estEl.textContent = '⚡ Est. Time: ~2 seconds (Data Only)';
    return;
  }

  const allMedia = await db.getAll('media');
  const targetMedia = allMedia.filter(m => !targetProfileId || m.profileId === targetProfileId);

  let totalBytes = 0;
  for (const m of targetMedia) {
    if (m.dataUrl) totalBytes += m.dataUrl.length;
  }

  const totalMb = Math.round(totalBytes * 0.75 / (1024 * 1024));
  let estSecs = Math.max(3, Math.ceil(totalMb / 4)); // ~4 MB per second estimated compression speed

  if (totalMb < 5) {
    estEl.textContent = `⚡ Est. Time: ~${estSecs} seconds (${targetMedia.length} files)`;
  } else {
    estEl.textContent = `⚡ Est. Time: ~${estSecs} seconds (~${totalMb} MB Media Included)`;
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

  const targetProfileId = activeSelectedExportProfileId || (await db.getActiveProfileId());
  const includeMedia = document.getElementById('includeMediaCheckbox')?.checked ?? true;

  showArchiveProgressModal('📦 Exporting Portable SLD Package...');

  try {
    const zip = new window.JSZip();
    updateArchiveProgress(10, 'Gathering database records...');

    const allMedia = await db.getAll('media');
    const allSubjects = await db.getAll('subjects');
    const allEvents = await db.getAll('events');
    const allSldEntries = await db.getAll('sld_entries');
    const allTags = await db.getAll('tags');

    const targetMedia = allMedia.filter(m => !targetProfileId || m.profileId === targetProfileId);
    const targetSubjects = allSubjects.filter(s => !targetProfileId || s.profileId === targetProfileId);
    const targetEvents = allEvents.filter(e => !targetProfileId || e.profileId === targetProfileId);
    const targetSldEntries = allSldEntries.filter(entry => !targetProfileId || entry.profileId === targetProfileId);

    updateArchiveProgress(25, 'Stripping device-specific crops & formatting metadata...');

    // Exclude device-specific media crop coordinates (viewTransform, crop, cropRect)
    const cleanMediaMetadata = targetMedia.map(m => {
      const copy = { ...m };
      delete copy.viewTransform;
      delete copy.crop;
      delete copy.cropRect;
      if (!includeMedia) delete copy.dataUrl; // Omit binary data if media un-checked
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
      includeMedia: includeMedia,
      targetProfileId: targetProfileId,
      counts: {
        media: cleanMediaMetadata.length,
        subjects: targetSubjects.length,
        events: targetEvents.length,
        sldEntries: targetSldEntries.length,
        tags: allTags.length
      }
    };

    const sldDatabase = {
      manifest,
      activeProfileId: targetProfileId,
      profiles: (await db.getAll('profiles')).filter(p => p.id === targetProfileId),
      subjects: targetSubjects,
      events: targetEvents,
      sldEntries: targetSldEntries,
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

    if (includeMedia) {
      const mediaFolder = zip.folder('media');
      const totalMedia = targetMedia.length;

      for (let i = 0; i < totalMedia; i++) {
        const m = targetMedia[i];
        updateArchiveProgress(30 + (i / Math.max(1, totalMedia)) * 50, m.filename || `Media ${i + 1}`);

        if (m.dataUrl && m.dataUrl.includes(',')) {
          const parts = m.dataUrl.split(',');
          if (parts.length > 1) {
            const safeName = (m.filename || `${m.id}.bin`).replace(/[/\\?%*:|"<>]/g, '_');
            mediaFolder.file(safeName, parts[1], { base64: true });
          }
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
 */
async function importAndMergeSldPackage(file) {
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

    const targetProfileId = activeSelectedExportProfileId || (await db.getActiveProfileId());

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
    const localSubjects = await db.getAll('subjects');
    const targetLocalSubjects = localSubjects.filter(s => s.profileId === targetProfileId);

    for (const incSub of (packageData.subjects || [])) {
      const existing = targetLocalSubjects.find(s => s.id === incSub.id || (s.name && incSub.name && s.name.toLowerCase() === incSub.name.toLowerCase()));
      if (!existing) {
        await db.put('subjects', { ...incSub, profileId: targetProfileId, updatedAt: incSub.updatedAt || new Date().toISOString() });
        report.addedSubjects++;
      } else {
        const incTime = new Date(incSub.updatedAt || 0).getTime();
        const locTime = new Date(existing.updatedAt || 0).getTime();
        if (incTime >= locTime) {
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
    const localEvents = await db.getAll('events');
    const targetLocalEvents = localEvents.filter(e => e.profileId === targetProfileId);

    for (const incEvt of (packageData.events || [])) {
      const existing = targetLocalEvents.find(e => e.id === incEvt.id || (e.eventCode === incEvt.eventCode && e.dateTag === incEvt.dateTag));
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
    const targetLocalSld = localSldEntries.filter(entry => entry.profileId === targetProfileId);

    for (const incEntry of (packageData.sldEntries || [])) {
      const existing = targetLocalSld.find(e => e.id === incEntry.id || (e.dateTag === incEntry.dateTag && e.actionCode === incEntry.actionCode));
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
    const localMedia = await db.getAll('media');
    const targetLocalMedia = localMedia.filter(m => m.profileId === targetProfileId);
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

      const existing = targetLocalMedia.find(m => (fileHash && m.hash === fileHash) || m.id === incMeta.id || (m.filename && incMeta.filename && m.filename === incMeta.filename));

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
        const unionSubjectTags = Array.from(new Set([...(existing.subjectTags || []), ...(incMeta.subjectTags || [])]));
        const unionNormalTags = Array.from(new Set([...(existing.normalTags || []), ...(incMeta.normalTags || [])]));
        const unionHeartTags = Array.from(new Set([...(existing.heartTags || []), ...(incMeta.heartTags || [])]));
        const unionEvents = Array.from(new Set([...(existing.blueBookEvents || []), ...(incMeta.blueBookEvents || [])]));

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
      const targetPName = packageData.profiles?.find(p => p.id === targetProfileId)?.name || 'Selected Profile';
      const summaryMsg = `
✅ Smart Delta Merge Complete into "${targetPName}"!
• Media: ${report.addedMedia} added, ${report.mergedMedia} merged
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

window.showArchiveProgressModal = showArchiveProgressModal;
window.updateArchiveProgress = updateArchiveProgress;
window.hideArchiveProgressModal = hideArchiveProgressModal;
window.updateProfileHeaderUI = updateProfileHeaderUI;
window.renderProfilePopoverList = renderProfilePopoverList;
window.switchActiveProfile = switchActiveProfile;
window.cloneProfile = cloneProfile;
window.renameProfile = renameProfile;
window.changeProfileAvatar = changeProfileAvatar;
window.deleteProfileStrict = deleteProfileStrict;
window.updateEstimatedExportTimeUI = updateEstimatedExportTimeUI;
window.exportPortableSldPackage = exportPortableSldPackage;
window.importAndMergeSldPackage = importAndMergeSldPackage;
