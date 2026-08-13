/* Tags View Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <section id="tagsView" class="view-page">
      <div class="page-header">
        <div class="page-title-group">
          <h1>🏷️ Tags & Actions</h1>
          <p>Browse action tags (1-12) and established normal tags.</p>
        </div>
      </div>

      <div class="chart-card" style="margin-bottom:24px;">
        <h3>👄 Zodiacs</h3>
        <div id="actionTagsContainer" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;"></div>
      </div>

      <div class="chart-card" style="margin-bottom:24px;">
        <h3>⚡ Actions</h3>
        <p class="text-muted" style="font-size:0.85rem;">Bonus sub-actions and challenges with point modifiers:</p>
        <div id="subActionTagsContainer" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;"></div>
      </div>

      <div class="chart-card">
        <h3>🏷️ Normal Tags</h3>
        <div id="normalTagsContainer" style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;"></div>
      </div>
    </section>

    <section id="tagDetailsView" class="view-page">
      <div id="tagDetailsContent"></div>
    </section>
  `);
})();
