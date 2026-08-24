/**
 * System Notifications Center Subsystem
 */

let notificationsList = [];

async function loadNotifications() {
  notificationsList = (await db.getSetting('notificationsList')) || [];
  updateNotificationsBadge();
}

async function addNotification(title, message, type = 'info') {
  const notif = {
    id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    title,
    message,
    type,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    read: false
  };

  notificationsList.unshift(notif);
  if (notificationsList.length > 50) notificationsList.pop();

  await db.setSetting('notificationsList', notificationsList);
  updateNotificationsBadge();
  renderNotificationsList();
}

function updateNotificationsBadge() {
  const textEl = document.getElementById('navNotificationsText');
  const iconEl = document.getElementById('navNotificationsIcon');
  const unreadCount = notificationsList.filter(n => !n.read).length;

  if (textEl) {
    textEl.textContent = unreadCount > 0 ? `${unreadCount} New` : '0 Alert';
  }
  if (iconEl) {
    iconEl.textContent = unreadCount > 0 ? '🔔' : '🔕';
  }
}

function renderNotificationsList() {
  const container = document.getElementById('notificationsListContainer');
  if (!container) return;

  if (notificationsList.length === 0) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.85rem; text-align:center; padding:12px;">No notifications right now.</p>';
    return;
  }

  container.innerHTML = notificationsList.map(n => {
    let typeColor = '#38bdf8';
    let icon = 'ℹ️';
    if (n.type === 'success') { typeColor = '#22c55e'; icon = '✅'; }
    else if (n.type === 'warning') { typeColor = '#eab308'; icon = '⚠️'; }
    else if (n.type === 'danger') { typeColor = '#ef4444'; icon = '🔴'; }

    return `
    <div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-left:4px solid ${typeColor}; padding:10px 14px; border-radius:var(--radius-md); opacity:${n.read ? '0.75' : '1'};">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong style="font-size:0.88rem; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
          <span>${icon}</span> ${n.title}
        </strong>
        <span class="text-muted" style="font-size:0.75rem;">${n.time}</span>
      </div>
      <p style="margin:4px 0 0 0; font-size:0.82rem; color:var(--text-muted); line-height:1.35;">${n.message}</p>
    </div>`;
  }).join('');
}

async function openNotificationsModal() {
  const modal = document.getElementById('notificationsModal');
  // Mark all as read when opening
  notificationsList.forEach(n => n.read = true);
  await db.setSetting('notificationsList', notificationsList);
  updateNotificationsBadge();
  renderNotificationsList();

  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
  }
}

function closeNotificationsModal() {
  const modal = document.getElementById('notificationsModal');
  if (modal) {
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.style.opacity = '0';
    modal.style.pointerEvents = 'none';
  }
}

async function clearNotifications() {
  notificationsList = [];
  await db.setSetting('notificationsList', notificationsList);
  updateNotificationsBadge();
  renderNotificationsList();
}

function setupNotificationsEvents() {
  document.getElementById('navNotificationsIndicator')?.addEventListener('click', openNotificationsModal);
  document.getElementById('closeNotificationsModalBtn')?.addEventListener('click', closeNotificationsModal);
  document.getElementById('doneNotificationsModalBtn')?.addEventListener('click', closeNotificationsModal);
  document.getElementById('clearNotificationsBtn')?.addEventListener('click', clearNotifications);
}

window.loadNotifications = loadNotifications;
window.addNotification = addNotification;
window.updateNotificationsBadge = updateNotificationsBadge;
window.renderNotificationsList = renderNotificationsList;
window.openNotificationsModal = openNotificationsModal;
window.closeNotificationsModal = closeNotificationsModal;
window.clearNotifications = clearNotifications;
window.setupNotificationsEvents = setupNotificationsEvents;
