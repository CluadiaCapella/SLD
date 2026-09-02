/**
 * Dedicated Event Details Subsystem
 */

function openEventCoverPickerModal(evtId) {
  const evt = currentEventsList.find(item => item.id === evtId);
  if (!evt) return;
  const assignedMedia = currentMediaList.filter(m => (m.eventIds || []).includes(evt.id));
  const countsMap = new Map(Object.entries(evt.subjectCounts || {}));
  const participantSubIds = Array.from(countsMap.keys());
  const modal = document.getElementById('eventThumbPickerModal');
  if (!modal) return;

  // 1. Zodiac Action Emoji Cover (Default Auto-Generated Cover)
  const actionName = getActionDisplayName(evt.eventCode || 1);
  const actionEmoji = actionName.split(' ')[0] || '♏';
  const actionOptEl = document.getElementById('eventCoverActionOption');
  if (actionOptEl) {
    const isSel = !evt.coverType || evt.coverType === 'action';
    actionOptEl.innerHTML = `
      <button class="btn btn-secondary btn-sm" id="setCoverActionBtn" style="font-size:0.85rem; font-weight:800; display:flex; align-items:center; gap:8px; width:100%; justify-content:center; ${isSel ? 'border:2px solid var(--accent-pink); background:rgba(236,72,153,0.15);' : ''}">
        <span style="font-size:1.4rem;">${actionEmoji}</span> Reset to ${actionName} Emoji (Default Auto-Generated)
      </button>`;
    document.getElementById('setCoverActionBtn').onclick = async () => {
      evt.coverType = 'action';
      delete evt.coverSubjectId;
      delete evt.customCoverMediaId;
      await db.put('events', evt);
      modal.classList.remove('active');
      modal.style.display = 'none';
      await loadAppState();
      renderCurrentView();
    };
  }

  // 2. Subject Avatar Cover Options
  const subGrid = document.getElementById('eventCoverSubjectGrid');
  if (subGrid) {
    const subjectsToShow = participantSubIds.map(sId => currentSubjectsList.find(s => s.id === sId)).filter(Boolean);
    if (subjectsToShow.length === 0) {
      subGrid.innerHTML = `<span class="text-muted" style="font-size:0.8rem;">No subjects assigned to this event.</span>`;
    } else {
      subGrid.innerHTML = subjectsToShow.map(sub => {
        const isSel = evt.coverType === 'subject' && evt.coverSubjectId === sub.id;
        return `
          <div class="evt-cover-sub-card" data-subid="${sub.id}" style="display:flex; flex-direction:column; align-items:center; padding:8px 12px; background:var(--bg-card); border:2px solid ${isSel ? 'var(--accent-pink)' : 'var(--border-color)'}; border-radius:var(--radius-md); cursor:pointer; width:100px;">
            ${sub.avatarUrl ? `<img src="${sub.avatarUrl}" style="width:48px; height:48px; border-radius:50%; object-fit:cover; margin-bottom:4px;">` : `<div style="width:48px; height:48px; border-radius:50%; background:var(--bg-secondary); display:flex; align-items:center; justify-content:center; font-size:20px; margin-bottom:4px;">👤</div>`}
            <span style="font-size:0.75rem; font-weight:700; text-align:center; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; width:100%;">${sub.name}</span>
          </div>`;
      }).join('');

      subGrid.querySelectorAll('.evt-cover-sub-card').forEach(card => {
        card.onclick = async () => {
          const subId = card.getAttribute('data-subid');
          evt.coverType = 'subject';
          evt.coverSubjectId = subId;
          delete evt.customCoverMediaId;
          await db.put('events', evt);
          modal.classList.remove('active');
          modal.style.display = 'none';
          await loadAppState();
          renderCurrentView();
        };
      });
    }
  }

  // 3. Media Thumbnail Cover Options
  const grid = document.getElementById('eventThumbPickerGrid');
  if (grid) {
    if (assignedMedia.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">No media files attached to this event yet.</div>`;
    } else {
      grid.innerHTML = assignedMedia.map(m => {
        const isSel = (evt.coverType === 'media' && evt.coverTargetId === m.id) || evt.customCoverMediaId === m.id;
        return `
          <div class="media-card evt-cover-choice-card" data-mid="${m.id}" style="width:110px; height:110px; cursor:pointer; border-radius:var(--radius-md); overflow:hidden; border:2px solid ${isSel ? 'var(--accent-pink)' : 'var(--border-color)'};">
            ${renderMediaThumbnailHTML(m, '', 'width:100%; height:100%; object-fit:cover;')}
          </div>`;
      }).join('');

      grid.querySelectorAll('.evt-cover-choice-card').forEach(card => {
        card.onclick = async () => {
          const mId = card.getAttribute('data-mid');
          evt.coverType = 'media';
          evt.customCoverMediaId = mId;
          delete evt.coverSubjectId;
          await db.put('events', evt);
          modal.classList.remove('active');
          modal.style.display = 'none';
          await loadAppState();
          renderCurrentView();
        };
      });
    }
  }

  document.getElementById('closeEventThumbPickerBtn').onclick = () => {
    modal.classList.remove('active');
    modal.style.display = 'none';
  };

  modal.classList.add('active');
  modal.style.display = 'flex';
}

function renderEventDetailsPage(stats) {
  const container = document.getElementById('eventDetailsPageContent');
  if (!activeDetailEventId) { switchView('eventsView'); return; }

  const evt = currentEventsList.find(e => e.id === activeDetailEventId);
  if (!evt) return;

  let actionCode = evt.eventCode || 1;
  const assignedMedia = currentMediaList.filter(m => (m.eventIds || []).includes(evt.id));
  const countsMap = new Map(Object.entries(evt.subjectCounts || {}));
  const participantSubIds = Array.from(countsMap.keys());

  let participantsCardsHTML = Array.from(countsMap.entries()).map(([subId, count]) => {
    const sub = currentSubjectsList.find(s => s.id === subId);
    const taggedMedia = currentMediaList.filter(m => m.subjectTags?.includes(subId));
    const avatarSrc = sub?.avatarUrl;
    const borderClass = getSubjectGroup(sub?.groupId)?.cssClass || '';
    const actionPts = currentActionPointsMap[actionCode] || 0.1;
    const genderSymbol = sub?.gender === 'Male' ? '♂️' : sub?.gender === 'NB' ? '⚧️' : '♀️';
    const isPrimary = (evt.primarySubjectId === subId) || (!evt.primarySubjectId && participantSubIds[0] === subId);

    const avatarContainerStyle = "width:75%; height:75%; aspect-ratio:1/1; overflow:hidden; display:flex; align-items:center; justify-content:center; margin-bottom:8px;";

    let avatarElementHTML = avatarSrc ? `
      <div class="${borderClass}" style="${avatarContainerStyle}">
        <img src="${avatarSrc}" style="width:100%; height:100%;" alt="${sub?.name}">
      </div>` 
      : taggedMedia[0] ? `
      <div class="${borderClass}" style="${avatarContainerStyle}">
        ${renderMediaThumbnailHTML(taggedMedia[0], '', 'width:100%; height:100%;')}
      </div>` 
      : `
      <div class="${borderClass}" style="${avatarContainerStyle} background:var(--bg-secondary);">
        <span style="font-size:70px;">👤</span>
      </div>`;

    return `
      <div id="eventParticipantCard-${subId}" class="subject-card evt-participant-card ${borderClass}" data-subid="${subId}" style="width:190px; padding:14px; display:flex; flex-direction:column; align-items:center; text-align:center; background:var(--bg-secondary); border-radius:var(--radius-lg); border:1px solid var(--border-color); cursor:pointer;" title="Click to view Subject Profile">
        ${avatarElementHTML}
        <div style="font-weight:800; font-size:1.05rem; margin-bottom:4px; color:var(--text-primary); display:flex; align-items:center; gap:4px; z-index:10;">
          <span>${genderSymbol}</span> ${getSubjectDisplayName(sub)}
        </div>
        
        <div style="margin-bottom:auto; font-size:0.65rem; display:flex; flex-direction:column; align-items:center; gap:6px; width:100%;">
          <div class="" data-subid="${subId}" style="font-weight:800; color:var(--accent-pink); font-size:0.95rem; cursor:pointer; background:rgba(255,105,180,0.2); padding:0px 0px; border-radius:12px; border:1px solid var(--accent-pink); width:98%; box-sizing:border-box; z-index:1;" title="💦 Count">
            <button class="btn btn-secondary btn-sm evt-sub-inc" data-subid="${subId}" title="Increase 💦 Count">➕</button>
            <strong>${count}💦 </strong>
            <button class="btn btn-secondary btn-sm evt-sub-dec" data-subid="${subId}" title="Decrease 💦 Count">➖</button>
          </div>
          <button class="btn btn-sm make-primary-sub-btn" data-subid="${subId}" style="margin-top:4px; font-size:0.7rem; padding:2px 8px; font-weight:700; background:${isPrimary ? 'rgba(234,179,8,0.25)' : 'var(--bg-tertiary)'}; color:${isPrimary ? '#eab308' : 'var(--text-muted)'}; border:1px solid ${isPrimary ? '#eab308' : 'var(--border-color)'}; border-radius:10px;">${isPrimary ? '⭐ Primary Subject' : '☆ Make Primary'}</button>
          <div style="position:absolute; top:8px; left:8px; z-index:10; font-weight:700; color:#38bdf8; font-size:0.75rem; background:rgba(0,0,0,0.75); border:1px solid #38bdf8; padding:2px 6px; border-radius:8px; backdrop-filter:blur(4px);">
          ⚡ ${(count * actionPts).toFixed(1)}
          </div>
          <button class="btn btn-danger btn-sm remove-evt-sub" data-subid="${subId}" title="Remove Participant" style="position:absolute; top:8px; right:8px; z-index:10; padding:2px 6px; font-size:0.7rem; line-height:1; border-radius:6px;">✖</button>
        </div>
      </div>`;
  }).join('');

  let combosHTML = '';
  if (participantSubIds.length >= 2) {
    const comboPairs = [];
    for (let i = 0; i < participantSubIds.length; i++) {
      for (let j = i + 1; j < participantSubIds.length; j++) {
        const s1Id = participantSubIds[i];
        const s2Id = participantSubIds[j];
        const sub1 = currentSubjectsList.find(s => s.id === s1Id);
        const sub2 = currentSubjectsList.find(s => s.id === s2Id);
        if (sub1 && sub2) {
          const comboKey = [s1Id, s2Id].sort().join('::');
          const comboStats = (stats?.allCombinations || []).find(c => c.comboKey === comboKey || (c.subjectIds && c.subjectIds.sort().join('::') === comboKey));
          comboPairs.push({ sub1, sub2, comboKey, comboStats });
        }
      }
    }

    combosHTML = comboPairs.map(cp => {
      const isFirstMet = cp.comboStats?.firstMet?.eventId === evt.id || (stats?.firstMetMap?.get(cp.comboKey)?.eventId === evt.id);
      return `
      <div id="eventComboCard-${cp.comboKey}" class="subject-card evt-combo-card" data-key="${cp.comboKey}" style="position:relative; width:210px; padding:12px; display:flex; flex-direction:column; align-items:center; text-align:center; background:var(--bg-secondary); border-radius:var(--radius-lg); border:1px solid var(--border-color); cursor:pointer;" title="Click to view Combo details">
        ${isFirstMet ? `<div style="position:absolute; top:-8px; right:6px; background:#f43f5e; color:#fff; font-weight:800; font-size:0.68rem; padding:2px 6px; border-radius:10px; box-shadow:var(--shadow-sm); z-index:2;">🚩 FIRST MET</div>` : ''}
        <div style="display:flex; align-items:center; gap:-8px; margin-bottom:8px;">
          ${cp.sub1.avatarUrl ? `<img src="${cp.sub1.avatarUrl}" style="width:42px; height:42px; border-radius:50%; object-fit:cover; border:2px solid var(--accent-pink);">` : `<div style="width:42px; height:42px; border-radius:50%; background:var(--bg-card); display:flex; align-items:center; justify-content:center; font-size:18px; border:2px solid var(--accent-pink);">👤</div>`}
          ${cp.sub2.avatarUrl ? `<img src="${cp.sub2.avatarUrl}" style="width:42px; height:42px; border-radius:50%; object-fit:cover; border:2px solid var(--accent-blue); margin-left:-12px;">` : `<div style="width:42px; height:42px; border-radius:50%; background:var(--bg-card); display:flex; align-items:center; justify-content:center; font-size:18px; border:2px solid var(--accent-blue); margin-left:-12px;">👤</div>`}
        </div>
        <div style="font-weight:700; font-size:0.9rem; margin-bottom:4px;">🫂 ${getSubjectDisplayName(cp.sub1)} & ${getSubjectDisplayName(cp.sub2)}</div>
        <div style="font-size:0.8rem; font-weight:700; color:var(--accent-pink);">⚡ Combo Pts: <strong>${(cp.comboStats?.totalPoints || 0).toFixed(1)}</strong></div>
        ${cp.comboStats?.firstMet?.dateTag ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">🚩 First Met: ${formatColoredDateTag(cp.comboStats.firstMet.dateTag)}</div>` : ''}
      </div>`;
    }).join('');
  }

  function parseEventDateObj(dateTag) {
    if (!dateTag) return null;
    if (/^\d{3,4}$/.test(dateTag)) {
      const m = parseInt(dateTag.substring(0, dateTag.length - 2), 10);
      const d = parseInt(dateTag.substring(dateTag.length - 2), 10);
      const y = new Date().getFullYear();
      return new Date(y, m - 1, d);
    }
    const parsed = Date.parse(dateTag);
    return isNaN(parsed) ? null : new Date(parsed);
  }

  const currentEvtDate = parseEventDateObj(evt.dateTag);
  const nearbyEvents = [];
  if (currentEvtDate) {
    currentEventsList.forEach(otherEvt => {
      if (otherEvt.id === evt.id) return;
      const otherDate = parseEventDateObj(otherEvt.dateTag);
      if (!otherDate) return;
      const diffDays = Math.round((otherDate.getTime() - currentEvtDate.getTime()) / (1000 * 3600 * 24));
      if (Math.abs(diffDays) <= 7) {
        const otherCounts = otherEvt.subjectCounts || {};
        const sharedSubIds = participantSubIds.filter(sId => otherCounts[sId] > 0);
        if (sharedSubIds.length > 0) {
          const otherMedia = currentMediaList.find(m => (m.eventIds || []).includes(otherEvt.id));
          nearbyEvents.push({ evt: otherEvt, diffDays, sharedSubIds, otherCounts, thumbMedia: otherMedia });
        }
      }
    });
    nearbyEvents.sort((a, b) => a.diffDays - b.diffDays);
  }

  let nearbyEventsHTML = nearbyEvents.map(item => {
    const diffLabel = item.diffDays === 0 ? 'Same Day' : item.diffDays > 0 ? `+${item.diffDays}d after` : `${item.diffDays}d before`;
    const sharedPills = item.sharedSubIds.map(sId => {
      const sub = currentSubjectsList.find(s => s.id === sId);
      const c = item.otherCounts[sId];
      return `<span style="background:rgba(255,105,180,0.15); border:1px solid var(--accent-pink); padding:2px 6px; border-radius:10px; font-size:0.75rem; font-weight:700; margin:2px;">👤 ${getSubjectDisplayName(sub)} 💦${c}</span>`;
    }).join('');

    const mediaThumbHTML = item.thumbMedia ? renderMediaThumbnailHTML(item.thumbMedia, 'nearby-evt-thumb') : `<div style="width:100%; height:70px; background:var(--bg-primary); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:center; font-size:24px;">📙</div>`;

    return `
      <div id="eventNearbyCard-${item.evt.id}" class="subject-card nearby-evt-card" data-evtid="${item.evt.id}" style="width:210px; padding:12px; background:var(--bg-secondary); border-radius:var(--radius-lg); border:1px solid var(--border-color); cursor:pointer; display:flex; flex-direction:column; gap:6px;" title="Click to view Event details">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; font-weight:800;">
          <span style="color:var(--accent-pink);">📙 ${item.evt.dateTag}</span>
          <span style="background:rgba(56,189,248,0.2); color:#38bdf8; padding:2px 6px; border-radius:8px;">${diffLabel}</span>
        </div>
        <div style="width:100%; height:80px; overflow:hidden; border-radius:var(--radius-md);">
          ${mediaThumbHTML}
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:2px; margin-top:auto;">
          ${sharedPills}
        </div>
      </div>`;
  }).join('');

  const totalEventSldCount = Array.from(countsMap.values()).reduce((sum, val) => sum + (val || 0), 0);

  populateWhereDatalists();

  container.innerHTML = `
    <div id="eventDetailsHeaderSection" style="margin-bottom:12px;">
      <button class="btn btn-secondary btn-sm" id="backToEventsListBtn" style="margin-bottom:10px;">← Back to Events List</button>
    </div>

    <div id="eventHeaderCard" class="subject-card action-tag-${actionCode}" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:nowrap; gap:12px; width:100%; box-sizing:border-box; padding:6px 14px; max-height:10vh; border-radius:var(--radius-lg); color:#fff; box-shadow:var(--shadow-md); margin-bottom:16px;">
      <div>
        <h1 id="eventTitleHeading" style="font-size:1.2rem; font-weight:800; margin:0; line-height:1.2;">📙 ${formatColoredDateTag(evt.dateTag || 'Event Details')}</h1>
        <div id="eventActionPointsInfo" style="margin-top:2px; font-size:0.85rem; font-weight:700; opacity:0.9;">⚡ Action: ${getActionDisplayName(actionCode)} (Pts: ${currentActionPointsMap[actionCode] || 0.1}) | Total 💦: <span class="badge" style="background:rgba(255,105,180,0.3); color:#fff; border:1px solid #fff; font-weight:800; font-size:0.85rem; padding:2px 8px; border-radius:12px;">💦 ${totalEventSldCount}</span></div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn btn-secondary btn-sm" id="pickCoverPageEventBtn">🖼️ Cover</button>
        <button class="btn btn-secondary btn-sm" id="redatePageEventBtn">📅 Redate Event</button>
        <button class="btn btn-danger btn-sm" id="deletePageEventBtn">🗑️ Delete Event</button>
      </div>
    </div>

    <div id="eventParticipantsSection" style="background:var(--bg-card); padding:16px 20px; border-radius:var(--radius-lg); border:1px solid var(--border-color); margin-bottom:16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:14px;">
        <h3>👤 Event Participants (${countsMap.size})</h3>
        <div class="subject-autocomplete-container" style="min-width:260px;">
          <input type="text" id="evtDetailSubInput" class="input-text btn-sm" placeholder="+ Search / add participant..." style="width:100%;">
          <div id="evtDetailSubAutocomplete" class="subject-autocomplete-dropdown"></div>
        </div>
      </div>

      <div id="eventParticipantsGrid" style="display:flex; flex-wrap:wrap; gap:14px; align-items:stretch;">
        ${participantsCardsHTML || '<p class="text-muted" style="font-size:0.85rem;">No participants added yet.</p>'}
      </div>
    </div>

    <div id="eventWhereSection" style="background:var(--bg-card); padding:16px 20px; border-radius:var(--radius-lg); border:1px solid var(--border-color); margin-bottom:16px;">
      <h3 style="margin-bottom:6px;">📍 Where Location Tags</h3>
      <p class="text-muted" style="font-size:0.85rem; margin-bottom:12px;">Specify optional location details for this event:</p>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
        <div>
          <label class="form-label" style="font-size:0.75rem;">🌐 Country / Online</label>
          <input type="text" id="editEvtWhereCountryOnline" class="input-text btn-sm" list="whereCountryOnlineList" value="${evt.where?.countryOnline || ''}" placeholder="e.g. United States, Online..." style="width:100%;">
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">📱 State / App</label>
          <input type="text" id="editEvtWhereStateApp" class="input-text btn-sm" list="whereStateAppList" value="${evt.where?.stateApp || ''}" placeholder="e.g. California, Discord..." style="width:100%;">
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">🏙️ City</label>
          <input type="text" id="editEvtWhereCity" class="input-text btn-sm" list="whereCityList" value="${evt.where?.city || ''}" placeholder="e.g. Los Angeles..." style="width:100%;">
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">📍 Place</label>
          <input type="text" id="editEvtWherePlace" class="input-text btn-sm" list="wherePlaceList" value="${evt.where?.place || ''}" placeholder="e.g. Sunset Park..." style="width:100%;">
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">🧭 Zone</label>
          <input type="text" id="editEvtWhereZone" class="input-text btn-sm" list="whereZoneList" value="${evt.where?.zone || ''}" placeholder="e.g. Sector A..." style="width:100%;">
        </div>
        <div>
          <label class="form-label" style="font-size:0.75rem;">📌 GCode</label>
          <input type="text" id="editEvtWhereGCode" class="input-text btn-sm" list="whereGCodeList" value="${evt.where?.gcode || ''}" placeholder="e.g. GC12345..." style="width:100%;">
        </div>
      </div>
    </div>

    <div id="eventCombinationsSection" style="background:var(--bg-card); padding:16px 20px; border-radius:var(--radius-lg); border:1px solid var(--border-color); margin-bottom:16px;">
      <h3 style="margin-bottom:12px;">🫂 Subject Combinations (${participantSubIds.length >= 2 ? Math.floor((participantSubIds.length * (participantSubIds.length - 1)) / 2) : 0})</h3>
      <div id="eventCombinationsGrid" style="display:flex; flex-wrap:wrap; gap:14px; align-items:stretch;">
        ${combosHTML || '<p class="text-muted" style="font-size:0.85rem;">Need 2 or more participants to form combinations.</p>'}
      </div>
    </div>

    <div id="eventNearbyCalendarSection" style="background:var(--bg-card); padding:16px 20px; border-radius:var(--radius-lg); border:1px solid var(--border-color); margin-bottom:16px;">
      <h3 style="margin-bottom:6px;">🗓️ Nearby Events Timeline (±7 Days)</h3>
      <p class="text-muted" style="font-size:0.85rem; margin-bottom:12px;">Events within a week involving participants from this event:</p>
      <div id="eventNearbyCalendarGrid" style="display:flex; flex-wrap:wrap; gap:14px; align-items:stretch;">
        ${nearbyEventsHTML || '<p class="text-muted" style="font-size:0.85rem;">No nearby events found within ±7 days involving these subjects.</p>'}
      </div>
    </div>

    <div id="eventActionSelectorSection" style="background:var(--bg-card); padding:16px 20px; border-radius:var(--radius-lg); border:1px solid var(--border-color); margin-bottom:16px;">
      <h3 style="margin-bottom:8px;">👄 Zodiacs</h3>
      <p class="text-muted" style="font-size:0.85rem; margin-bottom:12px;">Click one of the 12 zodiac buttons below to assign the primary zodiac type:</p>
      <div id="evtDetailActionButtonsGrid" class="action-buttons-grid" style="margin-bottom:16px;"></div>

      <h3 style="margin-bottom:8px;">⚡ Actions</h3>
      <p class="text-muted" style="font-size:0.85rem; margin-bottom:10px;">Select all sub-action modifiers applicable to this event:</p>
      <div id="evtDetailSubActionsGrid" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px;">
        ${(typeof SUB_ACTION_TAGS !== 'undefined' ? SUB_ACTION_TAGS : []).map(sat => {
          const isSel = (evt.subActions || []).includes(sat.id);
          return `<button type="button" class="btn btn-sm evt-sub-action-chip ${isSel ? 'btn-primary' : 'btn-secondary'}" data-id="${sat.id}" style="${isSel ? 'background:var(--accent-pink); color:#fff; font-weight:700;' : 'opacity:0.75;'}">${sat.name}</button>`;
        }).join('')}
      </div>

      <h3 style="margin-bottom:8px;">📝 Notes / Description</h3>
      <textarea id="editEvtNotesInput" class="input-text" rows="3" style="width:100%; resize:vertical;" placeholder="Add notes...">${evt.notes || ''}</textarea>
      <button class="btn btn-primary" id="saveEvtDetailsBtn" style="margin-top:14px; width:100%;">💾 Save Event Changes</button>
    </div>

    <div id="eventMediaGallerySection">
      <h3 style="margin:16px 0 12px 0;">Assigned Media Gallery (${assignedMedia.length})</h3>
      <div id="eventMediaGalleryGrid" class="media-grid">
        ${assignedMedia.length > 0 ? assignedMedia.map(m => `
          <div class="media-card evt-page-media ${getMediaHighestPriorityGroupBorderClass(m)}" data-id="${m.id}">${renderMediaThumbnailHTML(m)}</div>`).join('') : '<p class="text-muted" style="font-size:0.85rem;">No media assigned to this event.</p>'}
      </div>
    </div>`;

  document.getElementById('backToEventsListBtn').onclick = () => switchView('eventsView');
  document.getElementById('pickCoverPageEventBtn').onclick = () => openEventCoverPickerModal(evt.id);

  const selectedSubActionIds = new Set(evt.subActions || []);

  container.querySelectorAll('.evt-sub-action-chip').forEach(btn => {
    btn.onclick = () => {
      const id = btn.getAttribute('data-id');
      if (selectedSubActionIds.has(id)) {
        selectedSubActionIds.delete(id);
        btn.className = 'btn btn-sm evt-sub-action-chip btn-secondary';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.fontWeight = '';
        btn.style.opacity = '0.75';
      } else {
        selectedSubActionIds.add(id);
        btn.className = 'btn btn-sm evt-sub-action-chip btn-primary';
        btn.style.background = 'var(--accent-pink)';
        btn.style.color = '#fff';
        btn.style.fontWeight = '700';
        btn.style.opacity = '1';
      }
    };
  });

  renderActionButtonsGrid('evtDetailActionButtonsGrid', actionCode, (selectedCode) => {
    actionCode = selectedCode;
  });

  document.getElementById('redatePageEventBtn').onclick = async () => {
    const oldTag = evt.dateTag;
    const newTagInput = prompt(`Enter new Date / Name for Event "${oldTag}":`, oldTag);
    if (newTagInput && newTagInput.trim() && newTagInput.trim() !== oldTag) {
      const newDateTag = parseSmartDateInput(newTagInput.trim());
      evt.dateTag = newDateTag;
      await db.put('events', evt);

      for (const m of currentMediaList) {
        let updated = false;
        (m.blueBookEvents || []).forEach(be => {
          if (be.dateTag === oldTag) {
            be.dateTag = newDateTag;
            updated = true;
          }
        });
        if (updated) await db.put('media', m);
      }

      await loadAppState();
      renderEventDetailsPage(stats);
      showToastNotification(`📅 Event renamed from "${oldTag}" to "${newDateTag}"`);
    }
  };

  document.getElementById('deletePageEventBtn').onclick = async () => {
    if (confirm(`Delete Event "${evt.dateTag}"?`)) {
      await db.delete('events', evt.id);
      switchView('eventsView');
    }
  };

  setupSmartSubjectAutocomplete('evtDetailSubInput', 'evtDetailSubAutocomplete', async (subId) => {
    evt.subjectCounts = evt.subjectCounts || {};
    if (!evt.subjectCounts[subId]) evt.subjectCounts[subId] = 1;
    await db.put('events', evt);
    renderEventDetailsPage(stats);
  });

  container.querySelectorAll('.make-primary-sub-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const subId = btn.getAttribute('data-subid');
      evt.primarySubjectId = subId;
      await db.put('events', evt);
      await loadAppState();
      renderEventDetailsPage(stats);
      showToastNotification(`⭐ Primary subject set for this event.`);
    };
  });

  container.querySelectorAll('.evt-participant-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.evt-sub-dec') || e.target.closest('.evt-sub-inc') || e.target.closest('.remove-evt-sub') || e.target.closest('.edit-sld-count-badge') || e.target.closest('.make-primary-sub-btn')) return;
      const subId = card.getAttribute('data-subid');
      if (subId) {
        activeDetailSubjectId = subId;
        switchView('subjectDetailsView');
      }
    };
  });

  container.querySelectorAll('.edit-sld-count-badge').forEach(badge => {
    badge.onclick = async (e) => {
      e.stopPropagation();
      const subId = badge.getAttribute('data-subid');
      const currentVal = evt.subjectCounts[subId] || 1;
      const sub = currentSubjectsList.find(s => s.id === subId);
      const subName = sub ? getSubjectDisplayName(sub) : 'Subject';
      const inputVal = prompt(`Edit 💦 SLD Count for ${subName}:`, currentVal);
      if (inputVal !== null) {
        const num = parseInt(inputVal.trim(), 10);
        if (!isNaN(num) && num > 0) {
          evt.subjectCounts[subId] = num;
          await db.put('events', evt);
          renderEventDetailsPage(stats);
        } else if (num === 0) {
          delete evt.subjectCounts[subId];
          await db.put('events', evt);
          renderEventDetailsPage(stats);
        }
      }
    };
  });

  container.querySelectorAll('.evt-sub-dec').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const subId = btn.getAttribute('data-subid');
      if (evt.subjectCounts[subId] > 1) {
        evt.subjectCounts[subId]--;
        await db.put('events', evt);
        renderEventDetailsPage(stats);
      }
    };
  });

  container.querySelectorAll('.evt-sub-inc').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const subId = btn.getAttribute('data-subid');
      evt.subjectCounts[subId]++;
      await db.put('events', evt);
      renderEventDetailsPage(stats);
    };
  });

  container.querySelectorAll('.remove-evt-sub').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const subId = btn.getAttribute('data-subid');
      delete evt.subjectCounts[subId];
      await db.put('events', evt);
      renderEventDetailsPage(stats);
    };
  });

  container.querySelectorAll('.evt-combo-card').forEach(card => {
    card.onclick = () => {
      const key = card.getAttribute('data-key');
      if (key) {
        activeDetailComboKey = key;
        switchView('comboDetailsView');
      }
    };
  });

  container.querySelectorAll('.nearby-evt-card').forEach(card => {
    card.onclick = () => {
      const evtId = card.getAttribute('data-evtid');
      if (evtId) {
        activeDetailEventId = evtId;
        renderEventDetailsPage(stats);
      }
    };
  });

  document.getElementById('saveEvtDetailsBtn').onclick = async () => {
    evt.eventCode = actionCode;
    evt.subActions = Array.from(selectedSubActionIds);
    evt.notes = document.getElementById('editEvtNotesInput').value;
    evt.where = {
      countryOnline: document.getElementById('editEvtWhereCountryOnline')?.value.trim() || '',
      stateApp: document.getElementById('editEvtWhereStateApp')?.value.trim() || '',
      city: document.getElementById('editEvtWhereCity')?.value.trim() || '',
      place: document.getElementById('editEvtWherePlace')?.value.trim() || '',
      zone: document.getElementById('editEvtWhereZone')?.value.trim() || '',
      gcode: document.getElementById('editEvtWhereGCode')?.value.trim() || ''
    };
    await db.put('events', evt);
    await loadAppState();
    renderEventDetailsPage(processAllStats(currentMediaList, currentSubjectsList, currentEventsList, currentWeights));
  };

  container.querySelectorAll('.evt-page-media').forEach(card => {
    card.onclick = () => {
      sldDefaultFullscreen = false;
      openLightboxById(card.getAttribute('data-id'));
    };
  });
}

window.openEventCoverPickerModal = openEventCoverPickerModal;
window.renderEventDetailsPage = renderEventDetailsPage;
