/**
 * Section 9: Main App Initialization, Keyboard/Touch Navigation & Global Event Binding
 */

function setupEventListeners() {
  window.addEventListener('hashchange', () => {
    const hView = window.location.hash ? window.location.hash.replace(/^#/, '').trim() : '';
    if (hView && hView !== currentActiveView) {
      restoreAppStateFromHashOrStorage();
    }
  });

  document.getElementById('headerBrandLogo')?.addEventListener('click', () => {
    triggerSplashScreen(() => {
      switchView('mediaBrowserView');
    });
  });

  document.addEventListener('click', (e) => {
    if (selectedMediaIds.size > 0) {
      const isMediaCard = Boolean(e.target.closest('.media-card'));
      const isSelectionBanner = Boolean(e.target.closest('#selectionBanner'));
      const isMultiSelectModal = Boolean(e.target.closest('#multiSelectTagsModal'));
      const isAutocompleteDropdown = Boolean(e.target.closest('.subject-autocomplete-dropdown, .tag-autocomplete-dropdown, .date-autocomplete-dropdown, .autocomplete-dropdown'));

      if (!isMediaCard && !isSelectionBanner && !isMultiSelectModal && !isAutocompleteDropdown) {
        selectedMediaIds.clear();
        updateSelectionStateUI();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    const lbModal = document.getElementById('lightboxModal');
    const isLbActive = lbModal && lbModal.classList.contains('active');

    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isInputFocused = activeTag === 'input' || activeTag === 'textarea';

    if (e.key === 'Escape') {
      if (isLbActive) {
        closeLightbox();
      } else if (selectedMediaIds.size > 0) {
        selectedMediaIds.clear();
        updateSelectionStateUI();
      }
    } else if (isLbActive && !isInputFocused) {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        const lbVid = document.getElementById('lbMediaVideo');
        if (lbVid) {
          if (lbVid.paused) {
            lbVid.play().catch(() => {});
          } else {
            lbVid.pause();
          }
        }
      } else if (e.key === 'ArrowLeft') {
        if (lightboxIndex > 0) openLightbox(lightboxIndex - 1);
      } else if (e.key === 'ArrowRight') {
        if (lightboxIndex < currentMediaList.length - 1) openLightbox(lightboxIndex + 1);
      }
    }
  });

  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  const handleTouchStart = (e) => {
    if (e.touches && e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }
  };

  const handleTouchEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length !== 1) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX;
    const deltaY = e.changedTouches[0].clientY - touchStartY;
    const elapsedTime = Date.now() - touchStartTime;

    if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > Math.abs(deltaY) && elapsedTime < 800) {
      if (deltaX < 0 && lightboxIndex < currentMediaList.length - 1) {
        openLightbox(lightboxIndex + 1);
      } else if (deltaX > 0 && lightboxIndex > 0) {
        openLightbox(lightboxIndex - 1);
      }
    } else if (deltaY > 90 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5 && elapsedTime < 800) {
      closeLightbox();
    }
  };

  const lbModalEl = document.getElementById('lightboxModal');
  const lbWrapperEl = document.getElementById('lightboxContentWrapper');

  if (lbModalEl) {
    lbModalEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    lbModalEl.addEventListener('touchend', handleTouchEnd, { passive: true });
  }
  if (lbWrapperEl) {
    lbWrapperEl.addEventListener('touchstart', handleTouchStart, { passive: true });
    lbWrapperEl.addEventListener('touchend', handleTouchEnd, { passive: true });
  }

  const searchInput = document.getElementById('mediaSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentMediaPage = 1;
      if (currentActiveView === 'mediaBrowserView') renderMediaBrowser();
    });
  }

  document.getElementById('toggleMediaRatingsBtn')?.addEventListener('click', () => {
    isMediaRatingsEnabled = !isMediaRatingsEnabled;
    const btn = document.getElementById('toggleMediaRatingsBtn');
    if (btn) {
      btn.textContent = '⭐';
      btn.setAttribute('title', `⭐ Star Ratings: ${isMediaRatingsEnabled ? 'ON' : 'OFF'}`);
      btn.classList.toggle('active-sort', isMediaRatingsEnabled);
    }
    renderMediaBrowser();
  });

  document.getElementById('toggleMediaGroupBtn')?.addEventListener('click', () => {
    isMediaGroupingEnabled = !isMediaGroupingEnabled;
    const btn = document.getElementById('toggleMediaGroupBtn');
    if (btn) {
      btn.textContent = '📁';
      btn.setAttribute('title', `📁 Subject Grouping: ${isMediaGroupingEnabled ? 'ON' : 'OFF'}`);
      btn.classList.toggle('active-sort', isMediaGroupingEnabled);
    }
    renderMediaBrowser();
  });

  document.getElementById('mediaFilterTagSelect')?.addEventListener('change', () => {
    currentMediaPage = 1;
    if (currentActiveView === 'mediaBrowserView') renderMediaBrowser();
  });

  document.querySelectorAll('#mediaSortButtonsToolbar .sort-toggle-btn').forEach(btn => {
    btn.onclick = () => {
      const key = btn.getAttribute('data-key');
      handleSortButtonClick(key);
    };
  });

  updateSortButtonsUI();
  renderHeaderGroupFilters();

  setupSmartDateAutocomplete('panelSldInput', 'panelSldAutocomplete');
  setupSmartDateAutocomplete('panelEventInput', 'panelEventAutocomplete');
  setupSmartDateAutocomplete('inlineEventDateInput', 'inlineEventDateAutocomplete');
  setupSmartDateAutocomplete('lbSldInput', 'lbSldAutocomplete');

  setupSmartSubjectAutocomplete('panelSubjectInput', 'panelSubjectAutocomplete', (subId) => {
    applyTagToSelectedMedia('subject', subId);
  });

  setupSmartSubjectAutocomplete('lbSubjectInput', 'lbSubjectAutocomplete', async (subId) => {
    if (lightboxIndex >= 0 && lightboxIndex < currentMediaList.length) {
      const media = currentMediaList[lightboxIndex];
      media.subjectTags = media.subjectTags || [];
      if (!media.subjectTags.includes(subId)) {
        media.subjectTags.push(subId);
        await db.put('media', media);
        renderLightboxContent();
        renderCurrentView();
        const subInput = document.getElementById('lbSubjectInput');
        if (subInput) setTimeout(() => subInput.focus(), 80);
      }
    }
  });

  setupNormalTagAutocomplete('panelNormalTagInput', 'panelNormalTagAutocomplete', (tag) => {
    applyTagToSelectedMedia('normal', tag);
  });

  setupNormalTagAutocomplete('lbNormalTagInput', 'lbNormalTagAutocomplete', async (tag) => {
    if (lightboxIndex >= 0 && lightboxIndex < currentMediaList.length) {
      const media = currentMediaList[lightboxIndex];
      media.normalTags = media.normalTags || [];
      if (!media.normalTags.includes(tag)) {
        media.normalTags.push(tag);
        await db.put('media', media);
        renderLightboxContent();
        renderCurrentView();
        const tagInput = document.getElementById('lbNormalTagInput');
        if (tagInput) setTimeout(() => tagInput.focus(), 80);
      }
    }
  });

  setupSmartSubjectAutocomplete('wizardSubjectInput', 'wizardSubjectAutocomplete', (subId) => {
    if (!wizardSubjectCountsMap.has(subId)) wizardSubjectCountsMap.set(subId, 1);
    renderWizardParticipants();
  });

  const lbModal = document.getElementById('lightboxModal');
  if (lbModal) {
    lbModal.addEventListener('click', (e) => {
      const isInteractive = e.target.closest('img, video, input, select, button, a, label, .lightbox-footer, .lightbox-editor-toolbar, .video-clipper-panel, .lightbox-header, .lightbox-nav-btn');
      if (!isInteractive) {
        closeLightbox();
      }
    });
  }

  setupSmartSubjectAutocomplete('inlineSubjectInput', 'inlineSubjectAutocomplete', async (subId) => {
    if (selectedMediaIds.size > 0) {
      const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
      for (const m of selectedFiles) {
        if (!m.subjectTags) m.subjectTags = [];
        if (!m.subjectTags.includes(subId)) m.subjectTags.push(subId);
        await db.put('media', m);
      }
      await loadAppState();
      updateSelectionStateUI();
      const subInput = document.getElementById('inlineSubjectInput');
      if (subInput) setTimeout(() => subInput.focus(), 80);
    }
  });

  setupNormalTagAutocomplete('inlineNormalTagInput', 'inlineNormalTagAutocomplete', async (tagVal) => {
    if (selectedMediaIds.size > 0) {
      const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
      for (const m of selectedFiles) {
        if (!m.normalTags) m.normalTags = [];
        if (!m.normalTags.includes(tagVal)) m.normalTags.push(tagVal);
        await db.put('media', m);
      }
      await loadAppState();
      updateSelectionStateUI();
      const tagInput = document.getElementById('inlineNormalTagInput');
      if (tagInput) setTimeout(() => tagInput.focus(), 80);
    }
  });

  setupSmartDateAutocomplete('inlineSldInput', 'inlineSldAutocomplete');

  setupSmartSubjectAutocomplete('inlineAlikeInput', 'inlineAlikeAutocomplete', async (subId) => {
    if (selectedMediaIds.size > 0) {
      const alikeInput = document.getElementById('inlineAlikeInput');
      const raw = alikeInput?.value.trim() || '';
      const parts = raw.split('::');
      const strPart = (parts[1] || 'faint').trim().toLowerCase();
      const strength = ['faint', 'medium', 'strong'].includes(strPart) ? strPart : 'faint';

      const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
      for (const m of selectedFiles) {
        if (!m.alikeTags) m.alikeTags = [];
        if (!m.alikeTags.some(al => al.targetSubjectId === subId && al.strength === strength)) {
          m.alikeTags.push({ targetSubjectId: subId, strength });
        }
        await db.put('media', m);
      }
      if (alikeInput) alikeInput.value = '';
      await loadAppState();
      updateSelectionStateUI();
      if (alikeInput) setTimeout(() => alikeInput.focus(), 80);
    }
  });

  if (typeof setupLightboxEditingSuite === 'function') {
    setupLightboxEditingSuite();
  }
}

async function initApp() {
  triggerSplashScreen();

  try {
    await db.init();
    await loadAppState();
  } catch (err) {
    console.warn('DB Init Warning:', err);
  }

  setupNavigation();
  setupEventListeners();
  setupNavbarAutoHide();
  initPWAandUpdates();
  initSystemErrorLoggerUI();
  initGlobalThumbSizeSlider();
  
  restoreAppStateFromHashOrStorage();
  renderCurrentView();
}

window.setupEventListeners = setupEventListeners;
window.initApp = initApp;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initApp());
} else {
  initApp();
}
