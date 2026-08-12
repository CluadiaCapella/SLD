/**
 * Section 6: Global System Error Logger, Diagnostics & Global Thumb Size Slider
 */

const systemErrorLogs = [];

function renderSubjectEmojiCounts(count) {
  if (!count || count <= 0) return '';
  if (count === 1) return '💦';
  if (count === 2) return '💦💦';
  return '💦💦<span style="opacity:0.5;" title="2.5 Max Faded Count">💦</span>';
}

function logSystemError(type, message, file = '', line = 0, col = 0, stack = '') {
  const errorEntry = {
    timestamp: new Date().toISOString(),
    type: type || 'Error',
    message: message || 'Unknown error occurred',
    location: file ? `${file.split('/').pop()}:${line}:${col}` : '',
    stack: stack || (new Error().stack || '')
  };

  systemErrorLogs.unshift(errorEntry);
  if (systemErrorLogs.length > 50) systemErrorLogs.pop();

  try {
    localStorage.setItem('sld_system_error_logs', JSON.stringify(systemErrorLogs));
  } catch (e) {}

  renderSystemErrorLogsUI();
}

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

window.addEventListener('error', (event) => {
  if (event.message === 'Script error.' && !event.filename && !event.lineno) return;
  logSystemError('JS Error', event.message, event.filename, event.lineno, event.colno, event.error?.stack);
});

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || 'Unhandled Promise Rejection');
  const stack = event.reason?.stack || '';
  logSystemError('Unhandled Promise Rejection', msg, '', 0, 0, stack);
});

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
      alert('📜 Error log copied to clipboard! You can paste it into the chat.');
    }).catch(() => {
      alert('Failed to copy to clipboard automatically. Please select the text in the error box and copy manually.');
    });
  });

  document.getElementById('clearErrorLogsBtn')?.addEventListener('click', () => {
    systemErrorLogs.length = 0;
    try {
      localStorage.removeItem('sld_system_error_logs');
    } catch (e) {}
    renderSystemErrorLogsUI();
  });
}

window.renderSubjectEmojiCounts = renderSubjectEmojiCounts;
window.systemErrorLogs = systemErrorLogs;
window.logSystemError = logSystemError;
window.loadSystemErrorLogs = loadSystemErrorLogs;
window.renderSystemErrorLogsUI = renderSystemErrorLogsUI;
window.initGlobalThumbSizeSlider = initGlobalThumbSizeSlider;
window.applyGlobalThumbSize = applyGlobalThumbSize;
window.initSystemErrorLoggerUI = initSystemErrorLoggerUI;
