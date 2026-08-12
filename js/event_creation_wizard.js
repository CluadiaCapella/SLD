/**
 * Event Creation Wizard Subsystem
 */

let wizardEventDate = null;
let wizardSubjectCountsMap = new Map();
let wizardSelectedActionCode = 1;

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

function openEventCreationWizard(dateTagInput) {
  const wizardModal = document.getElementById('eventCreationWizardModal');
  const dateInput = document.getElementById('wizardEventDateInput');
  if (!wizardModal || !dateInput) return;

  wizardEventDate = parseSmartDateInput(dateTagInput || getTodaySmartDateTag());
  dateInput.value = wizardEventDate;

  wizardSubjectCountsMap.clear();

  if (selectedMediaIds.size > 0) {
    const selectedMedia = currentMediaList.filter(m => selectedMediaIds.has(m.id));
    selectedMedia.forEach(m => {
      (m.subjectTags || []).forEach(subId => {
        if (!wizardSubjectCountsMap.has(subId)) {
          wizardSubjectCountsMap.set(subId, 1);
        }
      });
    });
  }

  renderWizardParticipants();

  wizardSelectedActionCode = 1;
  renderActionButtonsGrid('wizardActionButtonsGrid', wizardSelectedActionCode, (selectedCode) => {
    wizardSelectedActionCode = selectedCode;
  });

  populateWhereDatalists();
  const notesInput = document.getElementById('wizardNotesInput');
  if (notesInput) notesInput.value = '';

  wizardModal.classList.add('active');
  wizardModal.style.display = 'flex';
}

window.wizardEventDate = wizardEventDate;
window.wizardSubjectCountsMap = wizardSubjectCountsMap;
window.wizardSelectedActionCode = wizardSelectedActionCode;
window.renderWizardParticipants = renderWizardParticipants;
window.openEventCreationWizard = openEventCreationWizard;
