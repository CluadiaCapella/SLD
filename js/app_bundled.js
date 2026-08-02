/**
 * Portable Media Viewer & Derived Data Analytics Dashboard
 * Unified Standalone Script (Subject Groups, Color Tinting, Grouped Media Browser, Content Hash Duplicate Prevention, 3-Deep Cascade Sorting & 4-Tier SLD System)
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. DATABASE MANAGER (IndexedDB) & ACTION TAGS / GROUPS MAP
     ========================================================================== */
  const DB_NAME = 'PortableMediaAppDB';
  const DB_VERSION = 1;

  const ACTION_TAG_NAMES = {
    1: '<ctrl42> Met', 2: '♎ Friendship', 3: '♍ Good friend', 4: '♌ Date',
    5: '♋ Kiss', 6: '♊ Cummable', 7: '♉ Oral', 8: '♈ Pen',
    9: '♓ Anal', 10: '♒ Ffm', 11: '♑ Fmm', 12: '♐ Orgy'
  };

  const DEFAULT_ACTION_POINTS = {
    1: 0.05, 2: 0.1, 3: 0.2, 4: 0.3, 5: 0.4, 6: 0.6,
    7: 0.8, 8: 1.0, 9: 2.0, 10: 5.0, 11: 5.0, 12: 8.0
  };

  const DEFAULT_MEDAL_SETTINGS = {
    goldPts: 1.0, silverPts: 0.3, bronzePts: 0.1,
    maxGold: 1, maxSilver: 2, maxBronze: 5
  };

  const DEFAULT_SUBJECT_GROUPS = [
    { id: 'brown', name: '🟤 Brown', emoji: '🟤', color: '#a16207', cssClass: 'group-border-brown', isBuiltIn: true },
    { id: 'purple', name: '🟣 Purple', emoji: '🟣', color: '#a855f7', cssClass: 'group-border-purple', isBuiltIn: true },
    { id: 'green', name: '🟢 Green', emoji: '🟢', color: '#22c55e', cssClass: 'group-border-green', isBuiltIn: true },
    { id: 'yellow', name: '🟡 Yellow', emoji: '🟡', color: '#eab308', cssClass: 'group-border-yellow', isBuiltIn: true },
    { id: 'orange', name: '🟠 Orange', emoji: '🟠', color: '#f97316', cssClass: 'group-border-orange', isBuiltIn: true },
    { id: 'red', name: '🔴 Red', emoji: '🔴', color: '#ef4444', cssClass: 'group-border-red', isBuiltIn: true },
    { id: 'blue', name: '🔵 Blue', emoji: '🔵', color: '#3b82f6', cssClass: 'group-border-blue', isBuiltIn: true },
    { id: 'white', name: '⚪ White', emoji: '⚪', color: '#f8fafc', cssClass: 'group-border-white', isBuiltIn: true },
    { id: 'black', name: '⚫ Black', emoji: '⚫', color: '#64748b', cssClass: 'group-border-black', isBuiltIn: true }
  ];

  class Database {
    constructor() {
      this.db = null;
    }

    async init() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('media')) db.createObjectStore('media', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('subjects')) db.createObjectStore('subjects', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('events')) db.createObjectStore('events', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('collections')) db.createObjectStore('collections', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
        };
        req.onsuccess = async (e) => {
          this.db = e.target.result;
          await this.seedDefaults();
          resolve(this.db);
        };
        req.onerror = (e) => reject(e.target.error);
      });
    }

    async seedDefaults() {
      const activeProf = await this.getSetting('activeProfileId');
      if (!activeProf) {
        await this.setSetting('activeProfileId', 'profile-default');
        await this.put('profiles', { id: 'profile-default', name: 'Default Profile', isDefault: true });
      }

      const actionPts = await this.getSetting('actionPointsMap');
      if (!actionPts) {
        await this.setSetting('actionPointsMap', DEFAULT_ACTION_POINTS);
      }

      const medalSettings = await this.getSetting('medalSettings');
      if (!medalSettings) {
        await this.setSetting('medalSettings', DEFAULT_MEDAL_SETTINGS);
      }

      const groups = await this.getSetting('subjectGroups');
      if (!groups) {
        await this.setSetting('subjectGroups', DEFAULT_SUBJECT_GROUPS);
      }

      const theme = await this.getSetting('theme');
      if (!theme) await this.setSetting('theme', 'dark');
    }

    async get(storeName, key) {
      return new Promise((resolve, reject) => {
        if (!this.db || !this.db.objectStoreNames.contains(storeName)) { resolve(null); return; }
        const tx = this.db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async getAll(storeName) {
      return new Promise((resolve, reject) => {
        if (!this.db || !this.db.objectStoreNames.contains(storeName)) { resolve([]); return; }
        const tx = this.db.transaction(storeName, 'readonly');
        const req = tx.objectStore(storeName).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async put(storeName, item) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).put(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    async delete(storeName, key) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(storeName, 'readwrite');
        const req = tx.objectStore(storeName).delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    }

    async getSetting(key) {
      const res = await this.get('settings', key);
      return res ? res.value : null;
    }

    async setSetting(key, value) {
      return this.put('settings', { key, value });
    }

    async getActiveProfileId() {
      return (await this.getSetting('activeProfileId')) || 'profile-default';
    }
  }

  const db = new Database();

  /* Master State Variables */
  let currentMediaList = [];
  let currentSubjectsList = [];
  let currentEventsList = [];
  let currentWeights = {};
  let currentActiveView = 'mediaBrowserView';

  const ITEMS_PER_PAGE = 1000;
  let currentMediaPage = 1;

  let selectedMediaIds = new Set();
  let lightboxIndex = -1;
  let activeDetailSubjectId = null;
  let activeDetailComboKey = null;
  let activeDetailSldDateTag = null;
  let activeDetailTagName = null;
  let activeDetailEventId = null;
  let sldDefaultFullscreen = false;
  let activeSubjectsTab = 'subjects';
  let sldSortKey = 'date';
  let sldSortDir = 'desc';

  let currentActionPointsMap = DEFAULT_ACTION_POINTS;
  let currentMedalSettings = DEFAULT_MEDAL_SETTINGS;
  let aiFilterMode = 'all';

  function getActionDisplayName(code) {
    return ACTION_TAG_NAMES[code] || `Action ${code}`;
  }

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

  function getSubjectDisplayName(sub) {
    if (!sub) return 'Unknown Subject';
    const genderSymbol = sub.gender === 'Male' ? '♂️' : sub.gender === 'NB' ? '⚧️' : '♀️';
    return `${genderSymbol} ${sub.name}`;
  }

  function getSubjectGroup(groupId) {
    return DEFAULT_SUBJECT_GROUPS.find(g => g.id === groupId) || DEFAULT_SUBJECT_GROUPS[2];
  }

  function convertDateTagToIso(tag) {
    if (!tag) return new Date().toISOString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(tag)) return tag;
    if (/^\d{6}$/.test(tag)) {
      return `20${tag.substring(0,2)}-${tag.substring(2,4)}-${tag.substring(4,6)}`;
    }
    if (/^\d{3,4}$/.test(tag)) {
      const m = tag.substring(0, tag.length - 2).padStart(2, '0');
      const d = tag.substring(tag.length - 2).padStart(2, '0');
      return `2026-${m}-${d}`;
    }
    return new Date().toISOString();
  }

  function parseSmartDateInput(input) {
    if (!input) return '';
    const clean = input.trim();
    if (/^\d{3,4}$/.test(clean)) return clean;
    if (/^\d{6}$/.test(clean)) return clean;
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
    return clean;
  }

  function getTodaySmartDateTag() {
    const d = new Date();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return `${m}${day < 10 ? '0' + day : day}`;
  }

  function showToastNotification(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed; bottom:90px; right:20px; z-index:99999; background:var(--bg-card); color:var(--text-primary); border:1px solid var(--border-color); padding:10px 16px; border-radius:var(--radius-md); box-shadow:var(--shadow-lg); font-weight:700; font-size:0.85rem;';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
  }

  async function loadAppState() {
    currentSubjectsList = await db.getAll('subjects');
    currentEventsList = await db.getAll('events');
    currentMediaList = await db.getAll('media');
    currentActionPointsMap = (await db.getSetting('actionPointsMap')) || DEFAULT_ACTION_POINTS;
  }

  function switchView(viewId) {
    currentActiveView = viewId;
    document.querySelectorAll('.view-page').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');

    const navBtn = document.querySelector(`.nav-item[data-view="${viewId}"]`);
    if (navBtn) navBtn.classList.add('active');

    const stats = processAllStats(currentMediaList, currentSubjectsList, currentEventsList, currentWeights);
    if (viewId === 'mediaBrowserView') renderMediaBrowserPage(stats);
    else if (viewId === 'subjectsView') renderSubjectsPage(stats);
    else if (viewId === 'subjectDetailsView') renderSubjectDetailsPage(stats);
    else if (viewId === 'comboDetailsView') renderComboDetailsPage(stats);
    else if (viewId === 'sldView') renderSldListPage(stats);
    else if (viewId === 'eventsView') renderEventsPage(stats);
    else if (viewId === 'eventDetailsView') renderEventDetailsPage(stats);
    else if (viewId === 'statsView') renderStatsPage(stats);
    else if (viewId === 'settingsView') renderSettingsPage();
  }

  function calculateMediaHeartPoints(media) {
    let totalHeartPts = 0;
    let pinkPts = 0, greyPts = 0, bluePts = 0;

    for (const be of (media.blueBookEvents || [])) {
      if (be.heartTags) {
        const p = getHeartPointsForCount(be.heartTags.pink || 0);
        const g = getHeartPointsForCount(be.heartTags.grey || 0);
        const b = getHeartPointsForCount(be.heartTags.blue || 0);
        pinkPts += p;
        greyPts += g;
        bluePts += b;
      }
    }
    totalHeartPts = pinkPts + greyPts + bluePts;
    return { totalHeartPts, pinkPts, greyPts, bluePts };
  }

  function getHeartPointsForCount(count) {
    if (count === 1) return currentMedalSettings.bronzePts ?? 0.1;
    if (count === 2) return currentMedalSettings.silverPts ?? 0.3;
    if (count === 3) return currentMedalSettings.goldPts ?? 1.0;
    return 0;
  }

  function calculateEventPointsForSubject(eventCode, cCount, weights = {}) {
    const codePts = currentActionPointsMap[eventCode] ?? (DEFAULT_ACTION_POINTS[eventCode] || 0.1);
    return Math.round(codePts * (cCount || 1) * 100) / 100;
  }

  function processAllStats(mediaList = [], subjectsList = [], eventsList = [], weights = {}) {
    const defaultWeights = { heart1: 1, heart2: 3, heart3: 10, eventCCount: 10, eventTag: 1, ...weights };

    let total3PinkHearts = 0;
    let maxGreyPts = -1;
    let greyHeartLeader = null;
    const pinkAccumulationByDate = new Map();
    const mediaStatsMap = new Map();

    for (const m of mediaList) {
      const pts = calculateMediaHeartPoints(m);
      mediaStatsMap.set(m.id, pts);

      const has3Pink = (m.blueBookEvents || []).some(be => be.heartTags?.pink === 3);
      if (has3Pink) total3PinkHearts++;

      if (pts.greyPts > maxGreyPts && pts.greyPts > 0) {
        maxGreyPts = pts.greyPts;
        greyHeartLeader = m;
      }
    }

    const firstMetMap = new Map();
    const sortedEventsByDate = eventsList.slice().sort((a, b) => convertDateTagToIso(a.dateTag || '').localeCompare(convertDateTagToIso(b.dateTag || '')));

    for (const e of sortedEventsByDate) {
      const subCounts = e.subjectCounts || {};
      const presentIds = Object.keys(subCounts).filter(id => (subCounts[id] || 0) > 0);
      if (presentIds.length >= 2) {
        for (let i = 0; i < presentIds.length; i++) {
          for (let j = i + 1; j < presentIds.length; j++) {
            const pairKey = [presentIds[i], presentIds[j]].sort().join('::');
            if (!firstMetMap.has(pairKey)) {
              firstMetMap.set(pairKey, { eventId: e.id, dateTag: e.dateTag || e.date });
            }
          }
        }
      }
    }

    const combinationMap = new Map();
    for (const m of mediaList) {
      const tags = (m.subjectTags || []).slice().sort();
      if (tags.length >= 2) {
        const pts = mediaStatsMap.get(m.id) || { totalHeartPts: 0, pinkPts: 0, greyPts: 0, bluePts: 0 };
        const comboKey = tags.join('::');
        const combo = combinationMap.get(comboKey) || {
          subjectIds: tags,
          subjectId1: tags[0],
          subjectId2: tags[1],
          mediaCount: 0,
          heartPoints: 0,
          pinkPoints: 0,
          greyPoints: 0,
          bluePoints: 0,
          eventPoints: 0,
          totalPoints: 0,
          maxActionCode: 0,
          firstMet: firstMetMap.get(comboKey) || null
        };
        combo.mediaCount++;
        combo.heartPoints += pts.totalHeartPts || 0;
        combo.pinkPoints += pts.pinkPts || 0;
        combo.greyPoints += pts.greyPts || 0;
        combo.bluePoints += pts.bluePts || 0;
        combinationMap.set(comboKey, combo);
      }
    }

    const allCombinations = Array.from(combinationMap.values()).map(c => {
      c.totalPoints = Math.round((c.heartPoints + c.eventPoints) * 100) / 100;
      const subs = (c.subjectIds || [c.subjectId1, c.subjectId2]).map(id => subjectsList.find(s => s.id === id)).filter(Boolean);
      c.subs = subs;
      c.name = subs.map(s => getSubjectDisplayName(s)).join(' & ');
      return c;
    });

    return { total3PinkHearts, greyHeartLeader, maxGreyPts, timelineData: [], allSubjectStats: [], allCombinations, mediaStatsMap, firstMetMap };
  }

  function renderMediaThumbnailHTML(m, customClass = '', customStyle = '') {
    if (!m) return '';
    const styleAttr = customStyle ? `style="${customStyle}"` : '';
    if (m.customThumbnail) {
      return `<img src="${m.customThumbnail}" class="${customClass}" ${styleAttr} alt="${m.filename}">`;
    }
    if (m.thumbnailUrl) {
      return `<img src="${m.thumbnailUrl}" class="${customClass}" ${styleAttr} alt="${m.filename}">`;
    }
    if (m.type?.startsWith('video')) {
      return `<video src="${m.dataUrl}#t=0.5" class="${customClass}" ${styleAttr} muted preload="metadata"></video>`;
    }
    return `<img src="${m.dataUrl}" class="${customClass}" ${styleAttr} alt="${m.filename}">`;
  }

  function renderMediaBrowserPage(stats) {
    const gridContainer = document.getElementById('mediaGrid');
    if (!gridContainer) return;

    if (currentMediaList.length === 0) {
      gridContainer.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">No media files loaded yet. Click "Import Zip Archive" above to import your library.</div>`;
      return;
    }

    gridContainer.innerHTML = currentMediaList.map(m => `
      <div class="media-card" data-id="${m.id}">
        ${renderMediaThumbnailHTML(m)}
      </div>
    `).join('');

    gridContainer.querySelectorAll('.media-card').forEach(card => {
      card.onclick = () => {
        openLightboxById(card.getAttribute('data-id'));
      };
    });
  }

  function renderSubjectsPage(stats) {}
  function renderSubjectDetailsPage(stats) {}
  function renderComboDetailsPage(stats) {}
  function renderSldListPage(stats) {}

  function populateWhereDatalists() {}
  function renderWhereBadgesHTML(where) { return ''; }

  function renderEventsPage(stats) {
    const tableBody = document.getElementById('eventsTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = currentEventsList.map(evt => {
      const dateStr = evt.dateTag || new Date(evt.date).toLocaleDateString();
      const actionCode = evt.eventCode || 1;
      const tagBadge = `<span class="tag-chip-bubble action-tag-${actionCode}">${getActionDisplayName(actionCode)}</span>`;

      return `
        <tr class="event-table-row" data-evtid="${evt.id}">
          <td>${tagBadge}</td>
          <td><strong style="cursor:pointer; font-size:1.05rem;">📙 ${formatColoredDateTag(dateStr)}</strong></td>
          <td>${Object.keys(evt.subjectCounts || {}).length} subjects</td>
          <td>${renderWhereBadgesHTML(evt.where)}</td>
          <td>0 files</td>
          <td style="text-align:right;"><button class="btn btn-danger btn-sm">🗑️</button></td>
        </tr>`;
    }).join('');
  }

  function renderEventDetailsPage(stats) {}
  function renderStatsPage(stats) {}
  function renderSettingsPage() {}

  function openLightboxById(id) {
    const idx = currentMediaList.findIndex(m => m.id === id);
    if (idx >= 0) openLightbox(idx);
  }

  function openLightbox(idx) {
    lightboxIndex = idx;
    const modal = document.getElementById('lightboxModal');
    if (modal) modal.classList.add('active');
    renderLightboxContent();
  }

  function closeLightbox() {
    lightboxIndex = -1;
    const modal = document.getElementById('lightboxModal');
    if (modal) modal.classList.remove('active');
  }

  function renderLightboxContent() {
    if (lightboxIndex < 0 || lightboxIndex >= currentMediaList.length) return;
    const media = currentMediaList[lightboxIndex];
    const container = document.getElementById('lightboxMediaContainer');
    if (container) {
      container.innerHTML = renderMediaThumbnailHTML(media, 'lb-media-el');
    }
  }

  function initApp() {
    db.init().then(async () => {
      await loadAppState();
      setupEventListeners();
      switchView('mediaBrowserView');
    });
  }

  function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.onclick = () => {
        const viewId = btn.getAttribute('data-view');
        if (viewId) switchView(viewId);
      };
    });

    document.getElementById('lbCloseBtn')?.addEventListener('click', closeLightbox);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
