/**
 * Section 3: Navigation Router, View Switcher & URL Hash State Persistence Engine
 */

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
let activeDetailSldDateTag = null;
let activeDetailTagName = null;
let activeDetailEventId = null;
let sldDefaultFullscreen = false;
let activeSubjectsTab = 'subjects';
let sldSortKey = 'date';
let sldSortDir = 'desc';

let tagPrefixSettings = { subject: '🟠,🟡,🟢,🟣,🟤', normal: '🧿', action: '🧿', heart: '🩷,🩵,🩶', sld: '🪾' };
let alikeSettings = { faint: 15, medium: 30, strong: 45 };
let globalPointsDisplayMode = 'points';

let selectedEventYear = 'all';
let selectedEventMonth = 'all';
let subjectDetailComboSortHistory = ['eventPoints', 'action', 'heartPoints'];
let subjectDetailMediaSortHistory = ['totalPoints', 'pink', 'grey'];

let subjectAlikeSortKey = 'percentage';
let subjectAlikeSortDir = 'desc';

async function loadAppState() {
  currentMediaList = await db.getActiveMedia();
  currentSubjectsList = await db.getActiveSubjects();
  currentEventsList = await db.getActiveEvents();

  const savedWeights = await db.getSetting('scoringWeights');
  if (savedWeights) currentWeights = savedWeights;

  const savedPoints = await db.getSetting('actionPointsMap');
  if (savedPoints) currentActionPointsMap = savedPoints;

  const savedMedals = await db.getSetting('medalSettings');
  if (savedMedals) currentMedalSettings = savedMedals;

  const savedGroups = await db.getSetting('subjectGroups');
  if (savedGroups) currentSubjectGroupsList = savedGroups;
}

function saveAppStateToStorage(viewId) {
  try {
    const stateData = {
      viewId: viewId || currentActiveView || 'mediaBrowserView',
      activeDetailSubjectId,
      activeDetailComboKey,
      activeDetailSldDateTag,
      activeDetailEventId,
      activeDetailTagName,
      lightboxIndex,
      isLightbox: lightboxIndex >= 0
    };
    localStorage.setItem('sld_last_app_state', JSON.stringify(stateData));
  } catch (e) {}
}

function restoreAppStateFromHashOrStorage() {
  let targetView = 'mediaBrowserView';

  const hash = window.location.hash ? window.location.hash.replace(/^#/, '').trim() : '';
  if (hash) {
    if (hash.startsWith('subjectDetailsView')) {
      const parts = hash.split('?id=');
      targetView = 'subjectDetailsView';
      if (parts[1]) activeDetailSubjectId = parts[1];
    } else if (hash.startsWith('combinationDetailsView')) {
      const parts = hash.split('?key=');
      targetView = 'combinationDetailsView';
      if (parts[1]) activeDetailComboKey = parts[1];
    } else if (hash.startsWith('sldDetailsView')) {
      const parts = hash.split('?tag=');
      targetView = 'sldDetailsView';
      if (parts[1]) activeDetailSldDateTag = parts[1];
    } else if (hash.startsWith('eventDetailsView')) {
      const parts = hash.split('?id=');
      targetView = 'eventDetailsView';
      if (parts[1]) activeDetailEventId = parts[1];
    } else if (hash.startsWith('tagDetailsView')) {
      const parts = hash.split('?name=');
      targetView = 'tagDetailsView';
      if (parts[1]) activeDetailTagName = parts[1];
    } else if (document.getElementById(hash)) {
      targetView = hash;
    }
  } else {
    try {
      const savedStr = localStorage.getItem('sld_last_app_state');
      if (savedStr) {
        const st = JSON.parse(savedStr);
        if (st.viewId && document.getElementById(st.viewId)) {
          targetView = st.viewId;
          if (st.activeDetailSubjectId !== undefined) activeDetailSubjectId = st.activeDetailSubjectId;
          if (st.activeDetailComboKey !== undefined) activeDetailComboKey = st.activeDetailComboKey;
          if (st.activeDetailSldDateTag !== undefined) activeDetailSldDateTag = st.activeDetailSldDateTag;
          if (st.activeDetailEventId !== undefined) activeDetailEventId = st.activeDetailEventId;
          if (st.activeDetailTagName !== undefined) activeDetailTagName = st.activeDetailTagName;
        }
      }
    } catch (e) {}
  }

  switchView(targetView, true);
  return targetView;
}

function switchView(viewId, skipPushState = false) {
  currentActiveView = viewId;

  document.querySelectorAll('.view-page, .view-panel').forEach(panel => {
    panel.style.display = 'none';
    panel.classList.remove('active');
  });

  const activePanel = document.getElementById(viewId);
  if (activePanel) {
    activePanel.style.display = 'block';
    activePanel.classList.add('active');
  }

  document.querySelectorAll('.nav-item, .nav-link').forEach(link => {
    if (link.getAttribute('data-view') === viewId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  renderHeaderGroupFilters();
  renderCurrentView();

  saveAppStateToStorage(viewId);

  if (!skipPushState) {
    let hashUrl = '#' + viewId;
    if (viewId === 'subjectDetailsView' && activeDetailSubjectId) {
      hashUrl = `#subjectDetailsView?id=${activeDetailSubjectId}`;
    } else if (viewId === 'combinationDetailsView' && activeDetailComboKey) {
      hashUrl = `#combinationDetailsView?key=${activeDetailComboKey}`;
    } else if ((viewId === 'sldDetailsView' || viewId === 'sldView') && activeDetailSldDateTag) {
      hashUrl = `#sldDetailsView?tag=${activeDetailSldDateTag}`;
    } else if (viewId === 'eventDetailsView' && activeDetailEventId) {
      hashUrl = `#eventDetailsView?id=${activeDetailEventId}`;
    } else if (viewId === 'tagDetailsView' && activeDetailTagName) {
      hashUrl = `#tagDetailsView?name=${activeDetailTagName}`;
    }

    try {
      const stateData = {
        viewId,
        activeDetailSubjectId,
        activeDetailComboKey,
        activeDetailSldDateTag,
        activeDetailEventId,
        activeDetailTagName,
        isLightbox: false
      };
      window.history.pushState(stateData, '', hashUrl);
    } catch (e) {
      window.location.hash = hashUrl;
    }
  }
}

function renderCurrentView() {
  const stats = processAllStats(currentMediaList, currentSubjectsList, currentEventsList, currentWeights);

  switch (currentActiveView) {
    case 'mediaBrowserView':
      renderMediaBrowser();
      break;
    case 'subjectsView':
      renderSubjectsPage(stats);
      break;
    case 'subjectDetailsView':
      renderSubjectDetailsPage(activeDetailSubjectId, stats);
      break;
    case 'combinationDetailsView':
      renderCombinationDetailsPage(activeDetailComboKey, stats);
      break;
    case 'sldView':
    case 'sldListView':
      renderSldListPage(stats);
      break;
    case 'sldDetailsView':
      renderSldDetailsPage(activeDetailSldDateTag, stats);
      break;
    case 'eventsView':
      renderEventsPage(stats);
      break;
    case 'eventDetailsView':
      renderEventDetailsPage(activeDetailEventId, stats);
      break;
    case 'tagsView':
      renderTagsPage();
      break;
    case 'tagDetailsView':
      renderTagDetailsPage(activeDetailTagName);
      break;
    case 'statsView':
      renderStatsPage(stats);
      break;
    case 'settingsView':
      renderSettingsPage();
      break;
    default:
      renderMediaBrowser();
      break;
  }
}

function renderHeaderGroupFilters() {
  const filterToolbar = document.getElementById('headerGroupFilterToolbar');
  if (!filterToolbar) return;

  filterToolbar.innerHTML = currentSubjectGroupsList.map(g => {
    const isDisabled = disabledGroupIds.has(g.id);
    return `<button type="button" class="btn btn-sm group-filter-btn ${isDisabled ? 'disabled' : 'active'}" data-groupid="${g.id}" style="border-color:${g.color || 'var(--border-color)'};">
      ${g.emoji || '⚪'} ${g.name.replace(/^[🟤🟣🟢🟡🟠⭐\s]+/g, '').trim()}
    </button>`;
  }).join('') + `<button type="button" class="btn btn-sm group-filter-btn ${disabledGroupIds.has('__none__') ? 'disabled' : 'active'}" data-groupid="__none__">
    ⚪ None
  </button>`;

  filterToolbar.querySelectorAll('.group-filter-btn').forEach(btn => {
    btn.onclick = () => {
      const gId = btn.getAttribute('data-groupid');
      if (disabledGroupIds.has(gId)) {
        disabledGroupIds.delete(gId);
      } else {
        disabledGroupIds.add(gId);
      }
      renderHeaderGroupFilters();
      currentMediaPage = 1;
      if (currentActiveView === 'mediaBrowserView') renderMediaBrowser();
    };
  });
}

function setupNavigation() {
  document.querySelectorAll('.nav-item, .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = link.getAttribute('data-view');
      if (targetView) {
        switchView(targetView);
      }
    });
  });
}

function setupNavbarAutoHide() {
  let lastScrollY = window.scrollY;
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY > 100 && currentScrollY > lastScrollY) {
      navbar.style.transform = 'translateY(-100%)';
    } else {
      navbar.style.transform = 'translateY(0)';
    }
    lastScrollY = currentScrollY;
  });
}

window.currentMediaList = currentMediaList;
window.currentSubjectsList = currentSubjectsList;
window.currentEventsList = currentEventsList;
window.currentWeights = currentWeights;
window.currentActiveView = currentActiveView;
window.ITEMS_PER_PAGE = ITEMS_PER_PAGE;
window.currentMediaPage = currentMediaPage;
window.selectedMediaIds = selectedMediaIds;
window.lightboxIndex = lightboxIndex;
window.activeDetailSubjectId = activeDetailSubjectId;
window.activeDetailComboKey = activeDetailComboKey;
window.activeDetailSldDateTag = activeDetailSldDateTag;
window.activeDetailTagName = activeDetailTagName;
window.activeDetailEventId = activeDetailEventId;
window.sldDefaultFullscreen = sldDefaultFullscreen;
window.activeSubjectsTab = activeSubjectsTab;
window.sldSortKey = sldSortKey;
window.sldSortDir = sldSortDir;

window.loadAppState = loadAppState;
window.saveAppStateToStorage = saveAppStateToStorage;
window.restoreAppStateFromHashOrStorage = restoreAppStateFromHashOrStorage;
window.switchView = switchView;
window.renderCurrentView = renderCurrentView;
window.renderHeaderGroupFilters = renderHeaderGroupFilters;
window.setupNavigation = setupNavigation;
window.setupNavbarAutoHide = setupNavbarAutoHide;
