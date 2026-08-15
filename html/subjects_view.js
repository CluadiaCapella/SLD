/* Subjects List View Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <section id="subjectsView" class="view-page">
      <div class="page-header">
        <div class="page-title-group">
          <h1>👥 Subjects</h1>
          <p>Subject profiles, groups, and rankings.</p>
        </div>
        <div class="page-actions" style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <button class="btn btn-primary" id="openAddSubjectBtn">+ Add Subject</button>
          <select id="batchSubjectGroupSelect" class="select-input btn-sm" style="display:none; font-size:0.85rem;">
            <option value="">🎨 Change Group for Selected...</option>
          </select>
          <button class="btn btn-secondary btn-sm" id="batchSubjectTagsBtn" style="display:none;">🏷️ Tags</button>
          <div class="dropdown-container" id="subjectBatchMenuContainer" style="display:none; position:relative;">
            <button class="btn btn-secondary btn-sm" id="subjectBatchMenuBtn">•••</button>
            <div class="dropdown-menu" id="subjectBatchDropdown" style="display:none; position:absolute; right:0; top:100%; z-index:10; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:6px; min-width:150px; box-shadow:var(--shadow-md);">
              <button class="btn btn-danger btn-sm" id="batchDeleteSubjectsBtn" style="width:100%; text-align:left;">🗑️ Delete Selected</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab Buttons for Subjects vs. Combos -->
      <div class="tabs-nav" style="display:flex; gap:12px; margin-bottom:20px; border-bottom:2px solid var(--border-color); padding-bottom:8px;">
        <button class="btn btn-secondary btn-md subject-tab-btn active" data-tab="subjects" style="font-size:1rem; font-weight:800; padding:8px 20px;">👥 Subjects</button>
        <button class="btn btn-secondary btn-md subject-tab-btn" data-tab="combos" style="font-size:1rem; font-weight:800; padding:8px 20px;">🫂 Combos</button>
      </div>

      <div class="sorting-toolbar" style="margin-bottom: 20px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; background: var(--bg-card); padding: 12px; border-radius: var(--radius-md); border: 1px solid var(--border-color);">
        <input type="text" id="subjectsSearchInput" class="input-text btn-sm" placeholder="🔍 Search subjects (e.g. jenny+AI, -female)..." style="min-width:180px; flex:1;">
        <span class="text-muted" style="font-size:0.85rem; font-weight:700;">Sort by:</span>
        <button class="btn btn-secondary btn-sm subject-sort-btn active" data-sort="name" data-dir="asc">👤 Name ▲</button>
        <button class="btn btn-secondary btn-sm subject-sort-btn" data-sort="totalPoints" data-dir="desc">🏆 Total Pts</button>
        <button class="btn btn-secondary btn-sm subject-sort-btn" data-sort="eventPoints" data-dir="desc">📙 Life Pts</button>
        <button class="btn btn-secondary btn-sm subject-sort-btn" data-sort="eventDate" data-dir="desc">🗓️ Life Date</button>
        <button class="btn btn-secondary btn-sm subject-sort-btn" data-sort="pink" data-dir="desc">🩷 Pts</button>
        <button class="btn btn-secondary btn-sm subject-sort-btn" data-sort="grey" data-dir="desc">🩶 Pts</button>
        <button class="btn btn-secondary btn-sm subject-sort-btn" data-sort="blue" data-dir="desc">🩵 Pts</button>
        <span id="subjectSelectionCount" style="margin-left:auto; font-size:0.85rem; font-weight:700; color:var(--accent-pink); display:none;"></span>
      </div>

      <div class="subjects-container">
        <!-- Subjects Grid -->
        <div class="media-grid" id="subjectCardsGrid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px;"></div>

        <!-- 1. Subject Leaderboards Section -->
        <div id="subjectLeaderboardsSection">
          <h2 style="margin-top:40px; margin-bottom:16px; font-size:1.4rem; font-weight:800; border-bottom:1px solid var(--border-color); padding-bottom:8px;">🏆 Subject Points Leaderboards</h2>
          <div class="leaderboard-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:20px;">
            <div class="leaderboard-card">
              <h3>📙 Life</h3>
              <div id="eventPointsLeaderboard" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
            <div class="leaderboard-card">
              <h3>📘 SLD</h3>
              <div id="sldLeaderboard" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
            <div class="leaderboard-card">
              <h3>🩷</h3>
              <div id="pinkHeartLeaderboard" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
            <div class="leaderboard-card">
              <h3>🩵</h3>
              <div id="blueHeartLeaderboard" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
            <div class="leaderboard-card">
              <h3>🩶</h3>
              <div id="greyHeartLeaderboard" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
          </div>
        </div>

        <!-- 2. Companion Leaderboards Section -->
        <div id="comboLeaderboardsSection" style="display:none;">
          <h2 style="margin-top:40px; margin-bottom:16px; font-size:1.4rem; font-weight:800; border-bottom:1px solid var(--border-color); padding-bottom:8px;">⚡ Companion Points Leaderboards</h2>
          <div class="leaderboard-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:20px;">
            <div class="leaderboard-card">
              <h3>📙 Life</h3>
              <div id="comboEventLb" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
            <div class="leaderboard-card">
              <h3>📘 SLD</h3>
              <div id="comboSldLb" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
            <div class="leaderboard-card">
              <h3>🩷</h3>
              <div id="comboPinkLb" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
            <div class="leaderboard-card">
              <h3>🩵</h3>
              <div id="comboBlueLb" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
            <div class="leaderboard-card">
              <h3>🩶</h3>
              <div id="comboGreyLb" style="display:flex; flex-direction:column; gap:8px;"></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `);
})();
