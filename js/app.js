/**
 * Portable Media Viewer & Analytics - Main Application Coordinator
 */
import { db } from './db.js';
import { processAllStats, calculateMediaHeartPoints } from './scoring.js';
import { openAvatarCropper, setupCropperEventListeners } from './cropperModal.js';
import { exportFullProfilePackage, exportDataOnlyJSON, importPackageZip } from './zipManager.js';
import { renderPinkAccumulationChart, renderSubjectLeaderboardChart, renderCombinationsChart } from './charts.js';

// Application State
let currentMediaList = [];
let currentSubjectsList = [];
let currentEventsList = [];
let currentWeights = {};
let currentActiveView = 'mediaBrowserView';

let selectedMediaIds = new Set();
let lightboxIndex = -1;

// Subject Details / Combination Details State
let activeDetailSubjectId = null;
let activeDetailComboKey = null;

// Multi-tag Heart Temp State (0..3 per type)
let batchHeartState = { pink: 0, grey: 0, blue: 0 };

document.addEventListener('DOMContentLoaded', async () => {
  await db.init();
  await loadAppState();
  setupNavigation();
  setupEventListeners();
  setupCropperEventListeners();
  renderCurrentView();
});

async function loadAppState() {
  currentWeights = (await db.getSetting('scoringWeights')) || { heart1: 1, heart2: 3, heart3: 10, eventCCount: 10, eventTag: 1 };
  const theme = (await db.getSetting('theme')) || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  currentMediaList = await db.getActiveMedia();
  currentSubjectsList = await db.getActiveSubjects();
  currentEventsList = await db.getActiveEvents();

  // Profile Header Pill Update
  const activeProfileId = await db.getActiveProfileId();
  const profiles = await db.getAll('profiles');
  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const profilePill = document.getElementById('activeProfilePill');
  if (profilePill && activeProfile) {
    profilePill.textContent = `📁 ${activeProfile.name}`;
  }
}

/* NAVIGATION & SPA ROUTING */
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewId = item.getAttribute('data-view');
      switchView(viewId);
    });
  });
}

function switchView(viewId) {
  currentActiveView = viewId;
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-view') === viewId);
  });
  document.querySelectorAll('.view-page').forEach(el => {
    el.classList.toggle('active', el.id === viewId);
  });
  renderCurrentView();
}

function renderCurrentView() {
  const stats = processAllStats(currentMediaList, currentSubjectsList, currentEventsList, currentWeights);

  switch (currentActiveView) {
    case 'mediaBrowserView':
      renderMediaBrowser();
      break;
    case 'subjectsView':
      renderSubjectsPage(stats);
      break;
    case 'subjectDetailsView':
      renderSubjectDetailsPage(stats);
      break;
    case 'combinationDetailsView':
      renderCombinationDetailsPage(stats);
      break;
    case 'eventsView':
      renderEventsPage(stats);
      break;
    case 'eventDetailsView':
      renderEventDetailsPage();
      break;
    case 'statsView':
      renderStatsPage(stats);
      break;
    case 'settingsView':
      renderSettingsPage();
      break;
  }
}

/* ==========================================================================
   1. MEDIA BROWSER & LIGHTBOX
   ========================================================================== */

function renderMediaBrowser() {
  const gridContainer = document.getElementById('mediaGrid');
  const selectionBanner = document.getElementById('selectionBanner');
  const selectedCountEl = document.getElementById('selectedCount');

  if (selectedMediaIds.size > 0) {
    selectionBanner.style.display = 'flex';
    selectedCountEl.textContent = `${selectedMediaIds.size} file(s) selected`;
  } else {
    selectionBanner.style.display = 'none';
  }

  if (currentMediaList.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">📁</div>
        <h3>No media files added yet</h3>
        <p>Click "Upload Media" above or drag & drop photos/videos here to start.</p>
      </div>`;
    return;
  }

  // Search & Filter Query
  const searchQuery = (document.getElementById('mediaSearchInput')?.value || '').toLowerCase();
  const filterTag = document.getElementById('mediaFilterTagSelect')?.value || 'all';

  const filtered = currentMediaList.filter(m => {
    if (searchQuery) {
      const matchName = m.filename.toLowerCase().includes(searchQuery);
      const matchSubjects = (m.subjectTags || []).some(s => s.toLowerCase().includes(searchQuery));
      const matchNormal = (m.normalTags || []).some(t => t.toLowerCase().includes(searchQuery));
      if (!matchName && !matchSubjects && !matchNormal) return false;
    }
    if (filterTag !== 'all') {
      if (filterTag === 'pink3' && m.heartTags?.pink !== 3) return false;
      if (filterTag === 'hasSubjects' && (!m.subjectTags || m.subjectTags.length === 0)) return false;
    }
    return true;
  });

  gridContainer.innerHTML = filtered.map((m, idx) => {
    const isSelected = selectedMediaIds.has(m.id);
    const pinkCount = m.heartTags?.pink || 0;
    const greyCount = m.heartTags?.grey || 0;
    const blueCount = m.heartTags?.blue || 0;

    const subjectPills = (m.subjectTags || []).map(subId => {
      const sub = currentSubjectsList.find(s => s.id === subId);
      return `<span class="subject-tag-pill">${sub ? sub.name : subId}</span>`;
    }).join('');

    return `
      <div class="media-card ${isSelected ? 'selected' : ''}" data-id="${m.id}" data-idx="${idx}">
        <img src="${m.dataUrl}" class="media-thumbnail" alt="${m.filename}">
        <div class="media-card-overlay">
          <input type="checkbox" class="media-checkbox" data-id="${m.id}" ${isSelected ? 'checked' : ''}>
          <div class="media-card-badges">
            ${pinkCount > 0 ? `<span class="heart-badge pink">💖 ${pinkCount}</span>` : ''}
            ${greyCount > 0 ? `<span class="heart-badge grey">🩶 ${greyCount}</span>` : ''}
            ${blueCount > 0 ? `<span class="heart-badge blue">🩵 ${blueCount}</span>` : ''}
            ${subjectPills}
          </div>
        </div>
      </div>`;
  }).join('');

  // Attach Grid Event Listeners
  gridContainer.querySelectorAll('.media-card').forEach(card => {
    const id = card.getAttribute('data-id');
    const checkbox = card.querySelector('.media-checkbox');

    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMediaSelection(id);
    });

    card.addEventListener('click', () => {
      const originalIdx = currentMediaList.findIndex(m => m.id === id);
      openLightbox(originalIdx);
    });
  });
}

function toggleMediaSelection(mediaId) {
  if (selectedMediaIds.has(mediaId)) {
    selectedMediaIds.delete(mediaId);
  } else {
    selectedMediaIds.add(mediaId);
  }
  renderMediaBrowser();
}

/* Lightbox Functions */
function openLightbox(index) {
  if (index < 0 || index >= currentMediaList.length) return;
  lightboxIndex = index;

  const modal = document.getElementById('lightboxModal');
  modal.classList.add('active');
  renderLightboxContent();
}

function closeLightbox() {
  const modal = document.getElementById('lightboxModal');
  modal.classList.remove('active');
  lightboxIndex = -1;
}

function renderLightboxContent() {
  if (lightboxIndex < 0 || lightboxIndex >= currentMediaList.length) return;
  const media = currentMediaList[lightboxIndex];

  const container = document.getElementById('lightboxMediaContainer');
  const titleEl = document.getElementById('lightboxTitle');
  const counterEl = document.getElementById('lightboxCounter');

  titleEl.textContent = media.filename;
  counterEl.textContent = `${lightboxIndex + 1} of ${currentMediaList.length}`;

  if (media.type?.startsWith('video')) {
    container.innerHTML = `<video src="${media.dataUrl}" controls autoplay></video>`;
  } else {
    container.innerHTML = `<img src="${media.dataUrl}" alt="${media.filename}">`;
  }

  // Update Heart Toggle Buttons in Lightbox Footer
  updateHeartButtonUI('lbPinkHeartBtn', media.heartTags?.pink || 0, '💖');
  updateHeartButtonUI('lbGreyHeartBtn', media.heartTags?.grey || 0, '🩶');
  updateHeartButtonUI('lbBlueHeartBtn', media.heartTags?.blue || 0, '🩵');

  // Update Date Tag Input
  const dateInput = document.getElementById('lbDateInput');
  if (dateInput) {
    dateInput.value = media.dateTag || new Date().toISOString().slice(0, 16);
  }
}

function updateHeartButtonUI(btnId, count, emoji) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.className = `heart-toggle-btn active-${count}`;
  btn.innerHTML = `${emoji.repeat(count || 1)} <span>${count}</span>`;
}

async function toggleActiveLightboxHeart(type) {
  if (lightboxIndex < 0 || lightboxIndex >= currentMediaList.length) return;
  const media = currentMediaList[lightboxIndex];

  if (!media.heartTags) media.heartTags = { pink: 0, grey: 0, blue: 0 };
  const currentCount = media.heartTags[type] || 0;
  const newCount = (currentCount + 1) % 4; // Toggles 0 -> 1 -> 2 -> 3 -> 0

  media.heartTags[type] = newCount;
  await db.put('media', media);
  renderLightboxContent();
  renderCurrentView();
}

/* Multi-select Batch Tagging */
function openBatchTagModal() {
  if (selectedMediaIds.size === 0) return;
  batchHeartState = { pink: 0, grey: 0, blue: 0 };

  const modal = document.getElementById('batchTagModal');
  modal.classList.add('active');

  // Set default date input
  document.getElementById('batchDateInput').value = new Date().toISOString().slice(0, 16);
  renderBatchHeartButtons();
  renderSubjectCheckboxList('batchSubjectCheckboxes');
}

function renderBatchHeartButtons() {
  updateHeartButtonUI('batchPinkBtn', batchHeartState.pink, '💖');
  updateHeartButtonUI('batchGreyBtn', batchHeartState.grey, '🩶');
  updateHeartButtonUI('batchBlueBtn', batchHeartState.blue, '🩵');
}

function renderSubjectCheckboxList(containerId, selectedSubIds = []) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (currentSubjectsList.length === 0) {
    container.innerHTML = `<p class="text-muted">No subjects created yet. Add subjects first.</p>`;
    return;
  }

  container.innerHTML = currentSubjectsList.map(s => {
    const checked = selectedSubIds.includes(s.id);
    return `
      <label style="display:inline-flex; align-items:center; gap:6px; margin-right:12px; margin-bottom:8px; cursor:pointer;">
        <input type="checkbox" value="${s.id}" class="sub-check" ${checked ? 'checked' : ''}>
        <span>${s.name}</span>
      </label>`;
  }).join('');
}

async function saveBatchTags() {
  const dateVal = document.getElementById('batchDateInput').value;
  const selectedSubCheckboxes = document.querySelectorAll('#batchSubjectCheckboxes .sub-check:checked');
  const chosenSubIds = Array.from(selectedSubCheckboxes).map(cb => cb.value);

  const normalTagsVal = document.getElementById('batchNormalTagsInput').value;
  const normalTags = normalTagsVal ? normalTagsVal.split(',').map(t => t.trim()).filter(Boolean) : [];

  for (const mediaId of selectedMediaIds) {
    const media = currentMediaList.find(m => m.id === mediaId);
    if (media) {
      if (dateVal) media.dateTag = dateVal;
      media.heartTags = { ...batchHeartState };
      media.subjectTags = chosenSubIds;
      if (normalTags.length > 0) media.normalTags = normalTags;
      await db.put('media', media);
    }
  }

  selectedMediaIds.clear();
  document.getElementById('batchTagModal').classList.remove('active');
  await loadAppState();
  renderCurrentView();
}

/* ==========================================================================
   2. SUBJECTS & COMBINATIONS
   ========================================================================== */

function renderSubjectsPage(stats) {
  const gridContainer = document.getElementById('subjectCardsGrid');
  const singleLeaderboardContainer = document.getElementById('singleSubjectLeaderboard');
  const comboLeaderboardContainer = document.getElementById('comboSubjectLeaderboard');

  // Render Subject Cards
  if (currentSubjectsList.length === 0) {
    gridContainer.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="empty-state-icon">👥</div>
        <h3>No Subjects Added</h3>
        <p>Click "Add Subject" to create subject profiles.</p>
      </div>`;
  } else {
    gridContainer.innerHTML = currentSubjectsList.map(sub => {
      const sStat = stats.allSubjectStats.find(s => s.subject.id === sub.id) || { totalPoints: 0, heartPoints: 0, eventPoints: 0, mediaCount: 0 };
      
      // Fallback avatar selection logic: prefer cropped avatar, else solo photo, else first photo
      let avatarSrc = sub.avatarUrl;
      if (!avatarSrc) {
        const taggedMedia = currentMediaList.filter(m => m.subjectTags?.includes(sub.id));
        const soloMedia = taggedMedia.find(m => m.subjectTags.length === 1);
        avatarSrc = (soloMedia || taggedMedia[0])?.dataUrl || '';
      }

      return `
        <div class="subject-card" data-id="${sub.id}">
          ${avatarSrc ? `<img src="${avatarSrc}" class="subject-avatar-lg" alt="${sub.name}">` : `<div class="subject-avatar-lg" style="display:flex;align-items:center;justify-content:center;font-size:32px;">👤</div>`}
          <div class="subject-name">${sub.name}</div>
          <div class="subject-stats-row">
            <div class="stat-item">
              <span class="stat-value" style="color:var(--accent-pink);">${sStat.totalPoints}</span>
              <span class="stat-label">Total Pts</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${sStat.heartPoints}</span>
              <span class="stat-label">Hearts</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${sStat.eventPoints}</span>
              <span class="stat-label">Events</span>
            </div>
          </div>
        </div>`;
    }).join('');

    gridContainer.querySelectorAll('.subject-card').forEach(card => {
      card.addEventListener('click', () => {
        activeDetailSubjectId = card.getAttribute('data-id');
        switchView('subjectDetailsView');
      });
    });
  }

  // Render Top Subjects Leaderboard
  singleLeaderboardContainer.innerHTML = stats.allSubjectStats.slice(0, 5).map((stat, idx) => `
    <div class="leader-item" data-id="${stat.subject.id}">
      <span class="leader-rank">#${idx + 1}</span>
      <div class="leader-info">
        <span class="font-bold">${stat.subject.name}</span>
      </div>
      <span class="badge" style="background:rgba(236,72,153,0.2); color:var(--accent-pink);">${stat.totalPoints} pts</span>
    </div>`).join('');

  singleLeaderboardContainer.querySelectorAll('.leader-item').forEach(item => {
    item.addEventListener('click', () => {
      activeDetailSubjectId = item.getAttribute('data-id');
      switchView('subjectDetailsView');
    });
  });

  // Render Top Subject Combinations Leaderboard
  comboLeaderboardContainer.innerHTML = stats.allCombinations.slice(0, 5).map((combo, idx) => `
    <div class="leader-item" data-combokey="${combo.subjectId1}::${combo.subjectId2}">
      <span class="leader-rank">#${idx + 1}</span>
      <div class="leader-info">
        <span>${combo.name}</span>
      </div>
      <span class="badge" style="background:rgba(56,189,248,0.2); color:var(--accent-blue);">${combo.totalPoints} pts</span>
    </div>`).join('');

  comboLeaderboardContainer.querySelectorAll('.leader-item').forEach(item => {
    item.addEventListener('click', () => {
      activeDetailComboKey = item.getAttribute('data-combokey');
      switchView('combinationDetailsView');
    });
  });
}

function renderSubjectDetailsPage(stats) {
  const container = document.getElementById('subjectDetailsContent');
  if (!activeDetailSubjectId) {
    switchView('subjectsView');
    return;
  }

  const subject = currentSubjectsList.find(s => s.id === activeDetailSubjectId);
  const sStat = stats.allSubjectStats.find(s => s.subject.id === activeDetailSubjectId) || { totalPoints: 0, heartPoints: 0, eventPoints: 0, mediaCount: 0, coOccurrences: new Map() };

  if (!subject) return;

  // Fallback avatar selection
  let avatarSrc = subject.avatarUrl;
  const taggedMedia = currentMediaList.filter(m => m.subjectTags?.includes(subject.id));
  if (!avatarSrc) {
    const soloMedia = taggedMedia.find(m => m.subjectTags.length === 1);
    avatarSrc = (soloMedia || taggedMedia[0])?.dataUrl || '';
  }

  // Co-occurrence list
  const coOccurEntries = Array.from(sStat.coOccurrences.entries()).map(([otherId, count]) => {
    const otherSub = currentSubjectsList.find(s => s.id === otherId);
    return { otherId, name: otherSub ? otherSub.name : 'Unknown', count };
  });

  container.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="backToSubjectsBtn" style="margin-bottom:16px;">← Back to Subjects</button>
    <div class="subject-card" style="max-width:100%; text-align:left; flex-direction:row; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:20px;">
      <div style="display:flex; align-items:center; gap:20px;">
        ${avatarSrc ? `<img src="${avatarSrc}" class="subject-avatar-lg" style="margin-bottom:0;" alt="${subject.name}">` : `<div class="subject-avatar-lg" style="margin-bottom:0; display:flex;align-items:center;justify-content:center;font-size:32px;">👤</div>`}
        <div>
          <h2>${subject.name}</h2>
          <p class="text-muted">Total Score: <strong style="color:var(--accent-pink);">${sStat.totalPoints} pts</strong> (${sStat.heartPoints} Hearts + ${sStat.eventPoints} Events)</p>
        </div>
      </div>
      <button class="btn btn-primary" id="cropSubjectAvatarBtn">✂️ Crop Official Avatar</button>
    </div>

    <h3 style="margin:24px 0 12px 0;">Co-Occurring Subjects</h3>
    <div style="display:flex; gap:10px; flex-wrap:wrap;">
      ${coOccurEntries.length > 0 ? coOccurEntries.map(co => `
        <div class="profile-pill" data-otherid="${co.otherId}">
          <span>${co.name} (${co.count} photos)</span>
          <button class="btn btn-secondary btn-sm combo-btn" data-combokey="${[subject.id, co.otherId].sort().join('::')}">View Combination</button>
        </div>`).join('') : '<p class="text-muted">No co-occurring subject photos found.</p>'}
    </div>

    <h3 style="margin:24px 0 12px 0;">Tagged Photos & Videos (${taggedMedia.length})</h3>
    <div class="media-grid">
      ${taggedMedia.map(m => `
        <div class="media-card">
          <img src="${m.dataUrl}" class="media-thumbnail" alt="${m.filename}">
        </div>`).join('')}
    </div>`;

  document.getElementById('backToSubjectsBtn').onclick = () => switchView('subjectsView');

  // Avatar Crop Button Listener
  const cropBtn = document.getElementById('cropSubjectAvatarBtn');
  if (cropBtn) {
    cropBtn.onclick = () => {
      if (taggedMedia.length === 0) {
        alert('Please tag at least one photo with this subject before cropping an avatar.');
        return;
      }
      openAvatarCropper(taggedMedia[0].dataUrl, subject.id, async (croppedDataUrl) => {
        subject.avatarUrl = croppedDataUrl;
        await db.put('subjects', subject);
        await loadAppState();
        renderCurrentView();
      });
    };
  }

  container.querySelectorAll('.combo-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeDetailComboKey = btn.getAttribute('data-combokey');
      switchView('combinationDetailsView');
    });
  });
}

function renderCombinationDetailsPage(stats) {
  const container = document.getElementById('combinationDetailsContent');
  if (!activeDetailComboKey) {
    switchView('subjectsView');
    return;
  }

  const combo = stats.allCombinations.find(c => `${c.subjectId1}::${c.subjectId2}` === activeDetailComboKey);
  if (!combo) return;

  const sharedMedia = currentMediaList.filter(m => m.subjectTags?.includes(combo.subjectId1) && m.subjectTags?.includes(combo.subjectId2));

  container.innerHTML = `
    <button class="btn btn-secondary btn-sm" id="backToSubjectsComboBtn" style="margin-bottom:16px;">← Back to Subjects</button>
    <div class="subject-card" style="max-width:100%; text-align:left;">
      <h2>Combination: ${combo.name}</h2>
      <p style="margin-top:8px;">Total Combined Score: <strong style="color:var(--accent-blue);">${combo.totalPoints} pts</strong> (${combo.heartPoints} Heart Pts, ${combo.eventPoints} Event Pts)</p>
      <p class="text-muted">Featured together in <strong>${sharedMedia.length}</strong> media file(s).</p>
    </div>

    <h3 style="margin:24px 0 12px 0;">Shared Media Gallery</h3>
    <div class="media-grid">
      ${sharedMedia.map(m => `
        <div class="media-card">
          <img src="${m.dataUrl}" class="media-thumbnail" alt="${m.filename}">
        </div>`).join('')}
    </div>`;

  document.getElementById('backToSubjectsComboBtn').onclick = () => switchView('subjectsView');
}

/* ==========================================================================
   3. EVENTS SYSTEM
   ========================================================================== */

function renderEventsPage(stats) {
  const tableBody = document.getElementById('eventsTableBody');

  if (currentEventsList.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          No events created yet. Click "Add Event" to record events and subject c counts.
        </td>
      </tr>`;
    return;
  }

  // Sort Chronologically
  const sortedEvents = currentEventsList.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  tableBody.innerHTML = sortedEvents.map(evt => {
    const dateStr = new Date(evt.date).toLocaleString();
    const tagBadge = `<span class="event-tag-badge event-tag-${evt.eventCode || 1}">Event ${evt.eventCode || 1}</span>`;

    const participants = Object.keys(evt.subjectCounts || {}).map(subId => {
      const sub = currentSubjectsList.find(s => s.id === subId);
      const cCount = evt.subjectCounts[subId];
      return `<strong>${sub ? sub.name : 'Unknown'}</strong> (c=${cCount})`;
    }).join(', ');

    return `
      <tr data-id="${evt.id}">
        <td>${dateStr}</td>
        <td>${tagBadge}</td>
        <td>${participants || 'None'}</td>
        <td>${(evt.mediaIds || []).length} files</td>
        <td><button class="btn btn-secondary btn-sm view-evt-btn" data-id="${evt.id}">View Details</button></td>
      </tr>`;
  }).join('');

  tableBody.querySelectorAll('.view-evt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const evtId = btn.getAttribute('data-id');
      openEventDetails(evtId);
    });
  });
}

function openEventDetails(evtId) {
  const evt = currentEventsList.find(e => e.id === evtId);
  if (!evt) return;

  const modal = document.getElementById('eventDetailsModal');
  const body = document.getElementById('eventDetailsBody');

  const dateStr = new Date(evt.date).toLocaleString();
  const tagBadge = `<span class="event-tag-badge event-tag-${evt.eventCode || 1}">Event ${evt.eventCode || 1}</span>`;

  const participantsList = Object.keys(evt.subjectCounts || {}).map(subId => {
    const sub = currentSubjectsList.find(s => s.id === subId);
    const cCount = evt.subjectCounts[subId];
    return `<li><strong>${sub ? sub.name : 'Unknown'}</strong> - c count: ${cCount}</li>`;
  }).join('');

  const assignedMedia = currentMediaList.filter(m => (evt.mediaIds || []).includes(m.id));

  body.innerHTML = `
    <h4>${dateStr} ${tagBadge}</h4>
    <p style="margin-top:8px;">${evt.notes || 'No description provided.'}</p>
    <h5 style="margin-top:16px;">Participant C-Counts:</h5>
    <ul>${participantsList || 'None'}</ul>
    <h5 style="margin-top:16px;">Assigned Photos & Videos (${assignedMedia.length}):</h5>
    <div class="media-grid" style="margin-top:8px;">
      ${assignedMedia.map(m => `<div class="media-card"><img src="${m.dataUrl}" class="media-thumbnail"></div>`).join('')}
    </div>`;

  modal.classList.add('active');
}

/* ==========================================================================
   4. STATS & PLOTLY DIAGRAMS
   ========================================================================== */

function renderStatsPage(stats) {
  document.getElementById('statTotal3Pinks').textContent = stats.total3PinkHearts;
  
  const leaderCard = document.getElementById('greyLeaderCard');
  if (stats.greyHeartLeader) {
    leaderCard.innerHTML = `
      <img src="${stats.greyHeartLeader.dataUrl}" style="width:60px; height:60px; border-radius:var(--radius-md); object-fit:cover;">
      <div>
        <div style="font-weight:700;">${stats.greyHeartLeader.filename}</div>
        <div class="text-muted">Grey Heart Score: <strong style="color:var(--accent-grey);">${stats.maxGreyPts} pts</strong></div>
      </div>`;
  } else {
    leaderCard.innerHTML = `<span class="text-muted">No grey heart tags recorded.</span>`;
  }

  // Render Charts
  renderPinkAccumulationChart('pinkAccumulationChart', stats.timelineData);
  renderSubjectLeaderboardChart('subjectLeaderboardChart', stats.allSubjectStats);
  renderCombinationsChart('combinationsChart', stats.allCombinations);
}

/* ==========================================================================
   5. SETTINGS & PROFILE MANAGEMENT
   ========================================================================== */

async function renderSettingsPage() {
  const currentTheme = (await db.getSetting('theme')) || 'dark';
  document.getElementById('themeSelect').value = currentTheme;

  // Render Profiles List
  const profiles = await db.getAll('profiles');
  const activeProfileId = await db.getActiveProfileId();
  const profileListContainer = document.getElementById('profilesListContainer');

  profileListContainer.innerHTML = profiles.map(p => `
    <div class="leader-item">
      <div>
        <strong>${p.name}</strong> ${p.id === activeProfileId ? '<span class="badge" style="background:var(--accent-pink); color:#fff;">Active</span>' : ''}
      </div>
      <div style="display:flex; gap:8px;">
        ${p.id !== activeProfileId ? `<button class="btn btn-secondary btn-sm switch-profile-btn" data-id="${p.id}">Switch</button>` : ''}
        ${profiles.length > 1 ? `<button class="btn btn-danger btn-sm delete-profile-btn" data-id="${p.id}">Delete</button>` : ''}
      </div>
    </div>`).join('');

  profileListContainer.querySelectorAll('.switch-profile-btn').forEach(btn => {
    btn.onclick = async () => {
      await db.setActiveProfileId(btn.getAttribute('data-id'));
      await loadAppState();
      renderCurrentView();
    };
  });

  profileListContainer.querySelectorAll('.delete-profile-btn').forEach(btn => {
    btn.onclick = async () => {
      if (confirm('Are you sure you want to delete this profile?')) {
        await db.delete('profiles', btn.getAttribute('data-id'));
        const remaining = await db.getAll('profiles');
        await db.setActiveProfileId(remaining[0].id);
        await loadAppState();
        renderCurrentView();
      }
    };
  });
}

/* EVENT LISTENERS SETUP */
function setupEventListeners() {
  // Upload Media Listener
  const uploadInput = document.getElementById('mediaFileInput');
  if (uploadInput) {
    uploadInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      const activeProfileId = await db.getActiveProfileId();

      for (const file of files) {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const mediaItem = {
            id: 'media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            profileId: activeProfileId,
            filename: file.name,
            type: file.type,
            dataUrl: evt.target.result,
            dateTag: new Date().toISOString().slice(0, 16),
            heartTags: { pink: 0, grey: 0, blue: 0 },
            subjectTags: [],
            normalTags: []
          };
          await db.put('media', mediaItem);
          await loadAppState();
          renderCurrentView();
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Lightbox Heart Button Listeners
  document.getElementById('lbPinkHeartBtn')?.addEventListener('click', () => toggleActiveLightboxHeart('pink'));
  document.getElementById('lbGreyHeartBtn')?.addEventListener('click', () => toggleActiveLightboxHeart('grey'));
  document.getElementById('lbBlueHeartBtn')?.addEventListener('click', () => toggleActiveLightboxHeart('blue'));
  document.getElementById('closeLightboxBtn')?.addEventListener('click', closeLightbox);

  // Lightbox Arrow Navigation
  document.getElementById('lbPrevBtn')?.addEventListener('click', () => openLightbox(lightboxIndex - 1));
  document.getElementById('lbNextBtn')?.addEventListener('click', () => openLightbox(lightboxIndex + 1));
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('lightboxModal').classList.contains('active')) {
      if (e.key === 'ArrowLeft') openLightbox(lightboxIndex - 1);
      if (e.key === 'ArrowRight') openLightbox(lightboxIndex + 1);
      if (e.key === 'Escape') closeLightbox();
    }
  });

  // Batch Tagging Modal Buttons
  document.getElementById('batchTagBtn')?.addEventListener('click', openBatchTagModal);
  document.getElementById('cancelBatchTagBtn')?.addEventListener('click', () => document.getElementById('batchTagModal').classList.remove('active'));
  document.getElementById('saveBatchTagBtn')?.addEventListener('click', saveBatchTags);

  document.getElementById('batchPinkBtn')?.addEventListener('click', () => { batchHeartState.pink = (batchHeartState.pink + 1) % 4; renderBatchHeartButtons(); });
  document.getElementById('batchGreyBtn')?.addEventListener('click', () => { batchHeartState.grey = (batchHeartState.grey + 1) % 4; renderBatchHeartButtons(); });
  document.getElementById('batchBlueBtn')?.addEventListener('click', () => { batchHeartState.blue = (batchHeartState.blue + 1) % 4; renderBatchHeartButtons(); });

  // Add Subject Modal
  document.getElementById('addSubjectBtn')?.addEventListener('click', () => document.getElementById('addSubjectModal').classList.add('active'));
  document.getElementById('cancelAddSubjectBtn')?.addEventListener('click', () => document.getElementById('addSubjectModal').classList.remove('active'));
  document.getElementById('saveSubjectBtn')?.addEventListener('click', async () => {
    const nameInput = document.getElementById('subjectNameInput');
    if (nameInput.value.trim()) {
      const activeProfileId = await db.getActiveProfileId();
      await db.put('subjects', {
        id: 'sub-' + Date.now(),
        profileId: activeProfileId,
        name: nameInput.value.trim(),
        avatarUrl: null
      });
      nameInput.value = '';
      document.getElementById('addSubjectModal').classList.remove('active');
      await loadAppState();
      renderCurrentView();
    }
  });

  // Add Event Modal Listeners
  document.getElementById('addEventBtn')?.addEventListener('click', () => {
    const dateInput = document.getElementById('eventDateInput');
    if (dateInput) dateInput.value = new Date().toISOString().slice(0, 16);

    const cCountsContainer = document.getElementById('eventSubjectCCountsContainer');
    if (cCountsContainer) {
      if (currentSubjectsList.length === 0) {
        cCountsContainer.innerHTML = `<p class="text-muted">No subjects found. Please add subjects first.</p>`;
      } else {
        cCountsContainer.innerHTML = currentSubjectsList.map(s => `
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <span>${s.name}</span>
            <input type="number" min="0" value="0" class="input-text c-count-input" data-subid="${s.id}" style="width:80px;">
          </div>`).join('');
      }
    }
    document.getElementById('addEventModal').classList.add('active');
  });

  document.getElementById('cancelAddEventBtn')?.addEventListener('click', () => document.getElementById('addEventModal').classList.remove('active'));
  document.getElementById('closeEventDetailsBtn')?.addEventListener('click', () => document.getElementById('eventDetailsModal').classList.remove('active'));

  document.getElementById('saveEventBtn')?.addEventListener('click', async () => {
    const dateVal = document.getElementById('eventDateInput').value || new Date().toISOString();
    const eventCode = parseInt(document.getElementById('eventCodeSelect').value, 10) || 1;
    const notesVal = document.getElementById('eventNotesInput').value;

    const subjectCounts = {};
    document.querySelectorAll('.c-count-input').forEach(input => {
      const count = parseInt(input.value, 10) || 0;
      if (count > 0) {
        subjectCounts[input.getAttribute('data-subid')] = count;
      }
    });

    const activeProfileId = await db.getActiveProfileId();
    const newEvent = {
      id: 'evt-' + Date.now(),
      profileId: activeProfileId,
      date: dateVal,
      eventCode: eventCode,
      notes: notesVal,
      subjectCounts: subjectCounts,
      mediaIds: []
    };

    await db.put('events', newEvent);
    document.getElementById('addEventModal').classList.remove('active');
    await loadAppState();
    renderCurrentView();
  });

  // Export / Import Settings
  document.getElementById('exportZipBtn')?.addEventListener('click', async () => {
    const activeProfileId = await db.getActiveProfileId();
    const profiles = await db.getAll('profiles');
    const profile = profiles.find(p => p.id === activeProfileId);
    await exportFullProfilePackage(profile, currentMediaList, currentSubjectsList, currentEventsList);
  });

  document.getElementById('exportJsonBtn')?.addEventListener('click', async () => {
    const activeProfileId = await db.getActiveProfileId();
    const profiles = await db.getAll('profiles');
    const profile = profiles.find(p => p.id === activeProfileId);
    await exportDataOnlyJSON(profile, currentSubjectsList, currentEventsList, currentMediaList);
  });

  document.getElementById('importPackageInput')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      await importPackageZip(file, db);
      await loadAppState();
      renderCurrentView();
      alert('Package imported successfully!');
    }
  });

  // Theme Selector Listener
  document.getElementById('themeSelect')?.addEventListener('change', async (e) => {
    const val = e.target.value;
    document.documentElement.setAttribute('data-theme', val);
    await db.setSetting('theme', val);
  });
}
