/**
 * Section 12: Selection Inline Tags & Modal Chip Renderers Subsystem
 */

const tagSectionExpandedMap = { sld: false, subject: false, normal: false };

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
    const label = `Subject (${getSubjectDisplayName(sub)})`;
    const isPartial = count < totalSelected;
    html += `
      <span class="tag-chip-bubble" style="background:var(--accent-pink)22; border:1px solid var(--accent-pink); padding:3px 10px; border-radius:14px; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px;">
        <span class="apply-partial-tag" data-type="subject" data-val="${sId}" data-label="${label}" style="cursor:pointer;" title="${isPartial ? `Click to apply across all ${totalSelected} files` : 'Attached to all files'}">
          👤 ${getSubjectDisplayName(sub)} <strong style="color:${isPartial ? '#facc15' : '#4ade80'};">(${count}/${totalSelected})</strong>
        </span>
        <span class="remove-selection-tag" data-type="subject" data-val="${sId}" data-label="${label}" style="cursor:pointer; opacity:0.8; padding:0 2px;" title="Remove tag from selection">✖</span>
      </span>`;
  });

  tagCounts.forEach((count, tag) => {
    const label = `Tag (${tag})`;
    const isPartial = count < totalSelected;
    html += `
      <span class="tag-chip-bubble" style="background:var(--accent-blue)22; border:1px solid var(--accent-blue); padding:3px 10px; border-radius:14px; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px;">
        <span class="apply-partial-tag" data-type="normal" data-val="${tag}" data-label="${label}" style="cursor:pointer;" title="${isPartial ? `Click to apply across all ${totalSelected} files` : 'Attached to all files'}">
          🏷️ ${tag} <strong style="color:${isPartial ? '#facc15' : '#4ade80'};">(${count}/${totalSelected})</strong>
        </span>
        <span class="remove-selection-tag" data-type="normal" data-val="${tag}" data-label="${label}" style="cursor:pointer; opacity:0.8; padding:0 2px;" title="Remove tag from selection">✖</span>
      </span>`;
  });

  sldCounts.forEach((count, dateTag) => {
    const label = `SLD (${dateTag})`;
    const isPartial = count < totalSelected;
    html += `
      <span class="tag-chip-bubble" style="background:rgba(56,189,248,0.2); border:1px solid #38bdf8; padding:3px 10px; border-radius:14px; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px;">
        <span class="apply-partial-tag" data-type="sld" data-val="${dateTag}" data-label="${label}" style="cursor:pointer;" title="${isPartial ? `Click to apply across all ${totalSelected} files` : 'Attached to all files'}">
          💦 ${dateTag} <strong style="color:${isPartial ? '#facc15' : '#4ade80'};">(${count}/${totalSelected})</strong>
        </span>
        <span class="remove-selection-tag" data-type="sld" data-val="${dateTag}" data-label="${label}" style="cursor:pointer; opacity:0.8; padding:0 2px;" title="Remove tag from selection">✖</span>
      </span>`;
  });

  alikeCounts.forEach((count, key) => {
    const [sId, str] = key.split('::');
    const sub = currentSubjectsList.find(s => s.id === sId);
    const label = `Alike (${getSubjectDisplayName(sub)} ${str})`;
    const isPartial = count < totalSelected;
    html += `
      <span class="tag-chip-bubble" style="background:rgba(168,85,247,0.2); border:1px solid #a855f7; padding:3px 10px; border-radius:14px; font-size:0.8rem; display:inline-flex; align-items:center; gap:6px;">
        <span class="apply-partial-tag" data-type="alike" data-val="${key}" data-label="${label}" style="cursor:pointer;" title="${isPartial ? `Click to apply across all ${totalSelected} files` : 'Attached to all files'}">
          🪞 ${getSubjectDisplayName(sub)} (${str}) <strong style="color:${isPartial ? '#facc15' : '#4ade80'};">(${count}/${totalSelected})</strong>
        </span>
        <span class="remove-selection-tag" data-type="alike" data-val="${key}" data-label="${label}" style="cursor:pointer; opacity:0.8; padding:0 2px;" title="Remove tag from selection">✖</span>
      </span>`;
  });

  chipsContainer.innerHTML = html;

  chipsContainer.querySelectorAll('.apply-partial-tag').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-type');
      const val = btn.getAttribute('data-val');
      const label = btn.getAttribute('data-label');
      applyTagToAllSelected(type, val, label);
    };
  });

  chipsContainer.querySelectorAll('.remove-selection-tag').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-type');
      const val = btn.getAttribute('data-val');
      const label = btn.getAttribute('data-label');
      removeTagFromAllSelected(type, val, label);
    };
  });
}

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

  let sldHtml = Array.from(sldCounts.entries()).map(([tag, count]) => {
    const label = `SLD (${tag})`;
    const isPartial = count < totalSelected;
    return `
      <span class="tag-chip-bubble nav-sld-pill" data-tag="${tag}" style="display:inline-flex; align-items:center; gap:6px;">
        <span class="apply-partial-tag" data-type="sld" data-val="${tag}" data-label="${label}" style="cursor:pointer;" title="${isPartial ? `Click to apply across all ${totalSelected} files` : 'Attached to all files'}">
          💦 ${tag} <strong style="color:${isPartial ? '#facc15' : '#4ade80'};">(${count}/${totalSelected})</strong>
        </span>
        <span class="tag-chip-remove" data-type="sld" data-val="${tag}" data-label="${label}" style="cursor:pointer; opacity:0.8; padding:0 2px;" title="Remove tag from selection">✖</span>
      </span>`;
  }).join('');

  let subHtml = Array.from(subCounts.entries()).map(([sId, count]) => {
    const sub = currentSubjectsList.find(s => s.id === sId);
    const label = `Subject (${getSubjectDisplayName(sub)})`;
    const isPartial = count < totalSelected;
    return `
      <span class="tag-chip-bubble nav-sub-pill" data-subid="${sId}" style="display:inline-flex; align-items:center; gap:6px;">
        <span class="apply-partial-tag" data-type="subject" data-val="${sId}" data-label="${label}" style="cursor:pointer;" title="${isPartial ? `Click to apply across all ${totalSelected} files` : 'Attached to all files'}">
          👤 ${getSubjectDisplayName(sub)} <strong style="color:${isPartial ? '#facc15' : '#4ade80'};">(${count}/${totalSelected})</strong>
        </span>
        <span class="tag-chip-remove" data-type="subject" data-val="${sId}" data-label="${label}" style="cursor:pointer; opacity:0.8; padding:0 2px;" title="Remove tag from selection">✖</span>
      </span>`;
  }).join('');

  let normalHtml = Array.from(tagCounts.entries()).map(([tag, count]) => {
    const label = `Tag (${tag})`;
    const isPartial = count < totalSelected;
    return `
      <span class="tag-chip-bubble nav-tag-pill" data-tag="${tag}" style="display:inline-flex; align-items:center; gap:6px;">
        <span class="apply-partial-tag" data-type="normal" data-val="${tag}" data-label="${label}" style="cursor:pointer;" title="${isPartial ? `Click to apply across all ${totalSelected} files` : 'Attached to all files'}">
          🏷️ ${tag} <strong style="color:${isPartial ? '#facc15' : '#4ade80'};">(${count}/${totalSelected})</strong>
        </span>
        <span class="tag-chip-remove" data-type="normal" data-val="${tag}" data-label="${label}" style="cursor:pointer; opacity:0.8; padding:0 2px;" title="Remove tag from selection">✖</span>
      </span>`;
  }).join('');

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

  container.querySelectorAll('.apply-partial-tag').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-type');
      const val = btn.getAttribute('data-val');
      const label = btn.getAttribute('data-label');
      applyTagToAllSelected(type, val, label);
    };
  });

  container.querySelectorAll('.tag-chip-remove').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-type');
      const val = btn.getAttribute('data-val');
      const label = btn.getAttribute('data-label');
      removeTagFromAllSelected(type, val, label);
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

window.tagSectionExpandedMap = tagSectionExpandedMap;
window.renderSelectionInlineTags = renderSelectionInlineTags;
window.renderSelectionTagsPanel = renderSelectionTagsPanel;
window.applyTagToSelectedMedia = applyTagToSelectedMedia;
