/**
 * Groups Manager & Modal Subsystem
 */

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

window.openManageGroupsModal = openManageGroupsModal;
window.renderGroupsList = renderGroupsList;
