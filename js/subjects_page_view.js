/**
 * Subjects Page View & Leaderboards Subsystem
 */

function renderSubjectsPage(stats) {
  const gridContainer = document.getElementById('subjectCardsGrid');
  const sldLbContainer = document.getElementById('sldLeaderboard');
  const pinkLbContainer = document.getElementById('pinkHeartLeaderboard');
  const greyLbContainer = document.getElementById('greyHeartLeaderboard');
  const blueLbContainer = document.getElementById('blueHeartLeaderboard');
  const eventLbContainer = document.getElementById('eventPointsLeaderboard');

  const batchSelect = document.getElementById('batchSubjectGroupSelect');
  const selectionCountEl = document.getElementById('subjectSelectionCount');

  // Setup Batch Group Select Options & Handler
  const batchGrpSelect = document.getElementById('batchSubjectGroupSelect');
  const batchTagsBtn = document.getElementById('batchSubjectTagsBtn');
  const batchMenuContainer = document.getElementById('subjectBatchMenuContainer');
  const batchDropdown = document.getElementById('subjectBatchDropdown');
  const batchMenuBtn = document.getElementById('subjectBatchMenuBtn');
  const batchDeleteBtn = document.getElementById('batchDeleteSubjectsBtn');
  const batchGenderBtn = document.getElementById('batchGenderSubjectsBtn');

  if (selectedSubjectIds.size > 0) {
    if (batchGrpSelect) {
      batchGrpSelect.style.display = 'inline-block';
      batchGrpSelect.innerHTML = `<option value="">🎨 Group (${selectedSubjectIds.size})...</option>` + getSubjectGroupOptionsHTML();
      batchGrpSelect.onchange = async () => {
        const val = batchGrpSelect.value;
        if (!val) return;
        if (val.startsWith('__')) {
          await handleGroupSelectAction(val);
          return;
        }
        for (const sId of selectedSubjectIds) {
          const s = currentSubjectsList.find(sub => sub.id === sId);
          if (s) { s.groupId = val; await db.put('subjects', s); }
        }
        selectedSubjectIds.clear();
        await loadAppState();
        renderSubjectsPage(processAllStats());
      };
    }
    if (batchTagsBtn) {
      batchTagsBtn.style.display = 'inline-flex';
      batchTagsBtn.onclick = () => {
        openMultiSelectTagsModal(Array.from(selectedSubjectIds));
      };
    }
    if (batchMenuContainer) batchMenuContainer.style.display = 'inline-block';
  } else {
    if (batchGrpSelect) batchGrpSelect.style.display = 'none';
    if (batchTagsBtn) batchTagsBtn.style.display = 'none';
    if (batchMenuContainer) batchMenuContainer.style.display = 'none';
    if (batchDropdown) batchDropdown.style.display = 'none';
  }

  if (batchMenuBtn && batchDropdown) {
    batchMenuBtn.onclick = (e) => {
      e.stopPropagation();
      batchDropdown.style.display = batchDropdown.style.display === 'none' ? 'block' : 'none';
    };
  }

  if (batchGenderBtn) {
    batchGenderBtn.onclick = () => {
      if (batchDropdown) batchDropdown.style.display = 'none';
      openBatchGenderModal();
    };
  }

  if (batchDeleteBtn) {
    batchDeleteBtn.onclick = async () => {
      if (batchDropdown) batchDropdown.style.display = 'none';
      if (!confirm(`Are you sure you want to delete ${selectedSubjectIds.size} selected subject(s)?`)) return;
      for (const id of selectedSubjectIds) {
        await db.delete('subjects', id);
      }
      selectedSubjectIds.clear();
      await loadAppState();
      renderSubjectsPage(processAllStats());
    };
  }

  // Update sort buttons UI in Subjects page toolbar
  document.querySelectorAll('.subject-sort-btn').forEach(btn => {
    const key = btn.getAttribute('data-sort');
    if (key === subjectSortKey) {
      btn.classList.add('active');
      btn.innerHTML = btn.innerHTML.replace(/[▲▼]/g, '').trim() + ' ' + (subjectSortDir === 'asc' ? '▲' : '▼');
    } else {
      btn.classList.remove('active');
      btn.innerHTML = btn.innerHTML.replace(/[▲▼]/g, '').trim();
    }

    btn.onclick = () => {
      if (subjectSortKey === key) {
        subjectSortDir = subjectSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        subjectSortKey = key;
        subjectSortDir = 'desc';
        if (key === 'name') subjectSortDir = 'asc';
      }
      renderSubjectsPage(stats);
    };
  });

  const subLbSection = document.getElementById('subjectLeaderboardsSection');
  const comboLbSection = document.getElementById('comboLeaderboardsSection');

  document.querySelectorAll('.subject-tab-btn').forEach(btn => {
    const tab = btn.getAttribute('data-tab');
    if (tab === activeSubjectsTab) {
      btn.classList.add('active');
      btn.style.background = 'var(--accent-pink)';
      btn.style.color = '#fff';
    } else {
      btn.classList.remove('active');
      btn.style.background = '';
      btn.style.color = '';
    }

    btn.onclick = (e) => {
      e.stopPropagation();
      activeSubjectsTab = tab;
      renderSubjectsPage(stats);
    };
  });

  // Deselect selection on empty space click
  const subjectsViewContainer = document.getElementById('subjectsView');
  if (subjectsViewContainer) {
    subjectsViewContainer.onclick = (e) => {
      if (!e.target.closest('.subject-card') && !e.target.closest('.combination-element-card') && !e.target.closest('.btn') && !e.target.closest('select') && !e.target.closest('input')) {
        if (selectedSubjectIds.size > 0) {
          selectedSubjectIds.clear();
          renderSubjectsPage(stats);
        }
      }
    };
  }

  if (activeSubjectsTab === 'combos') {
    if (subLbSection) subLbSection.style.display = 'none';
    if (comboLbSection) comboLbSection.style.display = 'block';

    const allCombos = stats.allCombinations || [];
    if (allCombos.length === 0) {
      gridContainer.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No Subject Combinations Recorded.</div>`;
    } else {
      const sortedCombos = allCombos.slice().sort((a, b) => {
        let comp = 0;
        if (subjectSortKey === 'name') comp = a.name.localeCompare(b.name);
        else if (subjectSortKey === 'totalPoints') comp = a.totalPoints - b.totalPoints;
        else if (subjectSortKey === 'eventPoints') comp = a.eventPoints - b.eventPoints;
        else if (subjectSortKey === 'pink') comp = a.pinkPoints - b.pinkPoints;
        else if (subjectSortKey === 'grey') comp = a.greyPoints - b.greyPoints;
        else if (subjectSortKey === 'blue') comp = a.bluePoints - b.bluePoints;
        else comp = a.totalPoints - b.totalPoints;
        return subjectSortDir === 'asc' ? comp : -comp;
      });

      const ACTION_HEX_MAP = {
        1: '#a855f7', 2: '#3b82f6', 3: '#10b981', 4: '#eab308',
        5: '#f97316', 6: '#ef4444', 7: '#ec4899', 8: '#d946ef',
        9: '#0ea5e9', 10: '#6366f1', 11: '#8b5cf6', 12: '#f43f5e'
      };

      gridContainer.innerHTML = sortedCombos.map(c => {
        const subs = c.subs || [];
        const primarySub = subs[0];
        const secondarySub = subs[1] || primarySub;
        const comboKey = (c.subjectIds || [c.subjectId1, c.subjectId2]).join('::');

        const actColor = ACTION_HEX_MAP[c.maxActionCode] || '';
        const cardStyle = c.maxActionCode ? `border:2px solid ${actColor};` : `border:1px solid var(--border-color);`;

        const companionTagged = currentMediaList.filter(m => m.subjectTags?.includes(primarySub?.id));
        const g = primarySub ? getSubjectGroup(primarySub.groupId) : null;
        const bClass = g?.cssClass || '';
        const mainThumbHTML = primarySub?.avatarUrl 
          ? `<img src="${primarySub.avatarUrl}" class="combination-main-thumb ${bClass}" alt="${primarySub.name}">`
          : companionTagged[0]
            ? renderMediaThumbnailHTML(companionTagged[0], `combination-main-thumb ${bClass}`)
            : `<div class="combination-main-thumb ${bClass}" style="display:flex;align-items:center;justify-content:center;font-size:54px;background:var(--bg-secondary);">👤</div>`;

        const secondaryAvatar = secondarySub?.avatarUrl || (companionTagged[0] ? (companionTagged[0].customThumbnail || companionTagged[0].dataUrl) : null);
        const secondaryOverlayHTML = secondaryAvatar
          ? `<img src="${secondaryAvatar}" class="combination-active-overlay-thumb" title="${secondarySub ? getSubjectDisplayName(secondarySub) : ''}">`
          : `<div class="combination-active-overlay-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--accent-pink);color:#fff;">👤</div>`;

        return `
          <div class="combination-element-card combo-tab-card" data-combokey="${comboKey}" style="${cardStyle}">
            ${secondaryOverlayHTML}
            ${mainThumbHTML}
            <div class="combination-card-overlay">
              <div style="font-weight:800; font-size:1.05rem; color:#fff; text-shadow:0 2px 4px rgba(0,0,0,0.9); margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                ${c.name}
              </div>
              <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
                <span style="font-size:0.75rem; color:rgba(255,255,255,0.85); text-shadow:0 1px 3px #000;">${c.mediaCount} shared media</span>
                <span style="font-size:0.8rem; font-weight:800; color:var(--accent-pink); text-shadow:0 1px 3px #000;">${c.totalPoints} pts</span>
              </div>
            </div>
          </div>`;
      }).join('');

      gridContainer.querySelectorAll('.combo-tab-card').forEach(card => {
        card.onclick = (e) => {
          e.stopPropagation();
          activeDetailComboKey = card.getAttribute('data-combokey');
          switchView('combinationDetailsView');
        };
      });
    }
  } else {
    if (subLbSection) subLbSection.style.display = 'block';
    if (comboLbSection) comboLbSection.style.display = 'none';

    if (currentSubjectsList.length === 0) {
      gridContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">👥</div>
          <h3>No Subjects Added</h3>
          <p>Click "+ Add Subject" to create subject profiles.</p>
        </div>`;
    } else {
      // Sort subjects list
      const sortedSubjects = currentSubjectsList.slice().sort((a, b) => {
        const aStat = (stats?.allSubjectStats || []).find(s => s?.subject?.id === a.id) || { totalPoints: 0, heartPoints: 0, eventPoints: 0, pinkPoints: 0, greyPoints: 0, bluePoints: 0, latestEventDate: null };
        const bStat = (stats?.allSubjectStats || []).find(s => s?.subject?.id === b.id) || { totalPoints: 0, heartPoints: 0, eventPoints: 0, pinkPoints: 0, greyPoints: 0, bluePoints: 0, latestEventDate: null };

        let comp = 0;
        if (subjectSortKey === 'name') {
          comp = (a.name || '').localeCompare(b.name || '');
        } else if (subjectSortKey === 'totalPoints') {
          comp = (aStat.totalPoints || 0) - (bStat.totalPoints || 0);
        } else if (subjectSortKey === 'eventPoints') {
          comp = (aStat.eventPoints || 0) - (bStat.eventPoints || 0);
        } else if (subjectSortKey === 'eventDate') {
          const aDate = aStat.latestEventDate || '';
          const bDate = bStat.latestEventDate || '';
          comp = aDate.localeCompare(bDate);
        } else if (subjectSortKey === 'pink') {
          comp = (aStat.pinkPoints || 0) - (bStat.pinkPoints || 0);
        } else if (subjectSortKey === 'grey') {
          comp = (aStat.greyPoints || 0) - (bStat.greyPoints || 0);
        } else if (subjectSortKey === 'blue') {
          comp = (aStat.bluePoints || 0) - (bStat.bluePoints || 0);
        }

        return subjectSortDir === 'asc' ? comp : -comp;
      });

      // Media-Overlay Subject Card HTML Generator
      const renderSubjectCardHTML = (sub) => {
        if (!sub) return '';
        const sStat = (stats?.allSubjectStats || []).find(s => s?.subject?.id === sub.id) || { totalPoints: 0, heartPoints: 0, eventPoints: 0 };
        const taggedMedia = currentMediaList.filter(m => m.subjectTags?.includes(sub.id));
        const group = getSubjectGroup(sub.groupId);
        const borderClass = group?.cssClass || '';
        const isSelected = selectedSubjectIds.has(sub.id);

        let avatarHTML = sub.avatarUrl 
          ? `<img src="${sub.avatarUrl}" class="media-thumbnail ${borderClass}" alt="${sub.name}">` 
          : taggedMedia[0] 
            ? renderMediaThumbnailHTML(taggedMedia[0], `media-thumbnail ${borderClass}`) 
            : `<div class="media-thumbnail ${borderClass}" style="display:flex;align-items:center;justify-content:center;font-size:42px;background:var(--bg-secondary);">👤</div>`;

        return `
          <div class="subject-card ${borderClass} ${isSelected ? 'selected' : ''}" data-id="${sub.id}">
            ${avatarHTML}
            <div class="subject-card-overlay">
              <div class="subject-card-name">${getSubjectDisplayName(sub)}</div>
              <div class="subject-card-stats">
                <span class="subject-stat-badge" style="color:var(--accent-pink);">SLD: ${sStat.heartPoints} pts</span>
                <span class="subject-stat-badge" style="color:var(--accent-blue);">Events: ${sStat.eventPoints} pts</span>
              </div>
            </div>
          </div>`;
      };

      // Group the sorted subjects list
      const subjectsGroupMap = new Map();
      currentSubjectGroupsList.forEach(g => subjectsGroupMap.set(g.id, []));
      const unassignedSubjects = [];

      for (const sub of sortedSubjects) {
        if (!sub.groupId) {
          unassignedSubjects.push(sub);
        } else {
          const group = getSubjectGroup(sub.groupId);
          if (group && subjectsGroupMap.has(group.id)) {
            subjectsGroupMap.get(group.id).push(sub);
          } else {
            unassignedSubjects.push(sub);
          }
        }
      }

      let groupsHTML = '';
      currentSubjectGroupsList.forEach(g => {
        if (disabledGroupIds.has(g.id)) return;
        const groupSubs = subjectsGroupMap.get(g.id) || [];
        if (groupSubs.length > 0) {
          groupsHTML += `
            <div class="media-group-section" style="display:block; width:100%; margin-bottom:32px;">
              <div class="media-group-title" style="color:${g.color || 'var(--text-primary)'}; font-weight:800; font-size:1.15rem; margin-bottom:16px; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
                ${getGroupDisplayTitle(g)} (${groupSubs.length} subjects)
              </div>
              <div class="media-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:16px;">
                ${groupSubs.map(renderSubjectCardHTML).join('')}
              </div>
            </div>`;
        }
      });

      if (unassignedSubjects.length > 0 && !disabledGroupIds.has('__none__')) {
        groupsHTML += `
          <div class="media-group-section" style="display:block; width:100%; margin-bottom:32px;">
            <div class="media-group-title" style="color:var(--text-secondary); font-weight:800; font-size:1.15rem; margin-bottom:16px; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
              ⚪ Unassigned / No Subject Group (${unassignedSubjects.length} subjects)
            </div>
            <div class="media-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:16px;">
              ${unassignedSubjects.map(renderSubjectCardHTML).join('')}
            </div>
          </div>`;
      }

      gridContainer.innerHTML = groupsHTML || `<div class="empty-state" style="grid-column: 1 / -1;">No subjects match active group filters.</div>`;

      // Subject card selection / drilldown event listener with Long Press support
      gridContainer.querySelectorAll('.subject-card').forEach(card => {
        const subId = card.getAttribute('data-id');
        let isLongPressTriggered = false;
        let pressTimer = null;

        const startPress = () => {
          isLongPressTriggered = false;
          pressTimer = setTimeout(() => {
            isLongPressTriggered = true;
            if (selectedSubjectIds.has(subId)) {
              selectedSubjectIds.delete(subId);
            } else {
              selectedSubjectIds.add(subId);
            }
            renderSubjectsPage(stats);
          }, 300);
        };

        const cancelPress = () => { if (pressTimer) clearTimeout(pressTimer); };

        card.addEventListener('mousedown', startPress);
        card.addEventListener('touchstart', startPress);
        card.addEventListener('mouseup', cancelPress);
        card.addEventListener('mouseleave', cancelPress);
        card.addEventListener('touchend', cancelPress);

        card.oncontextmenu = (e) => {
          e.preventDefault();
          if (selectedSubjectIds.has(subId)) {
            selectedSubjectIds.delete(subId);
          } else {
            selectedSubjectIds.add(subId);
          }
          renderSubjectsPage(stats);
        };

        card.onclick = (e) => {
          if (isLongPressTriggered) {
            isLongPressTriggered = false;
            return;
          }
          if (e.shiftKey || e.ctrlKey || e.metaKey || selectedSubjectIds.size > 0) {
            e.preventDefault();
            e.stopPropagation();
            if (selectedSubjectIds.has(subId)) {
              selectedSubjectIds.delete(subId);
            } else {
              selectedSubjectIds.add(subId);
            }
            renderSubjectsPage(stats);
          } else {
            activeDetailSubjectId = subId;
            switchView('subjectDetailsView');
          }
        };
      });
    }
  }

  // Helper for Leaderboard Rows
  const renderLeaderboardRows = (container, list, scoreKey, badgeColor, isCombo = false, titleText = '') => {
    if (!container) return;

    const parentCard = container.closest('.leaderboard-card');
    if (parentCard) {
      const headerEl = parentCard.querySelector('h3');
      if (headerEl) {
        headerEl.title = 'Click to view full rankings popup';
        headerEl.onclick = () => openFullLeaderboardModal(titleText || headerEl.textContent, list, scoreKey, badgeColor, isCombo);
      }
    }

    if (!list || list.length === 0) {
      container.innerHTML = `<div class="text-muted" style="font-size:0.8rem; padding:6px 0;">No rankings available.</div>`;
      return;
    }

    const rowsHTML = list.slice(0, 25).map((item, idx) => {
      if (!item) return '';
      const val = item[scoreKey] ?? 0;
      const displayName = isCombo ? item.name : getSubjectDisplayName(item?.subject);
      const dataAttr = isCombo ? `data-combokey="${(item.subjectIds || [item.subjectId1, item.subjectId2]).join('::')}"` : `data-id="${item?.subject?.id || ''}"`;

      let thumbHTML = '';
      if (!isCombo && item?.subject) {
        const tagged = currentMediaList.filter(m => m.subjectTags?.includes(item.subject.id));
        thumbHTML = item.subject.avatarUrl 
          ? `<img src="${item.subject.avatarUrl}" class="leader-avatar-thumb" alt="${item.subject.name}">`
          : tagged[0]
            ? renderMediaThumbnailHTML(tagged[0], 'leader-avatar-thumb')
            : `<div class="leader-avatar-thumb" style="display:flex;align-items:center;justify-content:center;font-size:12px;background:var(--bg-secondary);">👤</div>`;
      } else if (isCombo && item.subs) {
        thumbHTML = item.subs.slice(0, 2).map(s => {
          if (!s) return '';
          return s.avatarUrl 
            ? `<img src="${s.avatarUrl}" class="leader-avatar-thumb" title="${getSubjectDisplayName(s)}">`
            : `<div class="leader-avatar-thumb" style="display:flex;align-items:center;justify-content:center;font-size:12px;background:var(--bg-secondary);">👤</div>`;
        }).join('');
      }

      return `
        <div class="leader-item ${isCombo ? 'combo-item' : ''}" ${dataAttr}>
          <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
            <span class="leader-rank">#${idx + 1}</span>
            ${thumbHTML}
            <div class="leader-info"><span style="font-weight:700;">${displayName}</span></div>
          </div>
          <span class="badge" style="background:${badgeColor}22; color:${badgeColor}; font-weight:700;">${val} pts</span>
        </div>`;
    }).join('');

    container.className = 'leaderboard-list-container';
    container.innerHTML = rowsHTML;

    container.querySelectorAll('.leader-item').forEach(el => {
      el.onclick = () => {
        if (isCombo) {
          activeDetailComboKey = el.getAttribute('data-combokey');
          switchView('combinationDetailsView');
        } else {
          activeDetailSubjectId = el.getAttribute('data-id');
          switchView('subjectDetailsView');
        }
      };
    });
  };

  // 1. Render 5 Distinct Subject Leaderboard Sets
  const sldList = stats.allSubjectStats.slice().sort((a, b) => b.heartPoints - a.heartPoints);
  const pinkList = stats.allSubjectStats.slice().sort((a, b) => b.pinkPoints - a.pinkPoints);
  const greyList = stats.allSubjectStats.slice().sort((a, b) => b.greyPoints - a.greyPoints);
  const blueList = stats.allSubjectStats.slice().sort((a, b) => b.bluePoints - a.bluePoints);
  const eventList = stats.allSubjectStats.slice().sort((a, b) => b.eventPoints - a.eventPoints);

  renderLeaderboardRows(eventLbContainer, eventList, 'eventPoints', '#3b82f6', false, '📙 Events Rankings');
  renderLeaderboardRows(sldLbContainer, sldList, 'heartPoints', 'var(--accent-pink)', false, '📘 Total Rankings');
  renderLeaderboardRows(pinkLbContainer, pinkList, 'pinkPoints', '#ff69b4', false, '🩷 Rankings');
  renderLeaderboardRows(blueLbContainer, blueList, 'bluePoints', '#38bdf8', false, '🩵 Rankings');
  renderLeaderboardRows(greyLbContainer, greyList, 'greyPoints', '#94a3b8', false, '🩶 Rankings');

  // 2. Render 5 Distinct Companion Leaderboard Sets
  const comboSldLbContainer = document.getElementById('comboSldLb');
  const comboPinkLbContainer = document.getElementById('comboPinkLb');
  const comboGreyLbContainer = document.getElementById('comboGreyLb');
  const comboBlueLbContainer = document.getElementById('comboBlueLb');
  const comboEventLbContainer = document.getElementById('comboEventLb');

  const cSldList = stats.allCombinations.slice().sort((a, b) => b.heartPoints - a.heartPoints);
  const cPinkList = stats.allCombinations.slice().sort((a, b) => b.pinkPoints - a.pinkPoints);
  const cGreyList = stats.allCombinations.slice().sort((a, b) => b.greyPoints - a.greyPoints);
  const cBlueList = stats.allCombinations.slice().sort((a, b) => b.bluePoints - a.bluePoints);
  const cEventList = stats.allCombinations.slice().sort((a, b) => b.eventPoints - a.eventPoints);

  renderLeaderboardRows(comboEventLbContainer, cEventList, 'eventPoints', '#3b82f6', true, '⚡ Companion Events Rankings');
  renderLeaderboardRows(comboSldLbContainer, cSldList, 'heartPoints', 'var(--accent-pink)', true, '⚡ Companion Total Rankings');
  renderLeaderboardRows(comboPinkLbContainer, cPinkList, 'pinkPoints', '#ff69b4', true, '⚡ Companion 🩷 Rankings');
  renderLeaderboardRows(comboBlueLbContainer, cBlueList, 'bluePoints', '#38bdf8', true, '⚡ Companion 🩵 Rankings');
  renderLeaderboardRows(comboGreyLbContainer, cGreyList, 'greyPoints', '#94a3b8', true, '⚡ Companion 🩶 Rankings');
}

function openBatchGenderModal() {
  if (selectedSubjectIds.size === 0) return;
  const modal = document.getElementById('batchGenderModal');
  if (!modal) return;

  document.getElementById('saveBatchGenderBtn').onclick = async () => {
    const genderVal = document.getElementById('batchGenderSelect')?.value || 'Female';
    for (const id of selectedSubjectIds) {
      const s = currentSubjectsList.find(sub => sub.id === id);
      if (s) {
        s.gender = genderVal;
        await db.put('subjects', s);
      }
    }
    selectedSubjectIds.clear();
    modal.classList.remove('active');
    modal.style.display = 'none';
    await loadAppState();
    renderCurrentView();
  };

  document.getElementById('closeBatchGenderBtn').onclick = () => {
    modal.classList.remove('active');
    modal.style.display = 'none';
  };

  document.getElementById('cancelBatchGenderBtn').onclick = () => {
    modal.classList.remove('active');
    modal.style.display = 'none';
  };

  modal.classList.add('active');
  modal.style.display = 'flex';
}

window.renderSubjectsPage = renderSubjectsPage;
window.openBatchGenderModal = openBatchGenderModal;
