/**
 * SLD Details Page Subsystem
 */

function renderSldDetailsPage() {
  const container = document.getElementById('sldDetailsContent');
  if (!activeDetailSldTag) { switchView('sldView'); return; }

  const sldTag = activeDetailSldTag;
  const sldMedia = currentMediaList.filter(m => (m.blueBookEvents || []).some(be => be.dateTag === sldTag));

  let p3 = 0, p2 = 0, p1 = 0, b3 = 0, b2 = 0, b1 = 0, g3 = 0, g2 = 0, g1 = 0;
  const subP3 = [], subP2 = [], subP1 = [];
  const subB3 = [], subB2 = [], subB1 = [];
  const subG3 = [], subG2 = [], subG1 = [];
  const noHeartMedia = [];

  for (const m of sldMedia) {
    const be = (m.blueBookEvents || []).find(e => e.dateTag === sldTag);
    if (be && be.heartTags) {
      const p = be.heartTags.pink || 0;
      const g = be.heartTags.grey || 0;
      const b = be.heartTags.blue || 0;

      if (p === 3) { p3++; subP3.push(m); } else if (p === 2) { p2++; subP2.push(m); } else if (p === 1) { p1++; subP1.push(m); }
      if (b === 3) { b3++; subB3.push(m); } else if (b === 2) { b2++; subB2.push(m); } else if (b === 1) { b1++; subB1.push(m); }
      if (g === 3) { g3++; subG3.push(m); } else if (g === 2) { g2++; subG2.push(m); } else if (g === 1) { g1++; subG1.push(m); }

      if (p === 0 && g === 0 && b === 0) noHeartMedia.push(m);
    } else noHeartMedia.push(m);
  }

  const p3Exceeded = p3 > currentMedalSettings.maxGold;
  const b3Exceeded = b3 > currentMedalSettings.maxGold;
  const g3Exceeded = g3 > currentMedalSettings.maxGold;

  const p2Exceeded = p2 > currentMedalSettings.maxSilver;
  const b2Exceeded = b2 > currentMedalSettings.maxSilver;
  const g2Exceeded = g2 > currentMedalSettings.maxSilver;

  const p1Exceeded = p1 > currentMedalSettings.maxBronze;
  const b1Exceeded = b1 > currentMedalSettings.maxBronze;
  const g1Exceeded = g1 > currentMedalSettings.maxBronze;

  const maxGold = currentMedalSettings.maxGold ?? 1;
  const maxSilver = currentMedalSettings.maxSilver ?? 2;
  const maxBronze = currentMedalSettings.maxBronze ?? 5;

  const headerMedalsList = [];
  if (p3 > 0) headerMedalsList.push(`<span class="badge ${p3Exceeded ? 'medal-limit-exceeded' : ''}">🩷🥇 ${p3 > 1 ? p3 : ''}</span>`);
  if (b3 > 0) headerMedalsList.push(`<span class="badge ${b3Exceeded ? 'medal-limit-exceeded' : ''}">🩵🥇 ${b3 > 1 ? b3 : ''}</span>`);
  if (g3 > 0) headerMedalsList.push(`<span class="badge ${g3Exceeded ? 'medal-limit-exceeded' : ''}">🩶🥇 ${g3 > 1 ? g3 : ''}</span>`);

  if (p2 > 0) headerMedalsList.push(`<span class="badge ${p2Exceeded ? 'medal-limit-exceeded' : ''}">🩷🥈 ${p2 > 1 ? p2 : ''}</span>`);
  if (b2 > 0) headerMedalsList.push(`<span class="badge ${b2Exceeded ? 'medal-limit-exceeded' : ''}">🩵🥈 ${b2 > 1 ? b2 : ''}</span>`);
  if (g2 > 0) headerMedalsList.push(`<span class="badge ${g2Exceeded ? 'medal-limit-exceeded' : ''}">🩶🥈 ${g2 > 1 ? g2 : ''}</span>`);

  if (p1 > 0) headerMedalsList.push(`<span class="badge ${p1Exceeded ? 'medal-limit-exceeded' : ''}">🩷🥉 ${p1 > 1 ? p1 : ''}</span>`);
  if (b1 > 0) headerMedalsList.push(`<span class="badge ${b1Exceeded ? 'medal-limit-exceeded' : ''}">🩵🥉 ${b1 > 1 ? b1 : ''}</span>`);
  if (g1 > 0) headerMedalsList.push(`<span class="badge ${g1Exceeded ? 'medal-limit-exceeded' : ''}">🩶🥉 ${g1 > 1 ? g1 : ''}</span>`);

  const renderHeartCardForDetails = (mediaArray, maxLimit, heartType, heartEmoji, thumbSize) => {
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
      ? `background: rgba(16, 185, 129, 0.22); border: 2px solid #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); border-radius: var(--radius-lg); padding: 14px; flex: ${isWinner ? '1 1 100%' : '1'}; min-width: ${isWinner ? '420px' : '220px'};`
      : `background: ${baseBg}; border: 2px solid ${baseBorder}; border-radius: var(--radius-lg); padding: 14px; flex: ${isWinner ? '1 1 100%' : '1'}; min-width: ${isWinner ? '420px' : '220px'};`;

    const thumbsHTML = mediaArray.map(m => {
      const borderClass = getMediaHighestPriorityGroupBorderClass(m);
      const be = (m.blueBookEvents || []).find(e => e.dateTag === sldTag);
      const pink = be?.heartTags?.pink || 0;
      const grey = be?.heartTags?.grey || 0;
      const blue = be?.heartTags?.blue || 0;

      return `
        <div class="media-card sld-grid-card ${borderClass}" data-id="${m.id}" style="width:${dim}; height:${dim}; border-radius:12px; overflow:hidden; position:relative; display:inline-block; cursor:pointer;">
          ${renderMediaThumbnailHTML(m, '', `width:${dim}; height:${dim}; object-fit:cover; display:block;`)}
          <div class="media-card-overlay" style="padding:4px; pointer-events:none;">
            <div class="heart-toggle-group-row" style="background:rgba(0,0,0,0.75); padding:3px 6px; border-radius:8px; font-size:0.75rem; pointer-events:auto;" data-mid="${m.id}">
              ${getHeartBtnHTML('pink', pink)}
              ${getHeartBtnHTML('grey', grey)}
              ${getHeartBtnHTML('blue', blue)}
            </div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="heart-medal-section-card" style="${cardStyle}">
        <div style="font-size:0.95rem; font-weight:800; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between;">
          <span>${heartEmoji}</span>
          <span style="opacity:0.85; font-size:0.8rem; font-weight:700;">${count} files</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
          ${thumbsHTML}
        </div>
      </div>`;
  };

  container.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="backToSldListBtn" style="margin-bottom:16px;">← Back to SLD List</button>

    <div class="subject-card" style="max-width:100%; text-align:left; margin-bottom:24px;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <div>
          <h2>📘 SLD: ${sldTag}</h2>
          <p class="text-muted" style="margin-top:4px;">Total Media Files: <strong>${sldMedia.length}</strong></p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${headerMedalsList.join('')}
        </div>
      </div>
    </div>

    <!-- Tiered Medalist Section -->
    <div style="display:flex; flex-direction:column; gap:20px; width:100%; margin-bottom:32px;">
      ${(subP3.length || subB3.length || subG3.length) ? `
        <div style="background:var(--bg-card); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-color);">
          <h3 style="font-size:1.2rem; font-weight:800; color:#eab308; margin-bottom:12px;">🥇 Winners (Tier 3)</h3>
          <div style="display:flex; flex-wrap:wrap; gap:14px;">
            ${renderHeartCardForDetails(subP3, maxGold, 'pink', '🩷 Pink Winners', 'winner')}
            ${renderHeartCardForDetails(subB3, maxGold, 'blue', '🩵 Blue Winners', 'winner')}
            ${renderHeartCardForDetails(subG3, maxGold, 'grey', '🩶 Grey Winners', 'winner')}
          </div>
        </div>` : ''}

      ${(subP2.length || subB2.length || subG2.length) ? `
        <div style="background:var(--bg-card); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-color);">
          <h3 style="font-size:1.2rem; font-weight:800; color:#94a3b8; margin-bottom:12px;">🥈 Second Place (Tier 2)</h3>
          <div style="display:flex; flex-wrap:wrap; gap:14px;">
            ${renderHeartCardForDetails(subP2, maxSilver, 'pink', '🩷 Pink Second Place', 'silver')}
            ${renderHeartCardForDetails(subB2, maxSilver, 'blue', '🩵 Blue Second Place', 'silver')}
            ${renderHeartCardForDetails(subG2, maxSilver, 'grey', '🩶 Grey Second Place', 'silver')}
          </div>
        </div>` : ''}

      ${(subP1.length || subB1.length || subG1.length) ? `
        <div style="background:var(--bg-card); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-color);">
          <h3 style="font-size:1.2rem; font-weight:800; color:#cd7f32; margin-bottom:12px;">🥉 Third Place (Tier 1)</h3>
          <div style="display:flex; flex-wrap:wrap; gap:14px;">
            ${renderHeartCardForDetails(subP1, maxBronze, 'pink', '🩷 Pink Third Place', 'bronze')}
            ${renderHeartCardForDetails(subB1, maxBronze, 'blue', '🩵 Blue Third Place', 'bronze')}
            ${renderHeartCardForDetails(subG1, maxBronze, 'grey', '🩶 Grey Third Place', 'bronze')}
          </div>
        </div>` : ''}
    </div>

    ${noHeartMedia.length > 0 ? `
      <div style="background:var(--bg-card); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-color); margin-bottom:32px;">
        <h3 style="font-size:1.2rem; font-weight:800; margin-bottom:12px;">⚪ Unmedaled Media (${noHeartMedia.length})</h3>
        <div class="media-grid">
          ${noHeartMedia.map(m => `
            <div class="media-card sld-grid-card ${getMediaHighestPriorityGroupBorderClass(m)}" data-id="${m.id}">
              ${renderMediaThumbnailHTML(m)}
            </div>`).join('')}
        </div>
      </div>` : ''}`;

  document.getElementById('backToSldListBtn').onclick = () => switchView('sldView');

  container.querySelectorAll('.sld-grid-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.heart-toggle-btn')) return;
      openLightboxById(card.getAttribute('data-id'));
    };
  });

  container.querySelectorAll('.heart-toggle-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const cardRow = btn.closest('.heart-toggle-group-row');
      const mId = cardRow.getAttribute('data-mid');
      const type = btn.getAttribute('data-type');
      const media = currentMediaList.find(m => m.id === mId);

      if (media) {
        const be = (media.blueBookEvents || []).find(x => x.dateTag === sldTag);
        if (be) {
          if (!be.heartTags) be.heartTags = { pink: 0, grey: 0, blue: 0 };
          be.heartTags[type] = ((be.heartTags[type] || 0) + 1) % 4;
          await db.put('media', media);
          renderSldDetailsPage();
        }
      }
    };
  });
}

window.renderSldDetailsPage = renderSldDetailsPage;
