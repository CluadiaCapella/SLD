/**
 * Action Grid & Normal Tag Autocomplete UI Subsystem
 */

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

window.renderActionButtonsGrid = renderActionButtonsGrid;
window.bindAutocompleteGridKeyboard = bindAutocompleteGridKeyboard;
window.setupNormalTagAutocomplete = setupNormalTagAutocomplete;
