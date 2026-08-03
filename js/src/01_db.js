/**
 * Section 1: Database Manager (IndexedDB) & Action Tags / Groups Map
 */

const DB_NAME = 'PortableMediaAppDB';
const DB_VERSION = 1;

const ACTION_TAG_NAMES = {
  1: '♏ Met', 2: '♎ Friendship', 3: '♍ Good friend', 4: '♌ Date',
  5: '♋ Kiss', 6: '♊ Cummable', 7: '♉ Oral', 8: '♈ Pen',
  9: '♓ Anal', 10: '♒ Ffm', 11: '♑ Fmm', 12: '♐ Orgy'
};

const DEFAULT_ACTION_POINTS = {
  1: 0.05, 2: 0.1, 3: 0.2, 4: 0.3, 5: 0.4, 6: 0.6,
  7: 0.8, 8: 1.0, 9: 2.0, 10: 5.0, 11: 5.0, 12: 8.0
};

const SUB_ACTION_TAGS = [
  { id: 'drunk_slutty', name: '🫦 Drunk or Slutty', pts: 0.25, parentAction: 'all' },
  { id: 'very_rough', name: '👋 Very Rough', pts: 0.15, parentAction: 'all' },
  { id: 'bareback', name: '🐻❄️ Bareback', pts: 0.30, parentAction: 'all', toggleWith: 'bareback_anal' },
  { id: 'bareback_anal', name: '🐻 Bareback Anal', pts: 0.50, parentAction: 'all', toggleWith: 'bareback' },
  { id: 'hat_trick', name: '🎩 Hat Trick', pts: 0.45, parentAction: 'all' },
  { id: 'gay_les', name: '🏳️‍🌈 Gay or Les', pts: 0.10, parentAction: 'all', isAuto: true },
  { id: 'stranger', name: '👤 Stranger', pts: 0.50, parentAction: 'all', isAuto: true },

  // Ffm specific sub-tags (Action Code 10)
  { id: 'ffm_double_suck', name: '💢 Double Suck', pts: 1.0, parentAction: 10 },
  { id: 'ffm_pyramid', name: '🔺 Pyramid', pts: 1.0, parentAction: 10 },
  { id: 'ffm_4_hole', name: '⛳ 4 Hole Challenge', pts: 2.0, parentAction: 10, toggleWith: 'ffm_6_hole' },
  { id: 'ffm_6_hole', name: '🎲 6 Hole Challenge', pts: 3.0, parentAction: 10, toggleWith: 'ffm_4_hole' },

  // Fmm specific sub-tags (Action Code 11)
  { id: 'fmm_double_suck', name: '🫶 Double Suck', pts: 1.0, parentAction: 11 },
  { id: 'fmm_double_pen', name: '✌️ Double Pen', pts: 2.0, parentAction: 11 },
  { id: 'fmm_statue_liberty', name: '🤘 Statue of Liberty', pts: 1.0, parentAction: 11 },
  { id: 'fmm_two_one_hole', name: '🫰 Two in One Hole', pts: 3.0, parentAction: 11 },

  // Orgy specific sub-tags (Action Code 12)
  { id: 'orgy_9_hole', name: '🎰 9 Hole Challenge', pts: 5.0, parentAction: 12 },
  { id: 'orgy_triple_pen', name: '🤟 Triple Penetration', pts: 5.0, parentAction: 12 }
];

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
];

let currentSubjectGroupsList = DEFAULT_SUBJECT_GROUPS;
let isMediaGroupingEnabled = true;
let isMediaRatingsEnabled = true;
let disabledGroupIds = new Set();
let subjectSortKey = 'name';
let subjectSortDir = 'asc';
let selectedSubjectIds = new Set();

// 3-Deep Cascade Sort History Stack
let sortCascadeStack = [{ key: 'date', dir: 'desc' }];

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
      if (!m.hash && m.dataUrl) {
        m.hash = await calculateContentHash(m.dataUrl);
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
        }
        await this.put('media', m);
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

function getActionName(code) { return ACTION_TAG_NAMES[code] || `Action ${code}`; }
function getActionDisplayName(code) { return ACTION_TAG_NAMES[code] || `Action ${code}`; }

function getSubjectGroup(groupId) {
  if (!groupId) return null;
  return currentSubjectGroupsList.find(g => g.id === groupId) || null;
}

function getSubjectGroupOptionsHTML(currentGroupId) {
  let html = `<option value="" ${!currentGroupId ? 'selected' : ''}>None</option>`;
  html += currentSubjectGroupsList.map(g => {
    let cleanName = g.name.trim();
    cleanName = cleanName.replace(/^[🟤🟣🟢🟡🟠🔴🔵⚪⚫⭐\s]+/g, '').trim();
    const label = `${g.emoji || '⚪'} ${cleanName}`;
    return `<option value="${g.id}" ${currentGroupId === g.id ? 'selected' : ''}>${label}</option>`;
  }).join('');
  html += `<option value="__rename_group__">✏️ Rename a Group...</option>`;
  html += `<option value="__add_custom__">➕ Add Custom Group...</option>`;
  html += `<option value="__manage_groups__">⚙️ Rearrange / Delete Groups...</option>`;
  return html;
}

async function handleGroupSelectAction(selectedVal, subjectOrSubjectId) {
  if (selectedVal === '__rename_group__') {
    let groupToRename = null;
    if (typeof subjectOrSubjectId === 'object' && subjectOrSubjectId && subjectOrSubjectId.groupId) {
      groupToRename = getSubjectGroup(subjectOrSubjectId.groupId);
    }

    if (!groupToRename) {
      const groupListStr = currentSubjectGroupsList.map((g, idx) => `${idx + 1}. ${g.name}`).join('\n');
      const choice = prompt(`Select a group number to rename:\n\n${groupListStr}`);
      if (!choice) return true;
      const selectedIdx = parseInt(choice.trim(), 10) - 1;
      if (!isNaN(selectedIdx) && currentSubjectGroupsList[selectedIdx]) {
        groupToRename = currentSubjectGroupsList[selectedIdx];
      } else {
        const found = currentSubjectGroupsList.find(g => g.name.toLowerCase().includes(choice.trim().toLowerCase()));
        if (found) groupToRename = found;
      }
    }

    if (!groupToRename) {
      alert('Group not found.');
      return true;
    }

    const currentText = groupToRename.name.replace(/^[🟤🟣🟢🟡🟠⭐\s]+/g, '').trim();
    const newText = prompt(`Enter new text for group "${groupToRename.name}":\n(The emoji/icon "${groupToRename.emoji || '⚪'}" will stay fixed)`, currentText);
    if (newText && newText.trim() && newText.trim() !== currentText) {
      groupToRename.name = `${groupToRename.emoji || '⚪'} ${newText.trim()}`;
      await db.setSetting('subjectGroups', currentSubjectGroupsList);
      await loadAppState();
      renderCurrentView();
    }
    return true;
  } else if (selectedVal === '__add_custom__') {
    const name = prompt('Enter a name for the new custom group:');
    if (name && name.trim()) {
      const gId = 'custom-' + Date.now();
      const newGroup = {
        id: gId, name: name.trim(), emoji: '⭐', color: '#38bdf8', cssClass: 'group-border-blue', isBuiltIn: false
      };
      currentSubjectGroupsList.push(newGroup);
      await db.setSetting('subjectGroups', currentSubjectGroupsList);

      if (typeof subjectOrSubjectId === 'object' && subjectOrSubjectId) {
        subjectOrSubjectId.groupId = gId;
        await db.put('subjects', subjectOrSubjectId);
      } else if (typeof subjectOrSubjectId === 'string' && subjectOrSubjectId) {
        const sub = currentSubjectsList.find(s => s.id === subjectOrSubjectId);
        if (sub) { sub.groupId = gId; await db.put('subjects', sub); }
      }
      await loadAppState();
      renderCurrentView();
    }
    return true;
  } else if (selectedVal === '__manage_groups__') {
    openManageGroupsModal();
    return true;
  }
  return false;
}

function promptStringentDeleteConfirmation(itemType, itemName) {
  const input = prompt(`DANGER: You are about to delete the ${itemType} "${itemName}".\n\nTo confirm deletion, please type "${itemName}" below:`);
  if (input === null) return false;
  if (input.trim() === itemName.trim()) {
    return true;
  } else {
    alert(`Deletion cancelled. The typed name did not match "${itemName}".`);
    return false;
  }
}

function getSubjectDisplayName(subject) {
  if (!subject) return 'Unknown';
  const group = getSubjectGroup(subject.groupId);
  if (group && group.emoji) {
    return `${group.emoji}${subject.name}`;
  }
  return subject.name;
}

function getSubjectGenderSymbol(gender) {
  if (gender === 'Female') return '♀️';
  if (gender === 'Male') return '♂️';
  if (gender === 'NB') return '⚧️';
  return '♀️';
}

function getMediaHighestPriorityGroupBorderClass(media) {
  if (!media || !media.subjectTags || media.subjectTags.length === 0) return '';
  const assignedSubs = media.subjectTags.map(id => currentSubjectsList.find(s => s.id === id)).filter(Boolean);
  if (assignedSubs.length === 0) return '';

  for (const group of currentSubjectGroupsList) {
    if (assignedSubs.some(s => s.groupId === group.id)) {
      return group.cssClass || '';
    }
  }
  return '';
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

function getStarRatingLabel(rating) {
  if (rating === 5) return '⭐⭐⭐⭐⭐ 5 Stars (Gold)';
  if (rating === 4) return '⭐⭐⭐⭐ 4 Stars (Silver)';
  if (rating === 3) return '⭐⭐⭐ 3 Stars (Bronze)';
  if (rating === 2) return '⭐⭐ 2 Stars';
  if (rating === 1) return '⭐ 1 Star';
  if (rating === 0) return '☆ 0 Stars (Unrated)';
  if (rating === -1) return '🚫 Rejected';
  return 'Unrated';
}

async function calculateContentHash(dataUrl) {
  if (!dataUrl) return '';
  const sample = dataUrl.length > 50000 ? dataUrl.slice(0, 25000) + dataUrl.slice(-25000) : dataUrl;
  let hash = 0;
  for (let i = 0; i < sample.length; i++) {
    const char = sample.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + sample.length;
}

function renderActionButtonsGrid(containerId, activeCode, onSelectCode) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const actionCodes = Array.from({ length: 12 }, (_, i) => i + 1);
  container.innerHTML = actionCodes.map(code => {
    const name = getActionDisplayName(code);
    const isActive = code === activeCode;
    return `<button type="button" class="action-btn-choice action-tag-${code} ${isActive ? 'active' : 'inactive'}" data-code="${code}">${name}</button>`;
  }).join('');

  container.querySelectorAll('.action-btn-choice').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      const code = parseInt(btn.getAttribute('data-code'), 10);
      container.querySelectorAll('.action-btn-choice').forEach(b => {
        const bCode = parseInt(b.getAttribute('data-code'), 10);
        b.className = `action-btn-choice action-tag-${bCode} ${bCode === code ? 'active' : 'inactive'}`;
      });
      if (onSelectCode) onSelectCode(code);
    };
  });
}
