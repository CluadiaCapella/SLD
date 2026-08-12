/**
 * Section 13: Lightbox Media Viewer Subsystem (Preserves Non-Destructive Video/Image Crop Transforms)
 */

let lightboxSourceContext = null;

async function openLightboxById(mediaId, skipPushState = false, sourceContext = null) {
  lightboxSourceContext = sourceContext;
  let idx = currentMediaList.findIndex(m => m.id === mediaId);
  if (idx < 0 && mediaId) {
    try {
      const item = await db.get('media', mediaId);
      if (item) {
        currentMediaList.push(item);
        idx = currentMediaList.length - 1;
      }
    } catch (err) {
      console.warn('Error fetching lightbox media by ID:', err);
    }
  }
  if (idx >= 0) openLightbox(idx, skipPushState);
}

function openLightbox(index, skipPushState = false) {
  if (index < 0 || index >= currentMediaList.length) return;
  lightboxIndex = index;
  const modal = document.getElementById('lightboxModal');
  if (!modal) return;

  modal.style.display = 'flex';
  modal.classList.add('active');

  const selectionBanner = document.getElementById('selectionBanner');
  if (selectionBanner) selectionBanner.style.display = 'none';

  const heartOverlay = document.getElementById('floatingHeartOverlay');
  if (sldDefaultFullscreen) {
    modal.classList.add('fullscreen-mode');
    if (heartOverlay) heartOverlay.style.display = 'flex';
  } else {
    modal.classList.remove('fullscreen-mode');
    if (heartOverlay) heartOverlay.style.display = 'none';
  }

  renderLightboxContent();

  if (!skipPushState) {
    try {
      const stateData = {
        viewId: currentActiveView,
        activeDetailSubjectId,
        activeDetailComboKey,
        activeDetailSldDateTag,
        activeDetailEventId,
        activeDetailTagName,
        lightboxIndex: index,
        isLightbox: true
      };
      if (window.location.protocol === 'file:') {
        window.history.pushState(stateData, '');
      } else {
        window.history.pushState(stateData, '', '#lightbox');
      }
    } catch (e) {}
  }
}

function closeLightbox(isPopState = false) {
  const modal = document.getElementById('lightboxModal');
  const isAlreadyOpen = modal && (modal.classList.contains('active') || modal.style.display === 'flex');

  const container = document.getElementById('lightboxMediaContainer');
  if (container) {
    const vids = container.querySelectorAll('video');
    vids.forEach(v => {
      try {
        v.pause();
        v.removeAttribute('src');
        v.load();
      } catch (e) {}
    });
    container.innerHTML = '';
  }

  if (modal) {
    modal.classList.remove('active', 'fullscreen-mode');
    modal.style.display = 'none';
  }
  const heartOverlay = document.getElementById('floatingHeartOverlay');
  if (heartOverlay) heartOverlay.style.display = 'none';
  lightboxIndex = -1;

  if (isAlreadyOpen && !isPopState) {
    if (window.history.state && window.history.state.isLightbox) {
      try {
        const stateData = {
          viewId: currentActiveView || 'mediaBrowserView',
          activeDetailSubjectId,
          activeDetailComboKey,
          activeDetailSldDateTag,
          activeDetailEventId,
          activeDetailTagName,
          isLightbox: false
        };
        if (window.location.protocol === 'file:') {
          window.history.replaceState(stateData, '');
        } else {
          window.history.replaceState(stateData, '', '#' + (currentActiveView || 'mediaBrowserView'));
        }
      } catch (e) {}
    }
  }
}

function renderLightboxContent() {
  if (lightboxIndex < 0 || lightboxIndex >= currentMediaList.length) return;
  const media = currentMediaList[lightboxIndex];
  media.viewTransform = media.viewTransform || { rotate: 0, clipStart: 0, clipEnd: null };

  const container = document.getElementById('lightboxMediaContainer');
  document.getElementById('lightboxTitle').textContent = media.filename;
  document.getElementById('lightboxCounter').textContent = `${lightboxIndex + 1} of ${currentMediaList.length}`;

  const isVideo = media.type?.startsWith('video');
  const croppedUrl = media.viewTransform?.croppedViewUrl;

  const resetCropBtn = document.getElementById('lbResetCropBtn');
  if (resetCropBtn) resetCropBtn.style.display = croppedUrl ? 'inline-flex' : 'none';

  if (isVideo) {
    const posterAttr = croppedUrl ? `poster="${croppedUrl}"` : '';
    container.innerHTML = `<video id="lbMediaVideo" src="${media.dataUrl}" ${posterAttr} autoplay muted loop playsinline webkit-playsinline moz-playsinline style="max-height:75vh; max-width:100%; object-fit:contain; pointer-events:none;"></video>`;
    const lbVid = document.getElementById('lbMediaVideo');
    if (lbVid) lbVid.muted = true;
  } else if (croppedUrl) {
    container.innerHTML = `<img id="lbMediaImg" src="${croppedUrl}" alt="${media.filename}" style="max-height:75vh; max-width:100%; object-fit:contain;">`;
  } else {
    container.innerHTML = `<img id="lbMediaImg" src="${media.dataUrl}" alt="${media.filename}" style="max-height:75vh; max-width:100%; object-fit:contain;">`;
  }

  applyNonDestructiveTransform(media);

  if (typeof renderLightboxSubjects === 'function') renderLightboxSubjects(media);
  if (typeof renderLightboxBlueEvents === 'function') renderLightboxBlueEvents(media);
  if (typeof renderLightboxEvents === 'function') renderLightboxEvents(media);
  if (typeof renderLightboxNormalTags === 'function') renderLightboxNormalTags(media);
  if (typeof renderLightboxRatings === 'function') renderLightboxRatings(media);
  if (typeof updateFloatingHeartOverlayUI === 'function') updateFloatingHeartOverlayUI(media);

  const toggleClipperBtn = document.getElementById('lbToggleVideoClipperBtn');
  const clipperPanel = document.getElementById('videoClipperPanel');
  if (isVideo) {
    if (toggleClipperBtn) toggleClipperBtn.style.display = 'inline-flex';
    if (typeof setupVideoClipperSliders === 'function') setupVideoClipperSliders(media);
  } else {
    if (toggleClipperBtn) toggleClipperBtn.style.display = 'none';
    if (clipperPanel) clipperPanel.style.display = 'none';
  }

  const setAvatarBtn = document.getElementById('lbSetAvatarBtn');
  if (setAvatarBtn) {
    if (lightboxSourceContext && lightboxSourceContext.name) {
      setAvatarBtn.style.display = 'inline-flex';
      setAvatarBtn.textContent = `👤 Use as ${lightboxSourceContext.name}'s Avatar`;
      setAvatarBtn.onclick = () => {
        openMediaCropperModal({
          imageSrcUrl: media.viewTransform?.croppedViewUrl || media.dataUrl,
          isVideo: isVideo,
          videoSrcUrl: isVideo ? media.dataUrl : null,
          modalTitle: `Crop ${lightboxSourceContext.name}'s Avatar`,
          onSave: async (croppedUrl) => {
            if (lightboxSourceContext.type === 'subject') {
              const sub = currentSubjectsList.find(s => s.id === lightboxSourceContext.id);
              if (sub) {
                sub.avatarUrl = croppedUrl;
                await db.put('subjects', sub);
              }
            } else if (lightboxSourceContext.type === 'combo') {
              const comboKey = lightboxSourceContext.key;
              const stats = processAllStats(currentMediaList, currentSubjectsList, currentEventsList, currentWeights);
              const combo = (stats?.allCombinations || []).find(c => (c.comboKey === comboKey || (c.subjectIds || [c.subjectId1, c.subjectId2]).join('::') === comboKey));
              if (combo) {
                combo.avatarUrl = croppedUrl;
                await db.put('combinations', combo);
              }
            }
            await loadAppState();
            renderCurrentView();
          }
        });
      };
    } else {
      setAvatarBtn.style.display = 'none';
    }
  }

  const lbAiBtn = document.getElementById('lbAiToggleBtn');
  if (lbAiBtn) {
    const isAi = media.isAiGenerated || (media.normalTags || []).includes('AI');
    if (isAi) {
      lbAiBtn.style.background = 'linear-gradient(135deg, #a855f7, #6366f1)';
      lbAiBtn.style.color = '#ffffff';
      lbAiBtn.style.fontWeight = '800';
      lbAiBtn.style.opacity = '1';
      lbAiBtn.style.filter = 'grayscale(0)';
      lbAiBtn.style.borderColor = '#a855f7';
    } else {
      lbAiBtn.style.background = 'var(--bg-secondary)';
      lbAiBtn.style.color = 'var(--text-muted)';
      lbAiBtn.style.fontWeight = '600';
      lbAiBtn.style.opacity = '0.5';
      lbAiBtn.style.filter = 'grayscale(1)';
      lbAiBtn.style.borderColor = 'var(--border-color)';
    }

    lbAiBtn.onclick = async () => {
      const newAiState = !(media.isAiGenerated || (media.normalTags || []).includes('AI'));
      media.isAiGenerated = newAiState;
      if (!media.normalTags) media.normalTags = [];
      if (newAiState) {
        if (!media.normalTags.includes('AI')) media.normalTags.push('AI');
      } else {
        media.normalTags = media.normalTags.filter(t => t !== 'AI');
      }
      await db.put('media', media);
      renderLightboxContent();
      renderCurrentView();
    };
  }

  document.getElementById('lbOpenCropModalBtn').onclick = () => openLightboxCropModal(media);
  if (resetCropBtn) {
    resetCropBtn.onclick = async () => {
      media.viewTransform.croppedViewUrl = null;
      await db.put('media', media);
      renderLightboxContent();
      renderCurrentView();
    };
  }

  const editThumbBtn = document.getElementById('lbEditThumbnailBtn');
  if (editThumbBtn) {
    editThumbBtn.onclick = () => {
      openMediaCropperModal({
        imageSrcUrl: media.customThumbnail || media.thumbnailUrl || media.dataUrl,
        isVideo: isVideo,
        videoSrcUrl: media.dataUrl,
        modalTitle: `Edit Thumbnail: ${media.filename}`,
        onSave: async (croppedDataUrl) => {
          media.customThumbnail = croppedDataUrl;
          await db.put('media', media);
          await loadAppState();
          renderCurrentView();
        }
      });
    };
  }
}

function applyNonDestructiveTransform(media) {
  const el = document.getElementById('lbMediaImg') || document.getElementById('lbMediaVideo') || document.querySelector('#lightboxMediaContainer img') || document.querySelector('#lightboxMediaContainer video');
  if (!el) return;
  const rot = (media.viewTransform?.rotate || 0);
  el.style.transition = 'transform 0.25s ease';
  el.style.transformOrigin = 'center center';
  el.style.transform = `rotate(${rot}deg)`;
}

window.lightboxSourceContext = lightboxSourceContext;
window.openLightboxById = openLightboxById;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.renderLightboxContent = renderLightboxContent;
window.applyNonDestructiveTransform = applyNonDestructiveTransform;
