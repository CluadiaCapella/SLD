/* Subject & Companion Leaderboards Renderer Module */

function renderLeaderboardRows(container, list, scoreKey, badgeColor, isCombo = false, titleText = '') {
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
      const tagged = (typeof currentMediaList !== 'undefined' ? currentMediaList : []).filter(m => m.subjectTags?.includes(item.subject.id));
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
}

function openFullLeaderboardModal(title, list, scoreKey, badgeColor, isCombo) {
  const modal = document.getElementById('leaderboardModal');
  const titleEl = document.getElementById('leaderboardModalTitle');
  const container = document.getElementById('leaderboardModalContent');
  if (!modal || !container) return;

  if (titleEl) titleEl.textContent = title;
  container.innerHTML = (list || []).map((item, idx) => {
    const val = item[scoreKey] ?? 0;
    const displayName = isCombo ? item.name : getSubjectDisplayName(item.subject);
    const dataAttr = isCombo ? `data-combokey="${(item.subjectIds || [item.subjectId1, item.subjectId2]).join('::')}"` : `data-id="${item.subject.id}"`;

    let thumbHTML = '';
    if (!isCombo && item.subject) {
      const tagged = (typeof currentMediaList !== 'undefined' ? currentMediaList : []).filter(m => m.subjectTags?.includes(item.subject.id));
      thumbHTML = item.subject.avatarUrl 
        ? `<img src="${item.subject.avatarUrl}" class="leader-avatar-thumb" alt="${item.subject.name}">`
        : tagged[0]
          ? renderMediaThumbnailHTML(tagged[0], 'leader-avatar-thumb')
          : `<div class="leader-avatar-thumb" style="display:flex;align-items:center;justify-content:center;font-size:12px;background:var(--bg-secondary);">👤</div>`;
    } else if (isCombo && item.subs) {
      thumbHTML = item.subs.slice(0, 2).map(s => {
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
          <span style="font-weight:700;">${displayName}</span>
        </div>
        <span class="badge" style="background:${badgeColor}22; color:${badgeColor}; font-weight:700;">${val} pts</span>
      </div>`;
  }).join('');

  container.querySelectorAll('.leader-item').forEach(el => {
    el.onclick = () => {
      modal.classList.remove('active');
      if (isCombo) {
        activeDetailComboKey = el.getAttribute('data-combokey');
        switchView('combinationDetailsView');
      } else {
        activeDetailSubjectId = el.getAttribute('data-id');
        switchView('subjectDetailsView');
      }
    };
  });

  const closeBtn = document.getElementById('closeLeaderboardModalBtn');
  if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
  modal.classList.add('active');
}

window.renderLeaderboardRows = renderLeaderboardRows;
window.openFullLeaderboardModal = openFullLeaderboardModal;
