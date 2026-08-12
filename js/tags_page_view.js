/**
 * Tags Page View & Editable Action Points Subsystem
 */

function renderTagsPage() {
  const actionContainer = document.getElementById('actionTagsContainer');
  const subActionContainer = document.getElementById('subActionTagsContainer');
  const normalContainer = document.getElementById('normalTagsContainer');

  const actionCodes = Array.from({ length: 12 }, (_, i) => i + 1);
  actionContainer.innerHTML = actionCodes.map(code => {
    const displayName = getActionDisplayName(code);
    const currentPts = currentActionPointsMap[code] ?? (DEFAULT_ACTION_POINTS[code] || 0.1);
    return `
      <div class="tag-chip-bubble action-tag-${code} nav-action-chip" data-code="${code}" style="display:inline-flex; align-items:center; gap:8px;">
        <span style="cursor:pointer;" class="action-chip-name" data-code="${code}">${displayName}</span>
        <span style="font-size:0.75rem; opacity:0.8;">Pts:</span>
        <input type="number" step="0.1" min="0" max="100" class="input-text btn-sm action-pts-input" data-code="${code}" value="${currentPts}" style="width:64px; padding:2px 6px; font-size:0.8rem; background:rgba(0,0,0,0.3); border-color:rgba(255,255,255,0.3); color:#fff;">
      </div>`;
  }).join('');

  if (subActionContainer) {
    subActionContainer.innerHTML = SUB_ACTION_TAGS.map(sat => {
      const currentPts = (window.currentSubActionPointsMap && window.currentSubActionPointsMap[sat.id] !== undefined)
        ? window.currentSubActionPointsMap[sat.id]
        : sat.pts;
      return `
        <div class="tag-chip-bubble nav-action-chip" data-id="${sat.id}" style="display:inline-flex; align-items:center; gap:8px; background:rgba(255,105,180,0.15); border:1px solid #ff69b4; color:#fff;">
          <span style="font-weight:700;">${sat.name}</span>
          <span style="font-size:0.75rem; opacity:0.8;">Pts:</span>
          <input type="number" step="0.05" min="0" max="100" class="input-text btn-sm sub-action-pts-input" data-id="${sat.id}" value="${currentPts}" style="width:64px; padding:2px 6px; font-size:0.8rem; background:rgba(0,0,0,0.3); border-color:rgba(255,255,255,0.3); color:#fff;">
          ${sat.parentAction !== 'all' ? `<span class="badge" style="background:rgba(255,255,255,0.1); font-size:0.7rem; color:var(--text-muted);">Zodiac #${sat.parentAction}</span>` : ''}
        </div>`;
    }).join('');

    subActionContainer.querySelectorAll('.sub-action-pts-input').forEach(input => {
      input.onclick = (e) => e.stopPropagation();
      input.onchange = async (e) => {
        const id = input.getAttribute('data-id');
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val < 0) val = 0;
        val = Math.round(val * 100) / 100;
        input.value = val;

        if (!window.currentSubActionPointsMap) window.currentSubActionPointsMap = {};
        window.currentSubActionPointsMap[id] = val;
        await db.setSetting('subActionPointsMap', window.currentSubActionPointsMap);
        await loadAppState();
      };
    });
  }

  actionContainer.querySelectorAll('.action-chip-name').forEach(chip => {
    chip.onclick = () => {
      const code = chip.getAttribute('data-code');
      activeDetailTagName = getActionDisplayName(code);
      switchView('tagDetailsView');
    };
  });

  actionContainer.querySelectorAll('.action-pts-input').forEach(input => {
    input.onclick = (e) => e.stopPropagation();
    input.onchange = async (e) => {
      const code = parseInt(input.getAttribute('data-code'), 10);
      let val = parseFloat(e.target.value);
      if (isNaN(val) || val < 0) val = 0.1;
      val = Math.round(val * 100) / 100;
      input.value = val;

      currentActionPointsMap[code] = val;
      await db.setSetting('actionPointsMap', currentActionPointsMap);
      await loadAppState();
    };
  });

  const normalTagCounts = new Map();
  currentMediaList.forEach(m => {
    (m.normalTags || []).forEach(t => normalTagCounts.set(t, (normalTagCounts.get(t) || 0) + 1));
  });

  const sortedNormalTags = Array.from(normalTagCounts.entries()).sort((a, b) => b[1] - a[1]);

  if (sortedNormalTags.length === 0) {
    normalContainer.innerHTML = `<p class="text-muted">No normal tags added yet. Add tags in Media Browser or Lightbox.</p>`;
  } else {
    normalContainer.innerHTML = sortedNormalTags.map(([tag, count]) => `
      <span class="tag-chip-bubble nav-normal-chip" data-tag="${tag}" style="display:inline-flex; align-items:center; gap:6px;">
        <span class="nav-normal-chip-name" data-tag="${tag}" style="cursor:pointer;">🏷️ ${tag} (${count})</span>
        <button class="btn btn-secondary btn-sm rename-normal-tag-btn" data-tag="${tag}" title="Rename / Merge tag" style="padding:1px 5px; font-size:0.75rem;">✏️</button>
        <span class="tag-chip-remove delete-normal-tag-btn" data-tag="${tag}">✖</span>
      </span>`).join('');

    normalContainer.querySelectorAll('.nav-normal-chip-name').forEach(chip => {
      chip.onclick = () => {
        activeDetailTagName = chip.getAttribute('data-tag');
        switchView('tagDetailsView');
      };
    });

    normalContainer.querySelectorAll('.rename-normal-tag-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const oldTag = btn.getAttribute('data-tag');
        const newTagRaw = prompt(`Rename / Merge normal tag "${oldTag}":`, oldTag);
        if (!newTagRaw) return;
        const newTag = newTagRaw.trim();
        if (!newTag || newTag === oldTag) return;

        const exists = currentMediaList.some(m => (m.normalTags || []).includes(newTag));
        if (exists) {
          if (!confirm(`Tag "${newTag}" already exists. Do you want to merge "${oldTag}" into "${newTag}"?`)) return;
        }

        for (const m of currentMediaList) {
          if ((m.normalTags || []).includes(oldTag)) {
            m.normalTags = m.normalTags.filter(t => t !== oldTag);
            if (!m.normalTags.includes(newTag)) m.normalTags.push(newTag);
            await db.put('media', m);
          }
        }

        await loadAppState();
        renderTagsPage();
      };
    });

    normalContainer.querySelectorAll('.delete-normal-tag-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const delTag = btn.getAttribute('data-tag');
        if (confirm(`Delete tag "${delTag}" from all media?`)) {
          const targetMedia = currentMediaList.filter(m => (m.normalTags || []).includes(delTag));
          for (const m of targetMedia) {
            m.normalTags = (m.normalTags || []).filter(t => t !== delTag);
            await db.put('media', m);
          }
          await loadAppState();
          renderCurrentView();
        }
      };
    });
  }
}

window.renderTagsPage = renderTagsPage;
