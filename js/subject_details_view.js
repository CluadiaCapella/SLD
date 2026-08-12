/**
 * Subject Details Page Subsystem
 */

let detailComboSortKey = 'eventPoints';
let detailComboSortDir = 'desc';
let detailMediaSortKey = 'totalPoints';
let detailMediaSortDir = 'desc';

function renderSubjectDetailsPage(stats) {
  try {
    const container = document.getElementById('subjectDetailsContent');
    if (!container) return;
    if (!activeDetailSubjectId) { switchView('subjectsView'); return; }
    const subject = currentSubjectsList.find(s => s.id === activeDetailSubjectId);
    const sStat = (stats?.allSubjectStats || []).find(s => s?.subject?.id === activeDetailSubjectId) || { totalPoints: 0, heartPoints: 0, eventPoints: 0, pinkPoints: 0, greyPoints: 0, bluePoints: 0, coOccurrences: new Map() };
    if (!subject) { switchView('subjectsView'); return; }

    let taggedMedia = currentMediaList.filter(m => m.subjectTags?.includes(subject.id));
    if (aiFilterMode === 'ai_only') {
      taggedMedia = taggedMedia.filter(m => m.isAiGenerated || (m.normalTags || []).includes('AI'));
    } else if (aiFilterMode === 'human_only') {
      taggedMedia = taggedMedia.filter(m => !m.isAiGenerated && !(m.normalTags || []).includes('AI'));
    }
    const group = getSubjectGroup(subject.groupId);
    const groupColor = group?.color || '#a855f7';
    const borderClass = group?.cssClass || '';

    // Sort Tagged Media
    taggedMedia.sort((a, b) => {
      const aPts = (stats?.mediaStatsMap || new Map()).get(a.id) || { totalHeartPts: 0, pinkPts: 0, greyPts: 0, bluePts: 0 };
      const bPts = (stats?.mediaStatsMap || new Map()).get(b.id) || { totalHeartPts: 0, pinkPts: 0, greyPts: 0, bluePts: 0 };
      let comp = 0;
      if (detailMediaSortKey === 'totalPoints') comp = aPts.totalHeartPts - bPts.totalHeartPts;
      else if (detailMediaSortKey === 'pink') comp = aPts.pinkPts - bPts.pinkPts;
      else if (detailMediaSortKey === 'grey') comp = aPts.greyPts - bPts.greyPts;
      else if (detailMediaSortKey === 'blue') comp = aPts.bluePts - bPts.bluePts;
      else if (detailMediaSortKey === 'date') comp = (a.filename || '').localeCompare(b.filename || '');
      return detailMediaSortDir === 'asc' ? comp : -comp;
    });

    // Subject Combinations List & Sort
    let subjectCombos = (stats?.allCombinations || []).filter(c => (c.subjectIds || [c.subjectId1, c.subjectId2]).includes(subject.id));
    subjectCombos.sort((a, b) => {
      let comp = 0;
      if (detailComboSortKey === 'eventPoints') comp = a.eventPoints - b.eventPoints;
      else if (detailComboSortKey === 'totalPoints') comp = a.totalPoints - b.totalPoints;
      else if (detailComboSortKey === 'heartPoints') comp = a.heartPoints - b.heartPoints;
      else if (detailComboSortKey === 'action') comp = (a.maxActionCode || 0) - (b.maxActionCode || 0);
      else if (detailComboSortKey === 'pink') comp = a.pinkPoints - b.pinkPoints;
      else if (detailComboSortKey === 'grey') comp = a.greyPoints - b.greyPoints;
      else if (detailComboSortKey === 'blue') comp = a.bluePoints - b.bluePoints;
      return detailComboSortDir === 'asc' ? comp : -comp;
    });

    // Actions Summary Section using official 12 Zodiac Actions
    const ACTION_HEX_MAP = {
      1: '#a855f7', 2: '#3b82f6', 3: '#10b981', 4: '#eab308',
      5: '#f97316', 6: '#ef4444', 7: '#ec4899', 8: '#d946ef',
      9: '#0ea5e9', 10: '#6366f1', 11: '#8b5cf6', 12: '#f43f5e'
    };

    const actionCodesList = Array.from({ length: 12 }, (_, i) => 12 - i);
    let totalActionCount = 0;
    const actionsGridHTML = actionCodesList.map(code => {
      const actColor = ACTION_HEX_MAP[code] || 'var(--accent-blue)';
      const displayName = getActionDisplayName(code);
      const comboCount = subjectCombos.filter(c => c.maxActionCode === code).length;
      if (comboCount === 0) return '';
      totalActionCount += comboCount;
      return `
        <div style="background:var(--bg-card); border:1px solid ${actColor}55; border-radius:var(--radius-md); padding:12px; display:flex; align-items:center; justify-content:space-between; gap:10px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="font-weight:800; font-size:0.9rem; color:var(--text-primary);">${displayName}</div>
          </div>
          <span class="subject-stat-badge" style="background:${actColor}22; color:${actColor}; font-weight:800; font-size:0.85rem; padding:4px 8px; border-radius:12px; border:1px solid ${actColor}55;">
            ${comboCount}
          </span>
        </div>`;
    }).join('');

    const actionsSectionHTML = totalActionCount > 0 ? `
      <!-- Actions Summary Section -->
      <div style="margin-bottom:32px; background:var(--bg-card); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-color);">
        <h3 style="font-size:1.3rem; font-weight:800; margin-bottom:16px;">💋 ${getSubjectDisplayName(subject)}'s Actions</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap:12px;">
          ${actionsGridHTML}
        </div>
      </div>` : '';

    // Events Gallery Computation
    const subEvents = (currentEventsList || []).filter(e => e.subjectCounts && e.subjectCounts[subject.id]);
    const eventYears = Array.from(new Set(subEvents.map(e => {
      const d = e.dateTag || e.date || '';
      return d.length >= 4 ? d.substr(0, 4) : null;
    }).filter(Boolean))).sort().reverse();

    let filteredEvents = subEvents.slice().sort((a, b) => (b.dateTag || b.date || '').localeCompare(a.dateTag || a.date || ''));

    if (selectedEventYear !== 'all') {
      filteredEvents = filteredEvents.filter(e => (e.dateTag || e.date || '').startsWith(selectedEventYear));
    }
    if (selectedEventMonth !== 'all') {
      filteredEvents = filteredEvents.filter(e => {
        const d = e.dateTag || e.date || '';
        return d.includes(`-${selectedEventMonth}-`) || d.substr(4, 2) === selectedEventMonth;
      });
    }

    const filteredEventsHTML = filteredEvents.length > 0 ? filteredEvents.map(evt => {
      const companionIds = Object.keys(evt.subjectCounts || {}).filter(id => id !== subject.id);
      const companionSub = currentSubjectsList.find(s => s.id === companionIds[0]) || subject;

      const activeAvatarSrc = subject.avatarUrl || (taggedMedia[0] ? (taggedMedia[0].customThumbnail || taggedMedia[0].dataUrl) : null);
      const activeOverlayHTML = activeAvatarSrc
        ? `<img src="${activeAvatarSrc}" class="combination-active-overlay-thumb" title="Active: ${getSubjectDisplayName(subject)}">`
        : `<div class="combination-active-overlay-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--accent-pink);color:#fff;">👤</div>`;

      const companionTagged = currentMediaList.filter(m => m.subjectTags?.includes(companionSub.id));
      const g = getSubjectGroup(companionSub.groupId);
      const bClass = g?.cssClass || '';
      const mainThumbHTML = companionSub.avatarUrl 
        ? `<img src="${companionSub.avatarUrl}" class="combination-main-thumb ${bClass}" alt="${companionSub.name}">`
        : companionTagged[0]
          ? renderMediaThumbnailHTML(companionTagged[0], `combination-main-thumb ${bClass}`)
          : `<div class="combination-main-thumb ${bClass}" style="display:flex;align-items:center;justify-content:center;font-size:54px;background:var(--bg-secondary);">👤</div>`;

      const actColor = ACTION_HEX_MAP[evt.eventCode] || 'var(--accent-blue)';
      const actionName = getActionDisplayName(evt.eventCode);

      return `
        <div class="combination-element-card sub-event-element" data-eventid="${evt.id}" style="border: 2px solid ${actColor}; min-width: 180px; width: 180px; flex-shrink: 0; cursor: pointer;">
          ${activeOverlayHTML}
          ${mainThumbHTML}
          <div class="combination-card-overlay" style="background: linear-gradient(to top, rgba(2, 6, 23, 0.95) 0%, ${actColor}44 60%, transparent 100%);">
            <div style="font-weight:800; font-size:0.9rem; color:#fff; text-shadow:0 2px 4px rgba(0,0,0,0.9); margin-bottom:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
              ${actionName}
            </div>
            <div style="font-size:0.75rem; color:rgba(255,255,255,0.85); text-shadow:0 1px 3px #000; font-weight:700;">
              🗓️ ${evt.dateTag || evt.date}
            </div>
          </div>
        </div>`;
    }).join('') : '<p class="text-muted" style="padding:12px 0;">No matching events found.</p>';

    // Subject Alikes List & Calculation
    subject.alikeSubjects = subject.alikeSubjects || [];
    let alikeList = [...subject.alikeSubjects];

    alikeList.sort((a, b) => {
      if (!a || !b) return 0;
      const aTargetSStat = (stats?.allSubjectStats || []).find(s => s?.subject?.id === a.targetSubjectId) || { totalPoints: 0, heartPoints: 0 };
      const bTargetSStat = (stats?.allSubjectStats || []).find(s => s?.subject?.id === b.targetSubjectId) || { totalPoints: 0, heartPoints: 0 };
      const aPts = ((a.percentage || 0) / 100) * 0.45 * (aTargetSStat.heartPoints || aTargetSStat.totalPoints || 0);
      const bPts = ((b.percentage || 0) / 100) * 0.45 * (bTargetSStat.heartPoints || bTargetSStat.totalPoints || 0);

      let comp = 0;
      if (subjectAlikeSortKey === 'percentage') {
        comp = (a.percentage || 0) - (b.percentage || 0);
      } else if (subjectAlikeSortKey === 'sldPoints') {
        comp = aPts - bPts;
      }
      return subjectAlikeSortDir === 'asc' ? comp : -comp;
    });

    const alikeCardsList = alikeList.map(item => {
      if (!item || !item.targetSubjectId) return '';
      const targetSub = currentSubjectsList.find(s => s.id === item.targetSubjectId);
      if (!targetSub) return '';
      const targetSStat = (stats?.allSubjectStats || []).find(s => s?.subject?.id === item.targetSubjectId) || { totalPoints: 0, heartPoints: 0 };
      const targetSldPts = targetSStat.heartPoints || targetSStat.totalPoints || 0;
      const pct = item.percentage ?? 15.0;
      const calculatedPts = (pct / 100) * 0.45 * targetSldPts;

      const targetGroup = getSubjectGroup(targetSub.groupId);
      const bClass = targetGroup?.cssClass || '';
      const targetTagged = currentMediaList.filter(m => m.subjectTags?.includes(targetSub.id));

      const mainThumbHTML = targetSub.avatarUrl 
        ? `<img src="${targetSub.avatarUrl}" class="combination-main-thumb ${bClass}" style="width:100%; height:160px; object-fit:cover; object-position:top center;">`
        : targetTagged[0]
          ? renderMediaThumbnailHTML(targetTagged[0], `combination-main-thumb ${bClass}`)
          : `<div class="combination-main-thumb ${bClass}" style="width:100%; height:160px; display:flex; align-items:center; justify-content:center; font-size:48px; background:var(--bg-secondary);">👤</div>`;

      return `
        <div class="subject-card ${bClass}" style="position:relative; background:var(--bg-secondary); border-radius:var(--radius-lg); overflow:hidden; border:1px solid var(--border-color); width:180px;">
          ${mainThumbHTML}
          <button class="btn btn-danger btn-sm remove-alike-btn" data-targetid="${item.targetSubjectId}" style="position:absolute; top:6px; right:6px; z-index:5; padding:2px 6px; font-size:0.75rem; border-radius:50%; opacity:0.9;">✖</button>
          
          <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(2,6,23,0.95) 0%, rgba(2,6,23,0.75) 75%, transparent 100%); padding:8px; display:flex; flex-direction:column; gap:4px; z-index:4;">
            <div style="font-weight:800; font-size:0.85rem; color:#fff; text-shadow:0 1px 3px #000; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center;">
              ${getSubjectDisplayName(targetSub)}
            </div>
            
            <div style="display:flex; align-items:center; justify-content:space-between; gap:4px;">
              <div style="display:flex; align-items:center; gap:1px; background:rgba(168,85,247,0.3); border:1px solid #a855f7; border-radius:6px; padding:1px 4px; font-weight:800; font-size:0.75rem; color:#e9d5ff;">
                <span>🪞</span>
                <input type="number" step="0.1" min="0.1" max="99.9" class="input-text btn-sm edit-alike-pct-input" data-targetid="${item.targetSubjectId}" value="${pct}" style="width:44px; padding:0; text-align:center; font-size:0.75rem; background:transparent; border:none; color:#fff; font-weight:800;">
                <span>%</span>
              </div>
              <span style="background:rgba(56,189,248,0.3); border:1px solid #38bdf8; border-radius:6px; padding:2px 4px; font-weight:800; font-size:0.7rem; color:#7dd3fc;" title="${pct}% * 0.45 * ${targetSldPts} SLD Pts">
                ⭐ ${calculatedPts.toFixed(1)}
              </span>
            </div>
          </div>
        </div>`;
    }).filter(Boolean);

    const alikeCardsHTML = alikeCardsList.length > 0 ? alikeCardsList.join('') : '<p class="text-muted" style="grid-column: 1 / -1;">No Alike subjects added yet.</p>';

    // Subject Thoughts List
    subject.thoughtSubjects = subject.thoughtSubjects || [];
    let thoughtsList = [...subject.thoughtSubjects];

    const thoughtCardsList = thoughtsList.map(item => {
      const targetSub = currentSubjectsList.find(s => s.id === item.targetSubjectId);
      if (!targetSub) return '';
      const targetGroup = getSubjectGroup(targetSub.groupId);
      const bClass = targetGroup?.cssClass || '';
      const targetTagged = currentMediaList.filter(m => m.subjectTags?.includes(targetSub.id));

      const beauty = item.beauty ?? 0;
      const hotness = item.hotness ?? 0;
      const personality = item.personality ?? 0;

      const mainThumbHTML = targetSub.avatarUrl 
        ? `<img src="${targetSub.avatarUrl}" class="combination-main-thumb ${bClass}" style="width:100%; height:170px; object-fit:cover; object-position:top center;">`
        : targetTagged[0]
          ? renderMediaThumbnailHTML(targetTagged[0], `combination-main-thumb ${bClass}`)
          : `<div class="combination-main-thumb ${bClass}" style="width:100%; height:170px; display:flex; align-items:center; justify-content:center; font-size:48px; background:var(--bg-secondary);">👤</div>`;

      return `
        <div class="subject-card ${bClass}" style="position:relative; background:var(--bg-secondary); border-radius:var(--radius-lg); overflow:hidden; border:1px solid var(--border-color); width:180px;">
          ${mainThumbHTML}
          <button class="btn btn-danger btn-sm remove-thought-btn" data-targetid="${item.targetSubjectId}" style="position:absolute; top:6px; right:6px; z-index:5; padding:2px 6px; font-size:0.75rem; border-radius:50%; opacity:0.9;">✖</button>
          
          <div style="position:absolute; bottom:0; left:0; right:0; background:linear-gradient(to top, rgba(2,6,23,0.95) 0%, rgba(2,6,23,0.75) 75%, transparent 100%); padding:8px; display:flex; flex-direction:column; gap:4px; z-index:4;">
            <div style="font-weight:800; font-size:0.85rem; color:#fff; text-shadow:0 1px 3px #000; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:center;">
              ${getSubjectDisplayName(targetSub)}
            </div>
            
            <div style="display:flex; align-items:center; justify-content:space-between; gap:3px;">
              <div style="display:flex; flex-direction:column; align-items:center; background:rgba(56,189,248,0.25); border:1px solid #38bdf8; border-radius:4px; padding:2px 2px; flex:1;" title="Beauty (Blue)">
                <span style="font-size:0.65rem; color:#7dd3fc; font-weight:700;">💙 Bty</span>
                <input type="number" step="1" class="input-text btn-sm edit-thought-beauty-input" data-targetid="${item.targetSubjectId}" value="${beauty}" style="width:100%; padding:0; text-align:center; font-size:0.75rem; background:transparent; border:none; color:#fff; font-weight:800;">
              </div>

              <div style="display:flex; flex-direction:column; align-items:center; background:rgba(239,68,68,0.25); border:1px solid #ef4444; border-radius:4px; padding:2px 2px; flex:1;" title="Hotness (Red)">
                <span style="font-size:0.65rem; color:#fca5a5; font-weight:700;">❤️ Hot</span>
                <input type="number" step="1" class="input-text btn-sm edit-thought-hotness-input" data-targetid="${item.targetSubjectId}" value="${hotness}" style="width:100%; padding:0; text-align:center; font-size:0.75rem; background:transparent; border:none; color:#fff; font-weight:800;">
              </div>

              <div style="display:flex; flex-direction:column; align-items:center; background:rgba(34,197,94,0.25); border:1px solid #22c55e; border-radius:4px; padding:2px 2px; flex:1;" title="Personality (Green)">
                <span style="font-size:0.65rem; color:#86efac; font-weight:700;">💚 Psn</span>
                <input type="number" step="1" class="input-text btn-sm edit-thought-personality-input" data-targetid="${item.targetSubjectId}" value="${personality}" style="width:100%; padding:0; text-align:center; font-size:0.75rem; background:transparent; border:none; color:#fff; font-weight:800;">
              </div>
            </div>
          </div>
        </div>`;
    }).filter(Boolean);

    const thoughtCardsHTML = thoughtCardsList.length > 0 ? thoughtCardsList.join('') : '<p class="text-muted" style="grid-column: 1 / -1;">No Thought subjects added yet.</p>';

    const heroMediaBg = subject.avatarUrl || (taggedMedia[0] ? (taggedMedia[0].customThumbnail || taggedMedia[0].dataUrl || taggedMedia[0].filename) : null);
    const heroCardBgStyle = heroMediaBg 
      ? `position:relative; overflow:hidden; background: linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(2, 6, 23, 0.95) 100%), url('${heroMediaBg}') center/cover no-repeat; border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:24px; text-align:left; margin-bottom:24px; box-shadow:var(--shadow-md); backdrop-filter:blur(10px);`
      : `background: linear-gradient(135deg, ${groupColor}22 0%, var(--bg-card) 65%); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:24px; text-align:left; margin-bottom:24px;`;

    container.innerHTML = `
      <button class="btn btn-secondary btn-sm" id="backToSubjectsBtn" style="margin-bottom:16px;">← Back to Subjects</button>

      <!-- Hero Header Card with Avatar 200x200 on LEFT, Info on RIGHT, Blurred Background -->
      <div style="${heroCardBgStyle}">
        <div style="display:flex; align-items:center; gap:24px; text-align:left; width:100%; z-index:2; position:relative; flex-wrap:wrap;">
          <div style="flex-shrink:0;">
            ${subject.avatarUrl 
              ? `<img src="${subject.avatarUrl}" class="subject-avatar-lg sub-avatar-clickable ${borderClass}" data-id="${subject.id}" alt="${subject.name}">` 
              : taggedMedia[0] 
                ? renderMediaThumbnailHTML(taggedMedia[0], `subject-avatar-lg sub-avatar-clickable ${borderClass}`) 
                : `<div class="subject-avatar-lg sub-avatar-clickable ${borderClass}" data-id="${subject.id}" style="display:flex;align-items:center;justify-content:center;font-size:48px;background:var(--bg-secondary);">👤</div>`}
          </div>

          <div style="flex:1; min-width:240px; display:flex; flex-direction:column; gap:8px;">
            <h2 style="font-size:2rem; font-weight:900; color:#fff; text-shadow:0 2px 4px rgba(0,0,0,0.8); margin:0;">${getSubjectDisplayName(subject)}</h2>
            <p class="text-muted" style="font-size:1rem; margin:0;">Total Score: <strong style="color:var(--accent-pink);">${sStat.totalPoints} pts</strong> (📘 ${sStat.heartPoints} SLD + 📙 ${sStat.eventPoints} Events)</p>

            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-top:6px;">
              <button class="btn btn-secondary btn-sm" style="height:33px" title="✏️ Rename" id="renameDetailSubjectBtn">✏️</button>
              <select id="detailSubGroupSelect" class="select-input btn-sm" style="font-size:0.85rem;">
                ${getSubjectGroupOptionsHTML(subject.groupId)}
              </select>
              
              <div class="dropdown-container" id="subDetailMenuContainer" style="position:relative; display:inline-block;">
                <button class="btn btn-secondary btn-sm" style="height:33px;" title="Submenu" id="subDetailMenuBtn">•••</button>
                <div class="dropdown-menu" id="subDetailDropdown" style="display:none; position:absolute; left:0; top:100%; z-index:10; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:6px; min-width:160px; box-shadow:var(--shadow-md);">
                  <button class="btn btn-danger btn-sm" id="deleteDetailSubjectBtn" style="width:100%; text-align:left;">🗑️ Delete Subject</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Events Section -->
      <div style="background:var(--bg-card); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-color); margin-bottom:32px;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
          <h3 style="font-size:1.3rem; font-weight:800; margin:0;">📅 ${getSubjectDisplayName(subject)}'s Events (${subEvents.length})</h3>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <div class="date-autocomplete-container" style="min-width:200px;">
              <input type="text" id="subPageEventDateInput" class="input-text btn-sm" placeholder="Event Date (Enter)..." style="width:100%;">
              <div id="subPageEventDateAutocomplete" class="date-autocomplete-dropdown"></div>
            </div>
            <button class="btn btn-primary btn-sm" id="subPageCreateEventBtn">➕ Create Event</button>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px; flex-wrap:wrap;">
          <span class="text-muted" style="font-size:0.85rem; font-weight:700;">Filter Events:</span>
          <select id="subEventYearFilter" class="select-input btn-sm">
            <option value="all">All Years</option>
            ${eventYears.map(y => `<option value="${y}" ${selectedEventYear === y ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <select id="subEventMonthFilter" class="select-input btn-sm">
            <option value="all">All Months</option>
            ${['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => `<option value="${m}" ${selectedEventMonth === m ? 'selected' : ''}>Month ${m}</option>`).join('')}
          </select>
        </div>

        <div style="display:flex; gap:16px; overflow-x:auto; padding-bottom:12px; scrollbar-width:thin;">
          ${filteredEventsHTML}
        </div>
      </div>

      ${actionsSectionHTML}

      <!-- 2 Timeline Analytics Graphs -->
      <h3 style="margin:28px 0 16px 0; font-size:1.3rem; font-weight:800;">📊 Subject Analytics</h3>
      <div class="charts-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:20px; margin-bottom:32px;">
        <div class="chart-card">
          <h3>📙 Event Points Over Time</h3>
          <div id="subEventTimelineChart" style="height:260px; margin-top:12px;"></div>
        </div>
        <div class="chart-card">
          <h3>📘 SLD & Heart Points Over Time</h3>
          <div id="subSldTimelineChart" style="height:260px; margin-top:12px;"></div>
        </div>
      </div>

      <!-- Friends (Combinations) Section -->
      <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:16px;">
        <h3 style="font-size:1.3rem; font-weight:800; margin:0;">🫂 ${getSubjectDisplayName(subject)}'s Friends (${subjectCombos.length})</h3>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-left:12px;">
          <span class="text-muted" style="font-size:0.8rem; font-weight:700;">Sort:</span>
          <button class="btn btn-secondary btn-sm combo-sort-btn ${detailComboSortKey === 'eventPoints' ? 'active' : ''}" data-sort="eventPoints">📙 Events</button>
          <button class="btn btn-secondary btn-sm combo-sort-btn ${detailComboSortKey === 'action' ? 'active' : ''}" data-sort="action">💋 Action</button>
          <button class="btn btn-secondary btn-sm combo-sort-btn ${detailComboSortKey === 'heartPoints' ? 'active' : ''}" data-sort="heartPoints">📘 SLD</button>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:16px; margin-bottom:32px;">
        ${subjectCombos.length > 0 ? subjectCombos.map(c => {
          const otherSubs = (c.subs || []).filter(s => s.id !== subject.id);
          const displaySubs = otherSubs.length > 0 ? otherSubs : c.subs;
          const companion = displaySubs[0] || (c.subs || []).find(s => s.id !== subject.id) || subject;

          const activeAvatarSrc = subject.avatarUrl || (taggedMedia[0] ? (taggedMedia[0].customThumbnail || taggedMedia[0].dataUrl) : null);
          const activeOverlayHTML = activeAvatarSrc
            ? `<img src="${activeAvatarSrc}" class="combination-active-overlay-thumb" title="Active: ${getSubjectDisplayName(subject)}">`
            : `<div class="combination-active-overlay-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--accent-pink);color:#fff;">👤</div>`;

          const companionTagged = currentMediaList.filter(m => m.subjectTags?.includes(companion.id));
          const g = getSubjectGroup(companion.groupId);
          const bClass = g?.cssClass || '';
          const mainThumbHTML = companion.avatarUrl 
            ? `<img src="${companion.avatarUrl}" class="combination-main-thumb ${bClass}" alt="${companion.name}">`
            : companionTagged[0]
              ? renderMediaThumbnailHTML(companionTagged[0], `combination-main-thumb ${bClass}`)
              : `<div class="combination-main-thumb ${bClass}" style="display:flex;align-items:center;justify-content:center;font-size:54px;background:var(--bg-secondary);">👤</div>`;

          const actColor = ACTION_HEX_MAP[c.maxActionCode] || '';
          const cardBgStyle = c.maxActionCode 
            ? `border: 2px solid ${actColor};`
            : `border: 1px solid var(--border-color);`;

          return `
            <div class="combination-element-card" data-combokey="${(c.subjectIds || [c.subjectId1, c.subjectId2]).join('::')}" style="${cardBgStyle}">
              ${activeOverlayHTML}
              ${mainThumbHTML}
              <div class="combination-card-overlay">
                <div style="font-weight:800; font-size:1.05rem; color:#fff; text-shadow:0 2px 4px rgba(0,0,0,0.9); margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${getSubjectDisplayName(companion)}
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
                  <span style="font-size:0.75rem; color:rgba(255,255,255,0.85); text-shadow:0 1px 3px #000;">${c.mediaCount} shared media</span>
                  <div style="display:flex; gap:6px;">
                    <span class="subject-stat-badge" style="color:#ff69b4; background:rgba(0,0,0,0.65); backdrop-filter:blur(4px); padding:2px 6px; border-radius:4px;">📘 ${c.heartPoints}</span>
                    <span class="subject-stat-badge" style="color:#38bdf8; background:rgba(0,0,0,0.65); backdrop-filter:blur(4px); padding:2px 6px; border-radius:4px;">📙 ${c.eventPoints}</span>
                  </div>
                </div>
              </div>
            </div>`;
        }).join('') : '<p class="text-muted" style="grid-column: 1 / -1;">No subject combinations found.</p>'}
      </div>

      <!-- 🪞 Subject Alikes Section -->
      <div style="background:var(--bg-card); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-color); margin-bottom:32px;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
          <h3 style="font-size:1.3rem; font-weight:800; margin:0;">🪞 ${getSubjectDisplayName(subject)}'s Alikes (${alikeList.length})</h3>
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <div style="display:flex; gap:6px; align-items:center;">
              <span class="text-muted" style="font-size:0.8rem; font-weight:700;">Sort:</span>
              <button class="btn btn-secondary btn-sm alike-sort-btn ${subjectAlikeSortKey === 'percentage' ? 'active' : ''}" data-sort="percentage">🪞 % Alike</button>
              <button class="btn btn-secondary btn-sm alike-sort-btn ${subjectAlikeSortKey === 'sldPoints' ? 'active' : ''}" data-sort="sldPoints">📘 SLD Points</button>
            </div>
            <div class="subject-autocomplete-container" style="min-width:200px;">
              <input type="text" id="subPageAlikeInput" class="input-text btn-sm" placeholder="+ Add Alike subject..." style="width:100%;">
              <div id="subPageAlikeAutocomplete" class="subject-autocomplete-dropdown"></div>
            </div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:16px;">
          ${alikeCardsHTML}
        </div>
      </div>

      <!-- 💭 Subject Thoughts Section -->
      <div style="background:var(--bg-card); padding:20px; border-radius:var(--radius-lg); border:1px solid var(--border-color); margin-bottom:32px;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
          <h3 style="font-size:1.3rem; font-weight:800; margin:0;">💭 ${getSubjectDisplayName(subject)}'s Thoughts (${thoughtsList.length})</h3>
          <div class="subject-autocomplete-container" style="min-width:200px;">
            <input type="text" id="subPageThoughtInput" class="input-text btn-sm" placeholder="+ Add Thought subject..." style="width:100%;">
            <div id="subPageThoughtAutocomplete" class="subject-autocomplete-dropdown"></div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:16px;">
          ${thoughtCardsHTML}
        </div>
      </div>

      <!-- Tagged Photos & Videos Section -->
      <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:16px;">
        <h3 style="font-size:1.3rem; font-weight:800; margin:0;">🖼️ ${getSubjectDisplayName(subject)}'s Media (${taggedMedia.length})</h3>
        <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-left:12px;">
          <span class="text-muted" style="font-size:0.8rem; font-weight:700;">Sort:</span>
          <button class="btn btn-secondary btn-sm media-sort-btn ${detailMediaSortKey === 'totalPoints' ? 'active' : ''}" data-sort="totalPoints">📘 SLD</button>
          <button class="btn btn-secondary btn-sm media-sort-btn ${detailMediaSortKey === 'pink' ? 'active' : ''}" data-sort="pink">🩷 Pink</button>
          <button class="btn btn-secondary btn-sm media-sort-btn ${detailMediaSortKey === 'grey' ? 'active' : ''}" data-sort="grey">🩶 Grey</button>
          <button class="btn btn-secondary btn-sm media-sort-btn ${detailMediaSortKey === 'blue' ? 'active' : ''}" data-sort="blue">🩵 Blue</button>
        </div>
      </div>

      <div class="media-grid">
        ${taggedMedia.map(m => `
          <div class="media-card sub-detail-media ${getMediaHighestPriorityGroupBorderClass(m)}" data-id="${m.id}" style="cursor:pointer;">
            ${renderMediaThumbnailHTML(m)}
          </div>`).join('')}
      </div>`;

    document.getElementById('backToSubjectsBtn').onclick = () => switchView('subjectsView');

    const detailGroupSelect = document.getElementById('detailSubGroupSelect');
    if (detailGroupSelect) {
      detailGroupSelect.onchange = async () => {
        const val = detailGroupSelect.value;
        if (val.startsWith('__')) {
          await handleGroupSelectAction(val, subject);
          return;
        }
        subject.groupId = val;
        await db.put('subjects', subject);
        await loadAppState();
        renderSubjectDetailsPage(stats);
      };
    }

    document.getElementById('renameDetailSubjectBtn').onclick = () => promptRenameSubject(subject);
    document.getElementById('deleteDetailSubjectBtn').onclick = () => deleteSubjectWithConfirmation(subject);

    const subDetailMenuBtn = document.getElementById('subDetailMenuBtn');
    const subDetailDropdown = document.getElementById('subDetailDropdown');
    if (subDetailMenuBtn && subDetailDropdown) {
      subDetailMenuBtn.onclick = (e) => {
        e.stopPropagation();
        subDetailDropdown.style.display = subDetailDropdown.style.display === 'none' ? 'block' : 'none';
      };
      document.addEventListener('click', (e) => {
        if (!subDetailMenuBtn.contains(e.target) && !subDetailDropdown.contains(e.target)) {
          subDetailDropdown.style.display = 'none';
        }
      });
    }

    const avatarEl = container.querySelector('.sub-avatar-clickable');
    if (avatarEl) avatarEl.onclick = () => openAvatarPhotoPicker(subject.id);

    setupSmartDateAutocomplete('subPageEventDateInput', 'subPageEventDateAutocomplete');
    document.getElementById('subPageEventDateInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const rawDate = e.target.value;
        const parsedDate = parseSmartDateInput(rawDate);
        openEventCreationWizard(parsedDate, [subject.id]);
      }
    });

    const createEvtBtn = document.getElementById('subPageCreateEventBtn');
    if (createEvtBtn) {
      createEvtBtn.onclick = () => {
        const dateInput = document.getElementById('subPageEventDateInput');
        const rawDate = dateInput?.value || '';
        const parsedDate = parseSmartDateInput(rawDate);
        openEventCreationWizard(parsedDate, [subject.id]);
      };
    }

    const yearFilter = document.getElementById('subEventYearFilter');
    if (yearFilter) {
      yearFilter.onchange = () => {
        selectedEventYear = yearFilter.value;
        renderSubjectDetailsPage(stats);
      };
    }

    const monthFilter = document.getElementById('subEventMonthFilter');
    if (monthFilter) {
      monthFilter.onchange = () => {
        selectedEventMonth = monthFilter.value;
        renderSubjectDetailsPage(stats);
      };
    }

    try {
      renderSubjectEventPointsTimelineChart('subEventTimelineChart', subject.id);
      renderSubjectSldHeartPointsTimelineChart('subSldTimelineChart', subject.id);
    } catch (chartErr) {
      console.warn('Timeline chart error:', chartErr);
    }

    // Combination Element Clicks & Sort Buttons
    container.querySelectorAll('.combination-element-card').forEach(el => {
      el.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const comboKey = el.getAttribute('data-combokey');
        if (comboKey) {
          activeDetailComboKey = comboKey;
          switchView('combinationDetailsView');
        }
      };
    });

    container.querySelectorAll('.combo-sort-btn').forEach(btn => {
      const k = btn.getAttribute('data-sort');
      const idx = subjectDetailComboSortHistory.indexOf(k);
      const isPrimary = (k === detailComboSortKey);

      let label = btn.getAttribute('data-base-label') || btn.textContent.replace(/[▲▼]/g, '').trim();
      btn.setAttribute('data-base-label', label);
      btn.textContent = isPrimary ? `${label} ${detailComboSortDir === 'asc' ? '▲' : '▼'}` : label;

      if (idx === 0) {
        btn.style.background = 'var(--accent-pink)';
        btn.style.color = '#ffffff';
        btn.style.borderColor = 'var(--accent-pink)';
        btn.style.fontWeight = '800';
      } else if (idx === 1) {
        btn.style.background = 'rgba(255, 105, 180, 0.45)';
        btn.style.color = '#ffffff';
        btn.style.borderColor = 'rgba(255, 105, 180, 0.6)';
        btn.style.fontWeight = '700';
      } else if (idx === 2) {
        btn.style.background = 'rgba(255, 105, 180, 0.22)';
        btn.style.color = '#ffffff';
        btn.style.borderColor = 'rgba(255, 105, 180, 0.35)';
        btn.style.fontWeight = '600';
      } else {
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }

      btn.onclick = (e) => {
        e.preventDefault();
        if (detailComboSortKey === k) detailComboSortDir = detailComboSortDir === 'asc' ? 'desc' : 'asc';
        else { detailComboSortKey = k; detailComboSortDir = 'desc'; }

        const histIdx = subjectDetailComboSortHistory.indexOf(k);
        if (histIdx >= 0) subjectDetailComboSortHistory.splice(histIdx, 1);
        subjectDetailComboSortHistory.unshift(k);
        if (subjectDetailComboSortHistory.length > 3) subjectDetailComboSortHistory.pop();

        renderSubjectDetailsPage(stats);
      };
    });

    // Media Sort Buttons
    container.querySelectorAll('.media-sort-btn').forEach(btn => {
      const k = btn.getAttribute('data-sort');
      const idx = subjectDetailMediaSortHistory.indexOf(k);
      const isPrimary = (k === detailMediaSortKey);

      let label = btn.getAttribute('data-base-label') || btn.textContent.replace(/[▲▼]/g, '').trim();
      btn.setAttribute('data-base-label', label);
      btn.textContent = isPrimary ? `${label} ${detailMediaSortDir === 'asc' ? '▲' : '▼'}` : label;

      if (idx === 0) {
        btn.style.background = 'var(--accent-pink)';
        btn.style.color = '#ffffff';
        btn.style.borderColor = 'var(--accent-pink)';
        btn.style.fontWeight = '800';
      } else if (idx === 1) {
        btn.style.background = 'rgba(255, 105, 180, 0.45)';
        btn.style.color = '#ffffff';
        btn.style.borderColor = 'rgba(255, 105, 180, 0.6)';
        btn.style.fontWeight = '700';
      } else if (idx === 2) {
        btn.style.background = 'rgba(255, 105, 180, 0.22)';
        btn.style.color = '#ffffff';
        btn.style.borderColor = 'rgba(255, 105, 180, 0.35)';
        btn.style.fontWeight = '600';
      } else {
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }

      btn.onclick = (e) => {
        e.preventDefault();
        if (detailMediaSortKey === k) detailMediaSortDir = detailMediaSortDir === 'asc' ? 'desc' : 'asc';
        else { detailMediaSortKey = k; detailMediaSortDir = 'desc'; }

        const histIdx = subjectDetailMediaSortHistory.indexOf(k);
        if (histIdx >= 0) subjectDetailMediaSortHistory.splice(histIdx, 1);
        subjectDetailMediaSortHistory.unshift(k);
        if (subjectDetailMediaSortHistory.length > 3) subjectDetailMediaSortHistory.pop();

        renderSubjectDetailsPage(stats);
      };
    });

    container.querySelectorAll('.sub-detail-media').forEach(card => {
      card.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mediaId = card.getAttribute('data-id');
        if (mediaId) openLightboxById(mediaId, false, { type: 'subject', id: subject.id, name: getSubjectDisplayName(subject) });
      };
    });

    // Alikes Autocomplete, Sort, Edit, Remove
    setupSmartSubjectAutocomplete('subPageAlikeInput', 'subPageAlikeAutocomplete', async (targetSubId) => {
      if (targetSubId === subject.id) return;
      subject.alikeSubjects = subject.alikeSubjects || [];
      if (!subject.alikeSubjects.some(a => a.targetSubjectId === targetSubId)) {
        subject.alikeSubjects.push({ targetSubjectId: targetSubId, percentage: 15.0 });
        await db.put('subjects', subject);
        await loadAppState();
        renderSubjectDetailsPage(stats);
      }
    });

    container.querySelectorAll('.alike-sort-btn').forEach(btn => {
      btn.onclick = () => {
        const k = btn.getAttribute('data-sort');
        if (subjectAlikeSortKey === k) {
          subjectAlikeSortDir = subjectAlikeSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          subjectAlikeSortKey = k;
          subjectAlikeSortDir = 'desc';
        }
        renderSubjectDetailsPage(stats);
      };
    });

    container.querySelectorAll('.edit-alike-pct-input').forEach(input => {
      input.onclick = (e) => e.stopPropagation();
      input.onchange = async (e) => {
        const targetId = input.getAttribute('data-targetid');
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val < 0.1) val = 0.1;
        if (val > 99.9) val = 99.9;
        val = Math.round(val * 10) / 10;
        input.value = val;

        subject.alikeSubjects = subject.alikeSubjects || [];
        const item = subject.alikeSubjects.find(a => a.targetSubjectId === targetId);
        if (item) {
          item.percentage = val;
          await db.put('subjects', subject);
          await loadAppState();
          renderSubjectDetailsPage(stats);
        }
      };
    });

    container.querySelectorAll('.remove-alike-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-targetid');
        subject.alikeSubjects = (subject.alikeSubjects || []).filter(a => a.targetSubjectId !== targetId);
        await db.put('subjects', subject);
        await loadAppState();
        renderSubjectDetailsPage(stats);
      };
    });

    // Thoughts Autocomplete, Edit, Remove
    setupSmartSubjectAutocomplete('subPageThoughtInput', 'subPageThoughtAutocomplete', async (targetSubId) => {
      if (targetSubId === subject.id) return;
      subject.thoughtSubjects = subject.thoughtSubjects || [];
      if (!subject.thoughtSubjects.some(t => t.targetSubjectId === targetSubId)) {
        subject.thoughtSubjects.push({ targetSubjectId: targetSubId, beauty: 0, hotness: 0, personality: 0 });
        await db.put('subjects', subject);
        await loadAppState();
        renderSubjectDetailsPage(stats);
      }
    });

    const bindThoughtEdit = (selector, field) => {
      container.querySelectorAll(selector).forEach(input => {
        input.onclick = (e) => e.stopPropagation();
        input.onchange = async (e) => {
          const targetId = input.getAttribute('data-targetid');
          let val = parseInt(e.target.value, 10);
          if (isNaN(val)) val = 0;
          input.value = val;

          subject.thoughtSubjects = subject.thoughtSubjects || [];
          const item = subject.thoughtSubjects.find(t => t.targetSubjectId === targetId);
          if (item) {
            item[field] = val;
            await db.put('subjects', subject);
          }
        };
      });
    };

    bindThoughtEdit('.edit-thought-beauty-input', 'beauty');
    bindThoughtEdit('.edit-thought-hotness-input', 'hotness');
    bindThoughtEdit('.edit-thought-personality-input', 'personality');

    container.querySelectorAll('.remove-thought-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const targetId = btn.getAttribute('data-targetid');
        subject.thoughtSubjects = (subject.thoughtSubjects || []).filter(t => t.targetSubjectId !== targetId);
        await db.put('subjects', subject);
        await loadAppState();
        renderSubjectDetailsPage(stats);
      };
    });
  } catch (err) {
    console.error('Error rendering subject details page:', err);
    const container = document.getElementById('subjectDetailsContent');
    if (container) {
      container.innerHTML = `<div style="padding:24px;"><button class="btn btn-secondary btn-sm" onclick="switchView('subjectsView')">← Back to Subjects</button><h3 class="text-danger" style="margin-top:16px;">Error loading subject details</h3><p class="text-muted">${err.message || err}</p></div>`;
    }
  }
}

window.renderSubjectDetailsPage = renderSubjectDetailsPage;
