/**
 * Section 14: Lightbox Downloads, Rotations & Video Clipper Suite
 */

async function downloadOriginalMedia(media) {
  if (!media) return;
  try {
    let fileData = media.fileData || media.dataUrl;
    if (!fileData) {
      fileData = await db.getMediaBlob(media.id);
    }
    if (!fileData) {
      showToastNotification("⚠️ Cannot download: File data unavailable");
      return;
    }

    let url;
    if (typeof fileData === 'string') {
      url = fileData;
    } else if (fileData instanceof Blob) {
      url = URL.createObjectURL(fileData);
    } else {
      const blob = new Blob([fileData], { type: media.mimeType || 'image/png' });
      url = URL.createObjectURL(blob);
    }

    const a = document.createElement('a');
    a.href = url;
    a.download = media.fileName || media.filename || `SLD_original_${media.id}.png`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); }, 100);
    showToastNotification("📥 Original file downloaded!");
  } catch (err) {
    console.error('Download original failed:', err);
    showToastNotification("⚠️ Download failed");
  }
}

async function downloadCurrentMedia(media) {
  if (!media) return;
  try {
    const imgEl = document.getElementById('lbMediaImg') || document.querySelector('#lightboxMediaContainer img');
    if (!imgEl || !imgEl.src) {
      return downloadOriginalMedia(media);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imgEl.src;
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const rot = (media.viewTransform?.rotate || 0) % 360;

    if (Math.abs(rot) === 90 || Math.abs(rot) === 270) {
      canvas.width = img.height;
      canvas.height = img.width;
    } else {
      canvas.width = img.width;
      canvas.height = img.height;
    }

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);

    canvas.toBlob((blob) => {
      if (!blob) {
        showToastNotification("⚠️ Download failed");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SLD_edited_${media.fileName || media.filename || media.id + '.png'}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); }, 100);
      showToastNotification("💾 Edited file downloaded!");
    }, media.mimeType || 'image/png');
  } catch (err) {
    console.error('Download current failed:', err);
    downloadOriginalMedia(media);
  }
}

function setupLightboxEditingSuite() {
  document.getElementById('lbRotateLeftBtn')?.addEventListener('click', async () => {
    if (lightboxIndex >= 0 && lightboxIndex < currentMediaList.length) {
      const media = currentMediaList[lightboxIndex];
      media.viewTransform = media.viewTransform || { rotate: 0 };
      media.viewTransform.rotate = (media.viewTransform.rotate - 90) % 360;
      if (!media.customThumbnail && typeof createCompressedThumbnailWithRotation === 'function') {
        const newThumb = await createCompressedThumbnailWithRotation(media.fileType || media.type, media.dataUrl, media.viewTransform.rotate);
        if (newThumb) media.thumbnailUrl = newThumb;
      }
      await db.put('media', media);
      applyNonDestructiveTransform(media);
    }
  });

  document.getElementById('lbRotateRightBtn')?.addEventListener('click', async () => {
    if (lightboxIndex >= 0 && lightboxIndex < currentMediaList.length) {
      const media = currentMediaList[lightboxIndex];
      media.viewTransform = media.viewTransform || { rotate: 0 };
      media.viewTransform.rotate = (media.viewTransform.rotate + 90) % 360;
      if (!media.customThumbnail && typeof createCompressedThumbnailWithRotation === 'function') {
        const newThumb = await createCompressedThumbnailWithRotation(media.fileType || media.type, media.dataUrl, media.viewTransform.rotate);
        if (newThumb) media.thumbnailUrl = newThumb;
      }
      await db.put('media', media);
      applyNonDestructiveTransform(media);
    }
  });

  document.getElementById('lbDownloadOriginalBtn')?.addEventListener('click', async () => {
    if (lightboxIndex >= 0 && lightboxIndex < currentMediaList.length) {
      const media = currentMediaList[lightboxIndex];
      await downloadOriginalMedia(media);
    }
  });

  document.getElementById('lbDownloadCurrentBtn')?.addEventListener('click', async () => {
    if (lightboxIndex >= 0 && lightboxIndex < currentMediaList.length) {
      const media = currentMediaList[lightboxIndex];
      await downloadCurrentMedia(media);
    }
  });

  document.getElementById('lbToggleVideoClipperBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('videoClipperPanel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
  });
}

function setupVideoClipperSliders(media) {
  const video = document.getElementById('lbMediaVideo');
  const startSlider = document.getElementById('clipStartSlider');
  const endSlider = document.getElementById('clipEndSlider');

  if (!video || !startSlider || !endSlider) return;

  video.onloadedmetadata = () => {
    startSlider.max = video.duration;
    endSlider.max = video.duration;

    startSlider.value = media.viewTransform?.clipStart || 0;
    endSlider.value = media.viewTransform?.clipEnd || video.duration;
  };

  startSlider.oninput = async () => {
    media.viewTransform = media.viewTransform || {};
    media.viewTransform.clipStart = parseFloat(startSlider.value);
    await db.put('media', media);
  };

  endSlider.oninput = async () => {
    media.viewTransform = media.viewTransform || {};
    media.viewTransform.clipEnd = parseFloat(endSlider.value);
    await db.put('media', media);
  };
}

window.downloadOriginalMedia = downloadOriginalMedia;
window.downloadCurrentMedia = downloadCurrentMedia;
window.setupLightboxEditingSuite = setupLightboxEditingSuite;
window.setupVideoClipperSliders = setupVideoClipperSliders;
