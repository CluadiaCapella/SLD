/**
 * SLD List Page Subsystem
 */

function renderSldListPage() {
  const cardsContainer = document.getElementById('sldCardsContainer');
  if (!cardsContainer) return;

  const sldTagMap = new Map();

  for (const m of currentMediaList) {
    for (const be of (m.blueBookEvents || [])) {
      if (be.dateTag) {
        const tag = be.dateTag;
        const entry = sldTagMap.get(tag) || {
          dateTag: tag, mediaSet: new Set(),
          p1: [], p2: [], p3: [],
          g1: [], g2: [], g3: [],
          b1: [], b2: [], b3: []
        };

        entry.mediaSet.add(m.id);
        const p = be.heartTags?.pink || 0;
        const g = be.heartTags?.grey || 0;
        const b = be.heartTags?.blue || 0;

        if (p === 1) entry.p1.push(m); if (p === 2) entry.p2.push(m); if (p === 3) entry.p3.push(m);
        if (g === 1) entry.g1.push(m); if (g === 2) entry.g2.push(m); if (g === 3) entry.g3.push(m);
        if (b === 1) entry.b1.push(m); if (b === 2) entry.b2.push(m); if (b === 3) entry.b3.push(m);

        sldTagMap.set(tag, entry);
      }
    }
  }

  // Update sort buttons UI in SLD page toolbar
  document.querySelectorAll('.sld-sort-btn').forEach(btn => {
    const key = btn.getAttribute('data-sort');
    if (key === sldSortKey) {
      btn.classList.add('active');
      btn.innerHTML = btn.innerHTML.replace(/[▲▼]/g, '').trim() + ' ' + (sldSortDir === 'asc' ? '▲' : '▼');
    } else {
      btn.classList.remove('active');
      btn.innerHTML = btn.innerHTML.replace(/[▲▼]/g, '').trim();
    }

    btn.onclick = () => {
      if (sldSortKey === key) {
        sldSortDir = sldSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sldSortKey = key;
        sldSortDir = 'desc';
      }
      renderSldListPage();
    };
  });

  const filterInput = document.getElementById('sldFilterInput');
  if (filterInput && !filterInput.dataset.bound) {
    filterInput.dataset.bound = 'true';
    filterInput.oninput = () => renderSldListPage();
  }

  let sldList = Array.from(sldTagMap.values());

  const filterQuery = document.getElementById('sldFilterInput')?.value || '';
  const sldTokens = parseSearchQuery(filterQuery);
  if (sldTokens.length > 0) {
    sldList = sldList.filter(item => matchesSldSearchFilter(item, sldTokens));
  }

  sldList.sort((a, b) => {
    let comp = 0;
    if (sldSortKey === 'date') {
      comp = convertDateTagToIso(a.dateTag).localeCompare(convertDateTagToIso(b.dateTag));
    } else if (sldSortKey === 'files') {
      comp = a.mediaSet.size - b.mediaSet.size;
    }
    return sldSortDir === 'asc' ? comp : -comp;
  });

  if (sldList.length === 0) {
    cardsContainer.innerHTML = `<div class="empty-state">No matching SLD events found.</div>`;
    return;
  }

  const renderHeartCardForList = (mediaArray, maxLimit, heartType, heartEmoji, thumbSize) => {
    if (!mediaArray || mediaArray.length === 0) return '';
    const count = mediaArray.length;
    const isMaxed = count > 0 && count === maxLimit;

    let baseBg = 'rgba(255, 255, 255, 0.03)';
    let baseBorder = 'var(--border-color)';
    if (heartType === 'pink') { baseBg = 'rgba(255, 105, 180, 0.15)'; baseBorder = 'rgba(255, 105, 180, 0.4)'; }
    else if (heartType === 'blue') { baseBg = 'rgba(56, 189, 248, 0.15)'; baseBorder = 'rgba(56, 189, 248, 0.4)'; }
    else if (heartType === 'grey') { baseBg = 'rgba(148, 163, 184, 0.15)'; baseBorder = 'rgba(148, 163, 184, 0.4)'; }

    const isWinner = thumbSize === 'winner';
    const dim = isWinner ? '400px' : '200px';

    const cardStyle = isMaxed
      ? `background: rgba(16, 185, 129, 0.22); border: 2px solid #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); border-radius: var(--radius-lg); padding: 12px; flex: ${isWinner ? '1 1 100%' : '1'}; min-width: ${isWinner ? '420px' : '220px'};`
      : `background: ${baseBg}; border: 2px solid ${baseBorder}; border-radius: var(--radius-lg); padding: 12px; flex: ${isWinner ? '1 1 100%' : '1'}; min-width: ${isWinner ? '420px' : '220px'};`;

    const thumbsHTML = mediaArray.map(m => `
      <div class="sld-mini-thumb-wrap" data-mid="${m.id}" style="width:${dim}; height:${dim}; border-radius:8px; overflow:hidden; display:inline-block; cursor:pointer;">
        ${renderMediaThumbnailHTML(m, 'sld-mini-thumb', `width:${dim}; height:${dim}; object-fit:cover; display:block;`)}
      </div>`).join('');

    return `
      <div class="heart-card-box" style="${cardStyle}">
        <div style="font-size:0.85rem; font-weight:800; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
          <span>${heartEmoji}</span>
          <span style="opacity:0.85; font-size:0.8rem; font-weight:700;">${count} files</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
          ${thumbsHTML}
        </div>
      </div>`;
  };

  const maxGold = currentMedalSettings.maxGold ?? 1;
  const maxSilver = currentMedalSettings.maxSilver ?? 2;
  const maxBronze = currentMedalSettings.maxBronze ?? 5;

  cardsContainer.innerHTML = sldList.map(item => `
    <div class="sld-entry-card" data-tag="${item.dateTag}" style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:18px; box-shadow:var(--shadow-sm); width:fit-content; min-width:300px; max-width:100%; flex:0 1 auto;">
      
      <!-- Header Row: Date (Left), File Count (Middle), 3-Dot Menu (Right) -->
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:12px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
        <div style="display:flex; align-items:center; gap:16px;">
          <h3 class="sld-date-link" data-tag="${item.dateTag}" style="margin:0; font-size:1.3rem; font-weight:800; color:var(--accent-blue); cursor:pointer;">
            📘 ${item.dateTag}
          </h3>
          <span style="font-weight:700; font-size:0.95rem; background:rgba(56,189,248,0.15); color:var(--accent-blue); padding:4px 10px; border-radius:12px; border:1px solid rgba(56,189,248,0.3);">
            📘 ${item.mediaSet.size}
          </span>
        </div>

        <div class="dropdown-container" style="position:relative; display:inline-block; margin-left:auto;">
          <button class="btn btn-secondary btn-sm sld-card-menu-btn">•••</button>
          <div class="dropdown-menu sld-card-dropdown" style="display:none; position:absolute; right:0; top:100%; z-index:10; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:6px; min-width:170px; box-shadow:var(--shadow-md);">
            <button class="btn btn-danger btn-sm delete-sld-btn" data-tag="${item.dateTag}" style="width:100%; text-align:left;">🗑️ Delete SLD Entry</button>
          </div>
        </div>
      </div>

      <!-- Medalist Rows: Winners, Second place, Third Place -->
      <div style="display:flex; flex-direction:column; gap:14px; width:100%;">
        ${(item.p3.length || item.b3.length || item.g3.length) ? `
          <div>
            <div style="font-size:0.85rem; font-weight:800; color:#eab308; margin-bottom:6px;">🥇 Winners</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${renderHeartCardForList(item.p3, maxGold, 'pink', '🩷 Pink', 'winner')}
              ${renderHeartCardForList(item.b3, maxGold, 'blue', '🩵 Blue', 'winner')}
              ${renderHeartCardForList(item.g3, maxGold, 'grey', '🩶 Grey', 'winner')}
            </div>
          </div>` : ''}

        ${(item.p2.length || item.b2.length || item.g2.length) ? `
          <div>
            <div style="font-size:0.85rem; font-weight:800; color:#94a3b8; margin-bottom:6px;">🥈 Second place</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${renderHeartCardForList(item.p2, maxSilver, 'pink', '🩷 Pink', 'silver')}
              ${renderHeartCardForList(item.b2, maxSilver, 'blue', '🩵 Blue', 'silver')}
              ${renderHeartCardForList(item.g2, maxSilver, 'grey', '🩶 Grey', 'silver')}
            </div>
          </div>` : ''}

        ${(item.p1.length || item.b1.length || item.g1.length) ? `
          <div>
            <div style="font-size:0.85rem; font-weight:800; color:#cd7f32; margin-bottom:6px;">🥉 Third Place</div>
            <div style="display:flex; flex-wrap:wrap; gap:8px;">
              ${renderHeartCardForList(item.p1, maxBronze, 'pink', '🩷 Pink', 'bronze')}
              ${renderHeartCardForList(item.b1, maxBronze, 'blue', '🩵 Blue', 'bronze')}
              ${renderHeartCardForList(item.g1, maxBronze, 'grey', '🩶 Grey', 'bronze')}
            </div>
          </div>` : ''}

        ${(!item.p3.length && !item.b3.length && !item.g3.length && !item.p2.length && !item.b2.length && !item.g2.length && !item.p1.length && !item.b1.length && !item.g1.length) ? `
          <div class="text-muted" style="font-size:0.8rem; padding:4px 0;">No medals awarded yet.</div>` : ''}
      </div>
    </div>`).join('');

  cardsContainer.querySelectorAll('.sld-card-menu-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const dropdown = btn.nextElementSibling;
      const isShown = dropdown.style.display === 'block';
      document.querySelectorAll('.sld-card-dropdown').forEach(d => d.style.display = 'none');
      if (!isShown) dropdown.style.display = 'block';
    };
  });

  document.addEventListener('click', () => {
    document.querySelectorAll('.sld-card-dropdown').forEach(d => d.style.display = 'none');
  });

  cardsContainer.querySelectorAll('.sld-date-link').forEach(link => {
    link.onclick = (e) => {
      e.stopPropagation();
      activeDetailSldTag = link.getAttribute('data-tag');
      switchView('sldDetailsView');
    };
  });

  cardsContainer.querySelectorAll('.sld-mini-thumb-wrap').forEach(wrap => {
    wrap.onclick = (e) => {
      e.stopPropagation();
      const mId = wrap.getAttribute('data-mid');
      sldDefaultFullscreen = true;
      openLightboxById(mId);
    };
  });

  cardsContainer.querySelectorAll('.delete-sld-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const delTag = btn.getAttribute('data-tag');
      if (confirm(`Are you sure you want to delete SLD "${delTag}"? This action can be undone.`)) {
        const targetMedia = currentMediaList.filter(m => (m.blueBookEvents || []).some(be => be.dateTag === delTag));
        const previousEvents = targetMedia.map(m => ({ id: m.id, events: JSON.parse(JSON.stringify(m.blueBookEvents || [])) }));

        for (const m of targetMedia) {
          m.blueBookEvents = (m.blueBookEvents || []).filter(be => be.dateTag !== delTag);
          await db.put('media', m);
        }

        pushUndoState(`Delete SLD "${delTag}"`, async () => {
          for (const prev of previousEvents) {
            const m = currentMediaList.find(item => item.id === prev.id);
            if (m) { m.blueBookEvents = prev.events; await db.put('media', m); }
          }
        });

        await loadAppState();
        renderSldListPage();
      }
    };
  });
}

window.renderSldListPage = renderSldListPage;
