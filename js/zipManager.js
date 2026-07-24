/**
 * 7z / ZIP Export & Import Package Engine (using JSZip)
 */

export async function exportFullProfilePackage(profile, mediaList = [], subjectsList = [], eventsList = []) {
  const zip = new window.JSZip();

  // 1. Construct JSON Metadata
  const metadata = {
    appVersion: '1.0',
    exportDate: new Date().toISOString(),
    profile: {
      id: profile.id,
      name: profile.name,
      createdAt: profile.createdAt
    },
    subjects: subjectsList,
    events: eventsList,
    mediaMetadata: mediaList.map(m => ({
      id: m.id,
      filename: m.filename,
      type: m.type,
      dateTag: m.dateTag,
      heartTags: m.heartTags,
      subjectTags: m.subjectTags,
      normalTags: m.normalTags,
      eventId: m.eventId
    }))
  };

  zip.file('data.json', JSON.stringify(metadata, null, 2));

  // 2. Add Media Binaries to media/ folder
  const mediaFolder = zip.folder('media');
  for (const m of mediaList) {
    if (m.dataUrl) {
      // Extract base64 data
      const base64Data = m.dataUrl.split(',')[1];
      if (base64Data) {
        mediaFolder.file(m.filename || `${m.id}.bin`, base64Data, { base64: true });
      }
    }
  }

  // 3. Generate Zip Blob & Download
  const content = await zip.generateAsync({ type: 'blob' });
  const filename = `${profile.name.replace(/[^a-z0-9]/gi, '_')}_export_${Date.now()}.7z`;
  downloadBlob(content, filename);
}

export async function exportDataOnlyJSON(profile, subjectsList = [], eventsList = [], mediaList = []) {
  const data = {
    appVersion: '1.0',
    exportDate: new Date().toISOString(),
    profile,
    subjects: subjectsList,
    events: eventsList,
    media: mediaList
  };
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  downloadBlob(blob, `${profile.name.replace(/[^a-z0-9]/gi, '_')}_data_${Date.now()}.json`);
}

export async function importPackageZip(file, dbInstance, mode = 'new') {
  const zip = await window.JSZip.loadAsync(file);

  // Read data.json
  const dataJsonFile = zip.file('data.json');
  if (!dataJsonFile) {
    throw new Error('Invalid archive format: data.json not found in root.');
  }

  const jsonText = await dataJsonFile.async('text');
  const parsedData = JSON.parse(jsonText);

  // Target Profile ID
  let targetProfileId;
  if (mode === 'new') {
    targetProfileId = 'profile-' + Date.now();
    const newProfile = {
      id: targetProfileId,
      name: (parsedData.profile?.name || 'Imported Profile') + ' (' + new Date().toLocaleDateString() + ')',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dbInstance.put('profiles', newProfile);
  } else {
    targetProfileId = await dbInstance.getActiveProfileId();
  }

  // Import Subjects
  if (parsedData.subjects) {
    for (const sub of parsedData.subjects) {
      await dbInstance.put('subjects', { ...sub, profileId: targetProfileId });
    }
  }

  // Import Events
  if (parsedData.events) {
    for (const evt of parsedData.events) {
      await dbInstance.put('events', { ...evt, profileId: targetProfileId });
    }
  }

  // Import Media Files & Binaries
  if (parsedData.mediaMetadata) {
    const mediaFolder = zip.folder('media');
    for (const meta of parsedData.mediaMetadata) {
      let dataUrl = meta.dataUrl;

      // Extract binary if stored in media folder
      const mediaFile = mediaFolder ? mediaFolder.file(meta.filename || `${meta.id}.bin`) : null;
      if (mediaFile) {
        const base64 = await mediaFile.async('base64');
        const mimeType = meta.type?.startsWith('video') ? 'video/mp4' : 'image/jpeg';
        dataUrl = `data:${mimeType};base64,${base64}`;
      }

      await dbInstance.put('media', {
        ...meta,
        dataUrl,
        profileId: targetProfileId
      });
    }
  }

  if (mode === 'new') {
    await dbInstance.setActiveProfileId(targetProfileId);
  }

  return targetProfileId;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
