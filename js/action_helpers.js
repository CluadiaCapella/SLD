/**
 * Action Names, Gender Symbols & Hash Utilities
 */

function getActionName(code) { return ACTION_TAG_NAMES[code] || `Action ${code}`; }
function getActionDisplayName(code) { return ACTION_TAG_NAMES[code] || `Action ${code}`; }

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

function getSubjectGenderSymbol(gender) {
  if (gender === 'Female') return '♀️';
  if (gender === 'Male') return '♂️';
  if (gender === 'NB') return '⚧️';
  return '♀️';
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

window.getActionName = getActionName;
window.getActionDisplayName = getActionDisplayName;
window.promptStringentDeleteConfirmation = promptStringentDeleteConfirmation;
window.getSubjectGenderSymbol = getSubjectGenderSymbol;
window.calculateContentHash = calculateContentHash;
