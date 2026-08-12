/**
 * Automatic 200x200 Square Thumbnail Crop Pipeline
 */

async function createCompressedThumbnail(fileType, dataUrl) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    const drawTopCenteredCrop = (source) => {
      const sw = source.naturalWidth || source.videoWidth || source.width || 200;
      const sh = source.naturalHeight || source.videoHeight || source.height || 200;
      const cropSize = Math.min(sw, sh);
      const sx = Math.max(0, Math.floor((sw - cropSize) / 2));
      const sy = 0; // Top-centered vertically

      ctx.drawImage(source, sx, sy, cropSize, cropSize, 0, 0, 200, 200);
    };

    if (fileType?.startsWith('video')) {
      const video = document.createElement('video');
      video.src = dataUrl;
      video.preload = 'metadata';
      video.currentTime = 0.5;
      video.onseeked = () => {
        try {
          drawTopCenteredCrop(video);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) {
          resolve(null);
        }
      };
      video.onerror = () => resolve(null);
    } else {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          drawTopCenteredCrop(img);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    }
  });
}

window.createCompressedThumbnail = createCompressedThumbnail;
