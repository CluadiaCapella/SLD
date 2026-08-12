/**
 * Single & Batch Media Downloader Subsystem
 */

async function downloadSingleMediaFile(mediaId) {
  const m = currentMediaList.find(item => item.id === mediaId) || await db.get('media', mediaId);
  if (!m || !m.dataUrl) {
    alert('Original media content not available for download.');
    return;
  }

  try {
    const a = document.createElement('a');
    a.href = m.dataUrl;
    a.download = m.filename || `media_${mediaId}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('Download error:', err);
    alert('Failed to download media file.');
  }
}

async function exportSelectedMediaFiles() {
  if (selectedMediaIds.size === 0) {
    alert('No media files selected for export.');
    return;
  }

  const selectedList = currentMediaList.filter(m => selectedMediaIds.has(m.id));
  if (selectedList.length === 1) {
    downloadSingleMediaFile(selectedList[0].id);
    return;
  }

  for (let i = 0; i < selectedList.length; i++) {
    const m = selectedList[i];
    downloadSingleMediaFile(m.id);
    await new Promise(r => setTimeout(r, 250));
  }
}

window.downloadSingleMediaFile = downloadSingleMediaFile;
window.exportSelectedMediaFiles = exportSelectedMediaFiles;
