/* === Module: 01_db.js === */
/* Module 01_db.js */
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

      const currentText = groupToRename.name.replace(/^[🟤🟣🟢🟡🟠🔴🔵⚪⚫⭐\s]+/g, '').trim();
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

  /* ==========================================================================


/* === Module: 02_state.js === */
/* Module 02_state.js */
2. AUTOMATIC 200x200 THUMBNAIL PIPELINE
     ========================================================================== */
  async function createCompressedThumbnail(fileType, dataUrl) {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');

      const drawTopCenteredCrop = (source) => {
        const sw = source.naturalWidth || source.videoWidth || source.width || 200;
        const sh = source.naturalHeight || source.videoHeight || source.height || 200;
        const cropSize = Math.min(sw, sh);
        const sx = Math.max(0, Math.floor((sw - cropSize) / 2));
        const sy = 0; // Top-centered vertically

        ctx.drawImage(source, sx, sy, cropSize, cropSize, 0, 0, 200, 200);
      };

      if (fileType?.startsWith('video')) {
        const video = document.createElement('video');
        video.src = dataUrl;
        video.preload = 'metadata';
        video.currentTime = 0.5;
        video.onseeked = () => {
          try {
            drawTopCenteredCrop(video);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } catch (e) {
            resolve(null);
          }
        };
        video.onerror = () => resolve(null);
      } else {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            drawTopCenteredCrop(img);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          } catch (e) {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl;
      }
    });
  }

  /* ==========================================================================
     3. GLOBAL UNDO HISTORY ENGINE
     ========================================================================== */
  const undoStack = [];

  function pushUndoState(actionDescription, undoFn) {
    undoStack.push({ description: actionDescription, undoFn });
  }

  async function triggerGlobalUndo() {
    if (undoStack.length === 0) {
      alert('Nothing to undo.');
      return;
    }
    const lastAction = undoStack.pop();
    if (lastAction && lastAction.undoFn) {
      await lastAction.undoFn();
      await loadAppState();
      renderCurrentView();
    }
  }

  /* ==========================================================================
     4. INTELLIGENT DATE, SUBJECT & NORMAL TAG AUTOCOMPLETES
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

  function setupSmartSubjectAutocomplete(inputId, dropdownId, onSelectSubject) {


/* === Module: 03_ui_helpers.js === */
/* Module 03_ui_helpers.js */
const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    input.addEventListener('focus', showAutocomplete);
    input.addEventListener('input', showAutocomplete);

    bindAutocompleteGridKeyboard(input, dropdown);

    input.addEventListener('keydown', async (e) => {
      const focusedIdx = parseInt(dropdown.dataset.focusedIndex || "-1", 10);
      if (e.key === 'Enter' && focusedIdx === -1) {
        e.preventDefault();
        const val = input.value.trim();
        if (!val) return;

        const tagCounts = new Map();
        for (const m of currentMediaList) {
          for (const sId of (m.subjectTags || [])) tagCounts.set(sId, (tagCounts.get(sId) || 0) + 1);
        }

        const sortedSubs = currentSubjectsList.slice().sort((a, b) => (tagCounts.get(b.id) || 0) - (tagCounts.get(a.id) || 0));
        const matches = sortedSubs.filter(s => getSubjectDisplayName(s).toLowerCase().includes(val.toLowerCase()) || s.name.toLowerCase().includes(val.toLowerCase()));

        let targetSub = matches.length > 0 ? matches[0] : null;
        if (!targetSub) {
          const pId = await db.getActiveProfileId();
          targetSub = { id: 'sub-' + Date.now(), profileId: pId, name: val, groupId: 'green', avatarUrl: null };
          await db.put('subjects', targetSub);
          await loadAppState();
        }

        input.value = '';
        dropdown.classList.remove('active');
        dropdown.dataset.focusedIndex = "-1";
        if (onSelectSubject) onSelectSubject(targetSub.id);
        setTimeout(() => input.focus(), 50);
      }
    });

    function showAutocomplete() {
      dropdown.dataset.focusedIndex = "-1";
      const val = input.value.trim().toLowerCase();
      const tagCounts = new Map();
      for (const m of currentMediaList) {
        for (const sId of (m.subjectTags || [])) tagCounts.set(sId, (tagCounts.get(sId) || 0) + 1);
      }

      const sortedSubs = currentSubjectsList.slice().sort((a, b) => (tagCounts.get(b.id) || 0) - (tagCounts.get(a.id) || 0));
      const matches = sortedSubs.filter(s => getSubjectDisplayName(s).toLowerCase().includes(val) || s.name.toLowerCase().includes(val));
      const exactMatch = currentSubjectsList.some(s => s.name.toLowerCase() === val);

      let chips = [];
      if (val && !exactMatch) {
        const rawVal = input.value.trim();
        chips.push(`<button type="button" class="autocomplete-btn-chip create-new-btn" data-action="create" data-val="${rawVal}">
          <span class="btn-text-label">➕ "${rawVal}"</span>
        </button>`);
      }

      matches.forEach((s, idx) => {
        const isMostPopular = idx === 0;
        const nameDisplay = getSubjectDisplayName(s);
        chips.push(`<button type="button" class="autocomplete-btn-chip ${isMostPopular ? 'popular-first-btn' : ''}" data-action="select" data-id="${s.id}">
          <span class="btn-text-label">👤 ${nameDisplay}</span>
          <span style="font-size:0.7rem; opacity:0.75;">(${tagCounts.get(s.id) || 0})</span>
        </button>`);
      });

      if (chips.length === 0) { dropdown.classList.remove('active'); return; }

      dropdown.innerHTML = chips.join('');
      dropdown.classList.add('active');

      dropdown.querySelectorAll('.autocomplete-btn-chip').forEach(item => {
        item.onclick = async (e) => {
          e.stopPropagation();
          const action = item.getAttribute('data-action');
          dropdown.classList.remove('active');
          dropdown.dataset.focusedIndex = "-1";
          input.value = '';

          if (action === 'create') {
            const createVal = item.getAttribute('data-val');
            const pId = await db.getActiveProfileId();
            const newSub = { id: 'sub-' + Date.now(), profileId: pId, name: createVal, groupId: 'green', avatarUrl: null };
            await db.put('subjects', newSub);
            await loadAppState();
            if (onSelectSubject) onSelectSubject(newSub.id);
          } else {
            const subId = item.getAttribute('data-id');
            if (onSelectSubject) onSelectSubject(subId);
          }
        };
      });
    }

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.remove('active');
    });
  }

  function setupNormalTagAutocomplete(inputId, dropdownId, onSelectTag) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    if (!input || !dropdown) return;

    input.addEventListener('focus', showAutocomplete);
    input.addEventListener('input', showAutocomplete);

    bindAutocompleteGridKeyboard(input, dropdown);

    input.addEventListener('keydown', async (e) => {
      const focusedIdx = parseInt(dropdown.dataset.focusedIndex || "-1", 10);
      if (e.key === 'Enter' && focusedIdx === -1) {
        e.preventDefault();
        const val = input.value.trim();
        if (!val) return;

        const tagCounts = new Map();
        currentMediaList.forEach(m => {
          (m.normalTags || []).forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
        });

        const allTags = Array.from(tagCounts.keys()).sort((a, b) => tagCounts.get(b) - tagCounts.get(a));
        const matches = allTags.filter(t => t.toLowerCase().includes(val.toLowerCase()));
        const chosenTag = matches.length > 0 ? matches[0] : val;

        input.value = '';
        dropdown.classList.remove('active');
        dropdown.dataset.focusedIndex = "-1";
        if (onSelectTag) await onSelectTag(chosenTag);
        setTimeout(() => input.focus(), 50);
      }
    });

    function showAutocomplete() {
      dropdown.dataset.focusedIndex = "-1";
      const val = input.value.trim().toLowerCase();
      const tagCounts = new Map();
      currentMediaList.forEach(m => {
        (m.normalTags || []).forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
      });

      const allTags = Array.from(tagCounts.keys()).sort((a, b) => tagCounts.get(b) - tagCounts.get(a));
      const matches = allTags.filter(t => t.toLowerCase().includes(val));
      const exactMatch = tagCounts.has(input.value.trim());

      let chips = [];
      if (val && !exactMatch) {
        const rawVal = input.value.trim();
        chips.push(`<button type="button" class="autocomplete-btn-chip create-new-btn" data-val="${rawVal}">
          <span class="btn-text-label">➕ Tag "${rawVal}"</span>
        </button>`);
      }

      matches.forEach((t, idx) => {
        const isMostPopular = idx === 0;
        chips.push(`<button type="button" class="autocomplete-btn-chip ${isMostPopular ? 'popular-first-btn' : ''}" data-val="${t}">
          <span class="btn-text-label">🏷️ ${t}</span>
          <span style="font-size:0.7rem; opacity:0.75;">(${tagCounts.get(t)})</span>
        </button>`);
      });

      if (chips.length === 0) { dropdown.classList.remove('active'); return; }

      dropdown.innerHTML = chips.join('');
      dropdown.classList.add('active');

      dropdown.querySelectorAll('.autocomplete-btn-chip').forEach(item => {
        item.onclick = async (e) => {
          e.stopPropagation();
          const selectedVal = item.getAttribute('data-val');
          input.value = '';
          dropdown.classList.remove('active');
          dropdown.dataset.focusedIndex = "-1";
          if (onSelectTag) await onSelectTag(selectedVal);
          setTimeout(() => input.focus(), 50);
        };
      });
    }

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.remove('active');
    });
  }

  function renderMediaThumbnailHTML(m, customClass = 'media-thumbnail') {
    if (m.customThumbnail) {
      return `<img src="${m.customThumbnail}" class="${customClass}" alt="${m.filename}">`;
    }
    if (m.thumbnailUrl) {
      return `<img src="${m.thumbnailUrl}" class="${customClass}" alt="${m.filename}">`;
    }
    if (m.type?.startsWith('video')) {
      return `<video src="${m.dataUrl}#t=0.5" class="${customClass}" muted preload="metadata"></video>`;
    }
    return `<img src="${m.dataUrl}" class="${customClass}" alt="${m.filename}">`;
  }

  function getHeartBtnHTML(type, count) {
    const baseEmoji = type === 'pink' ? '🩷' : type === 'grey' ? '🩶' : '🩵';
    if (count === 0) {
      return `<button class="heart-toggle-btn btn-sm active-0" data-type="${type}">${baseEmoji}</button>`;
    }
    const medal = count === 1 ? '🥉 1' : count === 2 ? '🥈 2' : '🥇 3';
    return `<button class="heart-toggle-btn btn-sm active-${count}" data-type="${type}">${baseEmoji}${medal}</button>`;
  }

  /* ==========================================================================
     5. SCORING & STATISTICS ENGINE WITH ACTION POINTS & REWORKED MEDALS
     ========================================================================== */
  let currentActionPointsMap = DEFAULT_ACTION_POINTS;
  let currentMedalSettings = DEFAULT_MEDAL_SETTINGS;

  function getHeartPointsForCount(count) {
    if (count === 1) return currentMedalSettings.bronzePts ?? 0.1;
    if (count === 2) return currentMedalSettings.silverPts ?? 0.3;
    if (count === 3) return currentMedalSettings.goldPts ?? 1.0;
    return 0;
  }

  function calculateMediaHeartPoints(media) {
    let pinkPts = 0, greyPts = 0, bluePts = 0, totalHeartPts = 0;
    const events = media.blueBookEvents || [];

    for (const be of events) {
      if (be.heartTags) {
        pinkPts += getHeartPointsForCount(be.heartTags.pink || 0);
        greyPts += getHeartPointsForCount(be.heartTags.grey || 0);
        bluePts += getHeartPointsForCount(be.heartTags.blue || 0);
      }
    }
    totalHeartPts = pinkPts + greyPts + bluePts;
    return { pinkPts, greyPts, bluePts, totalHeartPts };
  }

  function calculateEventPointsForSubject(eventCode, cCount, weights) {
    if (!cCount || cCount <= 0) return 0;
    const codePts = currentActionPointsMap[eventCode] ?? (DEFAULT_ACTION_POINTS[eventCode] || 0.1);
    const raw = (cCount * (weights.eventCCount ?? 10)) + (codePts * 10);
    return Math.round(raw * 100) / 100;
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

      for (const be of (m.blueBookEvents || [])) {
        if (be.dateTag) {
          const isoDate = convertDateTagToIso(be.dateTag).split('T')[0];
          const pinkCount = be.heartTags?.pink || 0;
          const pPts = getHeartPointsForCount(pinkCount);

          const existing = pinkAccumulationByDate.get(isoDate) || { pinkCount: 0, pinkPts: 0 };
          pinkAccumulationByDate.set(isoDate, {
            pinkCount: existing.pinkCount + pinkCount,
            pinkPts: existing.pinkPts + pPts
          });
        }
      }
    }

    const sortedDates = Array.from(pinkAccumulationByDate.keys()).sort();
    let cumulativePinkHearts = 0;
    let cumulativePinkPts = 0;
    const timelineData = sortedDates.map(date => {
      const entry = pinkAccumulationByDate.get(date);
      cumulativePinkHearts += entry.pinkCount;
      cumulativePinkPts += entry.pinkPts;
      return { date, dailyPinkCount: entry.pinkCount, dailyPinkPts: entry.pinkPts, cumulativePinkHearts, cumulativePinkPts };
    });

    const subjectStatsMap = new Map();
    for (const s of subjectsList) {
      subjectStatsMap.set(s.id, {
        subject: s,
        heartPoints: 0,
        pinkPoints: 0,
        greyPoints: 0,
        bluePoints: 0,
        eventPoints: 0,
        totalPoints: 0,
        mediaCount: 0,
        eventsCount: 0,
        totalCCount: 0,
        latestEventDate: null,
        coOccurrences: new Map()
      });
    }

    for (const m of mediaList) {
      const pts = mediaStatsMap.get(m.id) || { totalHeartPts: 0, pinkPts: 0, greyPts: 0, bluePts: 0 };
      const tags = m.subjectTags || [];

      for (const subId of tags) {
        const sStat = subjectStatsMap.get(subId);
        if (sStat) {
          sStat.heartPoints += pts.totalHeartPts;
          sStat.pinkPoints += pts.pinkPts || 0;
          sStat.greyPoints += pts.greyPts || 0;
          sStat.bluePoints += pts.bluePts || 0;
          sStat.mediaCount++;

          for (const otherId of tags) {
            if (otherId !== subId) {
              sStat.coOccurrences.set(otherId, (sStat.coOccurrences.get(otherId) || 0) + 1);
            }
          }
        }
      }
    }

    for (const e of eventsList) {
      const subCounts = e.subjectCounts || {};
      const code = e.eventCode || 1;
      const parsedDate = e.dateTag ? convertDateTagToIso(e.dateTag) : null;
      for (const subId of Object.keys(subCounts)) {
        const cCount = subCounts[subId] || 0;
        const evtPts = calculateEventPointsForSubject(code, cCount, defaultWeights);
        const sStat = subjectStatsMap.get(subId);
        if (sStat) {
          sStat.eventPoints += evtPts;
          sStat.eventsCount++;
          sStat.totalCCount += cCount;
          if (parsedDate) {
            if (!sStat.latestEventDate || parsedDate > sStat.latestEventDate) {
              sStat.latestEventDate = parsedDate;
            }
          }
        }
      }
    }

    const allSubjectStats = Array.from(subjectStatsMap.values()).map(stat => {
      stat.totalPoints = Math.round((stat.heartPoints + stat.eventPoints) * 100) / 100;
      return stat;
    }).sort((a, b) => b.totalPoints - a.totalPoints);

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
          maxActionCode: 0
        };
        combo.mediaCount++;
        combo.heartPoints += pts.totalHeartPts || 0;
        combo.pinkPoints += pts.pinkPts || 0;
        combo.greyPoints += pts.greyPts || 0;
        combo.bluePoints += pts.bluePts || 0;
        for (const be of (m.blueBookEvents || [])) {
          if (be.actionCode) combo.maxActionCode = Math.max(combo.maxActionCode, be.actionCode);
        }
        combinationMap.set(comboKey, combo);
      }
    }

    for (const e of eventsList) {
      const subCounts = e.subjectCounts || {};
      const presentIds = Object.keys(subCounts).filter(id => (subCounts[id] || 0) > 0).sort();
      if (presentIds.length >= 2) {
        const comboKey = presentIds.join('::');
        const combo = combinationMap.get(comboKey) || {
          subjectIds: presentIds,
          subjectId1: presentIds[0],
          subjectId2: presentIds[1],
          mediaCount: 0,
          heartPoints: 0,
          pinkPoints: 0,
          greyPoints: 0,
          bluePoints: 0,
          eventPoints: 0,
          totalPoints: 0,
          maxActionCode: 0
        };
        let comboEvtPts = 0;
        const code = e.eventCode || 1;
        combo.maxActionCode = Math.max(combo.maxActionCode, code);
        for (const subId of presentIds) {
          comboEvtPts += calculateEventPointsForSubject(code, subCounts[subId], defaultWeights);
        }
        combo.eventPoints += comboEvtPts;
        combinationMap.set(comboKey, combo);
      }
    }

    const allCombinations = Array.from(combinationMap.values()).map(c => {
      c.totalPoints = Math.round((c.heartPoints + c.eventPoints) * 100) / 100;
      const subs = (c.subjectIds || [c.subjectId1, c.subjectId2]).map(id => subjectsList.find(s => s.id === id)).filter(Boolean);
      c.subs = subs;
      c.name = subs.map(s => getSubjectDisplayName(s)).join(' & ');
      return c;
    }).sort((a, b) => b.totalPoints - a.totalPoints);

    return { total3PinkHearts, greyHeartLeader, maxGreyPts, timelineData, allSubjectStats, allCombinations, mediaStatsMap };
  }

  /* ==========================================================================
     6. CROPPER & CHARTS RENDERER
     ========================================================================== */
  let cropperInstance = null;
  let lightboxCropperInstance = null;

  function openMediaCropperModal({ imageSrcUrl, isVideo, videoSrcUrl, modalTitle, onSave }) {
    const modal = document.getElementById('cropperModal');
    const cropImageEl = document.getElementById('cropperImage');
    const titleEl = document.getElementById('cropperModalTitle');
    const seekerContainer = document.getElementById('videoSeekerContainer');
    const seekerSlider = document.getElementById('videoSeekerSlider');
    const seekerVideo = document.getElementById('cropperHiddenVideo');
    const timeLabel = document.getElementById('videoCurrentTimeLabel');

    if (titleEl) titleEl.textContent = modalTitle || 'Crop Image / Thumbnail';
    modal.classList.add('active');

    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }

    const initCropper = (src) => {
      cropImageEl.src = src;
      cropImageEl.onload = () => {
        if (cropperInstance) cropperInstance.destroy();
        if (window.Cropper) {
          cropperInstance = new window.Cropper(cropImageEl, { aspectRatio: 1, viewMode: 1, autoCropArea: 0.8 });
        }
      };
    };

    if (isVideo && videoSrcUrl) {
      seekerContainer.style.display = 'block';
      seekerVideo.src = videoSrcUrl;
      seekerVideo.onloadedmetadata = () => {
        seekerSlider.max = seekerVideo.duration;
        seekerSlider.value = 0.5;
        seekerVideo.currentTime = 0.5;
      };

      const captureFrame = () => {
        timeLabel.textContent = `${seekerVideo.currentTime.toFixed(1)}s`;
        const canvas = document.createElement('canvas');
        canvas.width = seekerVideo.videoWidth || 640;
        canvas.height = seekerVideo.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(seekerVideo, 0, 0, canvas.width, canvas.height);
        const frameUrl = canvas.toDataURL('image/png');
        initCropper(frameUrl);
      };

      seekerVideo.onseeked = captureFrame;
      seekerSlider.oninput = () => { seekerVideo.currentTime = parseFloat(seekerSlider.value); };
      initCropper(imageSrcUrl);
    } else {
      seekerContainer.style.display = 'none';
      initCropper(imageSrcUrl);
    }

    document.getElementById('saveCropBtn').onclick = () => {
      if (cropperInstance) {
        const canvas = cropperInstance.getCroppedCanvas({ width: 200, height: 200 });
        const croppedUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (onSave) onSave(croppedUrl);
      }
      closeAvatarCropper();
    };

    document.getElementById('closeCropperModalBtn').onclick = closeAvatarCropper;
    document.getElementById('cancelCropBtn').onclick = closeAvatarCropper;
  }

  function closeAvatarCropper() {
    document.getElementById('cropperModal').classList.remove('active');
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null; }
  }

  function openLightboxCropModal(media) {
    const modal = document.getElementById('lightboxCropModal');
    const cropImg = document.getElementById('cropModalImage');
    const ratioSelect = document.getElementById('cropModalRatioSelect');
    const seekerContainer = document.getElementById('cropModalVideoSeeker');
    const seekerSlider = document.getElementById('cropVideoSeekerSlider');
    const seekerVideo = document.getElementById('cropModalHiddenVideo');
    const timeLabel = document.getElementById('cropVideoTimeLabel');

    modal.classList.add('active');
    if (lightboxCropperInstance) { lightboxCropperInstance.destroy(); lightboxCropperInstance = null; }

    const isVideo = media.type?.startsWith('video');

    const initCropperInstance = (src) => {
      cropImg.src = src;
      cropImg.onload = () => {
        if (lightboxCropperInstance) lightboxCropperInstance.destroy();
        if (window.Cropper) {
          lightboxCropperInstance = new window.Cropper(cropImg, {
            aspectRatio: NaN,
            viewMode: 1,
            autoCropArea: 0.9,
            responsive: true,
            movable: true,
            resizable: true
          });
        }
      };
    };

    if (isVideo) {
      seekerContainer.style.display = 'block';
      seekerVideo.src = media.dataUrl;
      seekerVideo.onloadedmetadata = () => {
        seekerSlider.max = seekerVideo.duration;
        seekerSlider.value = 0.5;
        seekerVideo.currentTime = 0.5;
      };

      const captureFrame = () => {
        timeLabel.textContent = `${seekerVideo.currentTime.toFixed(1)}s`;
        const canvas = document.createElement('canvas');
        canvas.width = seekerVideo.videoWidth || 640;
        canvas.height = seekerVideo.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(seekerVideo, 0, 0, canvas.width, canvas.height);
        initCropperInstance(canvas.toDataURL('image/png'));
      };

      seekerVideo.onseeked = captureFrame;
      seekerSlider.oninput = () => { seekerVideo.currentTime = parseFloat(seekerSlider.value); };
      initCropperInstance(media.thumbnailUrl || media.dataUrl);
    } else {
      seekerContainer.style.display = 'none';
      initCropperInstance(media.dataUrl);
    }

    ratioSelect.onchange = () => {
      const val = ratioSelect.value;
      if (!lightboxCropperInstance) return;

      if (val === 'free') {
        lightboxCropperInstance.setAspectRatio(NaN);
      } else if (val === 'screen') {
        lightboxCropperInstance.setAspectRatio(window.innerWidth / window.innerHeight);
      } else if (val === '1:1') {
        lightboxCropperInstance.setAspectRatio(1);
      } else if (val === '4:3') {
        lightboxCropperInstance.setAspectRatio(4 / 3);
      } else if (val === '16:9') {
        lightboxCropperInstance.setAspectRatio(16 / 9);
      } else if (val === 'custom') {
        const input = prompt('Enter ratio (e.g. 9/20 or 1.5):', '9/20');
        if (input) {
          let num = parseFloat(input);
          if (input.includes('/')) {
            const p = input.split('/');
            num = parseFloat(p[0]) / parseFloat(p[1]);
          }
          if (!isNaN(num)) lightboxCropperInstance.setAspectRatio(num);
        }
      }
    };

    document.getElementById('confirmCropModalBtn').onclick = async () => {
      if (lightboxCropperInstance) {
        const canvas = lightboxCropperInstance.getCroppedCanvas();
        const croppedUrl = canvas.toDataURL('image/jpeg', 0.95);
        media.viewTransform = media.viewTransform || {};
        media.viewTransform.croppedViewUrl = croppedUrl;
        await db.put('media', media);
      }
      closeLightboxCropModal();
      renderLightboxContent();
      renderCurrentView();
    };

    document.getElementById('cropModalClearBtn').onclick = async () => {
      if (media.viewTransform) {
        media.viewTransform.croppedViewUrl = null;
        await db.put('media', media);
      }
      closeLightboxCropModal();
      renderLightboxContent();
      renderCurrentView();
    };

    document.getElementById('closeCropModalBtn').onclick = closeLightboxCropModal;
    document.getElementById('cancelCropModalBtn').onclick = closeLightboxCropModal;
  }

  function closeLightboxCropModal() {
    document.getElementById('lightboxCropModal').classList.remove('active');
    if (lightboxCropperInstance) { lightboxCropperInstance.destroy(); lightboxCropperInstance = null; }
  }

  function renderSubjectEventPointsTimelineChart(containerId, subjectId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!window.Plotly) {
      container.innerHTML = `<div class="empty-state">Chart library loading...</div>`;
      return;
    }

    const subEvents = (currentEventsList || []).filter(e => e.subjectCounts && e.subjectCounts[subjectId]);
    if (subEvents.length === 0) {
      container.innerHTML = `<div class="empty-state">No recorded events for this subject.</div>`;
      return;
    }

    subEvents.sort((a, b) => (a.dateTag || '').localeCompare(b.dateTag || ''));

    let cumulative = 0;
    const dates = [];
    const pts = [];

    subEvents.forEach(e => {
      const weight = currentWeights?.actions?.[e.eventCode] ?? (e.eventCode * 2.5);
      cumulative += weight;
      dates.push(e.dateTag || e.date || 'Unknown');
      pts.push(cumulative);
    });

    const trace = {
      x: dates,
      y: pts,
      name: 'Event Points',
      type: 'scatter',
      mode: 'lines+markers',
      fill: 'tozeroy',
      line: { color: '#38bdf8', width: 3 }
    };

    const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, margin: { l: 40, r: 20, t: 20, b: 40 } };
    window.Plotly.newPlot(containerId, [trace], layout, { responsive: true, displayModeBar: false });
  }

  function renderSubjectSldHeartPointsTimelineChart(containerId, subjectId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!window.Plotly) {
      container.innerHTML = `<div class="empty-state">Chart library loading...</div>`;
      return;
    }

    const tagged = (currentMediaList || []).filter(m => m.subjectTags?.includes(subjectId));
    const dateMap = new Map();

    tagged.forEach(m => {
      (m.blueBookEvents || []).forEach(be => {
        if (!be.dateTag) return;
        const p = be.heartTags?.pink || 0;
        const g = be.heartTags?.grey || 0;
        const b = be.heartTags?.blue || 0;
        const prev = dateMap.get(be.dateTag) || { pink: 0, grey: 0, blue: 0 };
        dateMap.set(be.dateTag, { pink: prev.pink + p, grey: prev.grey + g, blue: prev.blue + b });
      });
    });

    const sortedDates = Array.from(dateMap.keys()).sort();
    if (sortedDates.length === 0) {
      container.innerHTML = `<div class="empty-state">No SLD events logged for this subject.</div>`;
      return;
    }

    let cumPink = 0, cumGrey = 0, cumBlue = 0;
    const dates = [];
    const pinkPts = [], greyPts = [], bluePts = [];

    sortedDates.forEach(d => {
      const entry = dateMap.get(d);
      cumPink += entry.pink * (currentWeights.pinkHeart ?? 5);
      cumGrey += entry.grey * (currentWeights.greyHeart ?? 3);
      cumBlue += entry.blue * (currentWeights.blueHeart ?? 1);

      dates.push(d);
      pinkPts.push(cumPink);
      greyPts.push(cumGrey);
      bluePts.push(cumBlue);
    });

    const trace1 = { x: dates, y: pinkPts, name: '🩷 Pink Pts', type: 'scatter', mode: 'lines+markers', line: { color: '#ff69b4', width: 2.5 } };
    const trace2 = { x: dates, y: greyPts, name: '🩶 Grey Pts', type: 'scatter', mode: 'lines+markers', line: { color: '#94a3b8', width: 2.5 } };
    const trace3 = { x: dates, y: bluePts, name: '🩵 Blue Pts', type: 'scatter', mode: 'lines+markers', line: { color: '#38bdf8', width: 2.5 } };

    const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, margin: { l: 40, r: 20, t: 20, b: 40 } };
    window.Plotly.newPlot(containerId, [trace1, trace2, trace3], layout, { responsive: true, displayModeBar: false });
  }

  function renderPinkAccumulationChart(containerId, timelineData = []) {
    const container = document.getElementById(containerId);
    if (!container || !window.Plotly) return;

    if (timelineData.length === 0) {
      container.innerHTML = `<div class="empty-state">No date-tagged media found to display accumulation.</div>`;
      return;
    }

    const dates = timelineData.map(d => d.date);
    const counts = timelineData.map(d => d.cumulativePinkHearts);
    const pts = timelineData.map(d => d.cumulativePinkPts);

    const trace1 = { x: dates, y: counts, name: 'Total 🩷 Pink Hearts', type: 'scatter', mode: 'lines+markers', fill: 'tozeroy', line: { color: '#ff69b4', width: 3 } };
    const trace2 = { x: dates, y: pts, name: 'Pink Heart Points', type: 'scatter', mode: 'lines+markers', line: { color: '#a855f7', width: 2, dash: 'dot' } };

    const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, margin: { l: 40, r: 20, t: 20, b: 40 } };
    window.Plotly.newPlot(containerId, [trace1, trace2], layout, { responsive: true, displayModeBar: false });
  }

  function renderSubjectLeaderboardChart(containerId, subjectStats = []) {
    const container = document.getElementById(containerId);
    if (!container || !window.Plotly) return;

    if (subjectStats.length === 0) { container.innerHTML = `<div class="empty-state">No subject stats recorded.</div>`; return; }

    const top = subjectStats.slice(0, 10).reverse();
    const names = top.map(s => getSubjectDisplayName(s.subject));
    const heartPts = top.map(s => s.heartPoints);
    const eventPts = top.map(s => s.eventPoints);

    const trace1 = { x: heartPts, y: names, name: 'Heart Points', type: 'bar', orientation: 'h', marker: { color: '#ff69b4' } };
    const trace2 = { x: eventPts, y: names, name: 'Event Points', type: 'bar', orientation: 'h', marker: { color: '#38bdf8' } };

    const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, barmode: 'stack', margin: { l: 100, r: 20, t: 20, b: 40 } };
    window.Plotly.newPlot(containerId, [trace1, trace2], layout, { responsive: true, displayModeBar: false });
  }

  function renderCombinationsChart(containerId, combinations = []) {
    const container = document.getElementById(containerId);
    if (!container || !window.Plotly) return;
    if (combinations.length === 0) { container.innerHTML = `<div class="empty-state">No subject combinations found.</div>`; return; }

    const top = combinations.slice(0, 8).reverse();
    const names = top.map(c => c.name);
    const pts = top.map(c => c.totalPoints);

    const trace = { x: pts, y: names, type: 'bar', orientation: 'h', marker: { color: pts, colorscale: 'Viridis' } };
    const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, margin: { l: 140, r: 20, t: 20, b: 40 } };
    window.Plotly.newPlot(containerId, [trace], layout, { responsive: true, displayModeBar: false });
  }

  /* ==========================================================================
     7. MAIN APP COORDINATOR & STATE
     ========================================================================== */
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
  let activeDetailSldTag = null;
  let activeDetailTagName = null;
  let activeDetailEventId = null;
  let sldDefaultFullscreen = false;
  let activeSubjectsTab = 'subjects';
  let sldSortKey = 'date';
  let sldSortDir = 'desc';

  let tagPrefixSettings = { subject: '🔴,🟠,🟡,🟢,🔵,🟣,🟤,🖤,⚪', normal: '🧿', action: '🧿', heart: '🩷,🩵,🩶', sld: '🪾' };
  let alikeSettings = { faint: 15, medium: 30, strong: 45 };
  let globalPointsDisplayMode = 'points';

  let selectedEventYear = 'all';
  let selectedEventMonth = 'all';
  let subjectDetailComboSortHistory = ['eventPoints', 'action', 'heartPoints'];
  let subjectDetailMediaSortHistory = ['totalPoints', 'pink', 'grey'];

  let subjectAlikeSortKey = 'percentage';
  let subjectAlikeSortDir = 'desc';

  let wizardEventDate = null;
  let wizardSubjectCountsMap = new Map();
  let wizardSelectedActionCode = 1;

  let splashTimer = null;
  let splashFadeTimer = null;
  let isSplashActive = false;
  let lastSplashDismissTime = 0;

  function hideSplashScreen(onComplete) {
    const splash = document.getElementById('splashScreen');
    if (!splash) { if (onComplete) onComplete(); return; }

    if (splashTimer) { clearTimeout(splashTimer); splashTimer = null; }
    if (splashFadeTimer) { clearTimeout(splashFadeTimer); splashFadeTimer = null; }

    splash.classList.remove('active');
    splash.classList.add('fade-out');
    splash.style.pointerEvents = 'none';
    splash.style.display = 'none';

    isSplashActive = false;
    lastSplashDismissTime = Date.now();

    if (onComplete) onComplete();
  }

  window.hideSplashScreen = hideSplashScreen;

  function triggerSplashScreen(onComplete) {
    // Guard: Ignore re-trigger attempts within 800ms of dismissal (prevents mobile touch bleed)
    if (Date.now() - lastSplashDismissTime < 800) {
      if (onComplete) onComplete();
      return;
    }

    const splash = document.getElementById('splashScreen');
    if (!splash) { if (onComplete) onComplete(); return; }

    if (isSplashActive) return;
    isSplashActive = true;

    if (splashTimer) clearTimeout(splashTimer);
    if (splashFadeTimer) clearTimeout(splashFadeTimer);

    splash.classList.remove('fade-out');
    splash.classList.add('active');
    splash.style.pointerEvents = 'auto';
    splash.style.display = 'flex';

    const handleSkip = (e) => {
      if (e) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
      }
      hideSplashScreen(onComplete);
    };

    splash.onclick = handleSkip;
    splash.onpointerdown = handleSkip;

    splashTimer = setTimeout(() => {
      hideSplashScreen(onComplete);
    }, 1000);
  }

  function renderSubjectEmojiCounts(count) {
    if (!count || count <= 0) return '';
    if (count === 1) return '💦';
    if (count === 2) return '💦💦';
    return '💦💦<span style="opacity:0.5;" title="2.5 Max Faded Count">💦</span>';
  }

  /* ==========================================================================
     GLOBAL SYSTEM ERROR LOGGER & DIAGNOSTICS
     ========================================================================== */
  const systemErrorLogs = [];

  function logSystemError(type, message, file = '', line = 0, col = 0, stack = '') {
    const errorEntry = {
      timestamp: new Date().toISOString(),
      type: type || 'Error',
      message: message || 'Unknown error occurred',
      location: file ? `${file.split('/').pop()}:${line}:${col}` : '',
      stack: stack || (new Error().stack || '')
    };

    systemErrorLogs.unshift(errorEntry);
    if (systemErrorLogs.length > 50) systemErrorLogs.pop();

    try {
      localStorage.setItem('sld_system_error_logs', JSON.stringify(systemErrorLogs));
    } catch (e) {}

    renderSystemErrorLogsUI();
  }

  function loadSystemErrorLogs() {
    try {
      const saved = localStorage.getItem('sld_system_error_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          systemErrorLogs.length = 0;
          systemErrorLogs.push(...parsed);
        }
      }
    } catch (e) {}
    renderSystemErrorLogsUI();
  }

  function renderSystemErrorLogsUI() {
    const container = document.getElementById('systemErrorLogsContainer');
    const countBadge = document.getElementById('errorLogCountBadge');

    if (countBadge) {
      countBadge.textContent = `${systemErrorLogs.length} error${systemErrorLogs.length === 1 ? '' : 's'}`;
      countBadge.style.background = systemErrorLogs.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)';
      countBadge.style.color = systemErrorLogs.length > 0 ? '#f87171' : '#10b981';
      countBadge.style.borderColor = systemErrorLogs.length > 0 ? '#ef4444' : '#10b981';
    }

    if (!container) return;

    if (systemErrorLogs.length === 0) {
      container.textContent = 'No runtime errors recorded on this device.';
      return;
    }

    container.textContent = systemErrorLogs.map((e, idx) => {
      const timeStr = new Date(e.timestamp).toLocaleTimeString();
      return `[#${systemErrorLogs.length - idx}] ${timeStr} - ${e.type}\nMsg: ${e.message}\nLoc: ${e.location}\nStack:\n${e.stack}\n----------------------------------------`;
    }).join('\n\n');
  }

  window.addEventListener('error', (event) => {
    if (event.message === 'Script error.' && !event.filename && !event.lineno) return;
    logSystemError('JS Error', event.message, event.filename, event.lineno, event.colno, event.error?.stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || 'Unhandled Promise Rejection');
    const stack = event.reason?.stack || '';
    logSystemError('Unhandled Promise Rejection', msg, '', 0, 0, stack);
  });

  /* ==========================================================================
     GLOBAL THUMBNAIL SIZE SLIDER SUBSYSTEM (50px to 200px)
     ========================================================================== */
  async function initGlobalThumbSizeSlider() {
    const slider = document.getElementById('globalThumbSizeSlider');

    const savedSize = await db.getSetting('globalThumbSize');
    const thumbSize = savedSize ? parseInt(savedSize, 10) : 200;

    applyGlobalThumbSize(thumbSize);

    if (slider) {
      slider.value = thumbSize;
      slider.oninput = async (e) => {
        const val = parseInt(e.target.value, 10);
        applyGlobalThumbSize(val);
        await db.setSetting('globalThumbSize', val);
      };
    }
  }

  function applyGlobalThumbSize(sizePx) {
    const valText = document.getElementById('globalThumbSizeVal');
    if (valText) valText.textContent = `${sizePx}px`;

    document.documentElement.style.setProperty('--thumb-size', `${sizePx}px`);

    document.querySelectorAll('.media-card, .sld-mini-thumb-wrap, .subject-mini-thumb').forEach(el => {
      if (!el.classList.contains('winner-thumb') && el.style.width !== '400px') {
        el.style.width = `${sizePx}px`;
        el.style.height = `${sizePx}px`;
      }
    });
  }

  function initSystemErrorLoggerUI() {
    loadSystemErrorLogs();

    document.getElementById('copyErrorLogsBtn')?.addEventListener('click', () => {
      const text = systemErrorLogs.length > 0
        ? document.getElementById('systemErrorLogsContainer')?.textContent
        : 'No runtime errors recorded on this device.';
      navigator.clipboard.writeText(text).then(() => {
        alert('📜 Error log copied to clipboard! You can paste it into the chat.');
      }).catch(() => {
        alert('Failed to copy to clipboard automatically. Please select the text in the error box and copy manually.');
      });
    });

    document.getElementById('clearErrorLogsBtn')?.addEventListener('click', () => {
      systemErrorLogs.length = 0;
      localStorage.removeItem('sld_system_error_logs');
      renderSystemErrorLogsUI();
    });
  }

  /* ==========================================================================
     PWA & AUTO-UPDATE MANAGER
     ========================================================================== */
  let deferredPrompt = null;
  let isAutoUpdateEnabled = true;

  async function initPWAandUpdates() {
    const toggleEl = document.getElementById('autoUpdateToggle');
    const checkBtn = document.getElementById('checkForUpdatesBtn');
    const installBtn = document.getElementById('installPwaBtn');

    const savedAutoUpdate = await db.getSetting('isAutoUpdateEnabled');
    if (savedAutoUpdate !== null && savedAutoUpdate !== undefined) {
      isAutoUpdateEnabled = !!savedAutoUpdate;
    }
    if (toggleEl) {
      toggleEl.checked = isAutoUpdateEnabled;
      toggleEl.onchange = async () => {
        isAutoUpdateEnabled = toggleEl.checked;
        await db.setSetting('isAutoUpdateEnabled', isAutoUpdateEnabled);
      };
    }

    if (checkBtn) {
      checkBtn.onclick = () => checkForAppUpdates(true);
    }

    const isApkMode = window.isNativeApk || window.location.protocol === 'file:' || window.navigator.userAgent.includes('SLDAndroidAPK');
    const badgeEl = document.getElementById('appEnvironmentBadge');
    if (badgeEl) {
      if (isApkMode) {
        badgeEl.textContent = '🤖 Native Android APK V1.2.0';
        badgeEl.style.background = 'rgba(16, 185, 129, 0.2)';
        badgeEl.style.color = '#34d399';
        badgeEl.style.borderColor = '#10b981';
      } else {
        badgeEl.textContent = '🌐 Web PWA & APK Available';
      }
    }

    if (installBtn) {
      installBtn.onclick = () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choice) => {
            if (choice.outcome === 'accepted') {
              installBtn.style.display = 'none';
            }
            deferredPrompt = null;
          });
        } else {
          alert('📲 How to Install SLD App on your phone:\n\n• Android (Chrome/Firefox): Tap browser menu ⋮ → "Add to Home screen" or "Install app".\n\n• iPhone (Safari): Tap Share ⎋ → "Add to Home Screen".');
        }
      };
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (installBtn) {
        installBtn.style.display = 'inline-block';
      }
    });

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('./sw.js');
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                handleNewVersionDetected();
              }
            };
          }
        };
      } catch (err) {
        console.warn('Service worker registration failed:', err);
      }
    }

    if (isAutoUpdateEnabled) {
      checkForAppUpdates(false);
    }
  }


/* === Module: 04_version_pwa.js === */
/* Module 04_version_pwa.js */
let hasCheckedUpdatesThisSession = false;

  async function checkForAppUpdates(userTriggered = false) {
    if (!userTriggered && hasCheckedUpdatesThisSession) return;
    hasCheckedUpdatesThisSession = true;

    let data = null;

    if (window.location.protocol !== 'file:') {
      try {
        const res = await fetch('./version.json?t=' + Date.now());
        if (res.ok) {
          data = await res.json();
        }
      } catch (err) {
        console.warn('Local version check failed, attempting remote GitHub check...', err);
      }
    }

    if (!data) {
      try {
        const remoteRes = await fetch('https://raw.githubusercontent.com/CluadiaCapella/SLD/main/version.json?t=' + Date.now());
        if (remoteRes.ok) {
          data = await remoteRes.json();
        }
      } catch (err) {
        console.warn('Remote GitHub version check failed:', err);
      }
    }

    if (data && data.version) {
      const currentLocalVersion = await db.getSetting('appVersion');

      // Save version to DB immediately to avoid reload loops
      await db.setSetting('appVersion', data.version);

      if (currentLocalVersion && currentLocalVersion !== data.version) {
        showUpdateAvailableBanner(data.version);
      } else {
        if (userTriggered) alert(`Your app is up to date! (V${data.version})`);
      }
    } else {
      if (userTriggered) alert('Unable to check for updates. Please check your internet connection.');
    }
  }

  async function handleNewVersionDetected(newVer = '') {
    if (isAutoUpdateEnabled) {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      }
      setTimeout(() => window.location.reload(), 500);
    } else {
      showUpdateAvailableBanner(newVer);
    }
  }

  function showUpdateAvailableBanner(newVer = '') {
    let banner = document.getElementById('appUpdateBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'appUpdateBanner';
      banner.style.cssText = `
        position: fixed; top: 70px; left: 50%; transform: translateX(-50%); z-index: 9999;
        background: linear-gradient(135deg, var(--accent-pink), var(--accent-blue));
        color: #fff; padding: 10px 20px; border-radius: 30px; font-weight: 800; font-size: 0.85rem;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 12px;
      `;
      document.body.appendChild(banner);
    }
    banner.innerHTML = `
      <span>🚀 New Version Available! ${newVer ? '(V' + newVer + ')' : ''}</span>
      <button class="btn btn-secondary btn-sm" id="reloadUpdateBtn" style="background:#fff; color:#000; font-weight:800;">Update Now</button>
      <button style="background:none; border:none; color:#fff; cursor:pointer; font-weight:bold;" onclick="this.parentElement.remove()">✖</button>
    `;
    document.getElementById('reloadUpdateBtn').onclick = () => window.location.reload();
  }

  async function initApp() {


/* === Module: 05_views_router.js === */
/* Module 05_views_router.js */
triggerSplashScreen();

    try {
      await db.init();
      await loadAppState();
    } catch (err) {
      console.warn('DB Init Warning:', err);
    }

    setupNavigation();
    setupEventListeners();
    setupNavbarAutoHide();
    initPWAandUpdates();
    initSystemErrorLoggerUI();
    initGlobalThumbSizeSlider();

    document.getElementById('headerBrandLogo')?.addEventListener('click', () => {
      triggerSplashScreen(() => {
        switchView('mediaBrowserView');
      });
    });

    document.addEventListener('click', (e) => {
      if (selectedMediaIds.size > 0) {
        if (!e.target.closest('.media-card') && !e.target.closest('#selectionBanner') && !e.target.closest('#multiSelectTagsModal')) {
          selectedMediaIds.clear();
          updateSelectionStateUI();
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      const lbModal = document.getElementById('lightboxModal');
      const isLbActive = lbModal && lbModal.classList.contains('active');

      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInputFocused = activeTag === 'input' || activeTag === 'textarea';

      if (e.key === 'Escape') {
        if (isLbActive) {
          closeLightbox();
        } else if (selectedMediaIds.size > 0) {
          selectedMediaIds.clear();
          updateSelectionStateUI();
        }
      } else if (isLbActive && !isInputFocused) {
        if (e.code === 'Space' || e.key === ' ') {
          e.preventDefault();
          const lbVid = document.getElementById('lbMediaVideo');
          if (lbVid) {
            if (lbVid.paused) {
              lbVid.play().catch(() => {});
            } else {
              lbVid.pause();
            }
          }
        } else if (e.key === 'ArrowLeft') {
          if (lightboxIndex > 0) openLightbox(lightboxIndex - 1);
        } else if (e.key === 'ArrowRight') {
          if (lightboxIndex < currentMediaList.length - 1) openLightbox(lightboxIndex + 1);
        }
      }
    });

    // Touch swipe gestures for mobile Lightbox navigation (Firefox Mobile & Chrome Compatible)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e) => {
      if (e.touches && e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
      }
    };

    const handleTouchEnd = (e) => {
      if (!e.changedTouches || e.changedTouches.length !== 1) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      const deltaY = e.changedTouches[0].clientY - touchStartY;
      const elapsedTime = Date.now() - touchStartTime;

      if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > Math.abs(deltaY) && elapsedTime < 800) {
        if (deltaX < 0 && lightboxIndex < currentMediaList.length - 1) {
          openLightbox(lightboxIndex + 1);
        } else if (deltaX > 0 && lightboxIndex > 0) {
          openLightbox(lightboxIndex - 1);
        }
      } else if (deltaY > 90 && Math.abs(deltaY) > Math.abs(deltaX) * 1.5 && elapsedTime < 800) {
        closeLightbox();
      }
    };

    const lbModalEl = document.getElementById('lightboxModal');
    const lbWrapperEl = document.getElementById('lightboxContentWrapper');

    if (lbModalEl) {
      lbModalEl.addEventListener('touchstart', handleTouchStart, { passive: true });
      lbModalEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    }
    if (lbWrapperEl) {
      lbWrapperEl.addEventListener('touchstart', handleTouchStart, { passive: true });
      lbWrapperEl.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    const searchInput = document.getElementById('mediaSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        currentMediaPage = 1;
        if (currentActiveView === 'mediaBrowserView') renderMediaBrowser();
      });
    }

    document.getElementById('toggleMediaRatingsBtn')?.addEventListener('click', () => {
      isMediaRatingsEnabled = !isMediaRatingsEnabled;
      const btn = document.getElementById('toggleMediaRatingsBtn');
      if (btn) {
        btn.textContent = '⭐';
        btn.setAttribute('title', `⭐ Star Ratings: ${isMediaRatingsEnabled ? 'ON' : 'OFF'}`);
        btn.classList.toggle('active-sort', isMediaRatingsEnabled);
      }
      renderMediaBrowser();
    });

    document.getElementById('toggleMediaGroupBtn')?.addEventListener('click', () => {
      isMediaGroupingEnabled = !isMediaGroupingEnabled;
      const btn = document.getElementById('toggleMediaGroupBtn');
      if (btn) {
        btn.textContent = '📁';
        btn.setAttribute('title', `📁 Subject Grouping: ${isMediaGroupingEnabled ? 'ON' : 'OFF'}`);
        btn.classList.toggle('active-sort', isMediaGroupingEnabled);
      }
      renderMediaBrowser();
    });

    document.getElementById('mediaFilterTagSelect')?.addEventListener('change', () => {
      currentMediaPage = 1;
      if (currentActiveView === 'mediaBrowserView') renderMediaBrowser();
    });

    // 3-Deep Cascade Sort Buttons Listeners
    document.querySelectorAll('#mediaSortButtonsToolbar .sort-toggle-btn').forEach(btn => {
      btn.onclick = () => {
        const key = btn.getAttribute('data-key');
        handleSortButtonClick(key);
      };
    });

    updateSortButtonsUI();
    renderHeaderGroupFilters();

    setupSmartDateAutocomplete('panelSldInput', 'panelSldAutocomplete');
    setupSmartDateAutocomplete('panelEventInput', 'panelEventAutocomplete');
    setupSmartDateAutocomplete('inlineEventDateInput', 'inlineEventDateAutocomplete');
    setupSmartDateAutocomplete('lbSldInput', 'lbSldAutocomplete');

    setupSmartSubjectAutocomplete('panelSubjectInput', 'panelSubjectAutocomplete', (subId) => {
      applyTagToSelectedMedia('subject', subId);
    });

    setupSmartSubjectAutocomplete('lbSubjectInput', 'lbSubjectAutocomplete', async (subId) => {
      if (lightboxIndex >= 0 && lightboxIndex < currentMediaList.length) {
        const media = currentMediaList[lightboxIndex];
        media.subjectTags = media.subjectTags || [];
        if (!media.subjectTags.includes(subId)) {
          media.subjectTags.push(subId);
          await db.put('media', media);
          renderLightboxContent();
          renderCurrentView();
          const subInput = document.getElementById('lbSubjectInput');
          if (subInput) setTimeout(() => subInput.focus(), 80);
        }
      }
    });

    setupNormalTagAutocomplete('panelNormalTagInput', 'panelNormalTagAutocomplete', (tag) => {
      applyTagToSelectedMedia('normal', tag);
    });

    setupNormalTagAutocomplete('lbNormalTagInput', 'lbNormalTagAutocomplete', async (tag) => {
      if (lightboxIndex >= 0 && lightboxIndex < currentMediaList.length) {
        const media = currentMediaList[lightboxIndex];
        media.normalTags = media.normalTags || [];
        if (!media.normalTags.includes(tag)) {
          media.normalTags.push(tag);
          await db.put('media', media);
          renderLightboxContent();
          renderCurrentView();
          const tagInput = document.getElementById('lbNormalTagInput');
          if (tagInput) setTimeout(() => tagInput.focus(), 80);
        }
      }
    });

    setupSmartSubjectAutocomplete('wizardSubjectInput', 'wizardSubjectAutocomplete', (subId) => {
      if (!wizardSubjectCountsMap.has(subId)) wizardSubjectCountsMap.set(subId, 1);
      renderWizardParticipants();
    });

    const lbModal = document.getElementById('lightboxModal');
    if (lbModal) {
      lbModal.addEventListener('click', (e) => {
        const isInteractive = e.target.closest('img, video, input, select, button, a, label, .lightbox-footer, .lightbox-editor-toolbar, .video-clipper-panel, .lightbox-header, .lightbox-nav-btn');
        if (!isInteractive) {
          closeLightbox();
        }
      });
    }

    setupSmartSubjectAutocomplete('inlineSubjectInput', 'inlineSubjectAutocomplete', async (subId) => {
      if (selectedMediaIds.size > 0) {
        const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
        for (const m of selectedFiles) {
          if (!m.subjectTags) m.subjectTags = [];
          if (!m.subjectTags.includes(subId)) m.subjectTags.push(subId);
          await db.put('media', m);
        }
        await loadAppState();
        updateSelectionStateUI();
        const subInput = document.getElementById('inlineSubjectInput');
        if (subInput) setTimeout(() => subInput.focus(), 80);
      }
    });

    setupNormalTagAutocomplete('inlineNormalTagInput', 'inlineNormalTagAutocomplete', async (tagVal) => {
      if (selectedMediaIds.size > 0) {
        const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
        for (const m of selectedFiles) {
          if (!m.normalTags) m.normalTags = [];
          if (!m.normalTags.includes(tagVal)) m.normalTags.push(tagVal);
          await db.put('media', m);
        }
        await loadAppState();
        updateSelectionStateUI();
        const tagInput = document.getElementById('inlineNormalTagInput');
        if (tagInput) setTimeout(() => tagInput.focus(), 80);
      }
    });

    setupSmartDateAutocomplete('inlineSldInput', 'inlineSldAutocomplete');

    setupSmartSubjectAutocomplete('inlineAlikeInput', 'inlineAlikeAutocomplete', async (subId) => {
      if (selectedMediaIds.size > 0) {
        const alikeInput = document.getElementById('inlineAlikeInput');
        const raw = alikeInput?.value.trim() || '';
        const parts = raw.split('::');
        const strPart = (parts[1] || 'faint').trim().toLowerCase();
        const strength = ['faint', 'medium', 'strong'].includes(strPart) ? strPart : 'faint';

        const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
        for (const m of selectedFiles) {
          if (!m.alikeTags) m.alikeTags = [];
          if (!m.alikeTags.some(al => al.targetSubjectId === subId && al.strength === strength)) {
            m.alikeTags.push({ targetSubjectId: subId, strength });
          }
          await db.put('media', m);
        }
        if (alikeInput) alikeInput.value = '';
        await loadAppState();
        updateSelectionStateUI();
        if (alikeInput) setTimeout(() => alikeInput.focus(), 80);
      }
    });

    renderCurrentView();
  }

  function handleSortButtonClick(key) {
    const existingIdx = sortCascadeStack.findIndex(s => s.key === key);
    let newDir = 'desc';

    if (existingIdx !== -1) {
      newDir = sortCascadeStack[existingIdx].dir === 'desc' ? 'asc' : 'desc';
      sortCascadeStack.splice(existingIdx, 1);
    }

    sortCascadeStack.unshift({ key, dir: newDir });
    if (sortCascadeStack.length > 3) {
      sortCascadeStack = sortCascadeStack.slice(0, 3);
    }

    updateSortButtonsUI();
    renderMediaBrowser();
  }

  function updateSortButtonsUI() {
    const container = document.getElementById('mediaSortButtonsToolbar');
    if (!container) return;

    const baseInfo = {
      date: { emoji: '📅', label: '📅 Date Sort' },
      subject: { emoji: '👤', label: '👤 Subject Sort' },
      totalPts: { emoji: '⭐', label: '⭐ Total Points Sort' },
      pinkPts: { emoji: '🩷', label: '🩷 Pink Heart Points Sort' },
      greyPts: { emoji: '🩶', label: '🩶 Grey Heart Points Sort' },
      bluePts: { emoji: '🩵', label: '🩵 Blue Heart Points Sort' },
      sldCount: { emoji: '📘', label: '📘 SLD Count Sort' }
    };

    const rankEmojis = ['1️⃣', '2️⃣', '3️⃣'];

    container.querySelectorAll('.sort-toggle-btn').forEach(btn => {
      const key = btn.getAttribute('data-key');
      const idx = sortCascadeStack.findIndex(s => s.key === key);
      const info = baseInfo[key] || { emoji: '❓', label: key };

      if (idx !== -1) {
        const item = sortCascadeStack[idx];
        const arrow = item.dir === 'desc' ? '▼' : '▲';
        const rank = sortCascadeStack.length > 1 ? rankEmojis[idx] : '';
        btn.textContent = `${rank}${info.emoji}${arrow}`;
        btn.setAttribute('title', `${info.label} (Rank ${idx + 1}: ${item.dir === 'desc' ? 'High to Low' : 'Low to High'})`);
        btn.classList.add('active-sort');
      } else {
        btn.textContent = info.emoji;
        btn.setAttribute('title', info.label);
        btn.classList.remove('active-sort');
      }
    });
  }

  function compareSingleSortKey(a, b, key, dir) {
    let valA, valB;
    const aPts = calculateMediaHeartPoints(a);
    const bPts = calculateMediaHeartPoints(b);

    if (key === 'date') {
      valA = a.id;
      valB = b.id;
    } else if (key === 'subject') {
      const subA = (a.subjectTags || []).map(id => currentSubjectsList.find(s => s.id === id)).filter(Boolean)[0];
      const subB = (b.subjectTags || []).map(id => currentSubjectsList.find(s => s.id === id)).filter(Boolean)[0];
      valA = subA ? getSubjectDisplayName(subA) : '';
      valB = subB ? getSubjectDisplayName(subB) : '';
    } else if (key === 'totalPts') {
      valA = aPts.totalHeartPts;
      valB = bPts.totalHeartPts;
    } else if (key === 'pinkPts') {
      valA = aPts.pinkPts;
      valB = bPts.pinkPts;
    } else if (key === 'greyPts') {
      valA = aPts.greyPts;
      valB = bPts.greyPts;
    } else if (key === 'bluePts') {
      valA = aPts.bluePts;
      valB = bPts.bluePts;
    } else if (key === 'sldCount') {
      valA = (a.blueBookEvents || []).length;
      valB = (b.blueBookEvents || []).length;
    }

    let result = 0;
    if (typeof valA === 'string' && typeof valB === 'string') {
      result = valA.localeCompare(valB);
    } else {
      result = (valA || 0) - (valB || 0);
    }

    return dir === 'desc' ? -result : result;
  }

  function compareMediaCascade(a, b) {
    for (const criterion of sortCascadeStack) {
      const cmp = compareSingleSortKey(a, b, criterion.key, criterion.dir);
      if (cmp !== 0) return cmp;
    }
    return 0;
  }

  function setupNavbarAutoHide() {
    const nav = document.getElementById('bottomNavBar');
    if (nav) {
      nav.classList.remove('nav-hidden');
    }

    // Ensure bottom navbar stays visible on all scroll events
    window.addEventListener('scroll', () => {
      const navEl = document.getElementById('bottomNavBar');
      if (navEl && navEl.classList.contains('nav-hidden')) {
        navEl.classList.remove('nav-hidden');
      }
    }, { passive: true });
  }

  async function loadAppState() {
    currentWeights = (await db.getSetting('scoringWeights')) || { heart1: 1, heart2: 3, heart3: 10, eventCCount: 10, eventTag: 1 };
    currentActionPointsMap = (await db.getSetting('actionPointsMap')) || DEFAULT_ACTION_POINTS;
    currentMedalSettings = (await db.getSetting('medalSettings')) || DEFAULT_MEDAL_SETTINGS;
    currentSubjectGroupsList = (await db.getSetting('subjectGroups')) || DEFAULT_SUBJECT_GROUPS;

    tagPrefixSettings = (await db.getSetting('tagPrefixSettings')) || { subject: '🔴,🟠,🟡,🟢,🔵,🟣,🟤,🖤,⚪', normal: '🧿', action: '🧿', heart: '🩷,🩵,🩶', sld: '🪾' };
    alikeSettings = (await db.getSetting('alikeSettings')) || { faint: 15, medium: 30, strong: 45 };
    globalPointsDisplayMode = (await db.getSetting('globalPointsDisplayMode')) || 'points';

    const theme = (await db.getSetting('theme')) || 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    currentMediaList = await db.getActiveMedia();
    currentSubjectsList = await db.getActiveSubjects();
    currentEventsList = await db.getActiveEvents();

    const activeProfileId = await db.getActiveProfileId();
    const profiles = await db.getAll('profiles');
    const activeProfile = profiles.find(p => p.id === activeProfileId);
    const profilePill = document.getElementById('activeProfilePill');
    if (profilePill && activeProfile) {
      profilePill.textContent = `📁 ${activeProfile.name}`;
    }
  }

  function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const viewId = e.currentTarget.getAttribute('data-view');
        if (viewId) switchView(viewId);
      });
    });
  }

  function getGroupDisplayTitle(g) {
    if (!g) return '';
    const emoji = g.emoji || '📁';
    const cleanName = (g.name || '').replace(/^[\p{Emoji}\s]+/u, '').trim();
    return `${emoji} ${cleanName || g.name}`;
  }

  function switchView(viewId, skipPushState = false) {
    currentActiveView = viewId;
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-view') === viewId);
    });
    document.querySelectorAll('.view-page').forEach(el => {
      el.classList.toggle('active', el.id === viewId);
    });
    renderCurrentView();

    if (!skipPushState) {
      const stateObj = {
        viewId,
        activeDetailSubjectId,
        activeDetailComboKey,
        activeDetailSldDateTag,
        activeDetailEventId,
        activeDetailTagName,
        isLightbox: false
      };
      window.history.pushState(stateObj, '', '#' + viewId);
    }
  }

  function renderCurrentView() {
    const stats = processAllStats(currentMediaList, currentSubjectsList, currentEventsList, currentWeights);

    switch (currentActiveView) {
      case 'mediaBrowserView': renderMediaBrowser(); break;
      case 'subjectsView': renderSubjectsPage(stats); break;
      case 'subjectDetailsView': renderSubjectDetailsPage(stats); break;
      case 'combinationDetailsView': renderCombinationDetailsPage(stats); break;
      case 'sldView': renderSldListPage(); break;
      case 'sldDetailsView': renderSldDetailsPage(); break;
      case 'eventsView': renderEventsPage(stats); break;
      case 'eventDetailsView': renderEventDetailsPage(stats); break;
      case 'tagsView': renderTagsPage(); break;
      case 'tagDetailsView': renderTagDetailsPage(); break;
      case 'statsView': renderStatsPage(stats); break;
      case 'settingsView': renderSettingsPage(); break;
    }
  }

  function renderHeaderGroupFilters() {
    const container = document.getElementById('headerGroupFiltersContainer');
    if (!container) return;

    const allGroups = [
      { id: '__none__', name: '⚪ None', emoji: '⚪' },
      ...currentSubjectGroupsList
    ];

    container.innerHTML = allGroups.map(g => {
      const isDisabled = disabledGroupIds.has(g.id);
      return `<button type="button" class="header-group-filter-btn ${isDisabled ? 'disabled-group' : ''}" data-gid="${g.id}" title="${g.name}">${g.emoji || '⚪'}</button>`;
    }).join('');

    container.querySelectorAll('.header-group-filter-btn').forEach(btn => {
      btn.onclick = () => {
        const gId = btn.getAttribute('data-gid');
        if (disabledGroupIds.has(gId)) {
          disabledGroupIds.delete(gId);
        } else {
          disabledGroupIds.add(gId);
        }
        renderHeaderGroupFilters();
        if (currentActiveView === 'mediaBrowserView') renderMediaBrowser();
      };
    });
  }

  /* ==========================================================================
     8. MEDIA BROWSER WITH GROUPING & 3-DEEP CASCADE SORTING
     ========================================================================== */
  function renderMediaBrowser() {
    const gridContainer = document.getElementById('mediaGrid');
    const selectionBanner = document.getElementById('selectionBanner');
    const selectedCountEl = document.getElementById('selectedCount');
    const paginationContainer = document.getElementById('mediaPaginationContainer');
    const paginationInfo = document.getElementById('paginationInfo');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');

    if (selectedMediaIds.size > 0) {
      selectionBanner.style.display = 'flex';
      selectionBanner.className = 'selection-banner-sticky';
      selectedCountEl.textContent = `${selectedMediaIds.size} file(s) selected`;
      renderSelectionTagsPanel();
    } else {
      selectionBanner.style.display = 'none';
    }

    if (currentMediaList.length === 0) {
      gridContainer.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">📁</div>
          <h3>No media files added yet</h3>
          <p>Click "Upload Media" above to select photos or videos.</p>
        </div>`;
      if (paginationContainer) paginationContainer.style.display = 'none';
      return;
    }

    const searchQuery = (document.getElementById('mediaSearchInput')?.value || '').toLowerCase();
    const filterTag = document.getElementById('mediaFilterTagSelect')?.value || 'all';

    const filtered = currentMediaList.filter(m => {
      const isAi = m.isAiGenerated || (m.normalTags || []).includes('AI');
      if (aiFilterMode === 'ai_only' && !isAi) return false;
      if (aiFilterMode === 'human_only' && isAi) return false;

      // Header Group Filter Toggle Check
      if (!m.subjectTags || m.subjectTags.length === 0) {
        if (disabledGroupIds.has('__none__')) return false;
      } else {
        const assignedSubs = (m.subjectTags || []).map(sId => currentSubjectsList.find(s => s.id === sId)).filter(Boolean);
        const subGroupIds = assignedSubs.map(s => s.groupId || '__none__');
        if (subGroupIds.length > 0 && subGroupIds.every(gId => disabledGroupIds.has(gId))) {
          return false;
        }
      }

      if (searchQuery) {
        const matchName = m.filename.toLowerCase().includes(searchQuery);
        const matchSubjects = (m.subjectTags || []).some(sId => {
          const sub = currentSubjectsList.find(s => s.id === sId);
          return sub ? getSubjectDisplayName(sub).toLowerCase().includes(searchQuery) : false;
        });
        const matchSld = (m.blueBookEvents || []).some(be => be.dateTag && be.dateTag.toLowerCase().includes(searchQuery));
        const matchNormal = (m.normalTags || []).some(t => t.toLowerCase().includes(searchQuery));

        if (!matchName && !matchSubjects && !matchSld && !matchNormal) return false;
      }

      if (filterTag === 'hasBlueEvents' && (!m.blueBookEvents || m.blueBookEvents.length === 0)) return false;
      if (filterTag === 'pink3' && !(m.blueBookEvents || []).some(be => be.heartTags?.pink === 3)) return false;
      if (filterTag === 'hasSubjects' && (!m.subjectTags || m.subjectTags.length === 0)) return false;
      if (filterTag === 'noSubjects' && (m.subjectTags && m.subjectTags.length > 0)) return false;
      if (filterTag === 'star5' && calculateMediaStarRating(m) !== 5) return false;
      if (filterTag === 'star4' && calculateMediaStarRating(m) !== 4) return false;
      if (filterTag === 'star3' && calculateMediaStarRating(m) !== 3) return false;
      if (filterTag === 'star2' && calculateMediaStarRating(m) !== 2) return false;
      if (filterTag === 'star1' && calculateMediaStarRating(m) !== 1) return false;
      if (filterTag === 'star0' && calculateMediaStarRating(m) !== 0) return false;
      if (filterTag === 'rejected' && calculateMediaStarRating(m) !== -1) return false;
      return true;
    });

    // 3-Deep Cascade Sort Execution
    filtered.sort(compareMediaCascade);

    // Separate Active (Non-Rejected) vs Rejected Files
    const activeFiltered = [];
    const rejectedFiltered = [];

    for (const m of filtered) {
      if (calculateMediaStarRating(m) === -1) {
        rejectedFiltered.push(m);
      } else {
        activeFiltered.push(m);
      }
    }

    const totalItems = activeFiltered.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    if (currentMediaPage > totalPages) currentMediaPage = totalPages;

    const startIndex = (currentMediaPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
    const pagedItems = activeFiltered.slice(startIndex, endIndex);

    if (totalItems > ITEMS_PER_PAGE) {
      if (paginationContainer) {
        paginationContainer.style.display = 'flex';
        paginationInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${totalItems} active files (Page ${currentMediaPage} of ${totalPages})`;
        prevBtn.disabled = currentMediaPage <= 1;
        nextBtn.disabled = currentMediaPage >= totalPages;

        prevBtn.onclick = () => { if (currentMediaPage > 1) { currentMediaPage--; renderMediaBrowser(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
        nextBtn.onclick = () => { if (currentMediaPage < totalPages) { currentMediaPage++; renderMediaBrowser(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
      }
    } else {
      if (paginationContainer) paginationContainer.style.display = 'none';
    }

    const renderCardHTML = (m) => {
      const isSelected = selectedMediaIds.has(m.id);
      const blueEvents = m.blueBookEvents || [];
      const borderClass = getMediaHighestPriorityGroupBorderClass(m);
      const starRating = calculateMediaStarRating(m);

      let pinkTotal = 0, greyTotal = 0, blueTotal = 0;
      blueEvents.forEach(be => {
        pinkTotal += be.heartTags?.pink || 0;
        greyTotal += be.heartTags?.grey || 0;
        blueTotal += be.heartTags?.blue || 0;
      });

      const subjectPills = (m.subjectTags || []).map(subId => {
        const sub = currentSubjectsList.find(s => s.id === subId);
        return `<span class="subject-tag-pill nav-sub-pill" data-subid="${subId}">${getSubjectDisplayName(sub)}</span>`;
      }).join('');

      const isAi = m.isAiGenerated || (m.normalTags || []).includes('AI');

      return `
        <div class="media-card ${borderClass} ${isSelected ? 'selected' : ''}" data-id="${m.id}">
          ${renderMediaThumbnailHTML(m)}
          <div class="media-card-overlay">
            <div class="media-card-badges">
              ${isAi ? `<span class="badge" style="background:linear-gradient(135deg, #a855f7, #6366f1); color:#fff; font-weight:800; border-radius:4px; padding:2px 6px;">🤖 AI</span>` : ''}
              ${starRating === -1 ? `<span class="heart-badge" style="background:#ef4444; color:#fff; font-weight:800;">🚫 Rejected</span>` : `<span class="heart-badge" style="background:rgba(234,179,8,0.25); color:#facc15; border:1px solid #eab308; font-weight:800;">⭐ ${starRating}</span>`}
              ${blueEvents.length > 0 ? `<span class="heart-badge blue">📘 ${blueEvents.length}</span>` : ''}
              ${pinkTotal > 0 ? `<span class="heart-badge pink">🩷 ${pinkTotal}</span>` : ''}
              ${greyTotal > 0 ? `<span class="heart-badge grey">🩶 ${greyTotal}</span>` : ''}
              ${blueTotal > 0 ? `<span class="heart-badge blue">🩵 ${blueTotal}</span>` : ''}
              ${subjectPills}
            </div>
          </div>
          ${selectedMediaIds.size > 0 ? `<button class="card-viewer-btn" data-id="${m.id}" title="View Media">👁️</button>` : ''}
        </div>`;
    };

    const renderSubjectGroupsHTML = (filesSlice) => {
      const mediaGroupsMap = new Map();
      currentSubjectGroupsList.forEach(g => mediaGroupsMap.set(g.id, []));
      const unassignedMedia = [];

      for (const m of filesSlice) {
        if (!m.subjectTags || m.subjectTags.length === 0) {
          unassignedMedia.push(m);
        } else {
          const borderClass = getMediaHighestPriorityGroupBorderClass(m);
          let assignedGroupId = null;
          for (const g of currentSubjectGroupsList) {
            if (g.cssClass === borderClass) { assignedGroupId = g.id; break; }
          }
          if (assignedGroupId && mediaGroupsMap.has(assignedGroupId)) {
            mediaGroupsMap.get(assignedGroupId).push(m);
          } else {
            unassignedMedia.push(m);
          }
        }
      }

      let groupsHTML = '';
      currentSubjectGroupsList.forEach(g => {
        if (disabledGroupIds.has(g.id)) return;
        const groupFiles = mediaGroupsMap.get(g.id) || [];
        if (groupFiles.length > 0) {
          groupsHTML += `
            <div class="media-group-section" style="display:block; width:100%; margin-bottom:20px;">
              <div class="media-group-title" style="color:${g.color || 'var(--text-primary)'}; font-weight:800; font-size:1.05rem; margin-bottom:12px; padding-bottom:4px; border-bottom:1px dashed var(--border-color);">
                ${getGroupDisplayTitle(g)} (${groupFiles.length} files)
              </div>
              <div class="media-grid">
                ${groupFiles.map(renderCardHTML).join('')}
              </div>
            </div>`;
        }
      });

      if (unassignedMedia.length > 0 && !disabledGroupIds.has('__none__')) {
        groupsHTML += `
          <div class="media-group-section" style="display:block; width:100%; margin-bottom:20px;">
            <div class="media-group-title" style="color:var(--text-secondary); font-weight:800; font-size:1.05rem; margin-bottom:12px; padding-bottom:4px; border-bottom:1px dashed var(--border-color);">
              ⚪ Unassigned / No Subject Group (${unassignedMedia.length} files)
            </div>
            <div class="media-grid">
              ${unassignedMedia.map(renderCardHTML).join('')}
            </div>
          </div>`;
      }
      return groupsHTML;
    };

    let mainHTML = '';

    if (isMediaRatingsEnabled) {
      const starLevels = [5, 4, 3, 2, 1, 0];
      starLevels.forEach(star => {
        const ratingFiles = pagedItems.filter(m => calculateMediaStarRating(m) === star);
        if (ratingFiles.length > 0) {
          mainHTML += `
            <div class="media-rating-section" style="width:100%; margin-bottom:32px;">
              <div class="media-rating-header">
                <span>${getStarRatingLabel(star)}</span>
                <span class="text-muted" style="font-size:0.85rem; font-weight:700;">${ratingFiles.length} file(s)</span>
              </div>
              ${isMediaGroupingEnabled ? renderSubjectGroupsHTML(ratingFiles) : `<div class="media-grid">${ratingFiles.map(renderCardHTML).join('')}</div>`}
            </div>`;
        }
      });
    } else if (isMediaGroupingEnabled) {
      mainHTML = renderSubjectGroupsHTML(pagedItems);
    } else {
      mainHTML = `<div class="media-grid">${pagedItems.map(renderCardHTML).join('')}</div>`;
    }

    if (rejectedFiltered.length > 0) {
      mainHTML += `
        <details class="rejected-accordion-card">
          <summary style="font-weight:800; font-size:1.1rem; cursor:pointer; color:#ef4444; display:flex; align-items:center; justify-content:space-between; user-select:none;">
            <span>🚫 Rejected Files (${rejectedFiltered.length})</span>
            <span class="text-muted" style="font-size:0.85rem; font-weight:600;">Click to expand / collapse ▼</span>
          </summary>
          <div class="media-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap:16px; margin-top:16px;">
            ${rejectedFiltered.map(renderCardHTML).join('')}
          </div>
        </details>`;
    }

    gridContainer.innerHTML = mainHTML || `<div class="empty-state" style="grid-column: 1 / -1;">No files match active filters.</div>`;

    gridContainer.querySelectorAll('.media-card').forEach(card => {
      const id = card.getAttribute('data-id');
      const viewerBtn = card.querySelector('.card-viewer-btn');
      let pressTimer = null;
      let isLongPressTriggered = false;

      if (viewerBtn) {
        viewerBtn.onclick = (e) => {
          e.stopPropagation();
          openLightboxById(id);
        };
      }

      card.querySelectorAll('.nav-sub-pill').forEach(pill => {
        pill.onclick = (e) => {
          if (selectedMediaIds.size === 0) {
            e.stopPropagation();
            activeDetailSubjectId = pill.getAttribute('data-subid');
            switchView('subjectDetailsView');
          }
        };
      });

      const startPress = () => {
        isLongPressTriggered = false;
        pressTimer = setTimeout(() => {
          isLongPressTriggered = true;
          if (!selectedMediaIds.has(id)) selectedMediaIds.add(id);
          card.classList.add('selected');
          updateSelectionStateUI();
        }, 200);
      };

      const cancelPress = () => { if (pressTimer) clearTimeout(pressTimer); };

      card.addEventListener('mousedown', startPress);
      card.addEventListener('touchstart', startPress);
      card.addEventListener('mouseup', cancelPress);
      card.addEventListener('mouseleave', cancelPress);
      card.addEventListener('touchend', cancelPress);

      card.onclick = (e) => {
        if (e.target.classList.contains('card-viewer-btn') || e.target.classList.contains('nav-sub-pill')) return;
        if (isLongPressTriggered) { isLongPressTriggered = false; return; }

        if (selectedMediaIds.size > 0) {
          if (selectedMediaIds.has(id)) {
            selectedMediaIds.delete(id);
            card.classList.remove('selected');
          } else {
            selectedMediaIds.add(id);
            card.classList.add('selected');
          }
          updateSelectionStateUI();
        } else {
          openLightboxById(id);
        }
      };
    });
  }


/* === Module: 06_selection_tags.js === */
/* Module 06_selection_tags.js */
function openMultiSelectTagsModal(subjectIds = null) {
    const modal = document.getElementById('multiSelectTagsModal');
    if (!modal) return;

    renderSelectionTagsPanel();
    modal.classList.add('active');
    modal.style.display = 'flex';
  }

  function updateSelectionStateUI() {
    const selectionBanner = document.getElementById('selectionBanner');
    const selectedCountEl = document.getElementById('selectedCount');

    if (selectedMediaIds.size > 0) {
      selectionBanner.style.display = 'flex';
      selectedCountEl.textContent = `${selectedMediaIds.size} file(s) selected`;
      renderSelectionInlineTags();
    } else {
      selectionBanner.style.display = 'none';
      renderMediaBrowser();
    }
  }

  function setupInlineSelectionTagInputs() {
    const subInput = document.getElementById('inlineSubjectInput');
    const normalInput = document.getElementById('inlineNormalTagInput');
    const sldInput = document.getElementById('inlineSldInput');
    const alikeInput = document.getElementById('inlineAlikeInput');

    if (subInput && !subInput.dataset.bound) {
      subInput.dataset.bound = 'true';
      subInput.onkeydown = async (e) => {
        if (e.key === 'Enter' && subInput.value.trim() && selectedMediaIds.size > 0) {
          const nameVal = subInput.value.trim();
          let sub = currentSubjectsList.find(s => s.name.toLowerCase() === nameVal.toLowerCase());
          if (!sub) {
            const pId = await db.getActiveProfileId();
            sub = { id: 'sub-' + Date.now(), profileId: pId, name: nameVal, groupId: 'green', avatarUrl: null };
            await db.put('subjects', sub);
          }
          const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
          for (const m of selectedFiles) {
            if (!m.subjectTags) m.subjectTags = [];
            if (!m.subjectTags.includes(sub.id)) m.subjectTags.push(sub.id);
            await db.put('media', m);
          }
          subInput.value = '';
          await loadAppState();
          updateSelectionStateUI();
        }
      };
    }

    if (normalInput && !normalInput.dataset.bound) {
      normalInput.dataset.bound = 'true';
      normalInput.onkeydown = async (e) => {
        if (e.key === 'Enter' && normalInput.value.trim() && selectedMediaIds.size > 0) {
          const tagVal = normalInput.value.trim();
          const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
          for (const m of selectedFiles) {
            if (!m.normalTags) m.normalTags = [];
            if (!m.normalTags.includes(tagVal)) m.normalTags.push(tagVal);
            await db.put('media', m);
          }
          normalInput.value = '';
          await loadAppState();
          updateSelectionStateUI();
        }
      };
    }

    if (sldInput && !sldInput.dataset.bound) {
      sldInput.dataset.bound = 'true';
      sldInput.onkeydown = async (e) => {
        if (e.key === 'Enter' && sldInput.value.trim() && selectedMediaIds.size > 0) {
          const dateTagVal = sldInput.value.trim();
          const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
          for (const m of selectedFiles) {
            if (!m.blueBookEvents) m.blueBookEvents = [];
            if (!m.blueBookEvents.some(be => be.dateTag === dateTagVal)) {
              m.blueBookEvents.push({
                id: 'be-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
                dateTag: dateTagVal,
                heartTags: { pink: 0, grey: 0, blue: 0 }
              });
            }
            await db.put('media', m);
          }
          sldInput.value = '';
          await loadAppState();
          updateSelectionStateUI();
        }
      };
    }

    if (alikeInput && !alikeInput.dataset.bound) {
      alikeInput.dataset.bound = 'true';
      alikeInput.onkeydown = async (e) => {
        if (e.key === 'Enter' && alikeInput.value.trim() && selectedMediaIds.size > 0) {
          const raw = alikeInput.value.trim();
          const parts = raw.split('::');
          const namePart = parts[0].trim();
          const strPart = (parts[1] || 'faint').trim().toLowerCase();
          const strength = ['faint', 'medium', 'strong'].includes(strPart) ? strPart : 'faint';

          let sub = currentSubjectsList.find(s => s.name.toLowerCase() === namePart.toLowerCase());
          if (!sub) {
            const pId = await db.getActiveProfileId();
            sub = { id: 'sub-' + Date.now(), profileId: pId, name: namePart, groupId: 'green', avatarUrl: null };
            await db.put('subjects', sub);
          }

          const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
          for (const m of selectedFiles) {
            if (!m.alikeTags) m.alikeTags = [];
            if (!m.alikeTags.some(al => al.targetSubjectId === sub.id && al.strength === strength)) {
              m.alikeTags.push({ targetSubjectId: sub.id, strength: strength });
            }
            await db.put('media', m);
          }
          alikeInput.value = '';
          await loadAppState();
          updateSelectionStateUI();
        }
      };
    }
  }

  function renderSelectionInlineTags() {
    setupInlineSelectionTagInputs();
    const chipsContainer = document.getElementById('selectionInlineTagsChips');
    if (!chipsContainer) return;

    const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
    if (selectedFiles.length === 0) {
      chipsContainer.innerHTML = '';
      return;
    }

    const sldCounts = new Map();
    const subCounts = new Map();
    const tagCounts = new Map();
    const alikeCounts = new Map();

    selectedFiles.forEach(m => {
      (m.blueBookEvents || []).forEach(be => { if (be.dateTag) sldCounts.set(be.dateTag, (sldCounts.get(be.dateTag) || 0) + 1); });
      (m.subjectTags || []).forEach(sId => subCounts.set(sId, (subCounts.get(sId) || 0) + 1));
      (m.normalTags || []).forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
      (m.alikeTags || []).forEach(al => {
        const key = `${al.targetSubjectId}::${al.strength}`;
        alikeCounts.set(key, (alikeCounts.get(key) || 0) + 1);
      });
    });

    const totalSelected = selectedFiles.length;
    let html = '';

    subCounts.forEach((count, sId) => {
      const sub = currentSubjectsList.find(s => s.id === sId);
      html += `
        <span class="tag-chip-bubble" style="background:var(--accent-pink)22; border:1px solid var(--accent-pink); padding:2px 8px; border-radius:12px; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px;">
          👤 ${getSubjectDisplayName(sub)} (${count}/${totalSelected})
          <span class="remove-selection-tag" data-type="subject" data-val="${sId}" style="cursor:pointer; opacity:0.8;">✖</span>
        </span>`;
    });

    tagCounts.forEach((count, tag) => {
      html += `
        <span class="tag-chip-bubble" style="background:var(--accent-blue)22; border:1px solid var(--accent-blue); padding:2px 8px; border-radius:12px; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px;">
          🏷️ ${tag} (${count}/${totalSelected})
          <span class="remove-selection-tag" data-type="normal" data-val="${tag}" style="cursor:pointer; opacity:0.8;">✖</span>
        </span>`;
    });

    sldCounts.forEach((count, dateTag) => {
      html += `
        <span class="tag-chip-bubble" style="background:rgba(56,189,248,0.2); border:1px solid #38bdf8; padding:2px 8px; border-radius:12px; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px;">
          💦 ${dateTag} (${count}/${totalSelected})
          <span class="remove-selection-tag" data-type="sld" data-val="${dateTag}" style="cursor:pointer; opacity:0.8;">✖</span>
        </span>`;
    });

    alikeCounts.forEach((count, key) => {
      const [sId, str] = key.split('::');
      const sub = currentSubjectsList.find(s => s.id === sId);
      html += `
        <span class="tag-chip-bubble" style="background:rgba(168,85,247,0.2); border:1px solid #a855f7; padding:2px 8px; border-radius:12px; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px;">
          🪞 ${getSubjectDisplayName(sub)} (${str}) (${count}/${totalSelected})
          <span class="remove-selection-tag" data-type="alike" data-val="${key}" style="cursor:pointer; opacity:0.8;">✖</span>
        </span>`;
    });

    chipsContainer.innerHTML = html;

    chipsContainer.querySelectorAll('.remove-selection-tag').forEach(btn => {
      btn.onclick = async () => {
        const type = btn.getAttribute('data-type');
        const val = btn.getAttribute('data-val');

        for (const m of selectedFiles) {
          if (type === 'subject') {
            m.subjectTags = (m.subjectTags || []).filter(id => id !== val);
          } else if (type === 'normal') {
            m.normalTags = (m.normalTags || []).filter(t => t !== val);
          } else if (type === 'sld') {
            m.blueBookEvents = (m.blueBookEvents || []).filter(be => be.dateTag !== val);
          } else if (type === 'alike') {
            const [sId, str] = val.split('::');
            m.alikeTags = (m.alikeTags || []).filter(al => !(al.targetSubjectId === sId && al.strength === str));
          }
          await db.put('media', m);
        }

        await loadAppState();
        updateSelectionStateUI();
      };
    });
  }

  const tagSectionExpandedMap = { sld: false, subject: false, normal: false };

  function renderSelectionTagsPanel() {
    const container = document.getElementById('selectionTagsPanel');
    if (!container) return;

    const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
    const sldCounts = new Map();
    const subCounts = new Map();
    const tagCounts = new Map();

    selectedFiles.forEach(m => {
      (m.blueBookEvents || []).forEach(be => { if (be.dateTag) sldCounts.set(be.dateTag, (sldCounts.get(be.dateTag) || 0) + 1); });
      (m.subjectTags || []).forEach(sId => subCounts.set(sId, (subCounts.get(sId) || 0) + 1));
      (m.normalTags || []).forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
    });

    const totalSelected = selectedFiles.length;

    let sldHtml = Array.from(sldCounts.entries()).map(([tag, count]) => `
      <span class="tag-chip-bubble nav-sld-pill" data-tag="${tag}">
        💦 ${tag} (${count}/${totalSelected})
        <span class="tag-chip-remove" data-type="sld" data-val="${tag}">✖</span>
      </span>`).join('');

    let subHtml = Array.from(subCounts.entries()).map(([sId, count]) => {
      const sub = currentSubjectsList.find(s => s.id === sId);
      return `
        <span class="tag-chip-bubble nav-sub-pill" data-subid="${sId}">
          👤 ${getSubjectDisplayName(sub)} (${count}/${totalSelected})
          <span class="tag-chip-remove" data-type="subject" data-val="${sId}">✖</span>
        </span>`;
    }).join('');

    let normalHtml = Array.from(tagCounts.entries()).map(([tag, count]) => `
      <span class="tag-chip-bubble nav-tag-pill" data-tag="${tag}">
        🏷️ ${tag} (${count}/${totalSelected})
        <span class="tag-chip-remove" data-type="normal" data-val="${tag}">✖</span>
      </span>`).join('');

    const isSldExpanded = tagSectionExpandedMap.sld;
    const isSubExpanded = tagSectionExpandedMap.subject;
    const isNormalExpanded = tagSectionExpandedMap.normal;

    container.innerHTML = `
      <div class="tag-category-card">
        <div class="tag-category-header" data-cat="sld">
          <span>📘 SLD Events (${sldCounts.size})</span>
          <button class="btn btn-secondary btn-sm toggle-cat-btn" data-cat="sld">${isSldExpanded ? '▲ Collapse' : '▼ Show All'}</button>
        </div>
        <div class="${isSldExpanded ? 'tag-chip-container-expanded' : 'tag-chip-container-collapsed'}">
          ${sldHtml || '<span class="text-muted" style="font-size:0.85rem;">None</span>'}
        </div>
      </div>

      <div class="tag-category-card">
        <div class="tag-category-header" data-cat="subject">
          <span>👥 Subjects (${subCounts.size})</span>
          <button class="btn btn-secondary btn-sm toggle-cat-btn" data-cat="subject">${isSubExpanded ? '▲ Collapse' : '▼ Show All'}</button>
        </div>
        <div class="${isSubExpanded ? 'tag-chip-container-expanded' : 'tag-chip-container-collapsed'}">
          ${subHtml || '<span class="text-muted" style="font-size:0.85rem;">None</span>'}
        </div>
      </div>

      <div class="tag-category-card">
        <div class="tag-category-header" data-cat="normal">
          <span>🏷️ Standard Tags (${tagCounts.size})</span>
          <button class="btn btn-secondary btn-sm toggle-cat-btn" data-cat="normal">${isNormalExpanded ? '▲ Collapse' : '▼ Show All'}</button>
        </div>
        <div class="${isNormalExpanded ? 'tag-chip-container-expanded' : 'tag-chip-container-collapsed'}">
          ${normalHtml || '<span class="text-muted" style="font-size:0.85rem;">None</span>'}
        </div>
      </div>`;

    container.querySelectorAll('.toggle-cat-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const cat = btn.getAttribute('data-cat');
        tagSectionExpandedMap[cat] = !tagSectionExpandedMap[cat];
        renderSelectionTagsPanel();
      };
    });

    container.querySelectorAll('.tag-chip-remove').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const type = btn.getAttribute('data-type');
        const val = btn.getAttribute('data-val');

        const previousState = selectedFiles.map(m => ({ id: m.id, blueBookEvents: JSON.parse(JSON.stringify(m.blueBookEvents || [])), subjectTags: [...(m.subjectTags || [])], normalTags: [...(m.normalTags || [])] }));

        for (const m of selectedFiles) {
          if (type === 'sld') m.blueBookEvents = (m.blueBookEvents || []).filter(be => be.dateTag !== val);
          if (type === 'subject') m.subjectTags = (m.subjectTags || []).filter(id => id !== val);
          if (type === 'normal') m.normalTags = (m.normalTags || []).filter(t => t !== val);
          await db.put('media', m);
        }

        pushUndoState(`Remove ${type} tag "${val}" from selection`, async () => {
          for (const prev of previousState) {
            const m = currentMediaList.find(item => item.id === prev.id);
            if (m) {
              m.blueBookEvents = prev.blueBookEvents;
              m.subjectTags = prev.subjectTags;
              m.normalTags = prev.normalTags;
              await db.put('media', m);
            }
          }
        });

        await loadAppState();
        renderSelectionTagsPanel();
      };
    });
  }

  async function applyTagToSelectedMedia(type, value) {
    if (selectedMediaIds.size === 0 || !value) return;
    const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
    const previousState = selectedFiles.map(m => ({ id: m.id, blueBookEvents: JSON.parse(JSON.stringify(m.blueBookEvents || [])), subjectTags: [...(m.subjectTags || [])], normalTags: [...(m.normalTags || [])] }));

    for (const m of selectedFiles) {
      if (type === 'sld') {
        const parsedTag = parseSmartDateInput(value);
        if (!m.blueBookEvents) m.blueBookEvents = [];
        if (!m.blueBookEvents.some(be => be.dateTag === parsedTag)) {
          m.blueBookEvents.push({ id: 'sld-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), dateTag: parsedTag, heartTags: { pink: 0, grey: 0, blue: 0 } });
        }
      } else if (type === 'subject') {
        if (!m.subjectTags) m.subjectTags = [];
        if (!m.subjectTags.includes(value)) m.subjectTags.push(value);
      } else if (type === 'normal') {
        if (!m.normalTags) m.normalTags = [];
        if (!m.normalTags.includes(value)) m.normalTags.push(value);
      }
      await db.put('media', m);
    }

    pushUndoState(`Apply ${type} tag "${value}" to selection`, async () => {
      for (const prev of previousState) {
        const m = currentMediaList.find(item => item.id === prev.id);
        if (m) {
          m.blueBookEvents = prev.blueBookEvents;
          m.subjectTags = prev.subjectTags;
          m.normalTags = prev.normalTags;
          await db.put('media', m);
        }
      }
    });

    await loadAppState();
    renderMediaBrowser();
  }

  /* ==========================================================================
     9. LIGHTBOX MEDIA VIEWER (PRESERVES VIDEO CROPPING Status)
     ========================================================================== */
  let lightboxSourceContext = null;

  async function openLightboxById(mediaId, skipPushState = false, sourceContext = null) {
    lightboxSourceContext = sourceContext;
    let idx = currentMediaList.findIndex(m => m.id === mediaId);
    if (idx < 0 && mediaId) {
      try {
        const item = await db.get('media', mediaId);
        if (item) {
          currentMediaList.push(item);
          idx = currentMediaList.length - 1;
        }
      } catch (err) {
        console.warn('Error fetching lightbox media by ID:', err);
      }
    }
    if (idx >= 0) openLightbox(idx, skipPushState);
  }

  function openLightbox(index, skipPushState = false) {
    if (index < 0 || index >= currentMediaList.length) return;
    lightboxIndex = index;
    const modal = document.getElementById('lightboxModal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.classList.add('active');

    const heartOverlay = document.getElementById('floatingHeartOverlay');
    if (sldDefaultFullscreen) {
      modal.classList.add('fullscreen-mode');
      if (heartOverlay) heartOverlay.style.display = 'flex';
    } else {
      modal.classList.remove('fullscreen-mode');
      if (heartOverlay) heartOverlay.style.display = 'none';
    }

    renderLightboxContent();

    if (!skipPushState) {
      window.history.pushState({
        viewId: currentActiveView,
        activeDetailSubjectId,
        activeDetailComboKey,
        activeDetailSldDateTag,
        activeDetailEventId,
        activeDetailTagName,
        lightboxIndex: index,
        isLightbox: true
      }, '', '#lightbox');
    }
  }

  function closeLightbox(isPopState = false) {
    const modal = document.getElementById('lightboxModal');
    const isAlreadyOpen = modal && (modal.classList.contains('active') || modal.style.display === 'flex');

    const container = document.getElementById('lightboxMediaContainer');
    if (container) {
      const vids = container.querySelectorAll('video');
      vids.forEach(v => {
        try {
          v.pause();
          v.removeAttribute('src');
          v.load();
        } catch (e) {}
      });
      container.innerHTML = '';
    }

    if (modal) {
      modal.classList.remove('active', 'fullscreen-mode');
      modal.style.display = 'none';
    }
    const heartOverlay = document.getElementById('floatingHeartOverlay');
    if (heartOverlay) heartOverlay.style.display = 'none';
    lightboxIndex = -1;

    if (isAlreadyOpen && !isPopState) {
      if (window.history.state && window.history.state.isLightbox) {
        try {
          window.history.replaceState({
            viewId: currentActiveView || 'mediaBrowserView',
            activeDetailSubjectId,
            activeDetailComboKey,
            activeDetailSldDateTag,
            activeDetailEventId,
            activeDetailTagName,
            isLightbox: false
          }, '', '#' + (currentActiveView || 'mediaBrowserView'));
        } catch (e) {
          console.warn('Error updating history replaceState on Lightbox exit:', e);
        }
      }
    }
  }

  function renderLightboxContent() {
    if (lightboxIndex < 0 || lightboxIndex >= currentMediaList.length) return;
    const media = currentMediaList[lightboxIndex];
    media.viewTransform = media.viewTransform || { rotate: 0, clipStart: 0, clipEnd: null };

    const container = document.getElementById('lightboxMediaContainer');
    document.getElementById('lightboxTitle').textContent = media.filename;
    document.getElementById('lightboxCounter').textContent = `${lightboxIndex + 1} of ${currentMediaList.length}`;

    const isVideo = media.type?.startsWith('video');
    const croppedUrl = media.viewTransform?.croppedViewUrl;

    const resetCropBtn = document.getElementById('lbResetCropBtn');
    if (resetCropBtn) resetCropBtn.style.display = croppedUrl ? 'inline-flex' : 'none';

    if (isVideo) {
      const posterAttr = croppedUrl ? `poster="${croppedUrl}"` : '';
      container.innerHTML = `<video id="lbMediaVideo" src="${media.dataUrl}" ${posterAttr} autoplay muted loop playsinline webkit-playsinline moz-playsinline style="max-height:75vh; max-width:100%; object-fit:contain; pointer-events:none;"></video>`;
      const lbVid = document.getElementById('lbMediaVideo');
      if (lbVid) lbVid.muted = true;
    } else if (croppedUrl) {
      container.innerHTML = `<img id="lbMediaImg" src="${croppedUrl}" alt="${media.filename}" style="max-height:75vh; max-width:100%; object-fit:contain;">`;
    } else {
      container.innerHTML = `<img id="lbMediaImg" src="${media.dataUrl}" alt="${media.filename}" style="max-height:75vh; max-width:100%; object-fit:contain;">`;
    }

    applyNonDestructiveTransform(media);

    renderLightboxSubjects(media);
    renderLightboxBlueEvents(media);
    renderLightboxEvents(media);
    renderLightboxNormalTags(media);
    renderLightboxRatings(media);
    updateFloatingHeartOverlayUI(media);

    const toggleClipperBtn = document.getElementById('lbToggleVideoClipperBtn');
    const clipperPanel = document.getElementById('videoClipperPanel');
    if (isVideo) {
      if (toggleClipperBtn) toggleClipperBtn.style.display = 'inline-flex';
      setupVideoClipperSliders(media);
    } else {
      if (toggleClipperBtn) toggleClipperBtn.style.display = 'none';
      if (clipperPanel) clipperPanel.style.display = 'none';
    }

    const setAvatarBtn = document.getElementById('lbSetAvatarBtn');
    if (setAvatarBtn) {
      if (lightboxSourceContext && lightboxSourceContext.name) {
        setAvatarBtn.style.display = 'inline-flex';
        setAvatarBtn.textContent = `👤 Use as ${lightboxSourceContext.name}'s Avatar`;
        setAvatarBtn.onclick = () => {
          openMediaCropperModal({
            imageSrcUrl: media.viewTransform?.croppedViewUrl || media.dataUrl,
            isVideo: isVideo,
            videoSrcUrl: isVideo ? media.dataUrl : null,
            modalTitle: `Crop ${lightboxSourceContext.name}'s Avatar`,
            onSave: async (croppedUrl) => {
              if (lightboxSourceContext.type === 'subject') {
                const sub = currentSubjectsList.find(s => s.id === lightboxSourceContext.id);
                if (sub) {
                  sub.avatarUrl = croppedUrl;
                  await db.put('subjects', sub);
                }
              } else if (lightboxSourceContext.type === 'combo') {
                const comboKey = lightboxSourceContext.key;
                const stats = calculateAllStats();
                const combo = (stats?.allCombinations || []).find(c => (c.comboKey === comboKey || (c.subjectIds || [c.subjectId1, c.subjectId2]).join('::') === comboKey));
                if (combo) {
                  combo.avatarUrl = croppedUrl;
                  await db.put('combinations', combo);
                }
              }
              await loadAppState();
              renderCurrentView();
            }
          });
        };
      } else {
        setAvatarBtn.style.display = 'none';
      }
    }

    const lbAiBtn = document.getElementById('lbAiToggleBtn');
    if (lbAiBtn) {
      const isAi = media.isAiGenerated || (media.normalTags || []).includes('AI');
      if (isAi) {
        lbAiBtn.style.background = 'linear-gradient(135deg, #a855f7, #6366f1)';
        lbAiBtn.style.color = '#ffffff';
        lbAiBtn.style.fontWeight = '800';
        lbAiBtn.style.opacity = '1';
        lbAiBtn.style.filter = 'grayscale(0)';
        lbAiBtn.style.borderColor = '#a855f7';
      } else {
        lbAiBtn.style.background = 'var(--bg-secondary)';
        lbAiBtn.style.color = 'var(--text-muted)';
        lbAiBtn.style.fontWeight = '600';
        lbAiBtn.style.opacity = '0.5';
        lbAiBtn.style.filter = 'grayscale(1)';
        lbAiBtn.style.borderColor = 'var(--border-color)';
      }

      lbAiBtn.onclick = async () => {
        const newAiState = !(media.isAiGenerated || (media.normalTags || []).includes('AI'));
        media.isAiGenerated = newAiState;
        if (!media.normalTags) media.normalTags = [];
        if (newAiState) {
          if (!media.normalTags.includes('AI')) media.normalTags.push('AI');
        } else {
          media.normalTags = media.normalTags.filter(t => t !== 'AI');
        }
        await db.put('media', media);
        renderLightboxContent();
        renderCurrentView();
      };
    }

    document.getElementById('lbOpenCropModalBtn').onclick = () => openLightboxCropModal(media);
    if (resetCropBtn) {
      resetCropBtn.onclick = async () => {
        media.viewTransform.croppedViewUrl = null;
        await db.put('media', media);
        renderLightboxContent();
        renderCurrentView();
      };
    }

    const editThumbBtn = document.getElementById('lbEditThumbnailBtn');
    if (editThumbBtn) {
      editThumbBtn.onclick = () => {
        openMediaCropperModal({
          imageSrcUrl: media.customThumbnail || media.thumbnailUrl || media.dataUrl,
          isVideo: isVideo,
          videoSrcUrl: media.dataUrl,
          modalTitle: `Edit Thumbnail: ${media.filename}`,
          onSave: async (croppedDataUrl) => {
            media.customThumbnail = croppedDataUrl;
            await db.put('media', media);
            await loadAppState();
            renderCurrentView();
          }
        });
      };
    }
  }

  function applyNonDestructiveTransform(media) {
    const el = document.getElementById('lbMediaVideo') || document.getElementById('lbMediaImg');
    if (!el || !media.viewTransform) return;

    const rot = media.viewTransform.rotate || 0;
    el.style.transform = `rotate(${rot}deg)`;
  }

  function setupLightboxEditingSuite() {
    document.getElementById('lbRotateLeftBtn')?.addEventListener('click', async () => {
      if (lightboxIndex >= 0 && lightboxIndex < currentMediaList.length) {
        const media = currentMediaList[lightboxIndex];
        media.viewTransform = media.viewTransform || { rotate: 0 };
        media.viewTransform.rotate = (media.viewTransform.rotate - 90) % 360;
        await db.put('media', media);
        applyNonDestructiveTransform(media);
      }
    });

    document.getElementById('lbRotateRightBtn')?.addEventListener('click', async () => {
      if (lightboxIndex >= 0 && lightboxIndex < currentMediaList.length) {
        const media = currentMediaList[lightboxIndex];
        media.viewTransform = media.viewTransform || { rotate: 0 };
        media.viewTransform.rotate = (media.viewTransform.rotate + 90) % 360;
        await db.put('media', media);
        applyNonDestructiveTransform(media);
      }
    });

    document.getElementById('lbToggleVideoClipperBtn')?.addEventListener('click', () => {
      const panel = document.getElementById('videoClipperPanel');
      if (panel) panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    });
  }

  function setupVideoClipperSliders(media) {
    const video = document.getElementById('lbMediaVideo');
    const startSlider = document.getElementById('clipStartSlider');
    const endSlider = document.getElementById('clipEndSlider');
    const startValLabel = document.getElementById('clipStartVal');
    const endValLabel = document.getElementById('clipEndVal');

    if (!video || !startSlider || !endSlider) return;

    video.onloadedmetadata = () => {
      const dur = video.duration || 100;
      startSlider.max = dur;
      endSlider.max = dur;

      const clipStart = media.viewTransform?.clipStart || 0;
      const clipEnd = media.viewTransform?.clipEnd || dur;

      startSlider.value = clipStart;
      endSlider.value = clipEnd;
      startValLabel.textContent = `${clipStart.toFixed(1)}s`;
      endValLabel.textContent = `${clipEnd.toFixed(1)}s`;

      startSlider.oninput = async () => {
        const val = parseFloat(startSlider.value);
        startValLabel.textContent = `${val.toFixed(1)}s`;
        video.currentTime = val;
        media.viewTransform.clipStart = val;
        await db.put('media', media);
      };

      endSlider.oninput = async () => {
        const val = parseFloat(endSlider.value);
        endValLabel.textContent = `${val.toFixed(1)}s`;
        video.currentTime = val;
        media.viewTransform.clipEnd = val;
        await db.put('media', media);
      };

      video.ontimeupdate = () => {
        const cStart = media.viewTransform?.clipStart || 0;
        const cEnd = media.viewTransform?.clipEnd || dur;
        if (video.currentTime < cStart) video.currentTime = cStart;
        if (video.currentTime >= cEnd) video.currentTime = cStart;
      };
    };
  }

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

  /* ==========================================================================
     10. SUBJECTS PAGE & GROUPS MANAGER
     ========================================================================== */
  /* ==========================================================================
     10. SUBJECTS PAGE & GROUPS MANAGER
     ========================================================================== */
  function renderSubjectsPage(stats) {
    const gridContainer = document.getElementById('subjectCardsGrid');
    const sldLbContainer = document.getElementById('sldLeaderboard');
    const pinkLbContainer = document.getElementById('pinkHeartLeaderboard');
    const greyLbContainer = document.getElementById('greyHeartLeaderboard');
    const blueLbContainer = document.getElementById('blueHeartLeaderboard');
    const eventLbContainer = document.getElementById('eventPointsLeaderboard');

    const batchSelect = document.getElementById('batchSubjectGroupSelect');
    const selectionCountEl = document.getElementById('subjectSelectionCount');

    // Setup Batch Group Select Options & Handler
    const batchGrpSelect = document.getElementById('batchSubjectGroupSelect');
    const batchTagsBtn = document.getElementById('batchSubjectTagsBtn');
    const batchMenuContainer = document.getElementById('subjectBatchMenuContainer');
    const batchDropdown = document.getElementById('subjectBatchDropdown');
    const batchMenuBtn = document.getElementById('subjectBatchMenuBtn');
    const batchDeleteBtn = document.getElementById('batchDeleteSubjectsBtn');

    if (selectedSubjectIds.size > 0) {
      if (batchGrpSelect) {
        batchGrpSelect.style.display = 'inline-block';
        batchGrpSelect.innerHTML = `<option value="">🎨 Group (${selectedSubjectIds.size})...</option>` + getSubjectGroupOptionsHTML();
        batchGrpSelect.onchange = async () => {
          const val = batchGrpSelect.value;
          if (!val) return;
          if (val.startsWith('__')) {
            await handleGroupSelectAction(val);
            return;
          }
          for (const sId of selectedSubjectIds) {
            const s = currentSubjectsList.find(sub => sub.id === sId);
            if (s) { s.groupId = val; await db.put('subjects', s); }
          }
          selectedSubjectIds.clear();
          await loadAppState();
          renderSubjectsPage(processAllStats());
        };
      }
      if (batchTagsBtn) {
        batchTagsBtn.style.display = 'inline-flex';
        batchTagsBtn.onclick = () => {
          openMultiSelectTagsModal(Array.from(selectedSubjectIds));
        };
      }
      if (batchMenuContainer) batchMenuContainer.style.display = 'inline-block';
    } else {
      if (batchGrpSelect) batchGrpSelect.style.display = 'none';
      if (batchTagsBtn) batchTagsBtn.style.display = 'none';
      if (batchMenuContainer) batchMenuContainer.style.display = 'none';
      if (batchDropdown) batchDropdown.style.display = 'none';
    }

    if (batchMenuBtn && batchDropdown) {
      batchMenuBtn.onclick = (e) => {
        e.stopPropagation();
        batchDropdown.style.display = batchDropdown.style.display === 'none' ? 'block' : 'none';
      };
    }

    if (batchDeleteBtn) {
      batchDeleteBtn.onclick = async () => {
        if (batchDropdown) batchDropdown.style.display = 'none';
        if (!confirm(`Are you sure you want to delete ${selectedSubjectIds.size} selected subject(s)?`)) return;
        for (const id of selectedSubjectIds) {
          await db.delete('subjects', id);
        }
        selectedSubjectIds.clear();
        await loadAppState();
        renderSubjectsPage(processAllStats());
      };
    }

    // Update sort buttons UI in Subjects page toolbar
    document.querySelectorAll('.subject-sort-btn').forEach(btn => {
      const key = btn.getAttribute('data-sort');
      if (key === subjectSortKey) {
        btn.classList.add('active');
        btn.innerHTML = btn.innerHTML.replace(/[▲▼]/g, '').trim() + ' ' + (subjectSortDir === 'asc' ? '▲' : '▼');
      } else {
        btn.classList.remove('active');
        btn.innerHTML = btn.innerHTML.replace(/[▲▼]/g, '').trim();
      }

      btn.onclick = () => {
        if (subjectSortKey === key) {
          subjectSortDir = subjectSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          subjectSortKey = key;
          subjectSortDir = 'desc';
          if (key === 'name') subjectSortDir = 'asc';
        }
        renderSubjectsPage(stats);
      };
    });

    // Tab Button Handlers (Subjects vs Combos)
    const subLbSection = document.getElementById('subjectLeaderboardsSection');
    const comboLbSection = document.getElementById('comboLeaderboardsSection');

    document.querySelectorAll('.subject-tab-btn').forEach(btn => {
      const tab = btn.getAttribute('data-tab');
      if (tab === activeSubjectsTab) {
        btn.classList.add('active');
        btn.style.background = 'var(--accent-pink)';
        btn.style.color = '#fff';
      } else {
        btn.classList.remove('active');
        btn.style.background = '';
        btn.style.color = '';
      }

      btn.onclick = (e) => {
        e.stopPropagation();
        activeSubjectsTab = tab;
        renderSubjectsPage(stats);
      };
    });

    // Deselect selection on empty space click
    const subjectsViewContainer = document.getElementById('subjectsView');
    if (subjectsViewContainer) {
      subjectsViewContainer.onclick = (e) => {
        if (!e.target.closest('.subject-card') && !e.target.closest('.combination-element-card') && !e.target.closest('.btn') && !e.target.closest('select') && !e.target.closest('input')) {
          if (selectedSubjectIds.size > 0) {
            selectedSubjectIds.clear();
            renderSubjectsPage(stats);
          }
        }
      };
    }

    if (activeSubjectsTab === 'combos') {
      if (subLbSection) subLbSection.style.display = 'none';
      if (comboLbSection) comboLbSection.style.display = 'block';

      const allCombos = stats.allCombinations || [];
      if (allCombos.length === 0) {
        gridContainer.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1;">No Subject Combinations Recorded.</div>`;
      } else {
        const sortedCombos = allCombos.slice().sort((a, b) => {
          let comp = 0;
          if (subjectSortKey === 'name') comp = a.name.localeCompare(b.name);
          else if (subjectSortKey === 'totalPoints') comp = a.totalPoints - b.totalPoints;
          else if (subjectSortKey === 'eventPoints') comp = a.eventPoints - b.eventPoints;
          else if (subjectSortKey === 'pink') comp = a.pinkPoints - b.pinkPoints;
          else if (subjectSortKey === 'grey') comp = a.greyPoints - b.greyPoints;
          else if (subjectSortKey === 'blue') comp = a.bluePoints - b.bluePoints;
          else comp = a.totalPoints - b.totalPoints;
          return subjectSortDir === 'asc' ? comp : -comp;
        });

        const ACTION_HEX_MAP = {
          1: '#a855f7', 2: '#3b82f6', 3: '#10b981', 4: '#eab308',
          5: '#f97316', 6: '#ef4444', 7: '#ec4899', 8: '#d946ef',
          9: '#0ea5e9', 10: '#6366f1', 11: '#8b5cf6', 12: '#f43f5e'
        };

        gridContainer.innerHTML = sortedCombos.map(c => {
          const subs = c.subs || [];
          const primarySub = subs[0];
          const secondarySub = subs[1] || primarySub;
          const comboKey = (c.subjectIds || [c.subjectId1, c.subjectId2]).join('::');

          const actColor = ACTION_HEX_MAP[c.maxActionCode] || '';
          const cardStyle = c.maxActionCode ? `border:2px solid ${actColor};` : `border:1px solid var(--border-color);`;

          const companionTagged = currentMediaList.filter(m => m.subjectTags?.includes(primarySub?.id));
          const g = primarySub ? getSubjectGroup(primarySub.groupId) : null;
          const bClass = g?.cssClass || '';
          const mainThumbHTML = primarySub?.avatarUrl 
            ? `<img src="${primarySub.avatarUrl}" class="combination-main-thumb ${bClass}" alt="${primarySub.name}">`
            : companionTagged[0]
              ? renderMediaThumbnailHTML(companionTagged[0], `combination-main-thumb ${bClass}`)
              : `<div class="combination-main-thumb ${bClass}" style="display:flex;align-items:center;justify-content:center;font-size:54px;background:var(--bg-secondary);">👤</div>`;

          const secondaryAvatar = secondarySub?.avatarUrl || (companionTagged[0] ? (companionTagged[0].customThumbnail || companionTagged[0].dataUrl) : null);
          const secondaryOverlayHTML = secondaryAvatar
            ? `<img src="${secondaryAvatar}" class="combination-active-overlay-thumb" title="${secondarySub ? getSubjectDisplayName(secondarySub) : ''}">`
            : `<div class="combination-active-overlay-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px;background:var(--accent-pink);color:#fff;">👤</div>`;


/* === Module: 07_lightbox.js === */
/* Module 07_lightbox.js */
return `
            <div class="combination-element-card combo-tab-card" data-combokey="${comboKey}" style="${cardStyle}">
              ${secondaryOverlayHTML}
              ${mainThumbHTML}
              <div class="combination-card-overlay">
                <div style="font-weight:800; font-size:1.05rem; color:#fff; text-shadow:0 2px 4px rgba(0,0,0,0.9); margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                  ${c.name}
                </div>
                <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; flex-wrap:wrap;">
                  <span style="font-size:0.75rem; color:rgba(255,255,255,0.85); text-shadow:0 1px 3px #000;">${c.mediaCount} shared media</span>
                  <span style="font-size:0.8rem; font-weight:800; color:var(--accent-pink); text-shadow:0 1px 3px #000;">${c.totalPoints} pts</span>
                </div>
              </div>
            </div>`;
        }).join('');

        gridContainer.querySelectorAll('.combo-tab-card').forEach(card => {
          card.onclick = (e) => {
            e.stopPropagation();
            activeDetailComboKey = card.getAttribute('data-combokey');
            switchView('combinationDetailsView');
          };
        });
      }
    } else {
      if (subLbSection) subLbSection.style.display = 'block';
      if (comboLbSection) comboLbSection.style.display = 'none';

      if (currentSubjectsList.length === 0) {
        gridContainer.innerHTML = `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-state-icon">👥</div>
            <h3>No Subjects Added</h3>
            <p>Click "+ Add Subject" to create subject profiles.</p>
          </div>`;
      } else {
        // Sort subjects list
        const sortedSubjects = currentSubjectsList.slice().sort((a, b) => {
          const aStat = (stats?.allSubjectStats || []).find(s => s?.subject?.id === a.id) || { totalPoints: 0, heartPoints: 0, eventPoints: 0, pinkPoints: 0, greyPoints: 0, bluePoints: 0, latestEventDate: null };
          const bStat = (stats?.allSubjectStats || []).find(s => s?.subject?.id === b.id) || { totalPoints: 0, heartPoints: 0, eventPoints: 0, pinkPoints: 0, greyPoints: 0, bluePoints: 0, latestEventDate: null };

          let comp = 0;
          if (subjectSortKey === 'name') {
            comp = (a.name || '').localeCompare(b.name || '');
          } else if (subjectSortKey === 'totalPoints') {
            comp = (aStat.totalPoints || 0) - (bStat.totalPoints || 0);
          } else if (subjectSortKey === 'eventPoints') {
            comp = (aStat.eventPoints || 0) - (bStat.eventPoints || 0);
          } else if (subjectSortKey === 'eventDate') {
            const aDate = aStat.latestEventDate || '';
            const bDate = bStat.latestEventDate || '';
            comp = aDate.localeCompare(bDate);
          } else if (subjectSortKey === 'pink') {
            comp = (aStat.pinkPoints || 0) - (bStat.pinkPoints || 0);
          } else if (subjectSortKey === 'grey') {
            comp = (aStat.greyPoints || 0) - (bStat.greyPoints || 0);
          } else if (subjectSortKey === 'blue') {
            comp = (aStat.bluePoints || 0) - (bStat.bluePoints || 0);
          }

          return subjectSortDir === 'asc' ? comp : -comp;
        });

        // Media-Overlay Subject Card HTML Generator
        const renderSubjectCardHTML = (sub) => {
          if (!sub) return '';
          const sStat = (stats?.allSubjectStats || []).find(s => s?.subject?.id === sub.id) || { totalPoints: 0, heartPoints: 0, eventPoints: 0 };
          const taggedMedia = currentMediaList.filter(m => m.subjectTags?.includes(sub.id));
          const group = getSubjectGroup(sub.groupId);
          const borderClass = group?.cssClass || '';
          const isSelected = selectedSubjectIds.has(sub.id);

          let avatarHTML = sub.avatarUrl 
            ? `<img src="${sub.avatarUrl}" class="media-thumbnail ${borderClass}" alt="${sub.name}">` 
            : taggedMedia[0] 
              ? renderMediaThumbnailHTML(taggedMedia[0], `media-thumbnail ${borderClass}`) 
              : `<div class="media-thumbnail ${borderClass}" style="display:flex;align-items:center;justify-content:center;font-size:42px;background:var(--bg-secondary);">👤</div>`;

          return `
            <div class="subject-card ${borderClass} ${isSelected ? 'selected' : ''}" data-id="${sub.id}">
              ${avatarHTML}
              <div class="subject-card-overlay">
                <div class="subject-card-name">${getSubjectDisplayName(sub)}</div>
                <div class="subject-card-stats">
                  <span class="subject-stat-badge" style="color:var(--accent-pink);">SLD: ${sStat.heartPoints} pts</span>
                  <span class="subject-stat-badge" style="color:var(--accent-blue);">Events: ${sStat.eventPoints} pts</span>
                </div>
              </div>
            </div>`;
        };

        // Group the sorted subjects list
        const subjectsGroupMap = new Map();
        currentSubjectGroupsList.forEach(g => subjectsGroupMap.set(g.id, []));
        const unassignedSubjects = [];

        for (const sub of sortedSubjects) {
          if (!sub.groupId) {
            unassignedSubjects.push(sub);
          } else {
            const group = getSubjectGroup(sub.groupId);
            if (group && subjectsGroupMap.has(group.id)) {
              subjectsGroupMap.get(group.id).push(sub);
            } else {
              unassignedSubjects.push(sub);
            }
          }
        }

        let groupsHTML = '';
        currentSubjectGroupsList.forEach(g => {
          if (disabledGroupIds.has(g.id)) return;
          const groupSubs = subjectsGroupMap.get(g.id) || [];
          if (groupSubs.length > 0) {
            groupsHTML += `
              <div class="media-group-section" style="display:block; width:100%; margin-bottom:32px;">
                <div class="media-group-title" style="color:${g.color || 'var(--text-primary)'}; font-weight:800; font-size:1.15rem; margin-bottom:16px; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
                  ${getGroupDisplayTitle(g)} (${groupSubs.length} subjects)
                </div>
                <div class="media-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:16px;">
                  ${groupSubs.map(renderSubjectCardHTML).join('')}
                </div>
              </div>`;
          }
        });

        if (unassignedSubjects.length > 0 && !disabledGroupIds.has('__none__')) {
          groupsHTML += `
            <div class="media-group-section" style="display:block; width:100%; margin-bottom:32px;">
              <div class="media-group-title" style="color:var(--text-secondary); font-weight:800; font-size:1.15rem; margin-bottom:16px; padding-bottom:8px; border-bottom:1px solid var(--border-color);">
                ⚪ Unassigned / No Subject Group (${unassignedSubjects.length} subjects)
              </div>
              <div class="media-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap:16px;">
                ${unassignedSubjects.map(renderSubjectCardHTML).join('')}
              </div>
            </div>`;
        }

        gridContainer.innerHTML = groupsHTML || `<div class="empty-state" style="grid-column: 1 / -1;">No subjects match active group filters.</div>`;

        // Subject card selection / drilldown event listener with Long Press support
        gridContainer.querySelectorAll('.subject-card').forEach(card => {
          const subId = card.getAttribute('data-id');
          let isLongPressTriggered = false;
          let pressTimer = null;

          const startPress = () => {
            isLongPressTriggered = false;
            pressTimer = setTimeout(() => {
              isLongPressTriggered = true;
              if (selectedSubjectIds.has(subId)) {
                selectedSubjectIds.delete(subId);
              } else {
                selectedSubjectIds.add(subId);
              }
              renderSubjectsPage(stats);
            }, 300);
          };

          const cancelPress = () => { if (pressTimer) clearTimeout(pressTimer); };

          card.addEventListener('mousedown', startPress);
          card.addEventListener('touchstart', startPress);
          card.addEventListener('mouseup', cancelPress);
          card.addEventListener('mouseleave', cancelPress);
          card.addEventListener('touchend', cancelPress);

          card.oncontextmenu = (e) => {
            e.preventDefault();
            if (selectedSubjectIds.has(subId)) {
              selectedSubjectIds.delete(subId);
            } else {
              selectedSubjectIds.add(subId);
            }
            renderSubjectsPage(stats);
          };

          card.onclick = (e) => {
            if (isLongPressTriggered) {
              isLongPressTriggered = false;
              return;
            }
            if (e.shiftKey || e.ctrlKey || e.metaKey || selectedSubjectIds.size > 0) {
              e.preventDefault();
              e.stopPropagation();
              if (selectedSubjectIds.has(subId)) {
                selectedSubjectIds.delete(subId);
              } else {
                selectedSubjectIds.add(subId);
              }
              renderSubjectsPage(stats);
            } else {
              activeDetailSubjectId = subId;
              switchView('subjectDetailsView');
            }
          };
        });
      }
    }

    // Helper for Leaderboard Rows
    const renderLeaderboardRows = (container, list, scoreKey, badgeColor, isCombo = false, titleText = '') => {
      if (!container) return;

      const parentCard = container.closest('.leaderboard-card');
      if (parentCard) {
        const headerEl = parentCard.querySelector('h3');
        if (headerEl) {
          headerEl.title = 'Click to view full rankings popup';
          headerEl.onclick = () => openFullLeaderboardModal(titleText || headerEl.textContent, list, scoreKey, badgeColor, isCombo);
        }
      }

      if (!list || list.length === 0) {
        container.innerHTML = `<div class="text-muted" style="font-size:0.8rem; padding:6px 0;">No rankings available.</div>`;
        return;
      }

      const rowsHTML = list.slice(0, 25).map((item, idx) => {
        if (!item) return '';
        const val = item[scoreKey] ?? 0;
        const displayName = isCombo ? item.name : getSubjectDisplayName(item?.subject);
        const dataAttr = isCombo ? `data-combokey="${(item.subjectIds || [item.subjectId1, item.subjectId2]).join('::')}"` : `data-id="${item?.subject?.id || ''}"`;

        let thumbHTML = '';
        if (!isCombo && item?.subject) {
          const tagged = currentMediaList.filter(m => m.subjectTags?.includes(item.subject.id));
          thumbHTML = item.subject.avatarUrl 
            ? `<img src="${item.subject.avatarUrl}" class="leader-avatar-thumb" alt="${item.subject.name}">`
            : tagged[0]
              ? renderMediaThumbnailHTML(tagged[0], 'leader-avatar-thumb')
              : `<div class="leader-avatar-thumb" style="display:flex;align-items:center;justify-content:center;font-size:12px;background:var(--bg-secondary);">👤</div>`;
        } else if (isCombo && item.subs) {
          thumbHTML = item.subs.slice(0, 2).map(s => {
            if (!s) return '';
            return s.avatarUrl 
              ? `<img src="${s.avatarUrl}" class="leader-avatar-thumb" title="${getSubjectDisplayName(s)}">`
              : `<div class="leader-avatar-thumb" style="display:flex;align-items:center;justify-content:center;font-size:12px;background:var(--bg-secondary);">👤</div>`;
          }).join('');
        }

        return `
          <div class="leader-item ${isCombo ? 'combo-item' : ''}" ${dataAttr}>
            <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
              <span class="leader-rank">#${idx + 1}</span>
              ${thumbHTML}
              <div class="leader-info"><span style="font-weight:700;">${displayName}</span></div>
            </div>
            <span class="badge" style="background:${badgeColor}22; color:${badgeColor}; font-weight:700;">${val} pts</span>
          </div>`;
      }).join('');

      container.className = 'leaderboard-list-container';
      container.innerHTML = rowsHTML;

      container.querySelectorAll('.leader-item').forEach(el => {
        el.onclick = () => {
          if (isCombo) {
            activeDetailComboKey = el.getAttribute('data-combokey');
            switchView('combinationDetailsView');
          } else {
            activeDetailSubjectId = el.getAttribute('data-id');
            switchView('subjectDetailsView');
          }
        };
      });
    };

    // 1. Render 5 Distinct Subject Leaderboard Sets
    const sldList = stats.allSubjectStats.slice().sort((a, b) => b.heartPoints - a.heartPoints);
    const pinkList = stats.allSubjectStats.slice().sort((a, b) => b.pinkPoints - a.pinkPoints);
    const greyList = stats.allSubjectStats.slice().sort((a, b) => b.greyPoints - a.greyPoints);
    const blueList = stats.allSubjectStats.slice().sort((a, b) => b.bluePoints - a.bluePoints);
    const eventList = stats.allSubjectStats.slice().sort((a, b) => b.eventPoints - a.eventPoints);

    renderLeaderboardRows(eventLbContainer, eventList, 'eventPoints', '#3b82f6', false, '📙 Events Rankings');
    renderLeaderboardRows(sldLbContainer, sldList, 'heartPoints', 'var(--accent-pink)', false, '📘 Total Rankings');
    renderLeaderboardRows(pinkLbContainer, pinkList, 'pinkPoints', '#ff69b4', false, '🩷 Rankings');
    renderLeaderboardRows(blueLbContainer, blueList, 'bluePoints', '#38bdf8', false, '🩵 Rankings');
    renderLeaderboardRows(greyLbContainer, greyList, 'greyPoints', '#94a3b8', false, '🩶 Rankings');

    // 2. Render 5 Distinct Companion Leaderboard Sets
    const comboSldLbContainer = document.getElementById('comboSldLb');
    const comboPinkLbContainer = document.getElementById('comboPinkLb');
    const comboGreyLbContainer = document.getElementById('comboGreyLb');
    const comboBlueLbContainer = document.getElementById('comboBlueLb');
    const comboEventLbContainer = document.getElementById('comboEventLb');

    const cSldList = stats.allCombinations.slice().sort((a, b) => b.heartPoints - a.heartPoints);
    const cPinkList = stats.allCombinations.slice().sort((a, b) => b.pinkPoints - a.pinkPoints);
    const cGreyList = stats.allCombinations.slice().sort((a, b) => b.greyPoints - a.greyPoints);
    const cBlueList = stats.allCombinations.slice().sort((a, b) => b.bluePoints - a.bluePoints);
    const cEventList = stats.allCombinations.slice().sort((a, b) => b.eventPoints - a.eventPoints);

    renderLeaderboardRows(comboEventLbContainer, cEventList, 'eventPoints', '#3b82f6', true, '⚡ Companion Events Rankings');
    renderLeaderboardRows(comboSldLbContainer, cSldList, 'heartPoints', 'var(--accent-pink)', true, '⚡ Companion Total Rankings');
    renderLeaderboardRows(comboPinkLbContainer, cPinkList, 'pinkPoints', '#ff69b4', true, '⚡ Companion 🩷 Rankings');
    renderLeaderboardRows(comboBlueLbContainer, cBlueList, 'bluePoints', '#38bdf8', true, '⚡ Companion 🩵 Rankings');
    renderLeaderboardRows(comboGreyLbContainer, cGreyList, 'greyPoints', '#94a3b8', true, '⚡ Companion 🩶 Rankings');
  }

  function openFullLeaderboardModal(title, list, scoreKey, badgeColor, isCombo) {
    const modal = document.getElementById('leaderboardModal');
    const titleEl = document.getElementById('leaderboardModalTitle');
    const container = document.getElementById('leaderboardModalContent');
    if (!modal || !container) return;

    if (titleEl) titleEl.textContent = title;
    container.innerHTML = (list || []).map((item, idx) => {
      const val = item[scoreKey] ?? 0;
      const displayName = isCombo ? item.name : getSubjectDisplayName(item.subject);
      const dataAttr = isCombo ? `data-combokey="${(item.subjectIds || [item.subjectId1, item.subjectId2]).join('::')}"` : `data-id="${item.subject.id}"`;

      let thumbHTML = '';
      if (!isCombo && item.subject) {
        const tagged = currentMediaList.filter(m => m.subjectTags?.includes(item.subject.id));
        thumbHTML = item.subject.avatarUrl 
          ? `<img src="${item.subject.avatarUrl}" class="leader-avatar-thumb" alt="${item.subject.name}">`
          : tagged[0]
            ? renderMediaThumbnailHTML(tagged[0], 'leader-avatar-thumb')
            : `<div class="leader-avatar-thumb" style="display:flex;align-items:center;justify-content:center;font-size:12px;background:var(--bg-secondary);">👤</div>`;
      } else if (isCombo && item.subs) {
        thumbHTML = item.subs.slice(0, 2).map(s => {
          return s.avatarUrl 
            ? `<img src="${s.avatarUrl}" class="leader-avatar-thumb" title="${getSubjectDisplayName(s)}">`
            : `<div class="leader-avatar-thumb" style="display:flex;align-items:center;justify-content:center;font-size:12px;background:var(--bg-secondary);">👤</div>`;
        }).join('');
      }

      return `
        <div class="leader-item ${isCombo ? 'combo-item' : ''}" ${dataAttr}>
          <div style="display:flex; align-items:center; gap:8px; overflow:hidden;">
            <span class="leader-rank">#${idx + 1}</span>
            ${thumbHTML}
            <span style="font-weight:700;">${displayName}</span>
          </div>
          <span class="badge" style="background:${badgeColor}22; color:${badgeColor}; font-weight:700;">${val} pts</span>
        </div>`;
    }).join('');

    container.querySelectorAll('.leader-item').forEach(el => {
      el.onclick = () => {
        modal.classList.remove('active');
        if (isCombo) {
          activeDetailComboKey = el.getAttribute('data-combokey');
          switchView('combinationDetailsView');
        } else {
          activeDetailSubjectId = el.getAttribute('data-id');
          switchView('subjectDetailsView');
        }
      };
    });

    const closeBtn = document.getElementById('closeLeaderboardModalBtn');
    if (closeBtn) closeBtn.onclick = () => modal.classList.remove('active');
    modal.classList.add('active');
  }

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

      // -------------------------------------------------------------------------
      // Subject Alikes List & Calculation
      // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // Subject Thoughts List
    // -------------------------------------------------------------------------
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
              <select id="detailSubGroupSelect" class="select-input btn-sm" style="font-size:0.85rem;">
                ${getSubjectGroupOptionsHTML(subject.groupId)}
              </select>
              <button class="btn btn-secondary btn-sm" id="renameDetailSubjectBtn">✏️ Rename</button>
              
              <!-- 3-Dot Submenu for Delete Subject -->
              <div class="dropdown-container" id="subDetailMenuContainer" style="position:relative; display:inline-block;">
                <button class="btn btn-secondary btn-sm" id="subDetailMenuBtn">•••</button>
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

        <!-- Recent Events Filters & Gallery -->
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

          const ACTION_HEX_MAP = {
            1: '#a855f7', 2: '#3b82f6', 3: '#10b981', 4: '#eab308',
            5: '#f97316', 6: '#ef4444', 7: '#ec4899', 8: '#d946ef',
            9: '#0ea5e9', 10: '#6366f1', 11: '#8b5cf6', 12: '#f43f5e'
          };
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

    // Render Timeline Charts safely
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

  function openManageGroupsModal() {
    const modal = document.getElementById('manageGroupsModal');
    const container = document.getElementById('groupsListContainer');
    if (!modal || !container) return;

    modal.classList.add('active');
    renderGroupsList();
  }

  function renderGroupsList() {
    const container = document.getElementById('groupsListContainer');
    if (!container) return;

    container.innerHTML = currentSubjectGroupsList.map((g, idx) => {
      const isDisabled = disabledGroupIds.has(g.id);
      return `
        <div class="group-drag-item ${isDisabled ? 'disabled-group' : ''}" data-idx="${idx}" draggable="true" style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border:1px solid var(--border-color); border-radius:var(--radius-md); margin-bottom:6px; opacity:${isDisabled ? 0.5 : 1};">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:1.2rem;">≡</span>
            <span style="font-size:1.1rem;">${g.emoji || '📁'}</span>
            <strong>${g.name} ${isDisabled ? '(Disabled)' : ''}</strong>
          </div>
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="btn btn-secondary btn-sm rename-group-btn" data-id="${g.id}">✏️ Rename</button>
            <button class="btn ${isDisabled ? 'btn-secondary' : 'btn-danger'} btn-sm delete-group-btn" data-id="${g.id}">
              ${isDisabled ? '🔄 Enable' : '🗑️ Delete'}
            </button>
          </div>
        </div>`;
    }).join('');

    let dragSrcIdx = null;

    container.querySelectorAll('.group-drag-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        dragSrcIdx = parseInt(item.getAttribute('data-idx'), 10);
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      item.addEventListener('drop', async (e) => {
        e.preventDefault();
        const dropIdx = parseInt(item.getAttribute('data-idx'), 10);
        if (dragSrcIdx !== null && dragSrcIdx !== dropIdx) {
          const movedGroup = currentSubjectGroupsList.splice(dragSrcIdx, 1)[0];
          currentSubjectGroupsList.splice(dropIdx, 0, movedGroup);
          await db.setSetting('subjectGroups', currentSubjectGroupsList);
          renderGroupsList();
          renderCurrentView();
        }
      });
    });

    container.querySelectorAll('.rename-group-btn').forEach(btn => {
      btn.onclick = async () => {
        const gId = btn.getAttribute('data-id');
        const group = currentSubjectGroupsList.find(g => g.id === gId);
        if (!group) return;

        const currentText = group.name.replace(/^[🟤🟣🟢🟡🟠🔴🔵⚪⚫⭐\s]+/g, '').trim();
        const newText = prompt(`Enter new text for group "${group.name}":\n(The emoji/icon "${group.emoji || '📁'}" will stay fixed)`, currentText);
        if (newText && newText.trim() && newText.trim() !== currentText) {
          group.name = `${group.emoji || '📁'} ${newText.trim()}`;
          await db.setSetting('subjectGroups', currentSubjectGroupsList);
          await loadAppState();
          renderGroupsList();
          renderCurrentView();
        }
      };
    });

    container.querySelectorAll('.delete-group-btn').forEach(btn => {
      btn.onclick = async () => {
        const gId = btn.getAttribute('data-id');
        const group = currentSubjectGroupsList.find(g => g.id === gId);
        if (!group) return;

        if (disabledGroupIds.has(gId)) {
          disabledGroupIds.delete(gId);
        } else {
          disabledGroupIds.add(gId);
        }
        await db.setSetting('disabledGroupIds', Array.from(disabledGroupIds));
        await loadAppState();
        renderGroupsList();
        renderHeaderGroupFilters();
        renderCurrentView();
      };
    });
  }

  function openAvatarPhotoPicker(subjectId) {
    const subject = currentSubjectsList.find(s => s.id === subjectId);
    if (!subject) return;

    const taggedMedia = currentMediaList.filter(m => m.subjectTags?.includes(subject.id));
    if (taggedMedia.length === 0) {
      alert(`No photos tagged with "${getSubjectDisplayName(subject)}" yet. Please tag photos first.`);
      return;
    }

    const modal = document.getElementById('avatarPickerModal');
    const grid = document.getElementById('avatarPickerMediaGrid');

    grid.innerHTML = taggedMedia.map(m => `
      <div class="media-card avatar-picker-card ${getMediaHighestPriorityGroupBorderClass(m)}" data-id="${m.id}">
        ${renderMediaThumbnailHTML(m)}
      </div>`).join('');

    modal.classList.add('active');

    grid.querySelectorAll('.avatar-picker-card').forEach(card => {
      card.onclick = () => {
        const mId = card.getAttribute('data-id');
        const media = currentMediaList.find(m => m.id === mId);
        modal.classList.remove('active');
        if (media) {
          openMediaCropperModal({
            imageSrcUrl: media.dataUrl,
            isVideo: media.type?.startsWith('video'),
            videoSrcUrl: media.dataUrl,
            modalTitle: `Crop Avatar for ${getSubjectDisplayName(subject)}`,
            onSave: async (croppedUrl) => {
              subject.avatarUrl = croppedUrl;
              await db.put('subjects', subject);
              await loadAppState();
              renderCurrentView();
            }
          });
        }
      };
    });

    document.getElementById('closeAvatarPickerBtn').onclick = () => modal.classList.remove('active');
  }

  async function promptRenameSubject(subject) {
    const newName = prompt(`Enter new name for subject "${subject.name}":`, subject.name);
    if (newName && newName.trim() && newName.trim() !== subject.name) {
      const trimmed = newName.trim();
      const duplicate = currentSubjectsList.find(s => s.id !== subject.id && s.name.toLowerCase() === trimmed.toLowerCase() && s.groupId === subject.groupId);
      if (duplicate) {
        alert(`Subject "${trimmed}" already exists in this group.`);
        return;
      }
      subject.name = trimmed;
      await db.put('subjects', subject);
      await loadAppState();
      renderCurrentView();
    }
  }

  async function deleteSubjectWithConfirmation(subject) {
    if (confirm(`Are you sure you want to delete subject "${getSubjectDisplayName(subject)}"? This action can be undone.`)) {
      const savedSubject = { ...subject };
      await db.delete('subjects', subject.id);

      pushUndoState(`Delete subject "${getSubjectDisplayName(subject)}"`, async () => {
        await db.put('subjects', savedSubject);
      });

      activeDetailSubjectId = null;
      await loadAppState();
      switchView('subjectsView');
    }
  }

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

  /* ==========================================================================
     11. TAGS PAGE (🏷️ Tags) & EDITABLE ACTION POINTS
     ========================================================================== */
  function renderTagsPage() {
    const actionContainer = document.getElementById('actionTagsContainer');
    const normalContainer = document.getElementById('normalTagsContainer');

    const actionCodes = Array.from({ length: 12 }, (_, i) => i + 1);
    actionContainer.innerHTML = actionCodes.map(code => {
      const displayName = getActionDisplayName(code);
      const currentPts = currentActionPointsMap[code] ?? (DEFAULT_ACTION_POINTS[code] || 0.1);
      return `
        <div class="tag-chip-bubble action-tag-${code} nav-action-chip" data-code="${code}" style="display:inline-flex; align-items:center; gap:8px;">
          <span style="cursor:pointer;" class="action-chip-name" data-code="${code}">${displayName}</span>
          <span style="font-size:0.75rem; opacity:0.8;">Pts:</span>
          <input type="number" step="0.1" min="0" max="100" class="input-text btn-sm action-pts-input" data-code="${code}" value="${currentPts}" style="width:64px; padding:2px 6px; font-size:0.8rem; background:rgba(0,0,0,0.3); border-color:rgba(255,255,255,0.3); color:#fff;">
        </div>`;
    }).join('');

    actionContainer.querySelectorAll('.action-chip-name').forEach(chip => {
      chip.onclick = () => {
        const code = chip.getAttribute('data-code');
        activeDetailTagName = getActionDisplayName(code);
        switchView('tagDetailsView');
      };
    });

    actionContainer.querySelectorAll('.action-pts-input').forEach(input => {
      input.onclick = (e) => e.stopPropagation();
      input.onchange = async (e) => {
        const code = parseInt(input.getAttribute('data-code'), 10);
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val < 0) val = 0.1;
        val = Math.round(val * 100) / 100;
        input.value = val;

        currentActionPointsMap[code] = val;
        await db.setSetting('actionPointsMap', currentActionPointsMap);
        await loadAppState();
      };
    });

    const normalTagCounts = new Map();
    currentMediaList.forEach(m => {
      (m.normalTags || []).forEach(t => normalTagCounts.set(t, (normalTagCounts.get(t) || 0) + 1));
    });

    const sortedNormalTags = Array.from(normalTagCounts.entries()).sort((a, b) => b[1] - a[1]);

    if (sortedNormalTags.length === 0) {
      normalContainer.innerHTML = `<p class="text-muted">No normal tags added yet. Add tags in Media Browser or Lightbox.</p>`;
    } else {
      normalContainer.innerHTML = sortedNormalTags.map(([tag, count]) => `
        <span class="tag-chip-bubble nav-normal-chip" data-tag="${tag}" style="display:inline-flex; align-items:center; gap:6px;">
          <span class="nav-normal-chip-name" data-tag="${tag}" style="cursor:pointer;">🏷️ ${tag} (${count})</span>
          <button class="btn btn-secondary btn-sm rename-normal-tag-btn" data-tag="${tag}" title="Rename / Merge tag" style="padding:1px 5px; font-size:0.75rem;">✏️</button>
          <span class="tag-chip-remove delete-normal-tag-btn" data-tag="${tag}">✖</span>
        </span>`).join('');

      normalContainer.querySelectorAll('.nav-normal-chip-name').forEach(chip => {
        chip.onclick = () => {
          activeDetailTagName = chip.getAttribute('data-tag');
          switchView('tagDetailsView');
        };
      });

      normalContainer.querySelectorAll('.rename-normal-tag-btn').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const oldTag = btn.getAttribute('data-tag');
          const newTagRaw = prompt(`Rename / Merge normal tag "${oldTag}":`, oldTag);
          if (!newTagRaw) return;
          const newTag = newTagRaw.trim();
          if (!newTag || newTag === oldTag) return;

          const exists = currentMediaList.some(m => (m.normalTags || []).includes(newTag));
          if (exists) {
            if (!confirm(`Tag "${newTag}" already exists. Do you want to merge "${oldTag}" into "${newTag}"?`)) return;
          }

          for (const m of currentMediaList) {
            if ((m.normalTags || []).includes(oldTag)) {
              m.normalTags = m.normalTags.filter(t => t !== oldTag);
              if (!m.normalTags.includes(newTag)) m.normalTags.push(newTag);
              await db.put('media', m);
            }
          }

          await loadAppState();
          renderTagsPage();
        };
      });

      normalContainer.querySelectorAll('.delete-normal-tag-btn').forEach(btn => {
        btn.onclick = async (e) => {
          e.stopPropagation();
          const delTag = btn.getAttribute('data-tag');
          if (confirm(`Delete tag "${delTag}" from all media?`)) {
            const targetMedia = currentMediaList.filter(m => (m.normalTags || []).includes(delTag));
            for (const m of targetMedia) {
              m.normalTags = (m.normalTags || []).filter(t => t !== delTag);
              await db.put('media', m);
            }
            await loadAppState();
            renderCurrentView();
          }
        };
      });
    }
  }

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

  /* ==========================================================================
     12. SLD LIST PAGE & REORGANIZED TIERED SLD DETAILS PAGE
     ========================================================================== */
  function renderSldListPage() {
    const cardsContainer = document.getElementById('sldCardsContainer');
    if (!cardsContainer) return;

    const sldTagMap = new Map();

    for (const m of currentMediaList) {
      for (const be of (m.blueBookEvents || [])) {
        if (be.dateTag) {
          const tag = be.dateTag;
          const entry = sldTagMap.get(tag) || {
            dateTag: tag, mediaSet: new Set(),
            p1: [], p2: [], p3: [],
            g1: [], g2: [], g3: [],
            b1: [], b2: [], b3: []
          };

          entry.mediaSet.add(m.id);
          const p = be.heartTags?.pink || 0;
          const g = be.heartTags?.grey || 0;
          const b = be.heartTags?.blue || 0;

          if (p === 1) entry.p1.push(m); if (p === 2) entry.p2.push(m); if (p === 3) entry.p3.push(m);
          if (g === 1) entry.g1.push(m); if (g === 2) entry.g2.push(m); if (g === 3) entry.g3.push(m);
          if (b === 1) entry.b1.push(m); if (b === 2) entry.b2.push(m); if (b === 3) entry.b3.push(m);

          sldTagMap.set(tag, entry);
        }
      }
    }

    // Update sort buttons UI in SLD page toolbar
    document.querySelectorAll('.sld-sort-btn').forEach(btn => {
      const key = btn.getAttribute('data-sort');
      if (key === sldSortKey) {
        btn.classList.add('active');
        btn.innerHTML = btn.innerHTML.replace(/[▲▼]/g, '').trim() + ' ' + (sldSortDir === 'asc' ? '▲' : '▼');
      } else {
        btn.classList.remove('active');
        btn.innerHTML = btn.innerHTML.replace(/[▲▼]/g, '').trim();
      }

      btn.onclick = () => {
        if (sldSortKey === key) {
          sldSortDir = sldSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          sldSortKey = key;
          sldSortDir = 'desc';
        }
        renderSldListPage();
      };
    });

    const filterInput = document.getElementById('sldFilterInput');
    if (filterInput && !filterInput.dataset.bound) {
      filterInput.dataset.bound = 'true';
      filterInput.oninput = () => renderSldListPage();
    }

    let sldList = Array.from(sldTagMap.values());

    const filterQuery = (document.getElementById('sldFilterInput')?.value || '').toLowerCase().trim();
    if (filterQuery) {
      sldList = sldList.filter(item => {
        const mediaArray = Array.from(item.mediaSet).map(mId => currentMediaList.find(m => m.id === mId)).filter(Boolean);
        return mediaArray.some(m => {
          const nameMatch = (m.filename || '').toLowerCase().includes(filterQuery);
          const subMatch = (m.subjectTags || []).some(sId => {
            const sub = currentSubjectsList.find(s => s.id === sId);
            return sub && getSubjectDisplayName(sub).toLowerCase().includes(filterQuery);
          });
          const sldMatch = (item.dateTag || '').toLowerCase().includes(filterQuery);
          const tagMatch = (m.normalTags || []).some(t => t.toLowerCase().includes(filterQuery));
          return nameMatch || subMatch || sldMatch || tagMatch;
        });
      });
    }

    sldList.sort((a, b) => {
      let comp = 0;
      if (sldSortKey === 'date') {
        comp = convertDateTagToIso(a.dateTag).localeCompare(convertDateTagToIso(b.dateTag));
      } else if (sldSortKey === 'files') {
        comp = a.mediaSet.size - b.mediaSet.size;
      }
      return sldSortDir === 'asc' ? comp : -comp;
    });

    if (sldList.length === 0) {
      cardsContainer.innerHTML = `<div class="empty-state">No matching SLD events found.</div>`;
      return;
    }

    const renderHeartCardForList = (mediaArray, maxLimit, heartType, heartEmoji, thumbSize) => {
      if (!mediaArray || mediaArray.length === 0) return '';
      const count = mediaArray.length;
      const isMaxed = count > 0 && count === maxLimit;

      let baseBg = 'rgba(255, 255, 255, 0.03)';
      let baseBorder = 'var(--border-color)';
      if (heartType === 'pink') { baseBg = 'rgba(255, 105, 180, 0.15)'; baseBorder = 'rgba(255, 105, 180, 0.4)'; }
      else if (heartType === 'blue') { baseBg = 'rgba(56, 189, 248, 0.15)'; baseBorder = 'rgba(56, 189, 248, 0.4)'; }
      else if (heartType === 'grey') { baseBg = 'rgba(148, 163, 184, 0.15)'; baseBorder = 'rgba(148, 163, 184, 0.4)'; }

      const isWinner = thumbSize === 'winner';
      const dim = isWinner ? '400px' : '200px';

      const cardStyle = isMaxed
        ? `background: rgba(16, 185, 129, 0.22); border: 2px solid #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); border-radius: var(--radius-lg); padding: 12px; flex: ${isWinner ? '1 1 100%' : '1'}; min-width: ${isWinner ? '420px' : '220px'};`
        : `background: ${baseBg}; border: 2px solid ${baseBorder}; border-radius: var(--radius-lg); padding: 12px; flex: ${isWinner ? '1 1 100%' : '1'}; min-width: ${isWinner ? '420px' : '220px'};`;

      const thumbsHTML = mediaArray.map(m => `
        <div class="sld-mini-thumb-wrap" data-mid="${m.id}" style="width:${dim}; height:${dim}; border-radius:8px; overflow:hidden; display:inline-block; cursor:pointer;">
          ${renderMediaThumbnailHTML(m, 'sld-mini-thumb', `width:${dim}; height:${dim}; object-fit:cover; display:block;`)}
        </div>`).join('');

      return `
        <div class="heart-card-box" style="${cardStyle}">
          <div style="font-size:0.85rem; font-weight:800; margin-bottom:8px; display:flex; align-items:center; justify-content:space-between;">
            <span>${heartEmoji}</span>
            <span style="opacity:0.85; font-size:0.8rem; font-weight:700;">${count} files</span>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
            ${thumbsHTML}
          </div>
        </div>`;
    };

    const maxGold = currentMedalSettings.maxGold ?? 1;
    const maxSilver = currentMedalSettings.maxSilver ?? 2;
    const maxBronze = currentMedalSettings.maxBronze ?? 5;

    cardsContainer.innerHTML = sldList.map(item => `
      <div class="sld-entry-card" data-tag="${item.dateTag}" style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:18px; box-shadow:var(--shadow-sm); width:fit-content; min-width:300px; max-width:100%; flex:0 1 auto;">
        
        <!-- Header Row: Date (Left), File Count (Middle), 3-Dot Menu (Right) -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:12px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
          <div style="display:flex; align-items:center; gap:16px;">
            <h3 class="sld-date-link" data-tag="${item.dateTag}" style="margin:0; font-size:1.3rem; font-weight:800; color:var(--accent-blue); cursor:pointer;">
              📘 ${item.dateTag}
            </h3>
            <span style="font-weight:700; font-size:0.95rem; background:rgba(56,189,248,0.15); color:var(--accent-blue); padding:4px 10px; border-radius:12px; border:1px solid rgba(56,189,248,0.3);">
              📘 ${item.mediaSet.size}
            </span>
          </div>

          <div class="dropdown-container" style="position:relative; display:inline-block; margin-left:auto;">
            <button class="btn btn-secondary btn-sm sld-card-menu-btn">•••</button>
            <div class="dropdown-menu sld-card-dropdown" style="display:none; position:absolute; right:0; top:100%; z-index:10; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:6px; min-width:170px; box-shadow:var(--shadow-md);">
              <button class="btn btn-danger btn-sm delete-sld-btn" data-tag="${item.dateTag}" style="width:100%; text-align:left;">🗑️ Delete SLD Entry</button>
            </div>


/* === Module: 08_modals_wizards.js === */
/* Module 08_modals_wizards.js */
</div>
        </div>

        <!-- Medalist Rows: Winners, Second place, Third Place -->
        <div style="display:flex; flex-direction:column; gap:14px; width:100%;">
          ${(item.p3.length || item.b3.length || item.g3.length) ? `
            <div>
              <div style="font-size:0.85rem; font-weight:800; color:#eab308; margin-bottom:6px;">🥇 Winners</div>
              <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${renderHeartCardForList(item.p3, maxGold, 'pink', '🩷 Pink', 'winner')}
                ${renderHeartCardForList(item.b3, maxGold, 'blue', '🩵 Blue', 'winner')}
                ${renderHeartCardForList(item.g3, maxGold, 'grey', '🩶 Grey', 'winner')}
              </div>
            </div>` : ''}

          ${(item.p2.length || item.b2.length || item.g2.length) ? `
            <div>
              <div style="font-size:0.85rem; font-weight:800; color:#94a3b8; margin-bottom:6px;">🥈 Second place</div>
              <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${renderHeartCardForList(item.p2, maxSilver, 'pink', '🩷 Pink', 'silver')}
                ${renderHeartCardForList(item.b2, maxSilver, 'blue', '🩵 Blue', 'silver')}
                ${renderHeartCardForList(item.g2, maxSilver, 'grey', '🩶 Grey', 'silver')}
              </div>
            </div>` : ''}

          ${(item.p1.length || item.b1.length || item.g1.length) ? `
            <div>
              <div style="font-size:0.85rem; font-weight:800; color:#cd7f32; margin-bottom:6px;">🥉 Third Place</div>
              <div style="display:flex; flex-wrap:wrap; gap:8px;">
                ${renderHeartCardForList(item.p1, maxBronze, 'pink', '🩷 Pink', 'bronze')}
                ${renderHeartCardForList(item.b1, maxBronze, 'blue', '🩵 Blue', 'bronze')}
                ${renderHeartCardForList(item.g1, maxBronze, 'grey', '🩶 Grey', 'bronze')}
              </div>
            </div>` : ''}

          ${(!item.p3.length && !item.b3.length && !item.g3.length && !item.p2.length && !item.b2.length && !item.g2.length && !item.p1.length && !item.b1.length && !item.g1.length) ? `
            <div class="text-muted" style="font-size:0.8rem; padding:4px 0;">No medals awarded yet.</div>` : ''}
        </div>
      </div>`).join('');

    cardsContainer.querySelectorAll('.sld-card-menu-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const dropdown = btn.nextElementSibling;
        const isShown = dropdown.style.display === 'block';
        document.querySelectorAll('.sld-card-dropdown').forEach(d => d.style.display = 'none');
        if (!isShown) dropdown.style.display = 'block';
      };
    });

    document.addEventListener('click', () => {
      document.querySelectorAll('.sld-card-dropdown').forEach(d => d.style.display = 'none');
    });

    cardsContainer.querySelectorAll('.sld-date-link').forEach(link => {
      link.onclick = (e) => {
        e.stopPropagation();
        activeDetailSldTag = link.getAttribute('data-tag');
        switchView('sldDetailsView');
      };
    });

    cardsContainer.querySelectorAll('.sld-mini-thumb-wrap').forEach(wrap => {
      wrap.onclick = (e) => {
        e.stopPropagation();
        const mId = wrap.getAttribute('data-mid');
        sldDefaultFullscreen = true;
        openLightboxById(mId);
      };
    });

    cardsContainer.querySelectorAll('.delete-sld-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const delTag = btn.getAttribute('data-tag');
        if (confirm(`Are you sure you want to delete SLD "${delTag}"? This action can be undone.`)) {
          const targetMedia = currentMediaList.filter(m => (m.blueBookEvents || []).some(be => be.dateTag === delTag));
          const previousEvents = targetMedia.map(m => ({ id: m.id, events: JSON.parse(JSON.stringify(m.blueBookEvents || [])) }));

          for (const m of targetMedia) {
            m.blueBookEvents = (m.blueBookEvents || []).filter(be => be.dateTag !== delTag);
            await db.put('media', m);
          }

          pushUndoState(`Delete SLD "${delTag}"`, async () => {
            for (const prev of previousEvents) {
              const m = currentMediaList.find(item => item.id === prev.id);
              if (m) { m.blueBookEvents = prev.events; await db.put('media', m); }
            }
          });

          await loadAppState();
          renderSldListPage();
        }
      };
    });
  }

  function renderSldDetailsPage() {
    const container = document.getElementById('sldDetailsContent');
    if (!activeDetailSldTag) { switchView('sldView'); return; }

    const sldTag = activeDetailSldTag;
    const sldMedia = currentMediaList.filter(m => (m.blueBookEvents || []).some(be => be.dateTag === sldTag));

    let p3 = 0, p2 = 0, p1 = 0, b3 = 0, b2 = 0, b1 = 0, g3 = 0, g2 = 0, g1 = 0;
    const subP3 = [], subP2 = [], subP1 = [];
    const subB3 = [], subB2 = [], subB1 = [];
    const subG3 = [], subG2 = [], subG1 = [];
    const noHeartMedia = [];

    for (const m of sldMedia) {
      const be = (m.blueBookEvents || []).find(e => e.dateTag === sldTag);
      if (be && be.heartTags) {
        const p = be.heartTags.pink || 0;
        const g = be.heartTags.grey || 0;
        const b = be.heartTags.blue || 0;

        if (p === 3) { p3++; subP3.push(m); } else if (p === 2) { p2++; subP2.push(m); } else if (p === 1) { p1++; subP1.push(m); }
        if (b === 3) { b3++; subB3.push(m); } else if (b === 2) { b2++; subB2.push(m); } else if (b === 1) { b1++; subB1.push(m); }
        if (g === 3) { g3++; subG3.push(m); } else if (g === 2) { g2++; subG2.push(m); } else if (g === 1) { g1++; subG1.push(m); }

        if (p === 0 && g === 0 && b === 0) noHeartMedia.push(m);
      } else noHeartMedia.push(m);
    }

    const p3Exceeded = p3 > currentMedalSettings.maxGold;
    const b3Exceeded = b3 > currentMedalSettings.maxGold;
    const g3Exceeded = g3 > currentMedalSettings.maxGold;

    const p2Exceeded = p2 > currentMedalSettings.maxSilver;
    const b2Exceeded = b2 > currentMedalSettings.maxSilver;
    const g2Exceeded = g2 > currentMedalSettings.maxSilver;

    const p1Exceeded = p1 > currentMedalSettings.maxBronze;
    const b1Exceeded = b1 > currentMedalSettings.maxBronze;
    const g1Exceeded = g1 > currentMedalSettings.maxBronze;

    const maxGold = currentMedalSettings.maxGold ?? 1;
    const maxSilver = currentMedalSettings.maxSilver ?? 2;
    const maxBronze = currentMedalSettings.maxBronze ?? 5;

    const headerMedalsList = [];
    if (p3 > 0) headerMedalsList.push(`<span class="badge ${p3Exceeded ? 'medal-limit-exceeded' : ''}">🩷🥇 ${p3 > 1 ? p3 : ''}</span>`);
    if (b3 > 0) headerMedalsList.push(`<span class="badge ${b3Exceeded ? 'medal-limit-exceeded' : ''}">🩵🥇 ${b3 > 1 ? b3 : ''}</span>`);
    if (g3 > 0) headerMedalsList.push(`<span class="badge ${g3Exceeded ? 'medal-limit-exceeded' : ''}">🩶🥇 ${g3 > 1 ? g3 : ''}</span>`);

    if (p2 > 0) headerMedalsList.push(`<span class="badge ${p2Exceeded ? 'medal-limit-exceeded' : ''}">🩷🥈 ${p2 > 1 ? p2 : ''}</span>`);
    if (b2 > 0) headerMedalsList.push(`<span class="badge ${b2Exceeded ? 'medal-limit-exceeded' : ''}">🩵🥈 ${b2 > 1 ? b2 : ''}</span>`);
    if (g2 > 0) headerMedalsList.push(`<span class="badge ${g2Exceeded ? 'medal-limit-exceeded' : ''}">🩶🥈 ${g2 > 1 ? g2 : ''}</span>`);

    if (p1 > 0) headerMedalsList.push(`<span class="badge ${p1Exceeded ? 'medal-limit-exceeded' : ''}">🩷🥉 ${p1 > 1 ? p1 : ''}</span>`);
    if (b1 > 0) headerMedalsList.push(`<span class="badge ${b1Exceeded ? 'medal-limit-exceeded' : ''}">🩵🥉 ${b1 > 1 ? b1 : ''}</span>`);
    if (g1 > 0) headerMedalsList.push(`<span class="badge ${g1Exceeded ? 'medal-limit-exceeded' : ''}">🩶🥉 ${g1 > 1 ? g1 : ''}</span>`);

    const renderHeartCardForDetails = (mediaArray, maxLimit, heartType, heartEmoji, thumbSize) => {
      if (!mediaArray || mediaArray.length === 0) return '';
      const count = mediaArray.length;
      const isMaxed = count > 0 && count === maxLimit;

      let baseBg = 'rgba(255, 255, 255, 0.03)';
      let baseBorder = 'var(--border-color)';
      if (heartType === 'pink') { baseBg = 'rgba(255, 105, 180, 0.15)'; baseBorder = 'rgba(255, 105, 180, 0.4)'; }
      else if (heartType === 'blue') { baseBg = 'rgba(56, 189, 248, 0.15)'; baseBorder = 'rgba(56, 189, 248, 0.4)'; }
      else if (heartType === 'grey') { baseBg = 'rgba(148, 163, 184, 0.15)'; baseBorder = 'rgba(148, 163, 184, 0.4)'; }

      const isWinner = thumbSize === 'winner';
      const dim = isWinner ? '400px' : '200px';

      const cardStyle = isMaxed
        ? `background: rgba(16, 185, 129, 0.22); border: 2px solid #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.4); border-radius: var(--radius-lg); padding: 14px; flex: ${isWinner ? '1 1 100%' : '1'}; min-width: ${isWinner ? '420px' : '220px'};`
        : `background: ${baseBg}; border: 2px solid ${baseBorder}; border-radius: var(--radius-lg); padding: 14px; flex: ${isWinner ? '1 1 100%' : '1'}; min-width: ${isWinner ? '420px' : '220px'};`;

      const thumbsHTML = mediaArray.map(m => {
        const borderClass = getMediaHighestPriorityGroupBorderClass(m);
        const be = (m.blueBookEvents || []).find(e => e.dateTag === sldTag);
        const pink = be?.heartTags?.pink || 0;
        const grey = be?.heartTags?.grey || 0;
        const blue = be?.heartTags?.blue || 0;

        return `
          <div class="media-card sld-grid-card ${borderClass}" data-id="${m.id}" style="width:${dim}; height:${dim}; border-radius:12px; overflow:hidden; position:relative; display:inline-block; cursor:pointer;">
            ${renderMediaThumbnailHTML(m, '', `width:${dim}; height:${dim}; object-fit:cover; display:block;`)}
            <div class="media-card-overlay" style="padding:4px; pointer-events:none;">
              <div class="heart-toggle-group-row" style="background:rgba(0,0,0,0.75); padding:3px 6px; border-radius:8px; font-size:0.75rem; pointer-events:auto;" data-mid="${m.id}">
                ${getHeartBtnHTML('pink', pink)}
                ${getHeartBtnHTML('grey', grey)}
                ${getHeartBtnHTML('blue', blue)}
              </div>
            </div>
          </div>`;
      }).join('');

      return `
        <div class="heart-medal-section-card" style="${cardStyle}">
          <div style="font-size:0.95rem; font-weight:800; margin-bottom:10px; display:flex; align-items:center; justify-content:space-between;">
            <span>${heartEmoji}</span>
            <span style="opacity:0.85; font-size:0.85rem; font-weight:700;">${count} files</span>
          </div>
          <div style="display:flex; flex-wrap:wrap; gap:12px; align-items:center;">
            ${thumbsHTML}
          </div>
        </div>`;
    };

    container.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; margin-bottom:20px; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-lg); padding:16px 20px;">
        <div style="display:flex; align-items:center; gap:16px;">
          <button class="btn btn-secondary btn-sm" id="backToSldListBtn">← Back to SLD List</button>
          <h2 style="margin:0; font-size:1.5rem; font-weight:800; color:var(--accent-blue);">📘 ${sldTag}</h2>
          <span style="font-weight:700; font-size:0.95rem; background:rgba(56,189,248,0.15); color:var(--accent-blue); padding:4px 12px; border-radius:12px; border:1px solid rgba(56,189,248,0.3);">
            📘 ${sldMedia.length} files
          </span>
        </div>
        <div class="header-medals-group" style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          ${headerMedalsList.join('') || '<span class="text-muted">No medals awarded</span>'}
        </div>
      </div>

      <!-- Row 1: Winners (🥇 400x400) -->
      ${(subP3.length || subB3.length || subG3.length) ? `
      <div class="sld-tier-container" style="margin-bottom:24px;">
        <div style="font-size:1.1rem; font-weight:800; color:#eab308; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
          <span>🥇 Winners (400x400)</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:14px;">
          ${renderHeartCardForDetails(subP3, maxGold, 'pink', '🩷 Pink Winners', 'winner')}
          ${renderHeartCardForDetails(subB3, maxGold, 'blue', '🩵 Blue Winners', 'winner')}
          ${renderHeartCardForDetails(subG3, maxGold, 'grey', '🩶 Grey Winners', 'winner')}
        </div>
      </div>` : ''}

      <!-- Row 2: Second place (🥈 200x200) -->
      ${(subP2.length || subB2.length || subG2.length) ? `
      <div class="sld-tier-container" style="margin-bottom:24px;">
        <div style="font-size:1.05rem; font-weight:800; color:#94a3b8; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
          <span>🥈 Second place (200x200)</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:14px;">
          ${renderHeartCardForDetails(subP2, maxSilver, 'pink', '🩷 Pink', 'silver')}
          ${renderHeartCardForDetails(subB2, maxSilver, 'blue', '🩵 Blue', 'silver')}
          ${renderHeartCardForDetails(subG2, maxSilver, 'grey', '🩶 Grey', 'silver')}
        </div>
      </div>` : ''}

      <!-- Row 3: Third Place (🥉 200x200) -->
      ${(subP1.length || subB1.length || subG1.length) ? `
      <div class="sld-tier-container" style="margin-bottom:24px;">
        <div style="font-size:1rem; font-weight:800; color:#cd7f32; margin-bottom:12px; display:flex; align-items:center; gap:8px;">
          <span>🥉 Third Place (200x200)</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:14px;">
          ${renderHeartCardForDetails(subP1, maxBronze, 'pink', '🩷 Pink', 'bronze')}
          ${renderHeartCardForDetails(subB1, maxBronze, 'blue', '🩵 Blue', 'bronze')}
          ${renderHeartCardForDetails(subG1, maxBronze, 'grey', '🩶 Grey', 'bronze')}
        </div>
      </div>` : ''}

      <!-- Row 4: Base / No Medal Files (200x200) -->
      ${noHeartMedia.length > 0 ? `
      <div class="sld-tier-container" style="margin-bottom:24px;">
        <div style="font-size:1rem; font-weight:800; color:var(--text-secondary); margin-bottom:12px; display:flex; align-items:center; gap:8px;">
          <span>⚪ Base / No Medal Tier (${noHeartMedia.length})</span>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:12px;">
          ${noHeartMedia.map(m => {
            const borderClass = getMediaHighestPriorityGroupBorderClass(m);
            const be = (m.blueBookEvents || []).find(e => e.dateTag === sldTag);
            const pink = be?.heartTags?.pink || 0;
            const grey = be?.heartTags?.grey || 0;
            const blue = be?.heartTags?.blue || 0;

            return `
              <div class="media-card sld-grid-card ${borderClass}" data-id="${m.id}" style="width:200px; height:200px; border-radius:12px; overflow:hidden; position:relative; display:inline-block; cursor:pointer;">
                ${renderMediaThumbnailHTML(m, '', 'width:200px; height:200px; object-fit:cover; display:block;')}
                <div class="media-card-overlay" style="padding:4px; pointer-events:none;">
                  <div class="heart-toggle-group-row" style="background:rgba(0,0,0,0.75); padding:3px 6px; border-radius:8px; font-size:0.75rem; pointer-events:auto;" data-mid="${m.id}">
                    ${getHeartBtnHTML('pink', pink)}
                    ${getHeartBtnHTML('grey', grey)}
                    ${getHeartBtnHTML('blue', blue)}
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>` : ''}`;

    document.getElementById('backToSldListBtn').onclick = () => switchView('sldView');

    container.querySelectorAll('.sld-grid-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('.heart-toggle-btn')) return;
        sldDefaultFullscreen = true;
        openLightboxById(card.getAttribute('data-id'));
      };
    });

    container.querySelectorAll('.heart-toggle-btn').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const mId = btn.closest('.heart-toggle-group-row')?.getAttribute('data-mid');
        const media = currentMediaList.find(m => m.id === mId);
        if (media) {
          const be = (media.blueBookEvents || []).find(item => item.dateTag === sldTag);
          if (be) {
            const type = btn.getAttribute('data-type');
            if (!be.heartTags) be.heartTags = { pink: 0, grey: 0, blue: 0 };
            be.heartTags[type] = ((be.heartTags[type] || 0) + 1) % 4;
            await db.put('media', media);
            renderSldDetailsPage();
          }
        }
      };
    });
  }

  /* ==========================================================================
     13. EVENTS LIST PAGE & DEDICATED EVENT DETAILS PAGE
     ========================================================================== */
  function renderEventsPage(stats) {
    const tableBody = document.getElementById('eventsTableBody');
    if (currentEventsList.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="empty-state">No events recorded yet. Type a date in "+ Create Event Date" above.</td></tr>`;
      return;
    }

    const sorted = currentEventsList.slice().sort((a, b) => convertDateTagToIso(b.dateTag || '').localeCompare(convertDateTagToIso(a.dateTag || '')));
    tableBody.innerHTML = sorted.map(evt => {
      const dateStr = evt.dateTag || new Date(evt.date).toLocaleDateString();
      const actionCode = evt.eventCode || 1;
      const tagBadge = `<span class="tag-chip-bubble action-tag-${actionCode}">${getActionDisplayName(actionCode)}</span>`;

      const participants = Object.keys(evt.subjectCounts || {}).map(subId => {
        const sub = currentSubjectsList.find(s => s.id === subId);
        const c = evt.subjectCounts[subId] || 0;
        return `<strong>${getSubjectDisplayName(sub)}</strong> ${renderSubjectEmojiCounts(c)}`;
      }).join('&nbsp;&nbsp;&nbsp; ');

      const assignedMedia = currentMediaList.filter(m => (m.eventIds || []).includes(evt.id));
      const sortedMedia = assignedMedia.slice().sort((a, b) => (stats.mediaStatsMap.get(b.id)?.totalHeartPts || 0) - (stats.mediaStatsMap.get(a.id)?.totalHeartPts || 0));
      const top5Media = sortedMedia.slice(0, 5);

      const mediaThumbsHTML = top5Media.length > 0 ? `<div class="sld-table-thumb-group">
        ${top5Media.map(m => `<div class="sld-mini-thumb-wrap evt-media-thumb" data-mid="${m.id}">${renderMediaThumbnailHTML(m, 'sld-mini-thumb')}</div>`).join('')}
      </div>` : '';

      return `
        <tr class="event-table-row" data-evtid="${evt.id}">
          <td><strong style="color:var(--accent-pink); cursor:pointer;">📙 ${dateStr}</strong></td>
          <td>${tagBadge}</td>
          <td>${participants || ''}</td>
          <td>${mediaThumbsHTML}</td>
          <td style="text-align:right;">
            <div class="dropdown-container" style="position:relative; display:inline-block;">
              <button class="btn btn-secondary btn-sm evt-menu-btn">•••</button>
              <div class="dropdown-menu evt-dropdown" style="display:none; position:absolute; right:0; top:100%; z-index:10; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:6px; min-width:160px; box-shadow:var(--shadow-md);">
                <button class="btn btn-danger btn-sm delete-evt-btn" data-evtid="${evt.id}" style="width:100%; text-align:left;">🗑️ Delete this Event</button>
              </div>
            </div>
          </td>
        </tr>`;
    }).join('');

    tableBody.querySelectorAll('.evt-menu-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const dropdown = btn.nextElementSibling;
        const isShown = dropdown.style.display === 'block';
        document.querySelectorAll('.evt-dropdown').forEach(d => d.style.display = 'none');
        if (!isShown) dropdown.style.display = 'block';
      };
    });

    document.addEventListener('click', () => {
      document.querySelectorAll('.evt-dropdown').forEach(d => d.style.display = 'none');
    });

    tableBody.querySelectorAll('.evt-media-thumb').forEach(thumb => {
      thumb.onclick = (e) => {
        e.stopPropagation();
        const mId = thumb.getAttribute('data-mid');
        sldDefaultFullscreen = false;
        openLightboxById(mId);
      };
    });

    tableBody.querySelectorAll('.event-table-row').forEach(row => {
      row.onclick = (e) => {
        if (e.target.closest('.evt-media-thumb') || e.target.closest('.delete-evt-btn')) return;
        activeDetailEventId = row.getAttribute('data-evtid');
        switchView('eventDetailsView');
      };
    });

    tableBody.querySelectorAll('.delete-evt-btn').forEach(btn => {
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

  function renderEventDetailsPage(stats) {
    const container = document.getElementById('eventDetailsPageContent');
    if (!activeDetailEventId) { switchView('eventsView'); return; }

    const evt = currentEventsList.find(e => e.id === activeDetailEventId);
    if (!evt) return;

    let actionCode = evt.eventCode || 1;
    const assignedMedia = currentMediaList.filter(m => (m.eventIds || []).includes(evt.id));
    const countsMap = new Map(Object.entries(evt.subjectCounts || {}));

    let participantsCardsHTML = Array.from(countsMap.entries()).map(([subId, count]) => {
      const sub = currentSubjectsList.find(s => s.id === subId);
      const taggedMedia = currentMediaList.filter(m => m.subjectTags?.includes(subId));
      const avatarSrc = sub?.avatarUrl;
      const borderClass = getSubjectGroup(sub?.groupId)?.cssClass || '';

      let avatarElementHTML = avatarSrc ? `<img src="${avatarSrc}" class="subject-avatar-lg ${borderClass}" style="width:80px; height:80px; margin-bottom:8px; border-radius:50%; object-fit:cover;" alt="${sub?.name}">` : taggedMedia[0] ? renderMediaThumbnailHTML(taggedMedia[0], `subject-avatar-lg ${borderClass}`) : `<div class="subject-avatar-lg ${borderClass}" style="width:80px; height:80px; margin-bottom:8px; display:flex; align-items:center; justify-content:center; font-size:36px; border-radius:50%; background:var(--bg-secondary);">👤</div>`;

      return `
        <div class="subject-card ${borderClass}" style="width:180px; padding:16px; display:flex; flex-direction:column; align-items:center; text-align:center; background:var(--bg-secondary); border-radius:var(--radius-lg); border:1px solid var(--border-color);">
          ${avatarElementHTML}
          <div style="font-weight:700; font-size:1.05rem; margin-bottom:8px;">${getSubjectDisplayName(sub)}</div>
          
          <div style="margin-top:auto; font-size:0.85rem; display:flex; flex-direction:column; align-items:center; gap:6px;">
            <div style="font-weight:700; color:var(--accent-pink);">💦 Count: ${count}</div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button class="btn btn-secondary btn-sm evt-sub-dec" data-subid="${subId}">➖</button>
              <button class="btn btn-secondary btn-sm evt-sub-inc" data-subid="${subId}">➕</button>
              <button class="btn btn-danger btn-sm remove-evt-sub" data-subid="${subId}">✖</button>
            </div>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = `
      <button class="btn btn-secondary btn-sm" id="backToEventsListBtn" style="margin-bottom:16px;">← Back to Events List</button>

      <div class="subject-card action-tag-${actionCode}" style="max-width:100%; text-align:left; padding:24px; border-radius:var(--radius-lg); color:#fff; box-shadow:var(--shadow-lg); margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
          <div>
            <h1 style="font-size:2.2rem; font-weight:800;">📙 ${evt.dateTag || 'Event Details'}</h1>
            <div style="margin-top:6px; font-size:1.2rem; font-weight:700;">⚡ Action: ${getActionDisplayName(actionCode)} (Pts: ${currentActionPointsMap[actionCode] || 0.1})</div>
          </div>
          <button class="btn btn-danger btn-sm" id="deletePageEventBtn">🗑️ Delete Event</button>
        </div>
      </div>

      <div style="background:var(--bg-card); padding:24px; border-radius:var(--radius-lg); border:1px solid var(--border-color); margin-bottom:24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px; margin-bottom:16px;">
          <h3>👤 Event Participants (${countsMap.size})</h3>
          <div class="subject-autocomplete-container" style="min-width:260px;">
            <input type="text" id="evtDetailSubInput" class="input-text btn-sm" placeholder="+ Search / add participant..." style="width:100%;">
            <div id="evtDetailSubAutocomplete" class="subject-autocomplete-dropdown"></div>
          </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:stretch;">
          ${participantsCardsHTML || '<p class="text-muted">No participants added yet.</p>'}
        </div>
      </div>

      <div style="background:var(--bg-card); padding:24px; border-radius:var(--radius-lg); border:1px solid var(--border-color); margin-bottom:24px;">
        <h3 style="margin-bottom:8px;">⚡ Select Action Tag</h3>
        <p class="text-muted" style="font-size:0.85rem; margin-bottom:12px;">Click one of the 12 action buttons below to assign the action type:</p>
        <div id="evtDetailActionButtonsGrid" class="action-buttons-grid" style="margin-bottom:20px;"></div>

        <h3 style="margin-bottom:8px;">📝 Notes / Description</h3>
        <textarea id="editEvtNotesInput" class="input-text" rows="3" style="width:100%; resize:vertical;" placeholder="Add notes...">${evt.notes || ''}</textarea>
        <button class="btn btn-primary" id="saveEvtDetailsBtn" style="margin-top:16px; width:100%;">💾 Save Event Changes</button>
      </div>

      <h3 style="margin:24px 0 12px 0;">Assigned Media Gallery (${assignedMedia.length})</h3>
      <div class="media-grid">
        ${assignedMedia.length > 0 ? assignedMedia.map(m => `
          <div class="media-card evt-page-media ${getMediaHighestPriorityGroupBorderClass(m)}" data-id="${m.id}">${renderMediaThumbnailHTML(m)}</div>`).join('') : '<p class="text-muted">No media assigned to this event.</p>'}
      </div>`;

    document.getElementById('backToEventsListBtn').onclick = () => switchView('eventsView');

    renderActionButtonsGrid('evtDetailActionButtonsGrid', actionCode, (selectedCode) => {
      actionCode = selectedCode;
    });

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

    container.querySelectorAll('.evt-sub-dec').forEach(btn => {
      btn.onclick = async () => {
        const subId = btn.getAttribute('data-subid');
        if (evt.subjectCounts[subId] > 1) {
          evt.subjectCounts[subId]--;
          await db.put('events', evt);
          renderEventDetailsPage(stats);
        }
      };
    });

    container.querySelectorAll('.evt-sub-inc').forEach(btn => {
      btn.onclick = async () => {
        const subId = btn.getAttribute('data-subid');
        evt.subjectCounts[subId]++;
        await db.put('events', evt);
        renderEventDetailsPage(stats);
      };
    });

    container.querySelectorAll('.remove-evt-sub').forEach(btn => {
      btn.onclick = async () => {
        const subId = btn.getAttribute('data-subid');
        delete evt.subjectCounts[subId];
        await db.put('events', evt);
        renderEventDetailsPage(stats);
      };
    });

    document.getElementById('saveEvtDetailsBtn').onclick = async () => {
      evt.eventCode = actionCode;
      evt.notes = document.getElementById('editEvtNotesInput').value;
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

  function openEventCreationWizard(dateTag, initialSubIds = []) {
    wizardEventDate = dateTag || getTodaySmartDateTag();
    wizardSubjectCountsMap = new Map();
    wizardSelectedActionCode = 1;
    initialSubIds.forEach(id => wizardSubjectCountsMap.set(id, 1));

    document.getElementById('wizardDateTagTitle').textContent = wizardEventDate;
    document.getElementById('createEventWizardModal').classList.add('active');

    renderActionButtonsGrid('wizardActionButtonsGrid', wizardSelectedActionCode, (selectedCode) => {
      wizardSelectedActionCode = selectedCode;
    });

    renderWizardParticipants();
  }

  function renderWizardParticipants() {
    const container = document.getElementById('wizardParticipantsList');
    if (!container) return;

    if (wizardSubjectCountsMap.size === 0) {
      container.innerHTML = `<p class="text-danger" style="font-size:0.85rem;">At least 2 subjects are required to create an event.</p>`;
      return;
    }

    container.innerHTML = Array.from(wizardSubjectCountsMap.entries()).map(([subId, count]) => {
      const sub = currentSubjectsList.find(s => s.id === subId);
      return `
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; background:var(--bg-primary); padding:8px 12px; border-radius:var(--radius-md);">
          <span>👤 <strong>${getSubjectDisplayName(sub)}</strong></span>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.85rem;">💦 Count:</span>
            <button class="btn btn-secondary btn-sm wiz-dec" data-subid="${subId}">➖</button>
            <span class="font-bold" style="width:24px; text-align:center;">${count}</span>
            <button class="btn btn-secondary btn-sm wiz-inc" data-subid="${subId}">➕</button>
            <button class="btn btn-danger btn-sm remove-wiz-sub" data-subid="${subId}" style="margin-left:8px;">✖</button>
          </div>
        </div>`;
    }).join('');

    container.querySelectorAll('.wiz-dec').forEach(btn => {
      btn.onclick = () => {
        const subId = btn.getAttribute('data-subid');
        const current = wizardSubjectCountsMap.get(subId) || 1;
        if (current > 1) {
          wizardSubjectCountsMap.set(subId, current - 1);
          renderWizardParticipants();
        }
      };
    });

    container.querySelectorAll('.wiz-inc').forEach(btn => {
      btn.onclick = () => {
        const subId = btn.getAttribute('data-subid');
        const current = wizardSubjectCountsMap.get(subId) || 1;
        wizardSubjectCountsMap.set(subId, current + 1);
        renderWizardParticipants();
      };
    });

    container.querySelectorAll('.remove-wiz-sub').forEach(btn => {
      btn.onclick = () => {
        wizardSubjectCountsMap.delete(btn.getAttribute('data-subid'));
        renderWizardParticipants();
      };
    });
  }

  /* Stats & Settings Pages */
  function renderStatsPage(stats) {
    document.getElementById('statTotal3Pinks').textContent = stats.total3PinkHearts;
    const leaderCard = document.getElementById('greyLeaderCard');
    if (stats.greyHeartLeader) {
      leaderCard.innerHTML = `
        <div style="width:60px; height:60px;">${renderMediaThumbnailHTML(stats.greyHeartLeader)}</div>
        <div><div>${stats.greyHeartLeader.filename}</div><div class="text-muted">Grey Heart Score: <strong>${stats.maxGreyPts} pts</strong></div></div>`;
    } else {
      leaderCard.innerHTML = `<span class="text-muted">No grey heart tags recorded.</span>`;
    }

    renderPinkAccumulationChart('pinkAccumulationChart', stats.timelineData);
    renderSubjectLeaderboardChart('subjectLeaderboardChart', stats.allSubjectStats);
    renderCombinationsChart('combinationsChart', stats.allCombinations);
  }

  async function renderSettingsPage() {
    const currentTheme = (await db.getSetting('theme')) || 'dark';
    document.getElementById('themeSelect').value = currentTheme;

    document.getElementById('goldPointValueInput').value = currentMedalSettings.goldPts ?? 1.0;
    document.getElementById('silverPointValueInput').value = currentMedalSettings.silverPts ?? 0.3;
    document.getElementById('bronzePointValueInput').value = currentMedalSettings.bronzePts ?? 0.1;

    document.getElementById('maxGoldPerHeartInput').value = currentMedalSettings.maxGold ?? 1;
    document.getElementById('maxSilverPerHeartInput').value = currentMedalSettings.maxSilver ?? 2;
    document.getElementById('maxBronzePerHeartInput').value = currentMedalSettings.maxBronze ?? 5;

    renderCollectionsManagerList();
    renderProfilesManagerList();
  }

  async function renderCollectionsManagerList() {
    const container = document.getElementById('collectionsListContainer');
    if (!container) return;

    const collections = await db.getAll('collections');
    const activeCollectionId = await db.getActiveCollectionId();

    container.innerHTML = collections.map((c, idx) => `
      <div class="leader-item collection-row-item" data-id="${c.id}" data-name="${c.name}" draggable="true" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="display:flex; align-items:center; gap:8px; min-width:0;">
          <span style="cursor:grab; font-size:1.1rem; flex-shrink:0;">≡</span>
          <strong class="collection-row-name" title="${c.name}">🖼️ ${c.name}</strong>
          ${c.id === activeCollectionId ? '<span class="badge" style="background:var(--accent-blue); color:#fff; flex-shrink:0;">Active</span>' : ''}
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          ${c.id !== activeCollectionId ? `<button class="btn btn-secondary btn-sm switch-collection-btn" data-id="${c.id}">Switch</button>` : ''}
          <button class="btn btn-secondary btn-sm dup-collection-btn" data-id="${c.id}">📋 Duplicate</button>
          <button class="btn btn-danger btn-sm delete-collection-btn" data-id="${c.id}" data-name="${c.name}">🗑️</button>
        </div>
      </div>`).join('') || '<p class="text-muted">No collections found.</p>';

    container.querySelectorAll('.switch-collection-btn').forEach(btn => {
      btn.onclick = async () => {
        await db.setActiveCollectionId(btn.getAttribute('data-id'));
        await loadAppState();
        renderCurrentView();
      };
    });

    container.querySelectorAll('.dup-collection-btn').forEach(btn => {
      btn.onclick = async () => {
        const cId = btn.getAttribute('data-id');
        const source = collections.find(c => c.id === cId);
        if (!source) return;
        const newId = 'col-' + Date.now();
        const newCol = { id: newId, name: `${source.name} (Copy)`, createdAt: new Date().toISOString() };
        await db.put('collections', newCol);

        const allMedia = await db.getAll('media');
        for (const m of allMedia.filter(m => m.collectionId === cId)) {
          const cloned = { ...m, id: 'media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), collectionId: newId };
          await db.put('media', cloned);
        }

        renderCollectionsManagerList();
      };
    });

    container.querySelectorAll('.delete-collection-btn').forEach(btn => {
      btn.onclick = async () => {
        const cId = btn.getAttribute('data-id');
        const cName = btn.getAttribute('data-name');
        if (cId === activeCollectionId) {
          alert('Cannot delete the currently active collection.');
          return;
        }
        if (promptStringentDeleteConfirmation('Collection', cName)) {
          const allMedia = await db.getAll('media');
          for (const m of allMedia.filter(item => item.collectionId === cId)) {
            await db.delete('media', m.id);
          }
          await db.delete('collections', cId);
          await loadAppState();
          renderSettingsPage();
        }
      };
    });

    setupDragToMergeRows(container, 'Collection', async (sourceId, targetId, sourceName, targetName) => {
      const allMedia = await db.getAll('media');
      for (const m of allMedia.filter(item => item.collectionId === sourceId)) {
        m.collectionId = targetId;
        await db.put('media', m);
      }
      await db.delete('collections', sourceId);
      await loadAppState();
      renderSettingsPage();
    });
  }

  async function renderProfilesManagerList() {
    const container = document.getElementById('profilesListContainer');
    if (!container) return;

    const profiles = await db.getAll('profiles');
    const activeProfileId = await db.getActiveProfileId();

    container.innerHTML = profiles.map(p => `
      <div class="leader-item profile-row-item" data-id="${p.id}" data-name="${p.name}" draggable="true" style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
        <div style="display:flex; align-items:center; gap:8px; min-width:0;">
          <span style="cursor:grab; font-size:1.1rem; flex-shrink:0;">≡</span>
          <strong class="profile-row-name" title="${p.name}">📁 ${p.name}</strong>
          ${p.id === activeProfileId ? '<span class="badge" style="background:var(--accent-pink); color:#fff; flex-shrink:0;">Active</span>' : ''}
        </div>
        <div style="display:flex; gap:6px; flex-shrink:0;">
          ${p.id !== activeProfileId ? `<button class="btn btn-secondary btn-sm switch-profile-btn" data-id="${p.id}">Switch</button>` : ''}
          <button class="btn btn-secondary btn-sm dup-profile-btn" data-id="${p.id}">📋 Duplicate</button>
          <button class="btn btn-danger btn-sm delete-profile-btn" data-id="${p.id}" data-name="${p.name}">🗑️</button>
        </div>
      </div>`).join('') || '<p class="text-muted">No profiles found.</p>';

    container.querySelectorAll('.switch-profile-btn').forEach(btn => {
      btn.onclick = async () => {
        await db.setActiveProfileId(btn.getAttribute('data-id'));
        await loadAppState();
        renderCurrentView();
      };
    });

    container.querySelectorAll('.dup-profile-btn').forEach(btn => {
      btn.onclick = async () => {
        const pId = btn.getAttribute('data-id');
        const source = profiles.find(p => p.id === pId);
        if (!source) return;
        const newId = 'profile-' + Date.now();
        const newProf = { id: newId, name: `${source.name} (Copy)`, createdAt: new Date().toISOString() };
        await db.put('profiles', newProf);

        const allMedia = await db.getAll('media');
        for (const m of allMedia.filter(m => m.profileId === pId)) {
          await db.put('media', { ...m, id: 'media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), profileId: newId });
        }
        const allSubs = await db.getAll('subjects');
        for (const s of allSubs.filter(s => s.profileId === pId)) {
          await db.put('subjects', { ...s, id: 'sub-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), profileId: newId });
        }
        const allEvts = await db.getAll('events');
        for (const e of allEvts.filter(e => e.profileId === pId)) {
          await db.put('events', { ...e, id: 'evt-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4), profileId: newId });
        }

        renderProfilesManagerList();
      };
    });

    container.querySelectorAll('.delete-profile-btn').forEach(btn => {
      btn.onclick = async () => {
        const pId = btn.getAttribute('data-id');
        const pName = btn.getAttribute('data-name');
        if (pId === activeProfileId) {
          alert('Cannot delete currently active profile.');
          return;
        }
        if (promptStringentDeleteConfirmation('Profile', pName)) {
          await db.delete('profiles', pId);
          await loadAppState();
          renderSettingsPage();
        }
      };
    });

    setupDragToMergeRows(container, 'Profile', async (sourceId, targetId, sourceName, targetName) => {
      const allMedia = await db.getAll('media');
      for (const m of allMedia.filter(item => item.profileId === sourceId)) {
        m.profileId = targetId;
        await db.put('media', m);
      }
      const allSubs = await db.getAll('subjects');
      for (const s of allSubs.filter(item => item.profileId === sourceId)) {
        s.profileId = targetId;
        await db.put('subjects', s);
      }
      const allEvts = await db.getAll('events');
      for (const e of allEvts.filter(item => item.profileId === sourceId)) {
        e.profileId = targetId;
        await db.put('events', e);
      }
      await db.delete('profiles', sourceId);
      await loadAppState();
      renderSettingsPage();
    });
  }

  function setupDragToMergeRows(container, itemType, onMerge) {
    let draggedId = null;
    let draggedName = null;

    container.querySelectorAll('.leader-item').forEach(row => {
      row.addEventListener('dragstart', (e) => {
        draggedId = row.getAttribute('data-id');
        draggedName = row.getAttribute('data-name');
        e.dataTransfer.effectAllowed = 'move';
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      row.addEventListener('drop', async (e) => {
        e.preventDefault();
        const targetId = row.getAttribute('data-id');
        const targetName = row.getAttribute('data-name');

        if (draggedId && targetId && draggedId !== targetId) {
          if (confirm(`Merge ${itemType} "${draggedName}" into "${targetName}"?\n\nAll items will be reassigned to "${targetName}".`)) {
            await onMerge(draggedId, targetId, draggedName, targetName);
          }
        }
      });
    });
  }

  /* Zip / Export / Backup Helpers */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function showArchiveProgressModal(title = 'Packaging Archive...') {
    const modal = document.getElementById('archiveProgressModal');
    const titleEl = document.getElementById('archiveProgressTitle');
    const msgEl = document.getElementById('archiveProgressMessage');
    const barEl = document.getElementById('archiveProgressBar');
    const pctEl = document.getElementById('archiveProgressPercent');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = 'Preparing files for packaging. Please wait...';
    if (barEl) barEl.style.width = '0%';
    if (pctEl) pctEl.textContent = '0%';

    if (modal) {
      modal.classList.add('active');
      modal.style.display = 'flex';
    }
  }

  function updateArchiveProgress(percent, currentFile = '') {
    const barEl = document.getElementById('archiveProgressBar');
    const pctEl = document.getElementById('archiveProgressPercent');
    const msgEl = document.getElementById('archiveProgressMessage');

    const rounded = Math.min(100, Math.max(0, Math.floor(percent)));
    if (barEl) barEl.style.width = `${rounded}%`;
    if (pctEl) pctEl.textContent = `${rounded}%`;
    if (msgEl && currentFile) msgEl.textContent = `Packaging: ${currentFile}`;
  }

  function hideArchiveProgressModal() {
    const modal = document.getElementById('archiveProgressModal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  }

  async function exportMediaCollectionZip() {
    if (!window.JSZip) { alert('JSZip library loading failed.'); return; }
    const mediaFiles = await db.getActiveMedia();

    if (mediaFiles.length === 0) {
      alert('No media files found in active collection to export.');
      return;
    }

    showArchiveProgressModal('💾 Packaging Collection Archive...');
    const zip = new window.JSZip();
    const manifestMedia = [];

    try {
      for (let i = 0; i < mediaFiles.length; i++) {
        const m = mediaFiles[i];
        updateArchiveProgress((i / mediaFiles.length) * 50, m.filename);
        if (m.dataUrl) {
          const parts = m.dataUrl.split(',');
          if (parts.length > 1) {
            const safeFilename = m.filename.replace(/[/\\?%*:|"<>]/g, '_');
            zip.file(safeFilename, parts[1], { base64: true });

            manifestMedia.push({
              id: m.id,
              filename: safeFilename,
              originalFilename: m.filename,
              type: m.type,
              hash: m.hash,
              blueBookEvents: m.blueBookEvents || [],
              subjectTags: m.subjectTags || [],
              normalTags: m.normalTags || [],
              viewTransform: m.viewTransform || {},
              customThumbnail: m.customThumbnail || null
            });
          }
        }
      }

      zip.file('collection_manifest.json', JSON.stringify({ version: DB_VERSION, exportDate: new Date().toISOString(), media: manifestMedia }, null, 2));

      const todayStr = new Date().toISOString().split('T')[0];
      const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, (metadata) => {
        updateArchiveProgress(50 + (metadata.percent / 2), metadata.currentFile || 'Generating ZIP archive...');
      });

      updateArchiveProgress(100, 'Complete! Opening download window...');
      setTimeout(() => {
        downloadBlob(blob, `SLD Collection ${todayStr}.zip`);
        hideArchiveProgressModal();
      }, 400);
    } catch (err) {
      hideArchiveProgressModal();
      console.error('Export collection archive error:', err);
      alert(`Error packaging collection archive: ${err.message || err}`);
    }
  }

  async function importMediaCollectionZip(file) {
    if (!window.JSZip) { alert('JSZip library loading failed.'); return; }
    try {
      const zip = new window.JSZip();
      const contents = await zip.loadAsync(file);
      const activeProfileId = await db.getActiveProfileId();
      const activeCollectionId = await db.getActiveCollectionId();
      const existingMedia = await db.getActiveMedia();
      const existingHashes = new Set(existingMedia.map(m => m.hash).filter(Boolean));

      let manifestData = null;
      const manifestFile = contents.file('collection_manifest.json');
      if (manifestFile) {
        try {
          const jsonText = await manifestFile.async('text');
          manifestData = JSON.parse(jsonText);
        } catch (e) {
          console.warn('Could not parse collection_manifest.json:', e);
        }
      }

      const manifestMap = new Map();
      if (manifestData && Array.isArray(manifestData.media)) {
        manifestData.media.forEach(item => {
          manifestMap.set(item.filename, item);
          if (item.originalFilename) manifestMap.set(item.originalFilename, item);
        });
      }

      let addedCount = 0;
      let duplicateCount = 0;

      const fileEntries = [];
      contents.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        const cleanName = relativePath.split('/').pop().toLowerCase();
        if (relativePath.includes('__MACOSX') || cleanName.startsWith('.') || cleanName === 'thumbs.db' || relativePath === 'collection_manifest.json') {
          return;
        }
        fileEntries.push({ relativePath, zipEntry });
      });

      for (const { relativePath, zipEntry } of fileEntries) {
        try {
          const base64 = await zipEntry.async('base64');
          const ext = relativePath.split('.').pop().toLowerCase();
          let mime = 'image/jpeg';
          if (ext === 'png') mime = 'image/png';
          else if (ext === 'gif') mime = 'image/gif';
          else if (ext === 'webp') mime = 'image/webp';
          else if (ext === 'svg') mime = 'image/svg+xml';
          else if (ext === 'mp4') mime = 'video/mp4';
          else if (ext === 'webm') mime = 'video/webm';
          else if (ext === 'mov') mime = 'video/quicktime';

          const dataUrl = `data:${mime};base64,${base64}`;
          const fileHash = await calculateContentHash(dataUrl);

          if (existingHashes.has(fileHash)) {
            duplicateCount++;
            continue;
          }
          existingHashes.add(fileHash);
          addedCount++;

          const compressedThumb = await createCompressedThumbnail(mime, dataUrl);
          const meta = manifestMap.get(relativePath) || manifestMap.get(relativePath.split('/').pop()) || {};

          const mediaItem = {
            id: meta.id || ('media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5)),
            profileId: activeProfileId,
            collectionId: activeCollectionId,
            filename: relativePath.split('/').pop(),
            type: mime,
            dataUrl: dataUrl,
            thumbnailUrl: meta.customThumbnail || compressedThumb,
            customThumbnail: meta.customThumbnail || null,
            hash: fileHash,
            blueBookEvents: meta.blueBookEvents || [],
            subjectTags: meta.subjectTags || [],
            normalTags: meta.normalTags || [],
            viewTransform: meta.viewTransform || { rotate: 0, clipStart: 0, clipEnd: null }
          };
          await db.put('media', mediaItem);
        } catch (itemErr) {
          console.warn('Skipped unreadable item in ZIP:', relativePath, itemErr);
        }
      }

      await loadAppState();
      renderCurrentView();
      let msg = `Successfully imported ${addedCount} media file(s).`;
      if (duplicateCount > 0) msg += ` Skipped ${duplicateCount} duplicate file(s).`;
      alert(msg);
    } catch (err) {
      console.error('Import error:', err);
      alert(`Error importing collection file: ${err.message || err}`);
    }
  }

  async function exportDataAndSettingsZip() {
    if (!window.JSZip) return;
    showArchiveProgressModal('💾 Packaging Profile Archive...');

    try {
      const zip = new window.JSZip();
      const activeMedia = await db.getActiveMedia();
      updateArchiveProgress(20, 'Gathering metadata & settings...');

      const mediaMetadata = activeMedia.map(m => ({
        id: m.id,
        filename: m.filename,
        hash: m.hash,
        blueBookEvents: m.blueBookEvents || [],
        subjectTags: m.subjectTags || [],
        normalTags: m.normalTags || [],
        viewTransform: m.viewTransform || {},
        customThumbnail: m.customThumbnail || null
      }));

      const backupData = {
        version: DB_VERSION,
        exportDate: new Date().toISOString(),
        activeProfileId: await db.getActiveProfileId(),
        profiles: await db.getAll('profiles'),
        subjects: await db.getActiveSubjects(),
        events: await db.getActiveEvents(),
        mediaMetadata: mediaMetadata,
        settings: {
          actionPointsMap: await db.getSetting('actionPointsMap'),
          medalSettings: await db.getSetting('medalSettings'),
          scoringWeights: await db.getSetting('scoringWeights'),
          subjectGroups: await db.getSetting('subjectGroups')
        }
      };

      zip.file('backup_data.json', JSON.stringify(backupData, null, 2));
      const todayStr = new Date().toISOString().split('T')[0];

      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }, (metadata) => {
        updateArchiveProgress(40 + (metadata.percent * 0.6), 'Compressing profile backup...');
      });

      updateArchiveProgress(100, 'Complete! Opening download window...');
      setTimeout(() => {
        downloadBlob(blob, `SLD Profile ${todayStr}.zip`);
        hideArchiveProgressModal();
      }, 400);
    } catch (err) {
      hideArchiveProgressModal();
      console.error('Export profile error:', err);
      alert(`Error packaging profile backup: ${err.message || err}`);
    }
  }

  async function importDataAndSettingsZip(file) {
    if (!window.JSZip) return;
    try {
      let jsonStr = '';
      if (file.name.endsWith('.json')) {
        jsonStr = await file.text();
      } else {
        const zip = new window.JSZip();
        const contents = await zip.loadAsync(file);
        const dataFile = contents.file('backup_data.json') || Object.values(contents.files)[0];
        if (dataFile) jsonStr = await dataFile.async('text');
      }

      if (!jsonStr) throw new Error('No data found in backup file');
      const backup = JSON.parse(jsonStr);

      const todayTag = getTodaySmartDateTag();
      const newProfileId = 'profile-' + Date.now();
      const newProfile = { id: newProfileId, name: `Profile ${todayTag}`, createdAt: new Date().toISOString() };
      await db.put('profiles', newProfile);

      for (const s of (backup.subjects || [])) {
        await db.put('subjects', { ...s, profileId: newProfileId });
      }

      for (const e of (backup.events || [])) {
        await db.put('events', { ...e, profileId: newProfileId });
      }

      if (backup.mediaMetadata && Array.isArray(backup.mediaMetadata)) {
        const allMedia = await db.getAll('media');
        for (const meta of backup.mediaMetadata) {
          const m = allMedia.find(item => item.id === meta.id || (item.hash && item.hash === meta.hash) || item.filename === meta.filename);
          if (m) {
            m.blueBookEvents = meta.blueBookEvents || m.blueBookEvents || [];
            m.subjectTags = meta.subjectTags || m.subjectTags || [];
            m.normalTags = meta.normalTags || m.normalTags || [];
            if (meta.viewTransform) m.viewTransform = meta.viewTransform;
            if (meta.customThumbnail) m.customThumbnail = meta.customThumbnail;
            await db.put('media', m);
          }
        }
      }

      if (backup.settings) {
        if (backup.settings.actionPointsMap) await db.setSetting('actionPointsMap', backup.settings.actionPointsMap);
        if (backup.settings.medalSettings) await db.setSetting('medalSettings', backup.settings.medalSettings);
        if (backup.settings.subjectGroups) await db.setSetting('subjectGroups', backup.settings.subjectGroups);
      }

      await db.setActiveProfileId(newProfileId);
      await loadAppState();
      renderCurrentView();
      alert(`Data imported successfully into new profile: "${newProfile.name}"!`);
    } catch (err) {
      alert('Error importing data and settings file.');
    }
  }

  /* ==========================================================================
     MEDIA EXPORTER & DOWNLOADER
     ========================================================================== */
  async function downloadSingleMediaFile(mediaId) {
    const m = currentMediaList.find(item => item.id === mediaId) || await db.get('media', mediaId);
    if (!m || !m.dataUrl) {
      alert('Original media content not available for download.');
      return;
    }

    try {
      const a = document.createElement('a');
      a.href = m.dataUrl;
      a.download = m.filename || `media_${mediaId}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download media file.');
    }
  }

  async function exportSelectedMediaFiles() {
    if (selectedMediaIds.size === 0) {
      alert('No media files selected for export.');
      return;
    }

    const selectedList = currentMediaList.filter(m => selectedMediaIds.has(m.id));
    if (selectedList.length === 1) {
      downloadSingleMediaFile(selectedList[0].id);
      return;
    }

    for (let i = 0; i < selectedList.length; i++) {
      const m = selectedList[i];
      downloadSingleMediaFile(m.id);
      await new Promise(r => setTimeout(r, 250));
    }
  }

  /* ==========================================================================
     STORAGE LIMITS & USAGE GAUGE
     ========================================================================== */
  let maxStorageLimitGb = 5;

  async function updateStorageGauge() {
    const textEl = document.getElementById('storageUsageText');
    const barEl = document.getElementById('storageUsageBar');
    const selectEl = document.getElementById('maxStorageLimitSelect');

    const savedLimit = await db.getSetting('maxStorageLimitGb');
    if (savedLimit !== null && savedLimit !== undefined) {
      maxStorageLimitGb = savedLimit;
      if (selectEl) selectEl.value = String(savedLimit);
    }

    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const est = await navigator.storage.estimate();
        const usageMb = (est.usage || 0) / (1024 * 1024);
        const usageGb = usageMb / 1024;
        const quotaGb = (est.quota || 0) / (1024 * 1024 * 1024);

        let limitDisplay = maxStorageLimitGb === 'unlimited' ? `${quotaGb.toFixed(1)} GB Quota` : `${maxStorageLimitGb} GB Limit`;
        if (textEl) textEl.textContent = `${usageMb < 1000 ? usageMb.toFixed(1) + ' MB' : usageGb.toFixed(2) + ' GB'} / ${limitDisplay}`;

        let pct = 0;
        if (maxStorageLimitGb === 'unlimited') {
          pct = quotaGb > 0 ? (usageGb / quotaGb) * 100 : 0;
        } else {
          pct = (usageGb / parseFloat(maxStorageLimitGb)) * 100;
        }
        if (barEl) barEl.style.width = `${Math.min(100, Math.max(2, pct))}%`;
      } catch (err) {
        if (textEl) textEl.textContent = 'Storage Estimate Unavailable';
      }
    } else if (textEl) {
      textEl.textContent = 'Storage API Unsupported';
    }
  }

  /* ==========================================================================
     WEBRTC PEER-TO-PEER SYNC ENGINE
     ========================================================================== */
  let rtcPeerConnection = null;
  let rtcDataChannel = null;
  let isP2pConnected = false;
  let p2pDeviceName = 'Device 1';

  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  function updateP2pStatusUI(status, text) {
    const badge = document.getElementById('p2pSyncStatusBadge');
    if (!badge) return;

    if (status === 'connected') {
      badge.textContent = `🟢 Connected (${text || 'Live Sync'})`;
      badge.style.background = 'rgba(34,197,94,0.2)';
      badge.style.color = '#22c55e';
      badge.style.borderColor = '#22c55e';
    } else if (status === 'connecting') {
      badge.textContent = `🟡 ${text || 'Connecting...'}`;
      badge.style.background = 'rgba(234,179,8,0.2)';
      badge.style.color = '#eab308';
      badge.style.borderColor = '#eab308';
    } else {
      badge.textContent = '⚪ Disconnected';
      badge.style.background = 'rgba(255,255,255,0.1)';
      badge.style.color = 'var(--text-muted)';
      badge.style.borderColor = 'var(--border-color)';
    }
  }

  function setupDataChannelEvents(channel) {
    rtcDataChannel = channel;

    channel.onopen = () => {
      isP2pConnected = true;
      updateP2pStatusUI('connected', p2pDeviceName || 'Peer');
      renderConnectedPeersUI();

      sendP2pMessage({
        type: 'handshake',
        deviceName: p2pDeviceName,
        timestamp: Date.now()
      });
      triggerPriorityQueueSync();
    };

    channel.onclose = () => {
      isP2pConnected = false;
      updateP2pStatusUI('disconnected');
      renderConnectedPeersUI();
    };

    channel.onmessage = async (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        await handleIncomingP2pMessage(msg);
      } catch (err) {
        console.error('Failed to parse incoming P2P message:', err);
      }
    };
  }

  function renderConnectedPeersUI() {
    const container = document.getElementById('connectedPeersList');
    if (!container) return;

    if (!isP2pConnected) {
      container.innerHTML = '<p class="text-muted" style="font-size:0.8rem; margin:0;">No devices paired currently.</p>';
      return;
    }

    container.innerHTML = `
      <div style="background:var(--bg-primary); padding:10px 14px; border-radius:var(--radius-md); border:1px solid #22c55e; display:flex; align-items:center; justify-content:space-between;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:1.2rem;">💻</span>
          <div>
            <div style="font-weight:800; font-size:0.85rem; color:#fff;">${p2pDeviceName}</div>
            <div style="font-size:0.75rem; color:#86efac;">🟢 Connected & Synced</div>
          </div>
        </div>
        <button class="btn btn-danger btn-sm" id="disconnectP2pBtn">Disconnect</button>
      </div>`;

    document.getElementById('disconnectP2pBtn')?.addEventListener('click', disconnectP2p);
  }

  function disconnectP2p() {
    if (rtcDataChannel) rtcDataChannel.close();
    if (rtcPeerConnection) rtcPeerConnection.close();
    rtcDataChannel = null;
    rtcPeerConnection = null;
    isP2pConnected = false;
    updateP2pStatusUI('disconnected');
    renderConnectedPeersUI();
  }

  function sendP2pMessage(msgObj) {
    if (rtcDataChannel && rtcDataChannel.readyState === 'open') {
      rtcDataChannel.send(JSON.stringify(msgObj));
    }
  }

  function waitForIceGatheringComplete(pc, maxWaitMs = 2500) {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      let timeoutId = null;
      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          if (timeoutId) clearTimeout(timeoutId);
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', checkState);
      timeoutId = setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, maxWaitMs);
    });
  }

  function sortCandidatesPreferTailscale(candidatesList = []) {
    return candidatesList.sort((a, b) => {
      const strA = (typeof a === 'string' ? a : a?.candidate || '').toLowerCase();
      const strB = (typeof b === 'string' ? b : b?.candidate || '').toLowerCase();

      const isTsA = /\b100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(strA);
      const isTsB = /\b100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(strB);

      if (isTsA && !isTsB) return -1;
      if (!isTsA && isTsB) return 1;
      return 0;
    });
  }

  async function generatePairCode() {
    updateP2pStatusUI('connecting', 'Gathering Network Candidates (Step 1)...');
    rtcPeerConnection = new RTCPeerConnection(RTC_CONFIG);
    const channel = rtcPeerConnection.createDataChannel('sld-sync-channel');
    setupDataChannelEvents(channel);

    const candidates = [];
    rtcPeerConnection.onicecandidate = (e) => {
      if (e.candidate) candidates.push(e.candidate);
    };

    const offer = await rtcPeerConnection.createOffer();
    await rtcPeerConnection.setLocalDescription(offer);

    await waitForIceGatheringComplete(rtcPeerConnection, 2500);

    // Prioritize Tailscale 100.x.y.z candidates at top of list
    sortCandidatesPreferTailscale(candidates);

    const payload = {
      offer: rtcPeerConnection.localDescription,
      candidates,
      deviceName: document.getElementById('syncDeviceNameInput')?.value || 'Device 1'
    };

    const encodedCode = btoa(JSON.stringify(payload));
    const codeArea = document.getElementById('pairCodeDisplayArea');
    const inputEl = document.getElementById('activePairCodeInput');

    if (codeArea && inputEl) {
      inputEl.value = encodedCode;
      codeArea.style.display = 'block';
    }
    updateP2pStatusUI('connecting', 'Step 1: Offer Code Generated. Paste on Device 2.');
  }

  async function connectToPeer(codeStr) {
    if (!codeStr || !codeStr.trim()) { alert('Please enter a valid Pair Code.'); return; }
    try {
      updateP2pStatusUI('connecting', 'Connecting to Peer...');
      const payload = JSON.parse(atob(codeStr.trim()));

      if (payload.offer) {
        rtcPeerConnection = new RTCPeerConnection(RTC_CONFIG);
        rtcPeerConnection.ondatachannel = (e) => setupDataChannelEvents(e.channel);

        const candidates = [];
        rtcPeerConnection.onicecandidate = (e) => {
          if (e.candidate) candidates.push(e.candidate);
        };

        await rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(payload.offer));
        if (payload.candidates && Array.isArray(payload.candidates)) {
          sortCandidatesPreferTailscale(payload.candidates);
          for (const c of payload.candidates) {
            try {
              await rtcPeerConnection.addIceCandidate(new RTCIceCandidate(c));
            } catch (err) {}
          }
        }

        const answer = await rtcPeerConnection.createAnswer();
        await rtcPeerConnection.setLocalDescription(answer);

        await waitForIceGatheringComplete(rtcPeerConnection, 2500);

        sortCandidatesPreferTailscale(candidates);

        const answerPayload = {
          answer: rtcPeerConnection.localDescription,
          candidates,
          deviceName: document.getElementById('syncDeviceNameInput')?.value || 'Device 2'
        };

        const answerCode = btoa(JSON.stringify(answerPayload));
        const codeArea = document.getElementById('pairCodeDisplayArea');
        const inputEl = document.getElementById('activePairCodeInput');

        if (codeArea && inputEl) {
          inputEl.value = answerCode;
          codeArea.style.display = 'block';
          alert('Step 2: Copy this Answer Code back to Device 1 (Phone) to complete pairing!');
        }
        updateP2pStatusUI('connecting', 'Step 2: Answer Code Generated. Paste back on Device 1.');
      } else if (payload.answer) {
        if (!rtcPeerConnection) {
          alert('Please click "Generate Pair Code" on this device first before connecting the answer code.');
          return;
        }
        await rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
        if (payload.candidates && Array.isArray(payload.candidates)) {
          sortCandidatesPreferTailscale(payload.candidates);
          for (const c of payload.candidates) {
            try {
              await rtcPeerConnection.addIceCandidate(new RTCIceCandidate(c));
            } catch (err) {}
          }
        }
        updateP2pStatusUI('connecting', 'Finalizing Connection...');
      }
    } catch (err) {
      console.error('Peer connection error:', err);
      alert('Error connecting to peer. Please verify the pair code.');
      updateP2pStatusUI('disconnected');
    }
  }

  /* PRIORITY SYNC QUEUE HANDLER */
  async function triggerPriorityQueueSync() {
    if (!isP2pConnected) return;

    // Priority 1: Settings, Profiles, Subjects, Groups, Action Maps, Prefixes
    const subjects = await db.getAll('subjects');
    const groups = await db.getAll('subjectGroups');
    const actionPointsMap = await db.getSetting('actionPointsMap');
    const medalSettings = await db.getSetting('medalSettings');

    sendP2pMessage({
      type: 'sync_priority_1',
      payload: { subjects, groups, actionPointsMap, medalSettings }
    });

    // Priority 2: Events
    const events = await db.getAll('events');
    sendP2pMessage({
      type: 'sync_priority_2',
      payload: { events }
    });

    // Priority 3: Media Metadata & Thumbnails (Unified Package)
    const activeMedia = await db.getActiveMedia();
    const metadataAndThumbsPackage = activeMedia.map(m => ({
      id: m.id,
      profileId: m.profileId,
      collectionId: m.collectionId,
      filename: m.filename,
      type: m.type,
      thumbnailUrl: m.thumbnailUrl || m.customThumbnail,
      customThumbnail: m.customThumbnail || null,
      hash: m.hash,
      blueBookEvents: m.blueBookEvents || [],
      subjectTags: m.subjectTags || [],
      normalTags: m.normalTags || [],
      viewTransform: m.viewTransform || {}
    }));

    sendP2pMessage({
      type: 'sync_priority_3',
      payload: { media: metadataAndThumbsPackage }
    });

    // Priority 4: Background High-Res Media File Blobs (Chunked Sequential Transfer)
    setTimeout(async () => {
      for (const m of activeMedia) {
        if (!isP2pConnected) break;
        if (m.dataUrl) {
          sendP2pMessage({
            type: 'sync_priority_4_media_chunk',
            payload: { id: m.id, dataUrl: m.dataUrl }
          });
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }, 1500);
  }

  async function handleIncomingP2pMessage(msg) {
    if (!msg || !msg.type) return;

    if (msg.type === 'handshake') {
      p2pDeviceName = msg.deviceName || 'Sibling Device';
      updateP2pStatusUI('connected', p2pDeviceName);
      renderConnectedPeersUI();
    } else if (msg.type === 'candidate') {
      if (rtcPeerConnection && msg.candidate) {
        try { await rtcPeerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch (e) {}
      }
    } else if (msg.type === 'sync_priority_1') {
      const { subjects, groups, actionPointsMap, medalSettings } = msg.payload || {};
      if (subjects) for (const s of subjects) await db.put('subjects', s);
      if (groups) for (const g of groups) await db.put('subjectGroups', g);
      if (actionPointsMap) await db.setSetting('actionPointsMap', actionPointsMap);
      if (medalSettings) await db.setSetting('medalSettings', medalSettings);
      await loadAppState();
      renderCurrentView();
    } else if (msg.type === 'sync_priority_2') {
      const { events } = msg.payload || {};
      if (events) for (const e of events) await db.put('events', e);
      await loadAppState();
      renderCurrentView();
    } else if (msg.type === 'sync_priority_3') {
      const { media } = msg.payload || {};
      if (media) {
        for (const metaItem of media) {
          const existing = await db.get('media', metaItem.id);
          if (!existing) {
            await db.put('media', {
              ...metaItem,
              dataUrl: metaItem.thumbnailUrl || ''
            });
          } else {
            await db.put('media', {
              ...existing,
              ...metaItem,
              dataUrl: existing.dataUrl || metaItem.thumbnailUrl || ''
            });
          }
        }
        await loadAppState();
        renderCurrentView();
      }
    } else if (msg.type === 'sync_priority_4_media_chunk') {
      const { id, dataUrl } = msg.payload || {};
      if (id && dataUrl) {
        const existing = await db.get('media', id);
        if (existing) {
          existing.dataUrl = dataUrl;
          await db.put('media', existing);
        }
      }
    }
  }

  /* Event Listeners */
  let aiFilterMode = 'all';

  function setupEventListeners() {
    setupAutoSaveSettings();
    document.getElementById('regenerateThumbnailsBtn')?.addEventListener('click', regenerateAllThumbnails);
    document.getElementById('globalUndoBtn')?.addEventListener('click', triggerGlobalUndo);

    // Download & Export Listeners
    document.getElementById('lbDownloadOriginalBtn')?.addEventListener('click', () => {
      if (lightboxIndex >= 0 && activeLightboxList[lightboxIndex]) {
        downloadSingleMediaFile(activeLightboxList[lightboxIndex].id);
      }
    });
    document.getElementById('exportSelectedMediaBtn')?.addEventListener('click', exportSelectedMediaFiles);

    // WebRTC & Storage Listeners
    document.getElementById('generatePairCodeBtn')?.addEventListener('click', generatePairCode);
    document.getElementById('connectPeerBtn')?.addEventListener('click', () => {
      const val = document.getElementById('connectPeerCodeInput')?.value;
      connectToPeer(val);
    });
    document.getElementById('copyPairCodeBtn')?.addEventListener('click', () => {
      const input = document.getElementById('activePairCodeInput');
      if (input && input.value) {
        navigator.clipboard.writeText(input.value);
        alert('Pair code copied to clipboard!');
      }
    });
    document.getElementById('maxStorageLimitSelect')?.addEventListener('change', async (e) => {
      await db.setSetting('maxStorageLimitGb', e.target.value);
      updateStorageGauge();
    });

    updateStorageGauge();

    const aiFilterBtn = document.getElementById('aiFilterToggleBtn');
    if (aiFilterBtn) {
      aiFilterBtn.onclick = () => {
        if (aiFilterMode === 'all') aiFilterMode = 'ai_only';
        else if (aiFilterMode === 'ai_only') aiFilterMode = 'human_only';
        else aiFilterMode = 'all';

        if (aiFilterMode === 'all') {
          aiFilterBtn.textContent = '🖼️';
          aiFilterBtn.setAttribute('title', '🖼️ Filter: All Media');
          aiFilterBtn.style.background = '';
          aiFilterBtn.style.color = '';


/* === Module: 09_p2p_sync.js === */
/* ==========================================================================
   MODULE 09: DIRECT IP PEER-TO-PEER TAILSCALE AUTO-CONNECT ENGINE
   ========================================================================== */
let savedP2pPeers = [];
let isP2pConnected = false;
let p2pDeviceName = 'This Device';
let p2pAutoConnectTimer = null;

async function loadSavedP2pPeers() {
  try {
    const list = await db.getSetting('savedP2pPeersList');
    if (Array.isArray(list)) savedP2pPeers = list;
  } catch(e) {}
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
    badge.textContent = `🟢 Connected (${deviceName || 'Peer'})`;
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

  let itemsHtml = '';

  if (savedP2pPeers && savedP2pPeers.length > 0) {
    itemsHtml += savedP2pPeers.map(p => {
      let statusBadge = `<span class="subject-stat-badge" style="background:rgba(239,68,68,0.2); color:#f87171; border:1px solid #ef4444; font-size:0.75rem;">🔴 Offline</span>`;
      if (p.status === 'connected') {
        statusBadge = `<span class="subject-stat-badge" style="background:rgba(34,197,94,0.2); color:#4ade80; border:1px solid #22c55e; font-size:0.75rem;">🟢 Connected</span>`;
      } else if (p.status === 'connecting') {
        statusBadge = `<span class="subject-stat-badge" style="background:rgba(234,179,8,0.2); color:#facc15; border:1px solid #eab308; font-size:0.75rem;">🟡 Probing...</span>`;
      }

      return `<div style="display:flex; align-items:center; justify-content:space-between; background:var(--bg-card); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color); margin-bottom:8px;">
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

  if (!itemsHtml) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.8rem; margin:0;">No devices paired currently.</p>';
  } else {
    container.innerHTML = itemsHtml;
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

window.initP2pIpAutoConnect = initP2pIpAutoConnect;
window.addP2pPeerIp = addP2pPeerIp;
window.removeP2pPeerIp = removeP2pPeerIp;


/* === Module: 10_main_app.js === */
/* ==========================================================================
   MODULE 10: MAIN APPLICATION INITIALIZER & FILE IMPORTER
   ========================================================================== */
async function processFilesArray(files) {
  if (!files || files.length === 0) return;

  const activeProfileId = await db.getActiveProfileId();
  showUploadProgressModal('📤 Importing Media Files...', `Scanning 0 of ${files.length}...`);

  let addedCount = 0;
  let duplicateCount = 0;
  let processedCount = 0;
  const existingHashes = new Set(currentMediaList.map(m => m.hash).filter(Boolean));

  const BATCH_SIZE = 10;
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const chunk = Array.from(files).slice(i, i + BATCH_SIZE);
    await Promise.all(chunk.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const dataUrl = evt.target.result;
            const fileHash = await calculateContentHash(dataUrl);

            if (existingHashes.has(fileHash)) {
              duplicateCount++;
            } else {
              existingHashes.add(fileHash);
              addedCount++;

              const compressedThumb = await createCompressedThumbnail(file.type, dataUrl);
              const mediaItem = {
                id: 'media-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
                profileId: activeProfileId,
                filename: file.name,
                type: file.type,
                dataUrl: dataUrl,
                thumbnailUrl: compressedThumb,
                hash: fileHash,
                blueBookEvents: [],
                subjectTags: [],
                normalTags: [],
                viewTransform: { rotate: 0, clipStart: 0, clipEnd: null }
              };
              await db.put('media', mediaItem);
            }
          } catch (err) {
            console.warn('Error reading upload item:', file.name, err);
          } finally {
            processedCount++;
            const pct = (processedCount / files.length) * 100;
            updateUploadProgress(pct, `Importing file ${processedCount} of ${files.length} (${addedCount} added)...`);
            resolve();
          }
        };
        reader.onerror = () => { processedCount++; resolve(); };
        reader.readAsDataURL(file);
      });
    }));
    await new Promise(r => setTimeout(r, 0));
  }

  updateUploadProgress(100, 'Finishing up...');
  await loadAppState();
  renderCurrentView();

  setTimeout(() => {
    hideUploadProgressModal();
    let msg = `Successfully uploaded ${addedCount} media file(s).`;
    if (duplicateCount > 0) msg += ` Skipped ${duplicateCount} duplicate file(s).`;
    alert(msg);
  }, 300);
}

function triggerSplashScreen(onComplete) {
  const splash = document.getElementById('splashScreen');
  if (!splash) { if (onComplete) onComplete(); return; }

  splash.classList.remove('fade-out');
  splash.classList.add('active');
  splash.style.display = 'flex';
  splash.style.opacity = '1';

  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => {
      splash.classList.remove('active', 'fade-out');
      splash.style.display = 'none';
      if (onComplete) onComplete();
    }, 500);
  }, 800);
}

function setupEventListeners() {
  const uploadInput = document.getElementById('mediaFileInput');
  if (uploadInput) uploadInput.addEventListener('change', (e) => processFilesArray(e.target.files));

  const folderInput = document.getElementById('mediaFolderInput');
  if (folderInput) folderInput.addEventListener('change', (e) => processFilesArray(e.target.files));

  document.getElementById('addP2pPeerIpBtn')?.addEventListener('click', () => {
    const input = document.getElementById('p2pPeerIpInput');
    if (input) {
      addP2pPeerIp(input.value);
      input.value = '';
    }
  });

  try { initP2pIpAutoConnect(); } catch(e) { console.warn('P2P Auto Connect Warning:', e); }

  document.getElementById('themeSelect')?.addEventListener('change', async (e) => {
    const val = e.target.value;
    document.documentElement.setAttribute('data-theme', val);
    await db.setSetting('theme', val);
  });
}

async function initApp() {
  try { triggerSplashScreen(); } catch (e) { console.warn('Splash trigger warning:', e); }

  try {
    await db.init();
    await loadAppState();
  } catch (err) {
    console.warn('DB Init Warning:', err);
  }

  try { setupNavigation(); } catch (e) { console.warn('Nav setup warning:', e); }
  try { setupEventListeners(); } catch (e) { console.warn('Listeners setup warning:', e); }
  try { setupNavbarAutoHide(); } catch (e) { console.warn('Navbar auto hide warning:', e); }
  try { initPWAandUpdates(); } catch (e) { console.warn('PWA updates warning:', e); }
  try { initSystemErrorLoggerUI(); } catch (e) { console.warn('Error logger warning:', e); }
  try { initGlobalThumbSizeSlider(); } catch (e) { console.warn('Thumb slider warning:', e); }

  document.getElementById('headerBrandLogo')?.addEventListener('click', () => {
    triggerSplashScreen(() => {
      switchView('mediaBrowserView');
    });
  });

  try {
    renderCurrentView();
  } catch(e) {
    console.error('Render current view error:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}


