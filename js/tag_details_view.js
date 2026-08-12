/**
 * Tag Details Page Subsystem
 */

function renderTagDetailsPage() {
  const container = document.getElementById('tagDetailsContent');
  if (!activeDetailTagName) { switchView('tagsView'); return; }

  const tagName = activeDetailTagName;
  let isActionTag = false;
  let actionCode = null;

  for (let i = 1; i <= 12; i++) {
    if (tagName === getActionDisplayName(i) || tagName === getActionName(i) || tagName === `Action ${i}`) {
      isActionTag = true;
      actionCode = i;
      break;
    }
  }

  let taggedMedia = [];
  if (isActionTag) {
    const matchingEvents = currentEventsList.filter(e => (e.eventCode || 1) === actionCode);
    const evtIds = matchingEvents.map(e => e.id);
    taggedMedia = currentMediaList.filter(m => (m.eventIds || []).some(id => evtIds.includes(id)));
  } else {
    taggedMedia = currentMediaList.filter(m => (m.normalTags || []).includes(tagName));
  }

  let subjectsSection = '';
  if (isActionTag) {
    const matchingEvents = currentEventsList.filter(e => (e.eventCode || 1) === actionCode);
    const subCounts = new Map();
    matchingEvents.forEach(e => {
      Object.keys(e.subjectCounts || {}).forEach(sId => {
        subCounts.set(sId, (subCounts.get(sId) || 0) + 1);
      });
    });

    const subEntries = Array.from(subCounts.entries()).map(([sId, count]) => {
      const sub = currentSubjectsList.find(s => s.id === sId);
      return { sub, count };
    });

    subjectsSection = `
      <h3 style="margin:24px 0 12px 0;">Associated Subjects (${subEntries.length})</h3>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        ${subEntries.length > 0 ? subEntries.map(e => `
          <div class="profile-pill nav-sub-pill" data-subid="${e.sub?.id}">
            <span>👤 ${getSubjectDisplayName(e.sub)} (${e.count} events)</span>
          </div>`).join('') : '<p class="text-muted">No subjects recorded for this action tag.</p>'}
      </div>`;
  }

  container.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="backToTagsListBtn" style="margin-bottom:16px;">← Back to Tags</button>
    <div class="subject-card" style="max-width:100%; text-align:left;">
      <h2>🏷️ Tag: ${tagName}</h2>
      <p class="text-muted" style="margin-top:4px;">Tagged Media Files: <strong>${taggedMedia.length}</strong></p>
    </div>

    ${subjectsSection}

    <h3 style="margin:24px 0 12px 0;">Tagged Media Gallery (${taggedMedia.length})</h3>
    <div class="media-grid">
      ${taggedMedia.map(m => `<div class="media-card tag-detail-media ${getMediaHighestPriorityGroupBorderClass(m)}" data-id="${m.id}">${renderMediaThumbnailHTML(m)}</div>`).join('')}
    </div>`;

  document.getElementById('backToTagsListBtn').onclick = () => switchView('tagsView');

  container.querySelectorAll('.nav-sub-pill').forEach(pill => {
    pill.onclick = () => {
      activeDetailSubjectId = pill.getAttribute('data-subid');
      switchView('subjectDetailsView');
    };
  });

  container.querySelectorAll('.tag-detail-media').forEach(card => {
    card.onclick = () => {
      openLightboxById(card.getAttribute('data-id'));
    };
  });
}

window.renderTagDetailsPage = renderTagDetailsPage;
