/**
 * Combination Details Page Subsystem
 */

function renderCombinationDetailsPage(stats) {
  const container = document.getElementById('combinationDetailsContent');
  const comboKeyParts = (activeDetailComboKey || '').split('::');
  const combo = stats.allCombinations.find(c => {
    const ids = c.subjectIds || [c.subjectId1, c.subjectId2];
    return ids.length === comboKeyParts.length && comboKeyParts.every(id => ids.includes(id));
  }) || stats.allCombinations.find(c => `${c.subjectId1}::${c.subjectId2}` === activeDetailComboKey);

  if (!combo) return;
  const subIds = combo.subjectIds || [combo.subjectId1, combo.subjectId2];
  let sharedMedia = currentMediaList.filter(m => subIds.every(sId => m.subjectTags?.includes(sId)));
  if (aiFilterMode === 'ai_only') {
    sharedMedia = sharedMedia.filter(m => m.isAiGenerated || (m.normalTags || []).includes('AI'));
  } else if (aiFilterMode === 'human_only') {
    sharedMedia = sharedMedia.filter(m => !m.isAiGenerated && !(m.normalTags || []).includes('AI'));
  }

  container.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="backToSubjectsComboBtn" style="margin-bottom:16px;">← Back to Subjects</button>
    <div class="subject-card" style="max-width:100%; text-align:left;">
      <h2>Combination: ${combo.name}</h2>
      <p style="margin-top:8px;">Combined Score: <strong style="color:var(--accent-blue);">${combo.totalPoints} pts</strong></p>
    </div>

    <div style="margin:20px 0; background:var(--bg-card); padding:16px; border-radius:var(--radius-lg); border:1px solid var(--border-color);">
      <h4 style="margin-bottom:8px;">➕ Create Event for ${combo.name}</h4>
      <div class="date-autocomplete-container" style="max-width:300px;">
        <input type="text" id="comboPageEventDateInput" class="input-text btn-sm" placeholder="Event Date (Enter)..." style="width:100%;">
        <div id="comboPageEventDateAutocomplete" class="date-autocomplete-dropdown"></div>
      </div>
    </div>

    <h3 style="margin:24px 0 12px 0;">Shared Media Gallery (${sharedMedia.length})</h3>
    <div class="media-grid">
      ${sharedMedia.map(m => `<div class="media-card combo-detail-media ${getMediaHighestPriorityGroupBorderClass(m)}" data-id="${m.id}">${renderMediaThumbnailHTML(m)}</div>`).join('')}
    </div>`;

  document.getElementById('backToSubjectsComboBtn').onclick = () => switchView('subjectsView');
  setupSmartDateAutocomplete('comboPageEventDateInput', 'comboPageEventDateAutocomplete');
  document.getElementById('comboPageEventDateInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const rawDate = e.target.value;
      const parsedDate = parseSmartDateInput(rawDate);
      openEventCreationWizard(parsedDate, [combo.subjectId1, combo.subjectId2]);
    }
  });

  container.querySelectorAll('.combo-detail-media').forEach(card => {
    card.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const mediaId = card.getAttribute('data-id');
      if (mediaId) openLightboxById(mediaId, false, { type: 'combo', key: activeDetailComboKey, name: combo.name });
    };
  });
}

window.renderCombinationDetailsPage = renderCombinationDetailsPage;
