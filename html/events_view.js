/* Events List View Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <section id="eventsView" class="view-page">
      <div class="page-header">
        <div class="page-title-group">
          <h1>📙 Life Events</h1>
          <p></p>
        </div>
        <div class="page-actions">
          <div class="date-autocomplete-container" style="min-width:240px;">
            <input type="text" id="inlineEventDateInput" class="input-text" placeholder="+ Create Event Date (e.g. 630)..." style="width:100%;">
            <div id="inlineEventDateAutocomplete" class="date-autocomplete-dropdown"></div>
          </div>
        </div>
      </div>

      <!-- Events Sorting & Toolbar -->
      <div class="sorting-toolbar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:16px; background:var(--bg-secondary); padding:10px 14px; border-radius:var(--radius-md); border:1px solid var(--border-color);">
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1;">
          <input type="text" id="eventsSearchInput" class="input-text btn-sm" placeholder="🔍 Search events (e.g. jenny+AI, -party, >091201)..." style="min-width:200px; flex:1;">
          <span style="font-weight:700; font-size:0.85rem; color:var(--text-secondary);">🔀 Sort Events:</span>
          <button class="btn btn-secondary btn-sm evt-sort-btn active-sort" data-sort="date">📅 Date</button>
          <button class="btn btn-secondary btn-sm evt-sort-btn" data-sort="points">⚡ Total Points</button>
          <button class="btn btn-secondary btn-sm evt-sort-btn" data-sort="water">💦 Total</button>
          <button class="btn btn-secondary btn-sm evt-sort-btn" data-sort="subject">👤 Subject Name</button>
        </div>
        <div id="eventsSelectionInfo" style="font-size:0.85rem; font-weight:700; color:var(--accent-pink);"></div>
      </div>

      <!-- Events Cards Container -->
      <div id="eventsGridContainer" class="events-cards-grid"></div>
    </section>
  `);
})();
