/**
 * 3-Deep Cascade Sort History & Toolbar Component
 */

let sortCascadeStack = [{ key: 'date', dir: 'desc' }];

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
    pinkPts: { emoji: '🩷', label: '🩷 Points Sort' },
    greyPts: { emoji: '🩶', label: '🩶 Points Sort' },
    bluePts: { emoji: '🩵', label: '🩵 Points Sort' },
    sldCount: { emoji: '📘', label: '📘 SLD Points Sort' }
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

window.sortCascadeStack = sortCascadeStack;
window.handleSortButtonClick = handleSortButtonClick;
window.updateSortButtonsUI = updateSortButtonsUI;
window.compareSingleSortKey = compareSingleSortKey;
window.compareMediaCascade = compareMediaCascade;
