/**
 * Section 11: Multi-Selection State & Undo/Redo Batch Tagging Engine
 */

let selectionUndoStack = [];
let selectionRedoStack = [];

function openMultiSelectTagsModal(subjectIds = null) {
  const modal = document.getElementById('multiSelectTagsModal');
  if (!modal) return;

  renderSelectionTagsPanel();
  modal.classList.add('active');
  modal.style.display = 'flex';
}

function updateUndoRedoButtonsUI() {
  const undoBtn = document.getElementById('selectionUndoBtn');
  const redoBtn = document.getElementById('selectionRedoBtn');
  if (undoBtn) undoBtn.disabled = selectionUndoStack.length === 0;
  if (redoBtn) redoBtn.disabled = selectionRedoStack.length === 0;
}

function captureMediaSnapshot(files) {
  return files.map(m => ({
    id: m.id,
    subjectTags: m.subjectTags ? [...m.subjectTags] : [],
    normalTags: m.normalTags ? [...m.normalTags] : [],
    blueBookEvents: m.blueBookEvents ? JSON.parse(JSON.stringify(m.blueBookEvents)) : [],
    alikeTags: m.alikeTags ? JSON.parse(JSON.stringify(m.alikeTags)) : []
  }));
}

async function restoreMediaSnapshot(snapshot) {
  for (const snap of snapshot) {
    const m = currentMediaList.find(x => x.id === snap.id);
    if (m) {
      m.subjectTags = [...snap.subjectTags];
      m.normalTags = [...snap.normalTags];
      m.blueBookEvents = JSON.parse(JSON.stringify(snap.blueBookEvents));
      m.alikeTags = JSON.parse(JSON.stringify(snap.alikeTags));
      await db.put('media', m);
    }
  }
}

async function performSelectionUndo() {
  if (selectionUndoStack.length === 0) return;
  const action = selectionUndoStack.pop();
  selectionRedoStack.push(action);

  await restoreMediaSnapshot(action.before);
  await loadAppState();
  renderCurrentView();
  updateSelectionStateUI();
  updateUndoRedoButtonsUI();
  showToastNotification(`↩️ ${action.undoMsg}`);
}

async function performSelectionRedo() {
  if (selectionRedoStack.length === 0) return;
  const action = selectionRedoStack.pop();
  selectionUndoStack.push(action);

  await restoreMediaSnapshot(action.after);
  await loadAppState();
  renderCurrentView();
  updateSelectionStateUI();
  updateUndoRedoButtonsUI();
  showToastNotification(`↪️ ${action.redoMsg}`);
}

async function applyTagToAllSelected(type, val, labelStr) {
  const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
  if (selectedFiles.length === 0) return;

  const before = captureMediaSnapshot(selectedFiles);

  for (const m of selectedFiles) {
    if (type === 'subject') {
      if (!m.subjectTags) m.subjectTags = [];
      if (!m.subjectTags.includes(val)) m.subjectTags.push(val);
    } else if (type === 'normal') {
      if (!m.normalTags) m.normalTags = [];
      if (!m.normalTags.includes(val)) m.normalTags.push(val);
    } else if (type === 'sld') {
      if (!m.blueBookEvents) m.blueBookEvents = [];
      if (!m.blueBookEvents.some(be => be.dateTag === val)) {
        m.blueBookEvents.push({
          id: 'sld-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          dateTag: val,
          heartTags: { pink: 0, grey: 0, blue: 0 }
        });
      }
    } else if (type === 'alike') {
      const [sId, str] = val.split('::');
      if (!m.alikeTags) m.alikeTags = [];
      if (!m.alikeTags.some(al => al.targetSubjectId === sId && al.strength === str)) {
        m.alikeTags.push({ targetSubjectId: sId, strength: str });
      }
    }
    await db.put('media', m);
  }

  const after = captureMediaSnapshot(selectedFiles);
  const undoMsg = `${labelStr} replaced after removal`;
  const redoMsg = `${labelStr} applied across all ${selectedFiles.length} files`;

  selectionUndoStack.push({ before, after, undoMsg, redoMsg });
  selectionRedoStack = [];

  await loadAppState();
  renderCurrentView();
  updateSelectionStateUI();
  updateUndoRedoButtonsUI();
  showToastNotification(`Applied ${labelStr} to all ${selectedFiles.length} selected files`);
}

async function removeTagFromAllSelected(type, val, labelStr) {
  const selectedFiles = currentMediaList.filter(m => selectedMediaIds.has(m.id));
  if (selectedFiles.length === 0) return;

  const before = captureMediaSnapshot(selectedFiles);

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

  const after = captureMediaSnapshot(selectedFiles);
  const undoMsg = `${labelStr} replaced after removal`;
  const redoMsg = `${labelStr} removed from selection`;

  selectionUndoStack.push({ before, after, undoMsg, redoMsg });
  selectionRedoStack = [];

  await loadAppState();
  renderCurrentView();
  updateSelectionStateUI();
  updateUndoRedoButtonsUI();
  showToastNotification(`Removed ${labelStr} from selection`);
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
  updateUndoRedoButtonsUI();
}

function setupInlineSelectionTagInputs() {
  const subInput = document.getElementById('inlineSubjectInput');
  const normalInput = document.getElementById('inlineNormalTagInput');
  const sldInput = document.getElementById('inlineSldInput');
  const alikeInput = document.getElementById('inlineAlikeInput');

  document.getElementById('selectionUndoBtn')?.addEventListener('click', performSelectionUndo);
  document.getElementById('selectionRedoBtn')?.addEventListener('click', performSelectionRedo);

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
        await applyTagToAllSelected('subject', sub.id, `Subject (${getSubjectDisplayName(sub)})`);
        subInput.value = '';
      }
    };
  }

  if (normalInput && !normalInput.dataset.bound) {
    normalInput.dataset.bound = 'true';
    normalInput.onkeydown = async (e) => {
      if (e.key === 'Enter' && normalInput.value.trim() && selectedMediaIds.size > 0) {
        const tagVal = normalInput.value.trim();
        await applyTagToAllSelected('normal', tagVal, `Tag (${tagVal})`);
        normalInput.value = '';
      }
    };
  }

  if (sldInput && !sldInput.dataset.bound) {
    sldInput.dataset.bound = 'true';
    sldInput.onkeydown = async (e) => {
      if (e.key === 'Enter' && sldInput.value.trim() && selectedMediaIds.size > 0) {
        const dateTagVal = sldInput.value.trim();
        await applyTagToAllSelected('sld', dateTagVal, `SLD (${dateTagVal})`);
        sldInput.value = '';
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

        const valKey = `${sub.id}::${strength}`;
        await applyTagToAllSelected('alike', valKey, `Alike (${getSubjectDisplayName(sub)} ${strength})`);
        alikeInput.value = '';
      }
    };
  }
}

window.selectionUndoStack = selectionUndoStack;
window.selectionRedoStack = selectionRedoStack;
window.openMultiSelectTagsModal = openMultiSelectTagsModal;
window.updateUndoRedoButtonsUI = updateUndoRedoButtonsUI;
window.captureMediaSnapshot = captureMediaSnapshot;
window.restoreMediaSnapshot = restoreMediaSnapshot;
window.performSelectionUndo = performSelectionUndo;
window.performSelectionRedo = performSelectionRedo;
window.applyTagToAllSelected = applyTagToAllSelected;
window.removeTagFromAllSelected = removeTagFromAllSelected;
window.updateSelectionStateUI = updateSelectionStateUI;
window.setupInlineSelectionTagInputs = setupInlineSelectionTagInputs;
