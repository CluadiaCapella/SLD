/**
 * Section 2: Shared Common & UI Utilities
 * (Thumbnail Pipeline, Smart Date Parsing, Autocompletes, Splash Screen, Toast Notifications, Undo Engine)
 */

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
      const sy = 0;

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

  splashFadeTimer = setTimeout(() => {
    splash.style.display = 'none';
    isSplashActive = false;
    lastSplashDismissTime = Date.now();
    if (onComplete) onComplete();
  }, 500);
}

function triggerSplashScreen(onComplete) {
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
  }, 500);
}

function showToastNotification(msg) {
  let toast = document.getElementById('sldToastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sldToastNotification';
    toast.style.cssText = 'position:fixed; top:20px; right:20px; z-index:999999; background:rgba(15,23,42,0.95); color:#fff; border:1px solid var(--accent-pink); padding:10px 16px; border-radius:8px; font-weight:700; font-size:0.85rem; box-shadow:0 4px 20px rgba(0,0,0,0.5); opacity:0; transition:opacity 0.3s ease; pointer-events:none;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

window.calculateContentHash = calculateContentHash;
window.renderActionButtonsGrid = renderActionButtonsGrid;
window.createCompressedThumbnail = createCompressedThumbnail;
window.undoStack = undoStack;
window.pushUndoState = pushUndoState;
window.triggerGlobalUndo = triggerGlobalUndo;
window.getTodaySmartDateTag = getTodaySmartDateTag;
window.parseSmartDateInput = parseSmartDateInput;
window.convertDateTagToIso = convertDateTagToIso;
window.bindAutocompleteGridKeyboard = bindAutocompleteGridKeyboard;
window.setupSmartDateAutocomplete = setupSmartDateAutocomplete;
window.setupSmartSubjectAutocomplete = setupSmartSubjectAutocomplete;
window.setupNormalTagAutocomplete = setupNormalTagAutocomplete;
window.renderMediaThumbnailHTML = renderMediaThumbnailHTML;
window.getHeartBtnHTML = getHeartBtnHTML;
window.hideSplashScreen = hideSplashScreen;
window.triggerSplashScreen = triggerSplashScreen;
window.showToastNotification = showToastNotification;
