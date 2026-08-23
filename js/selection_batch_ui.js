/**
 * Selection Banner & Batch Operations UI Subsystem
 */

function updateUndoRedoButtonsUI() {
  const undoBtn = document.getElementById('selectionUndoBtn');
  const redoBtn = document.getElementById('selectionRedoBtn');
  if (undoBtn) undoBtn.disabled = selectionUndoStack.length === 0;
  if (redoBtn) redoBtn.disabled = selectionRedoStack.length === 0;
}

function showToastNotification(msg) {
  let toast = document.getElementById('sldToastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sldToastNotification';
    toast.style.cssText = 'position:fixed; top:20px; right:20px; z-index:999999; background:rgba(15,23,42,0.95); color:#fff; border:1px solid var(--accent-pink); padding:10px 16px; border-radius:8px; font-weight:700; font-size:0.85rem; box-shadow:0 4px 20px rgba(0,0,0,0.5); opacity:0; transition:opacity 0.3s ease; pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

function updateSelectionStateUI() {
  const selectionBanner = document.getElementById('selectionBanner');
  const selectedCountEl = document.getElementById('selectedCount');
  const lbModal = document.getElementById('lightboxModal');
  const isLbActive = lbModal && (lbModal.classList.contains('active') || lbModal.style.display === 'flex');
  const isMediaBrowserActive = !currentActiveView || currentActiveView === 'mediaBrowserView';

  if (selectedMediaIds.size > 0 && !isLbActive && isMediaBrowserActive) {
    if (selectionBanner) {
      selectionBanner.style.display = 'flex';
      selectionBanner.className = 'selection-banner-sticky';
    }
    if (selectedCountEl) selectedCountEl.textContent = `${selectedMediaIds.size} file(s) selected`;
    renderSelectionInlineTags();
  } else {
    if (selectionBanner) selectionBanner.style.display = 'none';
  }

  if (isMediaBrowserActive) {
    document.querySelectorAll('.media-card').forEach(card => {
      const id = card.getAttribute('data-id');
      if (id && selectedMediaIds.has(id)) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });
  }
  updateUndoRedoButtonsUI();
}

function setupInlineSelectionTagInputs() {
  const subInput = document.getElementById('inlineSubjectInput');
  const normalInput = document.getElementById('inlineNormalTagInput');
  const sldInput = document.getElementById('inlineSldInput');
  const alikeInput = document.getElementById('inlineAlikeInput');

  document.getElementById('selectionUndoBtn')?.addEventListener('click', performSelectionUndo);
  document.getElementById('selectionRedoBtn')?.addEventListener('click', performSelectionRedo);

  if (subInput && !subInput.dataset.bound) {
    subInput.dataset.bound = 'true';
    subInput.onkeydown = async (e) => {
      if (e.key === 'Enter' && subInput.value.trim() && selectedMediaIds.size > 0) {
        const nameVal = subInput.value.trim();
        let sub = currentSubjectsList.find(s => s.name.toLowerCase() === nameVal.toLowerCase());
        if (!sub) {
          const pId = await db.getActiveProfileId();
          sub = { id: 'sub-' + Date.now(), profileId: pId, name: nameVal, groupId: 'green', avatarUrl: null };
          await db.put('subjects', sub);
        }
        await applyTagToAllSelected('subject', sub.id, `Subject (${getSubjectDisplayName(sub)})`);
        subInput.value = '';
      }
    };
  }

  if (normalInput && !normalInput.dataset.bound) {
    normalInput.dataset.bound = 'true';
    normalInput.onkeydown = async (e) => {
      if (e.key === 'Enter' && normalInput.value.trim() && selectedMediaIds.size > 0) {
        const tagVal = normalInput.value.trim();
        await applyTagToAllSelected('normal', tagVal, `Tag (${tagVal})`);
        normalInput.value = '';
      }
    };
  }

  if (sldInput && !sldInput.dataset.bound) {
    sldInput.dataset.bound = 'true';
    sldInput.onkeydown = async (e) => {
      if (e.key === 'Enter' && sldInput.value.trim() && selectedMediaIds.size > 0) {
        const dateTagVal = sldInput.value.trim();
        await applyTagToAllSelected('sld', dateTagVal, `SLD (${dateTagVal})`);
        sldInput.value = '';
      }
    };
  }

  if (alikeInput && !alikeInput.dataset.bound) {
    alikeInput.dataset.bound = 'true';
    alikeInput.onkeydown = async (e) => {
      if (e.key === 'Enter' && alikeInput.value.trim() && selectedMediaIds.size > 0) {
        const raw = alikeInput.value.trim();
        const parts = raw.split('::');
        const namePart = parts[0].trim();
        const strPart = (parts[1] || 'faint').trim().toLowerCase();
        const strength = ['faint', 'medium', 'strong'].includes(strPart) ? strPart : 'faint';

        let sub = currentSubjectsList.find(s => s.name.toLowerCase() === namePart.toLowerCase());
        if (!sub) {
          const pId = await db.getActiveProfileId();
          sub = { id: 'sub-' + Date.now(), profileId: pId, name: namePart, groupId: 'green', avatarUrl: null };
          await db.put('subjects', sub);
        }

        const valKey = `${sub.id}::${strength}`;
        await applyTagToAllSelected('alike', valKey, `Alike (${getSubjectDisplayName(sub)} ${strength})`);
        alikeInput.value = '';
      }
    };
  }
}

function setupLightboxEditingSuite() {
  document.getElementById('closeLightboxBtn')?.addEventListener('click', () => closeLightbox());

  document.getElementById('lbPrevBtn')?.addEventListener('click', () => {
    if (typeof lightboxIndex === 'number' && lightboxIndex > 0) openLightbox(lightboxIndex - 1);
  });

  document.getElementById('lbNextBtn')?.addEventListener('click', () => {
    if (typeof lightboxIndex === 'number' && lightboxIndex < currentMediaList.length - 1) openLightbox(lightboxIndex + 1);
  });

  document.getElementById('lbRotateBtn')?.addEventListener('click', async () => {
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

window.updateUndoRedoButtonsUI = updateUndoRedoButtonsUI;
window.showToastNotification = showToastNotification;
window.updateSelectionStateUI = updateSelectionStateUI;
window.setupInlineSelectionTagInputs = setupInlineSelectionTagInputs;
window.setupLightboxEditingSuite = setupLightboxEditingSuite;
