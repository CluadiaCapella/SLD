/**
 * Events List Page View Subsystem
 */

let activeEventSortKey = 'date';
let selectedEventCardIds = new Set();

function formatColoredDateTag(dateTag) {
  if (!dateTag) return '';
  const str = String(dateTag).trim();

  if (/^\d{6}$/.test(str)) {
    const yy = str.slice(0, 2);
    const mm = str.slice(2, 4);
    const dd = str.slice(4, 6);
    return `<span class="date-yy" style="color:#f43f5e; font-weight:800;">${yy}</span><span class="date-mm" style="color:#38bdf8; font-weight:800;">${mm}</span><span class="date-dd" style="color:#a855f7; font-weight:800;">${dd}</span>`;
  }

  if (/^\d{4}$/.test(str)) {
    const mm = str.slice(0, 2);
    const dd = str.slice(2, 4);
    return `<span class="date-mm" style="color:#38bdf8; font-weight:800;">${mm}</span><span class="date-dd" style="color:#a855f7; font-weight:800;">${dd}</span>`;
  }

  const matchFull = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (matchFull) {
    const yy = matchFull[1];
    const mm = matchFull[2].padStart(2, '0');
    const dd = matchFull[3].padStart(2, '0');
    return `<span class="date-yy" style="color:#f43f5e; font-weight:800;">${yy}</span>-<span class="date-mm" style="color:#38bdf8; font-weight:800;">${mm}</span>-<span class="date-dd" style="color:#a855f7; font-weight:800;">${dd}</span>`;
  }

  return `<span style="color:var(--accent-pink); font-weight:800;">${str}</span>`;
}

function getWhereSuggestions() {
  const suggestions = { countryOnline: new Set(), stateApp: new Set(), city: new Set(), place: new Set(), zone: new Set(), gcode: new Set() };
  currentEventsList.forEach(e => {
    if (e.where) {
      if (e.where.countryOnline) suggestions.countryOnline.add(e.where.countryOnline);
      if (e.where.stateApp) suggestions.stateApp.add(e.where.stateApp);
      if (e.where.city) suggestions.city.add(e.where.city);
      if (e.where.place) suggestions.place.add(e.where.place);
      if (e.where.zone) suggestions.zone.add(e.where.zone);
      if (e.where.gcode) suggestions.gcode.add(e.where.gcode);
    }
  });
  return {
    countryOnline: Array.from(suggestions.countryOnline),
    stateApp: Array.from(suggestions.stateApp),
    city: Array.from(suggestions.city),
    place: Array.from(suggestions.place),
    zone: Array.from(suggestions.zone),
    gcode: Array.from(suggestions.gcode)
  };
}

function renderWhereBadgesHTML(where) {
  if (!where) return '<span class="text-muted" style="font-size:0.8rem;">—</span>';
  const chips = [];
  if (where.countryOnline) chips.push(`<span class="badge" style="background:rgba(244,63,94,0.15); color:#f43f5e; border:1px solid #f43f5e; font-size:0.75rem; padding:2px 6px; border-radius:6px; margin:2px;">🌐 ${where.countryOnline}</span>`);
  if (where.stateApp) chips.push(`<span class="badge" style="background:rgba(56,189,248,0.15); color:#38bdf8; border:1px solid #38bdf8; font-size:0.75rem; padding:2px 6px; border-radius:6px; margin:2px;">📱 ${where.stateApp}</span>`);
  if (where.city) chips.push(`<span class="badge" style="background:rgba(168,85,247,0.15); color:#a855f7; border:1px solid #a855f7; font-size:0.75rem; padding:2px 6px; border-radius:6px; margin:2px;">🏙️ ${where.city}</span>`);
  if (where.place) chips.push(`<span class="badge" style="background:rgba(34,197,94,0.15); color:#22c55e; border:1px solid #22c55e; font-size:0.75rem; padding:2px 6px; border-radius:6px; margin:2px;">📍 ${where.place}</span>`);
  if (where.zone) chips.push(`<span class="badge" style="background:rgba(234,179,8,0.15); color:#eab308; border:1px solid #eab308; font-size:0.75rem; padding:2px 6px; border-radius:6px; margin:2px;">🧭 ${where.zone}</span>`);
  if (where.gcode) chips.push(`<span class="badge" style="background:rgba(249,115,22,0.15); color:#f97316; border:1px solid #f97316; font-size:0.75rem; padding:2px 6px; border-radius:6px; margin:2px;">📌 ${where.gcode}</span>`);

  return chips.length > 0 ? `<div style="display:flex; flex-wrap:wrap; gap:2px; max-width:240px;">${chips.join('')}</div>` : '<span class="text-muted" style="font-size:0.8rem;">—</span>';
}

function populateWhereDatalists() {
  const sug = getWhereSuggestions();
  const lists = {
    whereCountryOnlineList: sug.countryOnline,
    whereStateAppList: sug.stateApp,
    whereCityList: sug.city,
    wherePlaceList: sug.place,
    whereZoneList: sug.zone,
    whereGCodeList: sug.gcode
  };
  for (const [listId, values] of Object.entries(lists)) {
    const el = document.getElementById(listId);
    if (el) {
      el.innerHTML = values.map(v => `<option value="${v}">`).join('');
    }
  }
}

function renderEventsPage(stats) {
  const gridContainer = document.getElementById('eventsGridContainer');
  const infoEl = document.getElementById('eventsSelectionInfo');

  if (!gridContainer) return;

  if (currentEventsList.length === 0) {
    gridContainer.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No events recorded yet. Type a date tag in "+ Create Event Date" above to start.</div>`;
    if (infoEl) infoEl.textContent = '';
    return;
  }

  if (infoEl) {
    infoEl.textContent = selectedEventCardIds.size > 0 ? `Selected Events: ${selectedEventCardIds.size} file(s)` : '';
  }

  const sorted = currentEventsList.slice().sort((a, b) => {
    if (activeEventSortKey === 'points') {
      const ptsA = (a.eventCode ? (currentActionPointsMap[a.eventCode] || 0) : 0.1);
      const ptsB = (b.eventCode ? (currentActionPointsMap[b.eventCode] || 0) : 0.1);
      return ptsB - ptsA;
    } else if (activeEventSortKey === 'water') {
      const waterA = Object.values(a.subjectCounts || {}).reduce((s, v) => s + (v || 0), 0);
      const waterB = Object.values(b.subjectCounts || {}).reduce((s, v) => s + (v || 0), 0);
      return waterB - waterA;
    } else if (activeEventSortKey === 'subject') {
      const nameA = Object.keys(a.subjectCounts || {}).map(sId => currentSubjectsList.find(s => s.id === sId)?.name || '').sort().join(', ');
      const nameB = Object.keys(b.subjectCounts || {}).map(sId => currentSubjectsList.find(s => s.id === sId)?.name || '').sort().join(', ');
      return nameA.localeCompare(nameB);
    }
    return convertDateTagToIso(b.dateTag || '').localeCompare(convertDateTagToIso(a.dateTag || ''));
  });

  gridContainer.innerHTML = sorted.map(evt => {
    const isSelected = selectedEventCardIds.has(evt.id);
    const dateStr = evt.dateTag || new Date(evt.date).toLocaleDateString();
    const actionCode = evt.eventCode || 1;
    const actionPts = currentActionPointsMap[actionCode] || 0.1;
    const totalWater = Object.values(evt.subjectCounts || {}).reduce((s, v) => s + (v || 0), 0);

    const assignedMedia = currentMediaList.filter(m => (m.eventIds || []).includes(evt.id));
    const customCoverMedia = evt.customCoverMediaId ? currentMediaList.find(m => m.id === evt.customCoverMediaId) : null;
    const coverMedia = customCoverMedia || assignedMedia[0];

    const bgHeaderStyle = coverMedia ? `<img src="${coverMedia.thumbnailUrl || coverMedia.dataUrl}" class="event-card-bg-img" alt="Event Cover">` : `<div class="event-card-bg-img" style="background: linear-gradient(135deg, rgba(236,72,153,0.3), rgba(56,189,248,0.3));"></div>`;

    const subjectAvatarsHTML = Object.keys(evt.subjectCounts || {}).map(subId => {
      const sub = currentSubjectsList.find(s => s.id === subId);
      const c = evt.subjectCounts[subId] || 0;
      const avatarSrc = sub?.avatarUrl;
      const genderSymbol = getSubjectGenderSymbol(sub?.gender);
      return `
        <div style="position:relative; display:inline-flex; align-items:center; cursor:pointer;" title="${genderSymbol} ${getSubjectDisplayName(sub)} - 💦${c}" data-subid="${subId}" class="evt-card-sub-bubble">
          ${avatarSrc ? `<img src="${avatarSrc}" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:2px solid var(--border-color);" alt="${sub?.name}">` : `<div style="width:34px; height:34px; border-radius:50%; background:var(--bg-secondary); border:2px solid var(--border-color); display:flex; align-items:center; justify-content:center; font-size:14px;">👤</div>`}
          <span style="position:absolute; bottom:-4px; right:-4px; background:rgba(0,0,0,0.85); color:#ff69b4; font-size:0.6rem; font-weight:800; padding:1px 4px; border-radius:8px; border:1px solid #ff69b4;">💦${c}</span>
        </div>`;
    }).join('');

    const locationTooltipHTML = evt.where ? `
<div class="event-where-tooltip-wrap" 
     style="position:absolute; bottom:8px; left:8px; z-index:3; display:inline-block;"
     onmouseenter="this.querySelector('.event-where-tooltip').style.display='block'"
     onmouseleave="this.querySelector('.event-where-tooltip').style.display='none'">
  <span class="badge" style="background:rgba(0,0,0,0.85); color:#f43f5e; border:1px solid #f43f5e; font-size:0.68rem; padding:2px 6px; border-radius:10px; cursor:pointer;">
    🌐 ${evt.where.countryOnline || 'Location'}
  </span>
  <div class="event-where-tooltip" 
       style="display:none; position:absolute; bottom:24px; left:0; width:max-content; max-width:170px; background:rgba(15, 23, 42, 0.95); border:1px solid var(--border-color); color:#fff; padding:8px; border-radius:var(--radius-md); font-size:0.7rem; z-index:100; pointer-events:none; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
    <div>🌐 Country/Online: <strong>${evt.where.countryOnline || '—'}</strong></div>
    <div>📱 State/App: <strong>${evt.where.stateApp || '—'}</strong></div>
    <div>🏙️ City: <strong>${evt.where.city || '—'}</strong></div>
    <div>📍 Place: <strong>${evt.where.place || '—'}</strong></div>
    <div>🧭 Zone: <strong>${evt.where.zone || '—'}</strong></div>
    <div>📌 GCode: <strong>${evt.where.gcode || '—'}</strong></div>
  </div>
</div>` : '';

    return `
      <div class="event-card ${isSelected ? 'selected' : ''}" data-evtid="${evt.id}" style="position:relative; width:200px; height:200px; overflow:hidden; border-radius:var(--radius-md); border:1px solid var(--border-color); cursor:pointer;">
        ${bgHeaderStyle}
        <div class="media-card-overlay" style="position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.85) 100%); display:flex; flex-direction:column; justify-content:space-between; padding:8px; box-sizing:border-box;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:4px; z-index:2;">
            <div style="display:flex; flex-direction:column; gap:2px; max-width:130px;">
              <span class="tag-chip-bubble action-tag-${actionCode}" style="font-size:0.65rem; padding:1px 5px; width:fit-content;">${getActionDisplayName(actionCode)}</span>
              <strong style="font-size:0.85rem; color:#fff; text-shadow:0 1px 4px rgba(0,0,0,0.9); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">📙 ${formatColoredDateTag(dateStr)}</strong>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
              <span class="badge" style="background:rgba(0,0,0,0.8); color:#ff69b4; border:1px solid #ff69b4; font-weight:800; font-size:0.7rem; padding:1px 5px;">💦 ${totalWater}</span>
              <span class="badge" style="background:rgba(0,0,0,0.8); color:#38bdf8; border:1px solid #38bdf8; font-weight:800; font-size:0.65rem; padding:1px 4px;">⚡ ${actionPts}</span>
            </div>
          </div>

          <div style="display:flex; flex-wrap:wrap; gap:4px; align-items:center; justify-content:center; z-index:2; margin:auto 0;">
            ${subjectAvatarsHTML || ''}
          </div>

          <div style="display:flex; justify-content:space-between; align-items:center; width:100%; z-index:2; margin-top:auto;">
            ${locationTooltipHTML || '<div></div>'}
            <div style="display:flex; gap:4px; margin-left:auto; z-index:4;">
              <button class="btn btn-danger btn-sm evt-card-delete-btn" data-evtid="${evt.id}" style="font-size:0.65rem; padding:2px 6px;">🗑️</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join('');

  document.querySelectorAll('.evt-sort-btn').forEach(btn => {
    btn.onclick = () => {
      activeEventSortKey = btn.getAttribute('data-sort');
      document.querySelectorAll('.evt-sort-btn').forEach(b => b.classList.toggle('active-sort', b === btn));
      renderEventsPage(stats);
    };
  });

  gridContainer.querySelectorAll('.event-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.evt-pick-cover-btn') || e.target.closest('.evt-card-select-btn') || e.target.closest('.evt-card-delete-btn') || e.target.closest('.evt-media-thumb') || e.target.closest('.evt-card-sub-bubble')) return;
      activeDetailEventId = card.getAttribute('data-evtid');
      switchView('eventDetailsView');
    };
  });

  gridContainer.querySelectorAll('.evt-media-thumb').forEach(thumb => {
    thumb.onclick = (e) => {
      e.stopPropagation();
      const mId = thumb.getAttribute('data-mid');
      openLightboxById(mId);
    };
  });

  gridContainer.querySelectorAll('.evt-card-sub-bubble').forEach(b => {
    b.onclick = (e) => {
      e.stopPropagation();
      const subId = b.getAttribute('data-subid');
      if (subId) {
        activeDetailSubjectId = subId;
        switchView('subjectDetailsView');
      }
    };
  });

  gridContainer.querySelectorAll('.evt-pick-cover-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const evtId = btn.getAttribute('data-evtid');
      openEventCoverPickerModal(evtId);
    };
  });

  gridContainer.querySelectorAll('.evt-card-select-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const evtId = btn.getAttribute('data-evtid');
      if (selectedEventCardIds.has(evtId)) selectedEventCardIds.delete(evtId);
      else selectedEventCardIds.add(evtId);
      renderEventsPage(stats);
    };
  });

  gridContainer.querySelectorAll('.evt-card-delete-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const evtId = btn.getAttribute('data-evtid');
      const evt = currentEventsList.find(item => item.id === evtId);
      if (evt && confirm(`Are you sure you want to delete Event "${evt.dateTag}"?`)) {
        const savedEvt = { ...evt };
        await db.delete('events', evtId);
        pushUndoState(`Delete Event "${evt.dateTag}"`, async () => {
          await db.put('events', savedEvt);
        });
        await loadAppState();
        renderCurrentView();
      }
    };
  });
}

window.formatColoredDateTag = formatColoredDateTag;
window.getWhereSuggestions = getWhereSuggestions;
window.renderWhereBadgesHTML = renderWhereBadgesHTML;
window.populateWhereDatalists = populateWhereDatalists;
window.renderEventsPage = renderEventsPage;
