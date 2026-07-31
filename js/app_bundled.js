(function() {
'use strict';

/* === Module: 01_db.js === */
/* ==========================================================================
   MODULE 01: DATABASE MANAGER (IndexedDB)
   ========================================================================== */
const DB_NAME = 'PortableMediaAppDB';
const DB_VERSION = 1;

class Database {
  constructor() { this.db = null; }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('media')) {
          const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
          mediaStore.createIndex('profileId', 'profileId', { unique: false });
        }
        if (!db.objectStoreNames.contains('subjects')) {
          const subStore = db.createObjectStore('subjects', { keyPath: 'id' });
          subStore.createIndex('profileId', 'profileId', { unique: false });
        }
        if (!db.objectStoreNames.contains('events')) {
          const evtStore = db.createObjectStore('events', { keyPath: 'id' });
          evtStore.createIndex('profileId', 'profileId', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };
      request.onsuccess = async (e) => {
        this.db = e.target.result;
        await this.ensureDefaultSetup();
        resolve(this);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async ensureDefaultSetup() {
    const profiles = await this.getAll('profiles');
    if (profiles.length === 0) {
      await this.put('profiles', { id: 'default-profile', name: 'Main Collection', createdAt: new Date().toISOString() });
      await this.setSetting('activeProfileId', 'default-profile');
    }

    const weights = await this.getSetting('scoringWeights');
    if (!weights) {
      await this.setSetting('scoringWeights', { heart1: 1, heart2: 3, heart3: 10, eventCCount: 10, eventTag: 1 });
    }

    const points = await this.getSetting('actionPointsMap');
    if (!points) {
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
    const record = await this.get('settings', key);
    return record ? record.value : null;
  }

  async setSetting(key, value) { return this.put('settings', { key, value }); }

  async getActiveProfileId() { return (await this.getSetting('activeProfileId')) || 'default-profile'; }
  async setActiveProfileId(profileId) { await this.setSetting('activeProfileId', profileId); }

  async getActiveCollectionId() { return (await this.getSetting('activeCollectionId')) || 'default-collection'; }
  async setActiveCollectionId(collectionId) { await this.setSetting('activeCollectionId', collectionId); }

  async getActiveMedia() {
    const activeProfileId = await this.getActiveProfileId();
    const allMedia = await this.getAll('media');
    const items = allMedia.filter(m => !m.profileId || m.profileId === activeProfileId);
    for (const m of items) {
      if (!m.profileId) {
        m.profileId = activeProfileId;
        await this.put('media', m);
      }
      if (!m.blueBookEvents) {
        m.blueBookEvents = [];
        if (m.dateTag || m.heartTags) {
          m.blueBookEvents.push({
            id: 'sld-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            dateTag: m.dateTag || getTodaySmartDateTag(),
            heartTags: m.heartTags || { pink: 0, grey: 0, blue: 0 }
          });
          await this.put('media', m);
        }
      }
    }
    return items;
  }

  async getActiveSubjects() {
    const activeProfileId = await this.getActiveProfileId();
    const allSubs = await this.getAll('subjects');
    const items = allSubs.filter(s => !s.profileId || s.profileId === activeProfileId);
    for (const s of items) {
      if (!s.profileId) {
        s.profileId = activeProfileId;
        await this.put('subjects', s);
      }
    }
    return items;
  }

  async getActiveEvents() {
    const activeProfileId = await this.getActiveProfileId();
    const allEvts = await this.getAll('events');
    const items = allEvts.filter(e => !e.profileId || e.profileId === activeProfileId);
    for (const e of items) {
      if (!e.profileId) {
        e.profileId = activeProfileId;
        await this.put('events', e);
      }
    }
    return items;
  }
}

const db = new Database();


/* === Module: 02_state.js === */
/* ==========================================================================
   MODULE 02: GLOBAL APPLICATION STATE & HELPERS
   ========================================================================== */
const ACTION_TAG_NAMES = {
  1: '♏ Met', 2: '♎ Friendship', 3: '♍ Good friend', 4: '♌ Date',
  5: '♋ Kiss', 6: '♊ Cummable', 7: '♉ Oral', 8: '♈ Pen',
  9: '♓ Anal', 10: '♒ Ffm', 11: '♑ Fmm', 12: '♐ Orgy'
};

const DEFAULT_ACTION_POINTS = {
  1: 0.1, 2: 0.2, 3: 0.3, 4: 0.4, 5: 0.5, 6: 0.6,
  7: 0.7, 8: 0.8, 9: 0.9, 10: 1.0, 11: 1.1, 12: 1.2
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

let currentSubjectGroupsList = DEFAULT_SUBJECT_GROUPS;
let isMediaGroupingEnabled = true;
let isMediaRatingsEnabled = true;
let disabledGroupIds = new Set();
let subjectSortKey = 'name';
let subjectSortDir = 'asc';
let selectedSubjectIds = new Set();

let currentMediaList = [];
let currentSubjectsList = [];
let currentEventsList = [];
let currentProfilesList = [];
let selectedMediaIds = new Set();

// 3-Deep Cascade Sort History Stack
let sortCascadeStack = [{ key: 'date', dir: 'desc' }];

function getActionName(code) { return ACTION_TAG_NAMES[code] || `Action ${code}`; }
function getActionDisplayName(code) { return ACTION_TAG_NAMES[code] || `Action ${code}`; }

function getSubjectGroup(groupId) {
  if (!groupId) return null;
  return currentSubjectGroupsList.find(g => g.id === groupId) || null;
}

function getSubjectDisplayName(subject) {
  if (!subject) return 'Unknown';
  const group = getSubjectGroup(subject.groupId);
  if (group && group.emoji) {
    return `${group.emoji}${subject.name}`;
  }
  return subject.name;
}

function calculateMediaStarRating(m) {
  if (!m) return 0;
  if (m.userRating !== undefined && m.userRating !== null && m.userRating !== '') {
    return Number(m.userRating);
  }
  let maxHeart = 0;
  const blueEvents = m.blueBookEvents || [];
  blueEvents.forEach(be => {
    const p = be.heartTags?.pink || 0;
    const g = be.heartTags?.grey || 0;
    const b = be.heartTags?.blue || 0;
    maxHeart = Math.max(maxHeart, p, g, b);
  });

  if (maxHeart >= 3) return 5;
  if (maxHeart === 2) return 4;
  if (maxHeart === 1) return 3;
  if ((m.bronzeMedalHistoryCount || 0) >= 3) return 2;
  if (m.exifRating && Number(m.exifRating) >= 1 && Number(m.exifRating) <= 5) return Number(m.exifRating);
  if (m.subjectTags && m.subjectTags.length > 0) return 1;
  return 0;
}


/* === Module: 03_ui_helpers.js === */
/* ==========================================================================
   MODULE 03: UI HELPERS, AUTOCOMPLETE DROPDOWNS & DIAGNOSTIC LOGGER
   ========================================================================== */
function getTodaySmartDateTag() {
  const d = new Date();
  const yy = d.getFullYear().toString().slice(-2);
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function parseSmartDateInput(inputStr) {
  if (!inputStr) return getTodaySmartDateTag();
  const str = inputStr.trim();
  const parts = str.split(/\s+/);
  let datePart = parts[0];
  const timePart = parts[1] || '';

  const currentYY = new Date().getFullYear().toString().slice(-2);
  if (datePart.length === 3 || datePart.length === 4) {
    const mm = datePart.slice(0, datePart.length - 2).padStart(2, '0');
    const dd = datePart.slice(-2).padStart(2, '0');
    datePart = `${currentYY}${mm}${dd}`;
  }
  return timePart ? `${datePart} ${timePart}` : datePart;
}

function convertDateTagToIso(tagStr) {
  if (!tagStr) return new Date().toISOString();
  const clean = tagStr.trim();
  const parts = clean.split(/\s+/);
  const dStr = parts[0];
  const tStr = parts[1] || '000001';

  let yy = dStr.slice(0, 2);
  let mm = dStr.slice(2, 4) || '01';
  let dd = dStr.slice(4, 6) || '01';
  const year = parseInt(yy, 10) > 70 ? `19${yy}` : `20${yy}`;

  let hh = tStr.slice(0, 2).padStart(2, '0') || '00';
  let min = tStr.slice(2, 4).padStart(2, '0') || '00';
  let ss = tStr.slice(4, 6).padStart(2, '0') || '01';

  return `${year}-${mm}-${dd}T${hh}:${min}:${ss}`;
}

/* Grid Keyboard Navigation Helper for Chip Buttons */
function bindAutocompleteGridKeyboard(input, dropdown) {
  if (!input || !dropdown) return;
  dropdown.dataset.focusedIndex = "-1";

  input.addEventListener('keydown', (e) => {
    const isActive = dropdown.classList.contains('active');
    const items = Array.from(dropdown.querySelectorAll('.autocomplete-btn-chip'));

    if (!isActive || items.length === 0) return;

    let focusedIndex = parseInt(dropdown.dataset.focusedIndex || "-1", 10);

    if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();

      let cols = 3;
      if (items.length > 0) {
        const firstTop = items[0].offsetTop;
        const secondRowIdx = items.findIndex((el, idx) => idx > 0 && el.offsetTop > firstTop);
        if (secondRowIdx > 0) cols = secondRowIdx;
        else cols = items.length;
      }

      if (e.key === 'ArrowRight') {
        focusedIndex = focusedIndex < 0 ? 0 : Math.min(items.length - 1, focusedIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        focusedIndex = focusedIndex <= 0 ? 0 : focusedIndex - 1;
      } else if (e.key === 'ArrowDown') {
        focusedIndex = focusedIndex < 0 ? 0 : Math.min(items.length - 1, focusedIndex + cols);
      } else if (e.key === 'ArrowUp') {
        focusedIndex = focusedIndex < 0 ? 0 : Math.max(0, focusedIndex - cols);
      }

      dropdown.dataset.focusedIndex = String(focusedIndex);

      items.forEach((item, idx) => {
        if (idx === focusedIndex) {
          item.classList.add('keyboard-focus');
          item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          item.classList.remove('keyboard-focus');
        }
      });
    } else if (e.key === 'Enter') {
      if (focusedIndex >= 0 && items[focusedIndex]) {
        e.preventDefault();
        e.stopPropagation();
        items[focusedIndex].click();
        dropdown.dataset.focusedIndex = "-1";
      }
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('active');
      dropdown.dataset.focusedIndex = "-1";
    }
  });
}

function setupSmartDateAutocomplete(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  let isDefaultVal = true;

  input.addEventListener('focus', () => {
    if (isDefaultVal && !input.value) input.value = getTodaySmartDateTag();
    showAutocomplete();
  });

  input.addEventListener('input', () => {
    isDefaultVal = false;
    showAutocomplete();
  });

  bindAutocompleteGridKeyboard(input, dropdown);

  function showAutocomplete() {
    dropdown.dataset.focusedIndex = "-1";
    const val = input.value.trim().toLowerCase();
    const tagCounts = new Map();
    currentMediaList.forEach(m => {
      (m.blueBookEvents || []).forEach(be => {
        if (be.dateTag) tagCounts.set(be.dateTag, (tagCounts.get(be.dateTag) || 0) + 1);
      });
    });
    currentEventsList.forEach(e => {
      if (e.dateTag) tagCounts.set(e.dateTag, (tagCounts.get(e.dateTag) || 0) + 1);
    });

    const sorted = Array.from(tagCounts.keys()).sort((a, b) => tagCounts.get(b) - tagCounts.get(a));
    const matches = sorted.filter(t => t.toLowerCase().includes(val));

    let chips = [];
    if (val && !tagCounts.has(input.value.trim())) {
      const raw = input.value.trim();
      chips.push(`<button type="button" class="autocomplete-btn-chip create-new-btn" data-val="${raw}">
        <span class="btn-text-label">➕ Date "${raw}"</span>
      </button>`);
    }

    matches.forEach((m, idx) => {
      const isMostPopular = idx === 0 && !chips.some(c => c.includes('create-new-btn'));
      chips.push(`<button type="button" class="autocomplete-btn-chip ${isMostPopular ? 'popular-first-btn' : ''}" data-val="${m}">
        <span class="btn-text-label">💦 ${m}</span>
        <span style="font-size:0.7rem; opacity:0.75;">(${tagCounts.get(m)})</span>
      </button>`);
    });

    if (chips.length === 0) { dropdown.classList.remove('active'); return; }

    dropdown.innerHTML = chips.join('');
    dropdown.classList.add('active');

    dropdown.querySelectorAll('.autocomplete-btn-chip').forEach(item => {
      item.onclick = (e) => {
        e.stopPropagation();
        input.value = item.getAttribute('data-val');
        dropdown.classList.remove('active');
        dropdown.dataset.focusedIndex = "-1";
      };
    });
  }

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.remove('active');
  });
}

/* INSTANT SYSTEM BUG ALERT MODAL & DIAGNOSTIC LOGGER */
let systemErrorLogsList = [];

function logSystemRuntimeError(type, message, stack) {
  const timestamp = new Date().toLocaleTimeString();
  const entry = { type, message, stack, timestamp };
  systemErrorLogsList.unshift(entry);
  showRuntimeErrorAlertModal(entry);
}

function showRuntimeErrorAlertModal(entry) {
  const modal = document.getElementById('runtimeErrorAlertModal');
  const details = document.getElementById('runtimeErrorAlertDetails');
  if (modal && details) {
    details.textContent = `[${entry.timestamp}] ${entry.type}: ${entry.message}\n${entry.stack || 'No stack trace available.'}`;
    modal.style.display = 'flex';
  }
}


/* === Module: 04_version_pwa.js === */
/* ==========================================================================
   MODULE 04: PWA & AUTO-UPDATE MANAGER
   ========================================================================== */
const CURRENT_APP_VERSION = '260730.14';

async function initReleaseDownloadSection() {
  const versionBadge = document.getElementById('currentInstalledVersionBadge');
  const androidBtnText = document.getElementById('androidBtnText');
  const androidBtn = document.getElementById('androidDownloadBtn');
  const noticeEl = document.getElementById('updateAvailableNotice');

  if (versionBadge) versionBadge.textContent = `V${CURRENT_APP_VERSION}`;
  if (androidBtnText) androidBtnText.textContent = `Android (V${CURRENT_APP_VERSION})`;

  try {
    const res = await fetch('version.json?t=' + Date.now()).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (data && data.version) {
        if (androidBtnText) androidBtnText.textContent = `Android (V${data.version})`;
        if (data.version !== CURRENT_APP_VERSION) {
          if (noticeEl) {
            noticeEl.style.display = 'inline-flex';
            noticeEl.innerHTML = `🚀 A new version (V${data.version}) is available!`;
          }
          if (androidBtn) {
            androidBtn.style.border = '2px solid #22c55e';
            androidBtn.style.boxShadow = '0 0 12px rgba(34, 197, 94, 0.5)';
          }
        }
      }
    }
  } catch (e) {
    console.warn('Failed to check live release version:', e);
  }
}


/* === Module: 09_p2p_sync.js === */
/* ==========================================================================
   MODULE 09: DIRECT IP PEER-TO-PEER TAILSCALE AUTO-CONNECT ENGINE
   ========================================================================== */
let savedP2pPeers = [];
let isP2pConnected = false;
let p2pDeviceName = 'This Device';
let p2pAutoConnectTimer = null;

async function loadSavedP2pPeers() {
  const list = await db.getSetting('savedP2pPeersList');
  if (Array.isArray(list)) savedP2pPeers = list;
  renderConnectedPeersUI();
}

async function initP2pIpAutoConnect() {
  await loadSavedP2pPeers();
  if (p2pAutoConnectTimer) clearInterval(p2pAutoConnectTimer);
  p2pAutoConnectTimer = setInterval(async () => {
    if (savedP2pPeers && savedP2pPeers.length > 0) {
      for (const peer of savedP2pPeers) {
        attemptIpP2pConnect(peer.ip);
      }
    }
  }, 10000);
}

async function addP2pPeerIp(ipStr) {
  if (!ipStr || !ipStr.trim()) { alert('Please enter a valid IP address.'); return; }
  const cleanIp = ipStr.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');

  const existing = savedP2pPeers.find(p => p.ip === cleanIp);
  if (!existing) {
    savedP2pPeers.push({
      ip: cleanIp,
      name: `Peer (${cleanIp})`,
      status: 'connecting'
    });
    await db.setSetting('savedP2pPeersList', savedP2pPeers);
  }
  renderConnectedPeersUI();
  attemptIpP2pConnect(cleanIp);
}

async function removeP2pPeerIp(ipStr) {
  savedP2pPeers = savedP2pPeers.filter(p => p.ip !== ipStr);
  await db.setSetting('savedP2pPeersList', savedP2pPeers);
  if (savedP2pPeers.length === 0) {
    isP2pConnected = false;
    updateP2pStatusUI('disconnected');
  }
  renderConnectedPeersUI();
}

function updateP2pStatusUI(status, deviceName = '') {
  const badge = document.getElementById('p2pSyncStatusBadge');
  if (!badge) return;

  if (status === 'connected') {
    badge.style.background = 'rgba(34, 197, 94, 0.2)';
    badge.style.color = '#4ade80';
    badge.style.borderColor = '#22c55e';
    badge.textContent = `🟢 Connected (${deviceName})`;
  } else if (status === 'connecting') {
    badge.style.background = 'rgba(234, 179, 8, 0.2)';
    badge.style.color = '#facc15';
    badge.style.borderColor = '#eab308';
    badge.textContent = `🟡 Probing ${deviceName || 'Peers'}...`;
  } else {
    badge.style.background = 'rgba(255, 255, 255, 0.1)';
    badge.style.color = 'var(--text-muted)';
    badge.style.borderColor = 'var(--border-color)';
    badge.textContent = '⚪ Disconnected';
  }
}

function renderConnectedPeersUI() {
  const container = document.getElementById('connectedPeersList');
  if (!container) return;

  if (savedP2pPeers.length === 0) {
    container.innerHTML = `<p class="text-muted" style="font-size:0.8rem; margin:0;">No peer device IP addresses added yet.</p>`;
    return;
  }

  container.innerHTML = savedP2pPeers.map(p => {
    let statusBadge = `<span class="subject-stat-badge" style="background:rgba(239,68,68,0.2); color:#f87171; border:1px solid #ef4444; font-size:0.75rem;">🔴 Offline</span>`;
    if (p.status === 'connected') {
      statusBadge = `<span class="subject-stat-badge" style="background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid #22c55e; font-size:0.75rem;">🟢 Connected</span>`;
    } else if (p.status === 'connecting') {
      statusBadge = `<span class="subject-stat-badge" style="background:rgba(234,179,8,0.2); color:#facc15; border:1px solid #eab308; font-size:0.75rem;">🟡 Probing...</span>`;
    }

    return `<div style="display:flex; align-items:center; justify-space-between; background:var(--bg-card); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
      <div>
        <div style="font-weight:700; font-size:0.85rem;">🌐 ${p.ip}</div>
        <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">Tailscale / LAN Direct IP</div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        ${statusBadge}
        <button class="btn btn-danger btn-sm" onclick="removeP2pPeerIp('${p.ip}')" title="Remove IP">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

window.handleNativeP2pPayload = async function(jsonStr) {
  try {
    const msg = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    await handleIncomingP2pMessage(msg);
  } catch (e) {
    console.warn('Native P2P payload parse error:', e);
  }
};

async function sendP2pMessage(msgObj) {
  if (savedP2pPeers && savedP2pPeers.length > 0) {
    const payload = JSON.stringify(msgObj);
    for (const peer of savedP2pPeers) {
      try {
        fetch(`http://${peer.ip}:8080/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          mode: 'cors'
        }).then(res => {
          if (res.ok) {
            peer.status = 'connected';
            isP2pConnected = true;
            updateP2pStatusUI('connected', peer.name || peer.ip);
            renderConnectedPeersUI();
          }
        }).catch(() => {});
      } catch (e) {}
    }
  }
}

async function attemptIpP2pConnect(peerIp) {
  const peer = savedP2pPeers.find(p => p.ip === peerIp);
  if (!peer) return;

  peer.status = 'connecting';
  renderConnectedPeersUI();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`http://${peerIp}:8080/ping`, {
      method: 'GET',
      signal: controller.signal,
      mode: 'cors'
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (res && res.ok) {
      peer.status = 'connected';
      isP2pConnected = true;
      p2pDeviceName = peer.name || peer.ip;
      updateP2pStatusUI('connected', p2pDeviceName);
      renderConnectedPeersUI();
    } else {
      peer.status = 'offline';
      isP2pConnected = false;
      updateP2pStatusUI('disconnected');
      renderConnectedPeersUI();
    }
  } catch (e) {
    peer.status = 'offline';
    isP2pConnected = false;
    updateP2pStatusUI('disconnected');
    renderConnectedPeersUI();
  }
}



})();