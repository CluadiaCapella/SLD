/**
 * Avatar Photo Picker & Subject Management Subsystem
 */

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

window.openAvatarPhotoPicker = openAvatarPhotoPicker;
window.promptRenameSubject = promptRenameSubject;
window.deleteSubjectWithConfirmation = deleteSubjectWithConfirmation;
