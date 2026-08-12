/**
 * Navigation Bar Auto-Hide, App State Load & URL Hash State Subsystem
 */

function setupNavbarAutoHide() {
  const nav = document.getElementById('bottomNavBar');
  if (nav) {
    nav.classList.remove('nav-hidden');
  }

  window.addEventListener('scroll', () => {
    const navEl = document.getElementById('bottomNavBar');
    if (navEl && navEl.classList.contains('nav-hidden')) {
      navEl.classList.remove('nav-hidden');
    }
  }, { passive: true });
}

async function loadAppState() {
  currentWeights = (await db.getSetting('scoringWeights')) || { heart1: 1, heart2: 3, heart3: 10, eventCCount: 10, eventTag: 1 };
  currentActionPointsMap = (await db.getSetting('actionPointsMap')) || DEFAULT_ACTION_POINTS;
  window.currentSubActionPointsMap = (await db.getSetting('subActionPointsMap')) || {};
  currentMedalSettings = (await db.getSetting('medalSettings')) || DEFAULT_MEDAL_SETTINGS;
  currentSubjectGroupsList = (await db.getSetting('subjectGroups')) || DEFAULT_SUBJECT_GROUPS;

  tagPrefixSettings = (await db.getSetting('tagPrefixSettings')) || { subject: '🟠,🟡,🟢,🟣,🟤', normal: '🧿', action: '🧿', heart: '🩷,🩵,🩶', sld: '🪾' };
  alikeSettings = (await db.getSetting('alikeSettings')) || { faint: 15, medium: 30, strong: 45 };
  globalPointsDisplayMode = (await db.getSetting('globalPointsDisplayMode')) || 'points';

  const theme = (await db.getSetting('theme')) || 'dark';
  document.documentElement.setAttribute('data-theme', theme);

  currentMediaList = await db.getActiveMedia();
  currentSubjectsList = await db.getActiveSubjects();
  currentEventsList = await db.getActiveEvents();

  const activeProfileId = await db.getActiveProfileId();
  const profiles = await db.getAll('profiles');
  const activeProfile = profiles.find(p => p.id === activeProfileId);
  const profilePill = document.getElementById('activeProfilePill');
  if (profilePill && activeProfile) {
    profilePill.textContent = `📁 ${activeProfile.name}`;
  }
}

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const viewId = e.currentTarget.getAttribute('data-view');
      if (viewId) switchView(viewId);
    });
  });
}

function getGroupDisplayTitle(g) {
  if (!g) return '';
  const emoji = g.emoji || '📁';
  const cleanName = (g.name || '').replace(/^[\p{Emoji}\s]+/u, '').trim();
  return `${emoji} ${cleanName || g.name}`;
}

function saveAppStateToStorage(viewId) {
  const stateObj = {
    viewId: viewId || currentActiveView || 'mediaBrowserView',
    activeDetailSubjectId,
    activeDetailComboKey,
    activeDetailSldDateTag,
    activeDetailEventId,
    activeDetailTagName
  };
  try {
    sessionStorage.setItem('sld_retained_page_state', JSON.stringify(stateObj));
    if (window.location.hash !== '#' + stateObj.viewId) {
      window.history.replaceState(stateObj, '', '#' + stateObj.viewId);
    }
  } catch (e) {}
}

function restoreAppStateFromHashOrStorage() {
  let savedState = null;
  try {
    const stored = sessionStorage.getItem('sld_retained_page_state');
    if (stored) savedState = JSON.parse(stored);
  } catch (e) {}

  const rawHash = window.location.hash ? window.location.hash.replace(/^#/, '').trim() : '';
  const targetView = rawHash || (savedState ? savedState.viewId : 'mediaBrowserView');

  if (savedState) {
    if (savedState.activeDetailSubjectId) activeDetailSubjectId = savedState.activeDetailSubjectId;
    if (savedState.activeDetailComboKey) activeDetailComboKey = savedState.activeDetailComboKey;
    if (savedState.activeDetailSldDateTag) activeDetailSldDateTag = savedState.activeDetailSldDateTag;
    if (savedState.activeDetailEventId) activeDetailEventId = savedState.activeDetailEventId;
    if (savedState.activeDetailTagName) activeDetailTagName = savedState.activeDetailTagName;
  }

  const validViews = [
    'mediaBrowserView', 'subjectsView', 'subjectDetailsView', 'combinationDetailsView',
    'sldView', 'sldDetailsView', 'eventsView', 'eventDetailsView', 'tagsView',
    'tagDetailsView', 'statsView', 'settingsView'
  ];

  if (validViews.includes(targetView)) {
    switchView(targetView, true);
    return targetView;
  }
  return 'mediaBrowserView';
}

window.setupNavbarAutoHide = setupNavbarAutoHide;
window.loadAppState = loadAppState;
window.setupNavigation = setupNavigation;
window.getGroupDisplayTitle = getGroupDisplayTitle;
window.saveAppStateToStorage = saveAppStateToStorage;
window.restoreAppStateFromHashOrStorage = restoreAppStateFromHashOrStorage;
