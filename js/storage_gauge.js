/**
 * IndexedDB & Quota Storage Limits Gauge Component
 */

let maxStorageLimitGb = 5;

async function updateStorageGauge() {
  const textEl = document.getElementById('storageUsageText');
  const barEl = document.getElementById('storageUsageBar');
  const selectEl = document.getElementById('maxStorageLimitSelect');

  const savedLimit = await db.getSetting('maxStorageLimitGb');
  if (savedLimit !== null && savedLimit !== undefined) {
    maxStorageLimitGb = savedLimit;
    if (selectEl) selectEl.value = String(savedLimit);
  }

  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const est = await navigator.storage.estimate();
      const usageMb = (est.usage || 0) / (1024 * 1024);
      const usageGb = usageMb / 1024;
      const quotaGb = (est.quota || 0) / (1024 * 1024 * 1024);

      let limitDisplay = maxStorageLimitGb === 'unlimited' ? `${quotaGb.toFixed(1)} GB Quota` : `${maxStorageLimitGb} GB Limit`;
      if (textEl) textEl.textContent = `${usageMb < 1000 ? usageMb.toFixed(1) + ' MB' : usageGb.toFixed(2) + ' GB'} / ${limitDisplay}`;

      let pct = 0;
      if (maxStorageLimitGb === 'unlimited') {
        pct = quotaGb > 0 ? (usageGb / quotaGb) * 100 : 0;
      } else {
        pct = (usageGb / parseFloat(maxStorageLimitGb)) * 100;
      }
      if (barEl) barEl.style.width = `${Math.min(100, Math.max(2, pct))}%`;
    } catch (err) {
      if (textEl) textEl.textContent = 'Storage Estimate Unavailable';
    }
  } else if (textEl) {
    textEl.textContent = 'Storage API Unsupported';
  }
}

window.maxStorageLimitGb = maxStorageLimitGb;
window.updateStorageGauge = updateStorageGauge;
