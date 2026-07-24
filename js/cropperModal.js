/**
 * Interactive Subject Avatar Cropper Modal Handler (using Cropper.js)
 */

let cropperInstance = null;
let currentSubjectId = null;
let onCropSaveCallback = null;

export function openAvatarCropper(imageSrcUrl, subjectId, onSave) {
  currentSubjectId = subjectId;
  onCropSaveCallback = onSave;

  const modal = document.getElementById('cropperModal');
  const cropImageEl = document.getElementById('cropperImage');

  cropImageEl.src = imageSrcUrl;
  modal.classList.add('active');

  // Destroy previous cropper if exists
  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }

  // Initialize Cropper.js once image is loaded
  cropImageEl.onload = () => {
    cropperInstance = new window.Cropper(cropImageEl, {
      aspectRatio: 1, // 1:1 Square avatar
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.8,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });
  };
}

export function closeAvatarCropper() {
  const modal = document.getElementById('cropperModal');
  modal.classList.remove('active');

  if (cropperInstance) {
    cropperInstance.destroy();
    cropperInstance = null;
  }
}

export function getCroppedAvatarResult() {
  if (!cropperInstance) return null;
  const canvas = cropperInstance.getCroppedCanvas({
    width: 256,
    height: 256,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
  });
  return canvas.toDataURL('image/png');
}

export function setupCropperEventListeners() {
  const saveBtn = document.getElementById('saveCropBtn');
  const cancelBtn = document.getElementById('cancelCropBtn');
  const closeBtn = document.getElementById('closeCropperModalBtn');

  if (saveBtn) {
    saveBtn.onclick = () => {
      const croppedDataUrl = getCroppedAvatarResult();
      if (croppedDataUrl && onCropSaveCallback) {
        onCropSaveCallback(croppedDataUrl, currentSubjectId);
      }
      closeAvatarCropper();
    };
  }

  if (cancelBtn) cancelBtn.onclick = closeAvatarCropper;
  if (closeBtn) closeBtn.onclick = closeAvatarCropper;
}
