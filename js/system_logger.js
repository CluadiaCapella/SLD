/**
 * Global System Error Logger & Diagnostics Subsystem
 */

const systemErrorLogs = [];

function loadSystemErrorLogs() {
  try {
    const saved = localStorage.getItem('sld_system_error_logs');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        systemErrorLogs.length = 0;
        systemErrorLogs.push(...parsed);
      }
    }
  } catch (e) {}
  renderSystemErrorLogsUI();
}

function renderSystemErrorLogsUI() {
  const container = document.getElementById('systemErrorLogsContainer');
  const countBadge = document.getElementById('errorLogCountBadge');

  if (countBadge) {
    countBadge.textContent = `${systemErrorLogs.length} error${systemErrorLogs.length === 1 ? '' : 's'}`;
    countBadge.style.background = systemErrorLogs.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)';
    countBadge.style.color = systemErrorLogs.length > 0 ? '#f87171' : '#10b981';
    countBadge.style.borderColor = systemErrorLogs.length > 0 ? '#ef4444' : '#10b981';
  }

  if (!container) return;

  if (systemErrorLogs.length === 0) {
    container.textContent = 'No runtime errors recorded on this device.';
    return;
  }

  container.textContent = systemErrorLogs.map((e, idx) => {
    const timeStr = new Date(e.timestamp).toLocaleTimeString();
    return `[#${systemErrorLogs.length - idx}] ${timeStr} - ${e.type}\nMsg: ${e.message}\nLoc: ${e.location}\nStack:\n${e.stack}\n----------------------------------------`;
  }).join('\n\n');
}

async function initGlobalThumbSizeSlider() {
  const slider = document.getElementById('globalThumbSizeSlider');

  const savedSize = await db.getSetting('globalThumbSize');
  const thumbSize = savedSize ? parseInt(savedSize, 10) : 200;

  applyGlobalThumbSize(thumbSize);

  if (slider) {
    slider.value = thumbSize;
    slider.oninput = async (e) => {
      const val = parseInt(e.target.value, 10);
      applyGlobalThumbSize(val);
      await db.setSetting('globalThumbSize', val);
    };
  }
}

function applyGlobalThumbSize(sizePx) {
  const valText = document.getElementById('globalThumbSizeVal');
  if (valText) valText.textContent = `${sizePx}px`;

  document.documentElement.style.setProperty('--thumb-size', `${sizePx}px`);

  document.querySelectorAll('.media-card, .sld-mini-thumb-wrap, .subject-mini-thumb').forEach(el => {
    if (!el.classList.contains('winner-thumb') && el.style.width !== '400px') {
      el.style.width = `${sizePx}px`;
      el.style.height = `${sizePx}px`;
    }
  });
}

function initSystemErrorLoggerUI() {
  loadSystemErrorLogs();

  document.getElementById('copyErrorLogsBtn')?.addEventListener('click', () => {
    const text = systemErrorLogs.length > 0
      ? document.getElementById('systemErrorLogsContainer')?.textContent
      : 'No runtime errors recorded on this device.';
    navigator.clipboard.writeText(text).then(() => {
      showToastNotification('📋 System Error Logs copied to clipboard!');
    });
  });

  document.getElementById('clearErrorLogsBtn')?.addEventListener('click', () => {
    systemErrorLogs.length = 0;
    localStorage.removeItem('sld_system_error_logs');
    renderSystemErrorLogsUI();
    showToastNotification('🧹 Error logs cleared.');
  });
}

window.systemErrorLogs = systemErrorLogs;
window.loadSystemErrorLogs = loadSystemErrorLogs;
window.renderSystemErrorLogsUI = renderSystemErrorLogsUI;
window.initGlobalThumbSizeSlider = initGlobalThumbSizeSlider;
window.applyGlobalThumbSize = applyGlobalThumbSize;
window.initSystemErrorLoggerUI = initSystemErrorLoggerUI;
