/* Archive Progress Modal Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <div id="archiveProgressModal" class="modal-backdrop" style="display:none;">
      <div class="modal-card" style="max-width:450px; width:90%; text-align:center; padding:24px;">
        <div style="font-size:2.5rem; margin-bottom:12px;" id="archiveProgressSpinner">📦</div>
        <h3 id="archiveProgressTitle" style="font-weight:800; margin-bottom:8px;">Packaging Archive...</h3>
        <p class="text-muted" id="archiveProgressMessage" style="font-size:0.85rem; margin-bottom:16px;">Preparing files for packaging. Please wait...</p>
        <div style="background:var(--bg-secondary); border-radius:var(--radius-md); height:12px; overflow:hidden; border:1px solid var(--border-color); margin-bottom:12px;">
          <div id="archiveProgressBar" style="width:0%; height:100%; background:linear-gradient(90deg, var(--accent-pink), var(--accent-blue)); transition:width 0.2s ease;"></div>
        </div>
        <div id="archiveProgressPercent" style="font-weight:800; font-size:1rem; color:var(--accent-blue);">0%</div>
        <p class="text-muted" style="font-size:0.75rem; margin-top:12px; margin-bottom:0;">⚠️ Packaging takes time for large datasets. The download prompt will appear once completed.</p>
      </div>
    </div>
  `);
})();
