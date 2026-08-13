/* Upload Progress Modal Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <div id="uploadProgressModal" class="modal-backdrop" style="display:none; z-index:10000;">
      <div class="modal-card" style="max-width:450px; width:90%; text-align:center; padding:24px;">
        <div style="font-size:2.5rem; margin-bottom:12px; animation: pulse 1.5s infinite;">📤</div>
        <h3 id="uploadProgressTitle" style="font-weight:800; margin-bottom:8px;">Uploading Media Files...</h3>
        <p class="text-muted" id="uploadProgressMessage" style="font-size:0.85rem; margin-bottom:16px;">Scanning and importing selected files...</p>
        <div style="background:var(--bg-secondary); border-radius:var(--radius-md); height:14px; overflow:hidden; border:1px solid var(--border-color); margin-bottom:12px;">
          <div id="uploadProgressBar" style="width:0%; height:100%; background:linear-gradient(90deg, var(--accent-blue), var(--accent-pink)); transition:width 0.15s ease;"></div>
        </div>
        <div id="uploadProgressPercent" style="font-weight:800; font-size:1.1rem; color:var(--accent-pink);">0%</div>
        <p class="text-muted" style="font-size:0.75rem; margin-top:12px; margin-bottom:0;">Processing media & generating thumbnails...</p>
      </div>
    </div>
  `);
})();
