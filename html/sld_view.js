/* SLD Events List View Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <section id="sldView" class="view-page">
      <div class="page-header">
        <div class="page-title-group">
          <h1>📘 SLDs</h1>
          <p></p>
        </div>
      </div>

      <!-- Sorting & Filter Toolbar -->
      <div class="sorting-toolbar" style="margin-bottom: 20px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <span class="text-muted" style="font-size:0.85rem; font-weight:700;">Sort by:</span>
        <button type="button" class="btn btn-secondary btn-sm sld-sort-btn active" data-sort="date" data-dir="desc">📅 Date ▲</button>
        <button type="button" class="btn btn-secondary btn-sm sld-sort-btn" data-sort="files" data-dir="desc">📘 Files</button>
        
        <div style="margin-left:auto; display:flex; align-items:center; gap:8px; min-width:240px;">
          <input type="text" id="sldFilterInput" class="input-text btn-sm" placeholder="🔍 Filter SLD by file, subject, tag..." style="width:100%;">
        </div>
      </div>

      <div id="sldCardsContainer" style="display:flex; flex-wrap:wrap; gap:20px; align-items:flex-start; width:100%;"></div>
    </section>
  `);
})();
