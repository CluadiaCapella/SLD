/**
 * Lightbox Tagging & Metadata Panels Subsystem
 */

function renderLightboxSubjects(media) {
  const container = document.getElementById('lbSubjectsContainer');
  const assignedSubIds = media.subjectTags || [];

  container.innerHTML = assignedSubIds.map(subId => {
    const sub = currentSubjectsList.find(s => s.id === subId);
    return `
      <span class="subject-tag-pill nav-sub-pill" data-subid="${subId}" style="font-size:0.85rem; padding:4px 10px;">
        ${getSubjectDisplayName(sub)}
        <span style="cursor:pointer; font-weight:bold; margin-left:4px;" class="remove-lb-sub" data-subid="${subId}">✖</span>
      </span>`;
  }).join('');

  container.querySelectorAll('.nav-sub-pill').forEach(pill => {
    pill.onclick = (e) => {
      if (!e.target.classList.contains('remove-lb-sub')) {
        closeLightbox();
        activeDetailSubjectId = pill.getAttribute('data-subid');
        switchView('subjectDetailsView');
      }
    };
  });

  container.querySelectorAll('.remove-lb-sub').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const remId = btn.getAttribute('data-subid');
      media.subjectTags = (media.subjectTags || []).filter(id => id !== remId);
      await db.put('media', media);
      renderLightboxContent();
      renderCurrentView();
    };
  });
}

function renderLightboxBlueEvents(media) {
  const listEl = document.getElementById('lbBlueEventsList');
  const events = media.blueBookEvents || [];

  if (events.length === 0) {
    listEl.innerHTML = `<p class="text-muted" style="font-size:0.85rem;">No SLDs attached.</p>`;
    return;
  }

  listEl.innerHTML = events.map((be, beIdx) => {
    const pink = be.heartTags?.pink || 0;
    const grey = be.heartTags?.grey || 0;
    const blue = be.heartTags?.blue || 0;

    return `
      <div class="blue-event-card">
        <div class="blue-event-card-header">
          <span class="subject-tag-pill nav-sld-pill" data-tag="${be.dateTag}">
            ${be.dateTag}
            <span style="cursor:pointer; font-weight:bold; margin-left:4px;" class="remove-be-btn" data-beidx="${beIdx}">✖</span>
          </span>
        </div>
        <div class="heart-toggle-group-row">
          ${getHeartBtnHTML('pink', pink)}
          ${getHeartBtnHTML('grey', grey)}
          ${getHeartBtnHTML('blue', blue)}
        </div>
      </div>`;
  }).join('');

  listEl.querySelectorAll('.nav-sld-pill').forEach(pill => {
    pill.onclick = (e) => {
      if (!e.target.classList.contains('remove-be-btn')) {
        closeLightbox();
        activeDetailSldTag = pill.getAttribute('data-tag');
        switchView('sldDetailsView');
      }
    };
  });

  listEl.querySelectorAll('.heart-toggle-btn').forEach((btn) => {
    btn.onclick = async () => {
      const beCard = btn.closest('.blue-event-card');
      const beIdx = Array.from(listEl.querySelectorAll('.blue-event-card')).indexOf(beCard);
      const type = btn.getAttribute('data-type');
      const be = media.blueBookEvents[beIdx];
      if (be) {
        if (!be.heartTags) be.heartTags = { pink: 0, grey: 0, blue: 0 };
        be.heartTags[type] = ((be.heartTags[type] || 0) + 1) % 4;
        await db.put('media', media);
        renderLightboxContent();
        renderCurrentView();
      }
    };
  });

  listEl.querySelectorAll('.remove-be-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const beIdx = parseInt(btn.getAttribute('data-beidx'), 10);
      media.blueBookEvents.splice(beIdx, 1);
      await db.put('media', media);
      renderLightboxContent();
      renderCurrentView();
    };
  });
}

function renderLightboxEvents(media) {
  const container = document.getElementById('lbEventsContainer');
  const select = document.getElementById('lbEventSelect');

  const assignedEvtIds = media.eventIds || [];
  container.innerHTML = assignedEvtIds.map(evtId => {
    const evt = currentEventsList.find(e => e.id === evtId);
    const actionCode = evt ? (evt.eventCode || 1) : 1;
    return `
      <span class="badge action-tag-${actionCode} nav-tag-pill" data-tag="${getActionName(actionCode)}" style="margin-right:6px; margin-bottom:6px; cursor:pointer;">
        📙 ${evt ? (evt.dateTag || 'Event') : evtId} (${getActionDisplayName(actionCode)})
        <span class="remove-lb-evt" data-evtid="${evtId}" style="margin-left:4px;">✖</span>
      </span>`;
  }).join('');

  container.querySelectorAll('.nav-tag-pill').forEach(pill => {
    pill.onclick = (e) => {
      if (!e.target.classList.contains('remove-lb-evt')) {
        closeLightbox();
        activeDetailTagName = pill.getAttribute('data-tag');
        switchView('tagDetailsView');
      }
    };
  });

  container.querySelectorAll('.remove-lb-evt').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const remId = btn.getAttribute('data-evtid');
      media.eventIds = (media.eventIds || []).filter(id => id !== remId);
      await db.put('media', media);
      renderLightboxContent();
      renderCurrentView();
    };
  });

  const unassigned = currentEventsList.filter(e => !assignedEvtIds.includes(e.id));
  select.innerHTML = `<option value="">+ Assign Event...</option>` + unassigned.map(e => {
    const subs = Object.keys(e.subjectCounts || {}).map(sId => getSubjectDisplayName(currentSubjectsList.find(s => s.id === sId))).join(', ');
    return `<option value="${e.id}">📙 ${e.dateTag || 'Event'} (${subs})</option>`;
  }).join('');

  select.onchange = async () => {
    if (select.value) {
      media.eventIds = media.eventIds || [];
      if (!media.eventIds.includes(select.value)) {
        media.eventIds.push(select.value);
        await db.put('media', media);
        renderLightboxContent();
        renderCurrentView();
      }
    }
  };
}

function renderLightboxNormalTags(media) {
  const container = document.getElementById('lbNormalTagsContainer');
  const tags = media.normalTags || [];

  container.innerHTML = tags.map(t => `
    <span class="tag-chip-bubble nav-tag-pill" data-tag="${t}">
      🏷️ ${t}
      <span class="tag-chip-remove remove-lb-tag" data-tag="${t}">✖</span>
    </span>`).join('');

  container.querySelectorAll('.nav-tag-pill').forEach(pill => {
    pill.onclick = (e) => {
      if (!e.target.classList.contains('remove-lb-tag')) {
        closeLightbox();
        activeDetailTagName = pill.getAttribute('data-tag');
        switchView('tagDetailsView');
      }
    };
  });

  container.querySelectorAll('.remove-lb-tag').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const remTag = btn.getAttribute('data-tag');
      media.normalTags = (media.normalTags || []).filter(t => t !== remTag);
      await db.put('media', media);
      renderLightboxContent();
      renderCurrentView();
    };
  });
}

function renderLightboxRatings(media) {
  const controls = document.getElementById('lbRatingControls');
  const badgeInfo = document.getElementById('lbRatingBadgeInfo');
  if (!controls || !media) return;

  const currentRating = calculateMediaStarRating(media);
  const hasOverride = media.userRating !== undefined && media.userRating !== null && media.userRating !== '';

  controls.querySelectorAll('.rating-override-btn').forEach(btn => {
    const rVal = btn.getAttribute('data-rating');
    let isActive = false;
    if (rVal === 'auto') {
      isActive = !hasOverride;
    } else {
      isActive = hasOverride && Number(rVal) === Number(media.userRating);
    }
    if (isActive) {
      btn.classList.add('active');
      btn.style.background = rVal === '-1' ? '#ef4444' : 'var(--accent-pink)';
      btn.style.color = '#fff';
      btn.style.fontWeight = '800';
    } else {
      btn.classList.remove('active');
      btn.style.background = '';
      btn.style.color = '';
      btn.style.fontWeight = '';
    }

    btn.onclick = async (e) => {
      e.stopPropagation();
      if (rVal === 'auto') {
        delete media.userRating;
      } else {
        media.userRating = Number(rVal);
      }
      await db.put('media', media);
      renderLightboxRatings(media);
      renderCurrentView();
    };
  });

  if (badgeInfo) {
    badgeInfo.textContent = `Current Rating: ${getStarRatingLabel(currentRating)} ${hasOverride ? '(User Override)' : '(Auto Calculated)'}`;
  }
}

function updateFloatingHeartOverlayUI(media) {
  const be = (media.blueBookEvents || [])[0];
  const pink = be?.heartTags?.pink || 0;
  const grey = be?.heartTags?.grey || 0;
  const blue = be?.heartTags?.blue || 0;

  const flPink = document.getElementById('flPinkBtn');
  const flGrey = document.getElementById('flGreyBtn');
  const flBlue = document.getElementById('flBlueBtn');

  if (flPink) flPink.outerHTML = getHeartBtnHTML('pink', pink).replace('class="heart-toggle-btn btn-sm', 'id="flPinkBtn" class="heart-toggle-btn btn-sm');
  if (flGrey) flGrey.outerHTML = getHeartBtnHTML('grey', grey).replace('class="heart-toggle-btn btn-sm', 'id="flGreyBtn" class="heart-toggle-btn btn-sm');
  if (flBlue) flBlue.outerHTML = getHeartBtnHTML('blue', blue).replace('class="heart-toggle-btn btn-sm', 'id="flBlueBtn" class="heart-toggle-btn btn-sm');

  setupFloatingHeartOverlayListeners();
}

function setupFloatingHeartOverlayListeners() {
  ['flPinkBtn', 'flGreyBtn', 'flBlueBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = async (e) => {
        e.stopPropagation();
        if (lightboxIndex >= 0 && lightboxIndex < currentMediaList.length) {
          const media = currentMediaList[lightboxIndex];
          if (!media.blueBookEvents || media.blueBookEvents.length === 0) {
            media.blueBookEvents = [{ id: 'sld-' + Date.now(), dateTag: getTodaySmartDateTag(), heartTags: { pink: 0, grey: 0, blue: 0 } }];
          }
          const be = media.blueBookEvents[0];
          const type = id === 'flPinkBtn' ? 'pink' : id === 'flGreyBtn' ? 'grey' : 'blue';
          if (!be.heartTags) be.heartTags = { pink: 0, grey: 0, blue: 0 };
          be.heartTags[type] = ((be.heartTags[type] || 0) + 1) % 4;

          await db.put('media', media);
          renderLightboxContent();
          renderCurrentView();
        }
      };
    }
  });
}

window.renderLightboxSubjects = renderLightboxSubjects;
window.renderLightboxBlueEvents = renderLightboxBlueEvents;
window.renderLightboxEvents = renderLightboxEvents;
window.renderLightboxNormalTags = renderLightboxNormalTags;
window.renderLightboxRatings = renderLightboxRatings;
window.updateFloatingHeartOverlayUI = updateFloatingHeartOverlayUI;
window.setupFloatingHeartOverlayListeners = setupFloatingHeartOverlayListeners;
