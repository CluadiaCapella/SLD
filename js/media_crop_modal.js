/**
 * Interactive Lightbox Media & Avatar Cropping Subsystem
 */

let cropperInstance = null;
let lightboxCropperInstance = null;

function closeAvatarCropper() {
  document.getElementById('cropperModal').classList.remove('active');
  if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
}

function openLightboxCropModal(media) {
  const modal = document.getElementById('lightboxCropModal');
  const cropImg = document.getElementById('cropModalImage');
  const ratioSelect = document.getElementById('cropModalRatioSelect');
  const seekerContainer = document.getElementById('cropModalVideoSeeker');
  const seekerSlider = document.getElementById('cropVideoSeekerSlider');
  const seekerVideo = document.getElementById('cropModalHiddenVideo');
  const timeLabel = document.getElementById('cropVideoTimeLabel');

  modal.classList.add('active');
  if (lightboxCropperInstance) { lightboxCropperInstance.destroy(); lightboxCropperInstance = null; }

  const isVideo = media.type?.startsWith('video');

  const initCropperInstance = (src) => {
    cropImg.src = src;
    cropImg.onload = () => {
      if (lightboxCropperInstance) lightboxCropperInstance.destroy();
      if (window.Cropper) {
        lightboxCropperInstance = new window.Cropper(cropImg, {
          aspectRatio: NaN,
          viewMode: 1,
          autoCropArea: 0.9,
          responsive: true,
          movable: true,
          resizable: true
        });
      }
    };
  };

  if (isVideo) {
    seekerContainer.style.display = 'block';
    seekerVideo.src = media.dataUrl;
    seekerVideo.onloadedmetadata = () => {
      seekerSlider.max = seekerVideo.duration;
      seekerSlider.value = 0.5;
      seekerVideo.currentTime = 0.5;
    };

    const captureFrame = () => {
      timeLabel.textContent = `${seekerVideo.currentTime.toFixed(1)}s`;
      const canvas = document.createElement('canvas');
      canvas.width = seekerVideo.videoWidth || 640;
      canvas.height = seekerVideo.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(seekerVideo, 0, 0, canvas.width, canvas.height);
      initCropperInstance(canvas.toDataURL('image/png'));
    };

    seekerVideo.onseeked = captureFrame;
    seekerSlider.oninput = () => { seekerVideo.currentTime = parseFloat(seekerSlider.value); };
    initCropperInstance(media.thumbnailUrl || media.dataUrl);
  } else {
    seekerContainer.style.display = 'none';
    initCropperInstance(media.dataUrl);
  }

  ratioSelect.onchange = () => {
    const val = ratioSelect.value;
    if (!lightboxCropperInstance) return;

    if (val === 'free') {
      lightboxCropperInstance.setAspectRatio(NaN);
    } else if (val === 'screen') {
      lightboxCropperInstance.setAspectRatio(window.innerWidth / window.innerHeight);
    } else if (val === '1:1') {
      lightboxCropperInstance.setAspectRatio(1);
    } else if (val === '4:3') {
      lightboxCropperInstance.setAspectRatio(4 / 3);
    } else if (val === '16:9') {
      lightboxCropperInstance.setAspectRatio(16 / 9);
    } else if (val === 'custom') {
      const input = prompt('Enter ratio (e.g. 9/20 or 1.5):', '9/20');
      if (input) {
        let num = parseFloat(input);
        if (input.includes('/')) {
          const p = input.split('/');
          num = parseFloat(p[0]) / parseFloat(p[1]);
        }
        if (!isNaN(num)) lightboxCropperInstance.setAspectRatio(num);
      }
    }
  };

  document.getElementById('confirmCropModalBtn').onclick = async () => {
    if (lightboxCropperInstance) {
      const canvas = lightboxCropperInstance.getCroppedCanvas();
      const croppedUrl = canvas.toDataURL('image/jpeg', 0.95);
      media.viewTransform = media.viewTransform || {};
      media.viewTransform.croppedViewUrl = croppedUrl;
      await db.put('media', media);
    }
    closeLightboxCropModal();
    renderLightboxContent();
    renderCurrentView();
  };

  document.getElementById('cropModalClearBtn').onclick = async () => {
    if (media.viewTransform) {
      media.viewTransform.croppedViewUrl = null;
      await db.put('media', media);
    }
    closeLightboxCropModal();
    renderLightboxContent();
    renderCurrentView();
  };

  document.getElementById('closeCropModalBtn').onclick = closeLightboxCropModal;
  document.getElementById('cancelCropModalBtn').onclick = closeLightboxCropModal;
}

function closeLightboxCropModal() {
  document.getElementById('lightboxCropModal').classList.remove('active');
  if (lightboxCropperInstance) { lightboxCropperInstance.destroy(); lightboxCropperInstance = null; }
}

window.closeAvatarCropper = closeAvatarCropper;
window.openLightboxCropModal = openLightboxCropModal;
window.closeLightboxCropModal = closeLightboxCropModal;
