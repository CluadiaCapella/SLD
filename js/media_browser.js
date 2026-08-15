/**
 * Section 10: Media Browser with Grouping & 3-Deep Cascade Sorting
 */

let aiFilterMode = 'all';

function renderMediaBrowser() {
  const gridContainer = document.getElementById('mediaGrid');
  const selectionBanner = document.getElementById('selectionBanner');
  const selectedCountEl = document.getElementById('selectedCount');
  const paginationContainer = document.getElementById('mediaPaginationContainer');
  const paginationInfo = document.getElementById('paginationInfo');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (selectedMediaIds.size > 0) {
    selectionBanner.style.display = 'flex';
    selectionBanner.className = 'selection-banner-sticky';
    selectedCountEl.textContent = `${selectedMediaIds.size} file(s) selected`;
    renderSelectionTagsPanel();
  } else {
    selectionBanner.style.display = 'none';
  }

  if (currentMediaList.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📁</div>
        <h3>No media files added yet</h3>
        <p>Click "Upload Media" above to select photos or videos.</p>
      </div>`;
    if (paginationContainer) paginationContainer.style.display = 'none';
    return;
  }

  const searchQuery = document.getElementById('mediaSearchInput')?.value || '';
  const queryTokens = parseSearchQuery(searchQuery);
  const filterTag = document.getElementById('mediaFilterTagSelect')?.value || 'all';

  const filtered = currentMediaList.filter(m => {
    const isAi = m.isAiGenerated || (m.normalTags || []).includes('AI');
    if (aiFilterMode === 'ai_only' && !isAi) return false;
    if (aiFilterMode === 'human_only' && isAi) return false;

    // Header Group Filter Toggle Check
    if (!m.subjectTags || m.subjectTags.length === 0) {
      if (disabledGroupIds.has('__none__')) return false;
    } else {
      const assignedSubs = (m.subjectTags || []).map(sId => currentSubjectsList.find(s => s.id === sId)).filter(Boolean);
      const subGroupIds = assignedSubs.map(s => s.groupId || '__none__');
      if (subGroupIds.length > 0 && subGroupIds.every(gId => disabledGroupIds.has(gId))) {
        return false;
      }
    }

    if (queryTokens.length > 0 && !matchesMediaSearchFilter(m, queryTokens)) {
      return false;
    }

    if (filterTag === 'hasBlueEvents' && (!m.blueBookEvents || m.blueBookEvents.length === 0)) return false;
    if (filterTag === 'pink3' && !(m.blueBookEvents || []).some(be => be.heartTags?.pink === 3)) return false;
    if (filterTag === 'hasSubjects' && (!m.subjectTags || m.subjectTags.length === 0)) return false;
    if (filterTag === 'noSubjects' && (m.subjectTags && m.subjectTags.length > 0)) return false;
    if (filterTag === 'star5' && calculateMediaStarRating(m) !== 5) return false;
    if (filterTag === 'star4' && calculateMediaStarRating(m) !== 4) return false;
    if (filterTag === 'star3' && calculateMediaStarRating(m) !== 3) return false;
    if (filterTag === 'star2' && calculateMediaStarRating(m) !== 2) return false;
    if (filterTag === 'star1' && calculateMediaStarRating(m) !== 1) return false;
    if (filterTag === 'star0' && calculateMediaStarRating(m) !== 0) return false;
    if (filterTag === 'rejected' && calculateMediaStarRating(m) !== -1) return false;
    return true;
  });

  // 3-Deep Cascade Sort Execution
  filtered.sort(compareMediaCascade);

  // Separate Active (Non-Rejected) vs Rejected Files
  const activeFiltered = [];
  const rejectedFiltered = [];

  for (const m of filtered) {
    if (calculateMediaStarRating(m) === -1) {
      rejectedFiltered.push(m);
    } else {
      activeFiltered.push(m);
    }
  }

  const totalItems = activeFiltered.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
  if (currentMediaPage > totalPages) currentMediaPage = totalPages;

  const startIndex = (currentMediaPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
  const pagedItems = activeFiltered.slice(startIndex, endIndex);

  if (totalItems > ITEMS_PER_PAGE) {
    if (paginationContainer) {
      paginationContainer.style.display = 'flex';
      paginationInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalItems} active files (Page ${currentMediaPage} of ${totalPages})`;
      prevBtn.disabled = currentMediaPage <= 1;
      nextBtn.disabled = currentMediaPage >= totalPages;

      prevBtn.onclick = () => { if (currentMediaPage > 1) { currentMediaPage--; renderMediaBrowser(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
      nextBtn.onclick = () => { if (currentMediaPage < totalPages) { currentMediaPage++; renderMediaBrowser(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
    }
  } else {
    if (paginationContainer) paginationContainer.style.display = 'none';
  }

  const renderCardHTML = (m) => {
    const isSelected = selectedMediaIds.has(m.id);
    const blueEvents = m.blueBookEvents || [];
    const borderClass = getMediaHighestPriorityGroupBorderClass(m);
    const starRating = calculateMediaStarRating(m);

    let pinkTotal = 0, greyTotal = 0, blueTotal = 0;
    blueEvents.forEach(be => {
      pinkTotal += be.heartTags?.pink || 0;
      greyTotal += be.heartTags?.grey || 0;
      blueTotal += be.heartTags?.blue || 0;
    });

    const subjectPills = (m.subjectTags || []).map(subId => {
      const sub = currentSubjectsList.find(s => s.id === subId);
      return `<span class="subject-tag-pill nav-sub-pill" data-subid="${subId}">${getSubjectDisplayName(sub)}</span>`;
    }).join('');

    const isAi = m.isAiGenerated || (m.normalTags || []).includes('AI');

    return `
      <div class="media-card ${borderClass} ${isSelected ? 'selected' : ''}" data-id="${m.id}">
        ${renderMediaThumbnailHTML(m)}
        <div class="media-card-overlay">
          <div class="media-card-badges">
            ${isAi ? `<span class="badge" style="background:linear-gradient(135deg, #a855f7, #6366f1); color:#fff; font-weight:800; border-radius:4px; padding:2px 6px;">🤖 AI</span>` : ''}
            ${starRating === -1 ? `<span class="heart-badge" style="background:#ef4444; color:#fff; font-weight:800;">🚫 Rejected</span>` : `<span class="heart-badge" style="background:rgba(234,179,8,0.25); color:#facc15; border:1px solid #eab308; font-weight:800;">⭐ ${starRating}</span>`}
            ${blueEvents.length > 0 ? `<span class="heart-badge blue">📘 ${blueEvents.length}</span>` : ''}
            ${pinkTotal > 0 ? `<span class="heart-badge pink">🩷 ${pinkTotal}</span>` : ''}
            ${greyTotal > 0 ? `<span class="heart-badge grey">🩶 ${greyTotal}</span>` : ''}
            ${blueTotal > 0 ? `<span class="heart-badge blue">🩵 ${blueTotal}</span>` : ''}
            ${subjectPills}
          </div>
        </div>
        ${selectedMediaIds.size > 0 ? `<button class="card-viewer-btn" data-id="${m.id}" title="View Media">👁️</button>` : ''}
      </div>`;
  };

  const renderSubjectGroupsHTML = (filesSlice) => {
    const mediaGroupsMap = new Map();
    currentSubjectGroupsList.forEach(g => mediaGroupsMap.set(g.id, []));
    const unassignedMedia = [];

    for (const m of filesSlice) {
      if (!m.subjectTags || m.subjectTags.length === 0) {
        unassignedMedia.push(m);
      } else {
        const borderClass = getMediaHighestPriorityGroupBorderClass(m);
        let assignedGroupId = null;
        for (const g of currentSubjectGroupsList) {
          if (g.cssClass === borderClass) { assignedGroupId = g.id; break; }
        }
        if (assignedGroupId && mediaGroupsMap.has(assignedGroupId)) {
          mediaGroupsMap.get(assignedGroupId).push(m);
        } else {
          unassignedMedia.push(m);
        }
      }
    }

    let groupsHTML = '';
    currentSubjectGroupsList.forEach(g => {
      if (disabledGroupIds.has(g.id)) return;
      const groupFiles = mediaGroupsMap.get(g.id) || [];
      if (groupFiles.length > 0) {
        groupsHTML += `
          <div class="media-group-section" style="display:block; width:100%; margin-bottom:20px;">
            <div class="media-group-title" style="color:${g.color || 'var(--text-primary)'}; font-weight:800; font-size:1.05rem; margin-bottom:12px; padding-bottom:4px; border-bottom:1px dashed var(--border-color);">
              ${getGroupDisplayTitle(g)} (${groupFiles.length} files)
            </div>
            <div class="media-grid">
              ${groupFiles.map(renderCardHTML).join('')}
            </div>
          </div>`;
      }
    });

    if (unassignedMedia.length > 0 && !disabledGroupIds.has('__none__')) {
      groupsHTML += `
        <div class="media-group-section" style="display:block; width:100%; margin-bottom:20px;">
          <div class="media-group-title" style="color:var(--text-secondary); font-weight:800; font-size:1.05rem; margin-bottom:12px; padding-bottom:4px; border-bottom:1px dashed var(--border-color);">
            ⚪ Unassigned / No Subject Group (${unassignedMedia.length} files)
          </div>
          <div class="media-grid">
            ${unassignedMedia.map(renderCardHTML).join('')}
          </div>
        </div>`;
    }
    return groupsHTML;
  };

  let mainHTML = '';

  if (isMediaRatingsEnabled) {
    const starLevels = [5, 4, 3, 2, 1, 0];
    starLevels.forEach(star => {
      const ratingFiles = pagedItems.filter(m => calculateMediaStarRating(m) === star);
      if (ratingFiles.length > 0) {
        mainHTML += `
          <div class="media-rating-section" style="width:100%; margin-bottom:32px;">
            <div class="media-rating-header">
              <span>${getStarRatingLabel(star)}</span>
              <span class="text-muted" style="font-size:0.85rem; font-weight:700;">${ratingFiles.length} file(s)</span>
            </div>
            ${isMediaGroupingEnabled ? renderSubjectGroupsHTML(ratingFiles) : `<div class="media-grid">${ratingFiles.map(renderCardHTML).join('')}</div>`}
          </div>`;
      }
    });
  } else if (isMediaGroupingEnabled) {
    mainHTML = renderSubjectGroupsHTML(pagedItems);
  } else {
    mainHTML = `<div class="media-grid">${pagedItems.map(renderCardHTML).join('')}</div>`;
  }

  if (rejectedFiltered.length > 0) {
    mainHTML += `
      <details class="rejected-accordion-card">
        <summary style="font-weight:800; font-size:1.1rem; cursor:pointer; color:#ef4444; display:flex; align-items:center; justify-content:space-between; user-select:none;">
          <span>🚫 Rejected Files (${rejectedFiltered.length})</span>
          <span class="text-muted" style="font-size:0.85rem; font-weight:600;">Click to expand / collapse ▼</span>
        </summary>
        <div class="media-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:16px; margin-top:16px;">
          ${rejectedFiltered.map(renderCardHTML).join('')}
        </div>
      </details>`;
  }

  gridContainer.innerHTML = mainHTML || `<div class="empty-state" style="grid-column: 1 / -1;">No files match active filters.</div>`;

  gridContainer.querySelectorAll('.media-card').forEach(card => {
    const id = card.getAttribute('data-id');
    const viewerBtn = card.querySelector('.card-viewer-btn');
    let pressTimer = null;
    let isLongPressTriggered = false;

    if (viewerBtn) {
      viewerBtn.onclick = (e) => {
        e.stopPropagation();
        openLightboxById(id);
      };
    }

    card.querySelectorAll('.nav-sub-pill').forEach(pill => {
      pill.onclick = (e) => {
        if (selectedMediaIds.size === 0) {
          e.stopPropagation();
          activeDetailSubjectId = pill.getAttribute('data-subid');
          switchView('subjectDetailsView');
        }
      };
    });

    const startPress = () => {
      isLongPressTriggered = false;
      pressTimer = setTimeout(() => {
        isLongPressTriggered = true;
        if (!selectedMediaIds.has(id)) selectedMediaIds.add(id);
        card.classList.add('selected');
        updateSelectionStateUI();
      }, 200);
    };

    const cancelPress = () => { if (pressTimer) clearTimeout(pressTimer); };

    card.addEventListener('mousedown', startPress);
    card.addEventListener('touchstart', startPress);
    card.addEventListener('mouseup', cancelPress);
    card.addEventListener('mouseleave', cancelPress);
    card.addEventListener('touchend', cancelPress);

    card.onclick = (e) => {
      if (e.target.classList.contains('card-viewer-btn') || e.target.classList.contains('nav-sub-pill')) return;
      if (isLongPressTriggered) { isLongPressTriggered = false; return; }

      if (selectedMediaIds.size > 0) {
        if (selectedMediaIds.has(id)) {
          selectedMediaIds.delete(id);
          card.classList.remove('selected');
        } else {
          selectedMediaIds.add(id);
          card.classList.add('selected');
        }
        updateSelectionStateUI();
      } else {
        openLightboxById(id);
      }
    };
  });
}

window.aiFilterMode = aiFilterMode;
window.renderMediaBrowser = renderMediaBrowser;
