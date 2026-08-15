/* Media Browser View Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <section id="mediaBrowserView" class="view-page active">
      <div class="page-header">
        <div class="page-title-group">
          <h1>🖼️ Media Browser</h1>
          <p></p>
        </div>
        <div class="page-actions" style="display:flex; gap:8px; flex-wrap:wrap;">
          <label class="btn btn-accent-blue" style="cursor:pointer;" title="📷 Add Files / Photos">
            📷
            <input type="file" id="mediaFileInput" multiple accept="image/*,video/*" style="display:none;">
          </label>
          <label class="btn btn-secondary" id="mediaFolderInputLabel" style="cursor:pointer;" title="📁 Add Folder">
            📁
            <input type="file" id="mediaFolderInput" webkitdirectory directory multiple style="display:none;">
          </label>
        </div>
      </div>

      <!-- Media Toolbar Search, Filter & Sort -->
      <div class="media-toolbar">
        <div class="search-filter-group" style="flex-wrap:wrap;">
          <input type="text" id="mediaSearchInput" class="input-text" placeholder="Search filenames, tags, subjects (e.g. AI+jenny, -bob, <5 stars, >091201)..." style="flex:1; min-width:140px;">
          <button class="btn btn-secondary active-sort" id="toggleMediaRatingsBtn" title="⭐ Show Star Ratings">⭐</button>
          <button class="btn btn-secondary active-sort" id="toggleMediaGroupBtn" title="⚪ Show Subject Grouping">⚪</button>
          <button class="btn btn-secondary active-sort" id="aiFilterToggleBtn" title="🖼️🤖 Show All, Normal Only or AI Only Media">🖼️</button>
          <select id="mediaFilterTagSelect" class="select-input active-sort">
            <option value="all">All Media</option>
            <option value="star5">⭐⭐⭐⭐⭐ 5 Stars</option>
            <option value="star4">⭐⭐⭐⭐ 4 Stars</option>
            <option value="star3">⭐⭐⭐ 3 Stars</option>
            <option value="star2">⭐⭐ 2 Stars</option>
            <option value="star1">⭐ 1 Star</option>
            <option value="star0">☆ 0 Stars (Unrated)</option>
            <option value="rejected">🚫 Rejected</option>
            <option value="hasBlueEvents">📘 Has SLD Event</option>
            <option value="hasSubjects">Has Subject Tags</option>
            <option value="noSubjects">No Subject Tags</option>
          </select>
          <div style="display:inline-flex; align-items:center; gap:6px; background:var(--bg-secondary); border:1px solid var(--border-color); padding:4px 10px; border-radius:var(--radius-md);">
            <span style="font-size:0.8rem; font-weight:700;">🔍 Size:</span>
            <input type="range" id="globalThumbSizeSlider" min="50" max="200" step="5" value="200" style="width:70px;height:25px; cursor:pointer;">
            <span id="globalThumbSizeVal" style="font-size:0.75rem; font-weight:800; min-width:38px; color:var(--accent-blue);">200px</span>
          </div>
        </div>
        <!-- 3-Deep Cascade Sort Toggle Buttons -->
        <div id="mediaSortButtonsToolbar" style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">
          <button type="button" class="btn btn-secondary btn-sm sort-toggle-btn" data-key="date" title="📅 Date Sort">📅</button>
          <button type="button" class="btn btn-secondary btn-sm sort-toggle-btn" data-key="subject" title="👤 Subject Sort">👤</button>
          <button type="button" class="btn btn-secondary btn-sm sort-toggle-btn" data-key="totalPts" title="📘 Sort">⭐</button>
          <button type="button" class="btn btn-secondary btn-sm sort-toggle-btn" data-key="pinkPts" title="🩷 Sort">🩷</button>
          <button type="button" class="btn btn-secondary btn-sm sort-toggle-btn" data-key="greyPts" title="🩶 Sort">🩶</button>
          <button type="button" class="btn btn-secondary btn-sm sort-toggle-btn" data-key="bluePts" title="🩵 Sort">🩵</button>
        </div>
      </div>

      <!-- Sticky Multi-Selection Floating Action Bar with Inline Tagging -->
      <div id="selectionBanner" class="selection-banner-sticky" style="display:none; flex-direction:column; gap:10px; width:95%; max-width:1100px;">
        <div style="display:flex; align-items:center; justify-content:space-between; width:100%; flex-wrap:wrap; gap:8px;">
          <span id="selectedCount" style="font-weight:800; font-size:0.95rem;">0 file(s) selected</span>
          <div class="selection-actions" style="display:flex; align-items:center; gap:8px;">
            <button class="btn btn-secondary btn-sm" id="toggleSelectionAiBtn">🤖 AI</button>
            <div class="dropdown-container" id="mediaBatchMenuContainer" style="position:relative;">
              <button class="btn btn-secondary btn-sm" id="mediaBatchMenuBtn">•••</button>
              <div class="dropdown-menu" id="mediaBatchDropdown" style="display:none; position:absolute; right:0; top:100%; z-index:10; background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:6px; min-width:160px; box-shadow:var(--shadow-md);">
                <button class="btn btn-secondary btn-sm" id="exportSelectedMediaBtn" style="width:100%; text-align:left; margin-bottom:4px;">📥 Export Selected Files</button>
                <button class="btn btn-danger btn-sm" id="deleteSelectedMediaBtn" style="width:100%; text-align:left;">🗑️ Delete Selected</button>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" id="clearSelectionBtn">✖ Clear Selection</button>
          </div>
        </div>

        <!-- Inline Tagging Fields directly inside Selection Banner -->
        <div style="display:flex; flex-wrap:wrap; gap:8px; width:100%; align-items:center; background:rgba(0,0,0,0.25); padding:8px; border-radius:var(--radius-md);">
          <div class="subject-autocomplete-container" style="flex:1; min-width:120px; position:relative;">
            <input type="text" id="inlineSubjectInput" class="input-text btn-sm" placeholder="+ Subject..." style="width:100%;">
            <div id="inlineSubjectAutocomplete" class="subject-autocomplete-dropdown"></div>
          </div>

          <div class="tag-autocomplete-container" style="flex:1; min-width:120px; position:relative;">
            <input type="text" id="inlineNormalTagInput" class="input-text btn-sm" placeholder="+ Normal Tag..." style="width:100%;">
            <div id="inlineNormalTagAutocomplete" class="tag-autocomplete-dropdown"></div>
          </div>

          <div class="date-autocomplete-container" style="flex:1; min-width:110px; position:relative;">
            <input type="text" id="inlineSldInput" class="input-text btn-sm" placeholder="+ SLD Date..." style="width:100%;">
            <div id="inlineSldAutocomplete" class="date-autocomplete-dropdown"></div>
          </div>

          <div class="subject-autocomplete-container" style="flex:1; min-width:150px; position:relative;">
            <input type="text" id="inlineAlikeInput" class="input-text btn-sm" placeholder="+ 🪞 Alike (Sub::faint)..." style="width:100%;">
            <div id="inlineAlikeAutocomplete" class="subject-autocomplete-dropdown"></div>
          </div>
        </div>

        <div id="selectionInlineTagsChips" style="display:flex; flex-wrap:wrap; gap:6px; width:100%;"></div>
      </div>

      <!-- Popup Modal for Multi-Selection Tagging & Inspection -->
      <div id="multiSelectTagsModal" class="modal-backdrop" style="display:none; align-items:flex-start; padding-top:60px;">
        <div class="modal-card" style="max-width:700px; width:90%; max-height:80vh; display:flex; flex-direction:column;">
          <div class="modal-header">
            <h3>🏷️ Batch Tagging & File Details</h3>
            <button class="btn btn-secondary btn-sm" id="closeMultiSelectTagsBtn">✖ Close</button>
          </div>
          <div class="modal-body" style="overflow-y:auto; flex:1;">
            <div id="selectionTagsPanel"></div>
            
            <div style="margin-top:16px; display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
              <div class="form-group">
                <label class="form-label">+ Add SLD Event Date</label>
                <div class="date-autocomplete-container">
                  <input type="text" id="panelSldInput" class="input-text btn-sm" placeholder="e.g. 630 (Enter)..." style="width:100%;">
                  <div id="panelSldAutocomplete" class="date-autocomplete-dropdown"></div>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">+ Add Subject Tag</label>
                <div class="subject-autocomplete-container">
                  <input type="text" id="panelSubjectInput" class="input-text btn-sm" placeholder="Subject name..." style="width:100%;">
                  <div id="panelSubjectAutocomplete" class="subject-autocomplete-dropdown"></div>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">+ Add Standard Tag</label>
                <div class="tag-autocomplete-container">
                  <input type="text" id="panelNormalTagInput" class="input-text btn-sm" placeholder="Tag name..." style="width:100%;">
                  <div id="panelNormalTagAutocomplete" class="tag-autocomplete-dropdown"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Media Cards Grid -->
      <div class="media-grid" id="mediaGrid"></div>

      <!-- Pagination Footer -->
      <div id="mediaPaginationContainer" class="pagination-footer" style="display:none;">
        <button class="btn btn-secondary btn-sm" id="prevPageBtn">‹ Previous Page</button>
        <span id="paginationInfo" class="text-muted" style="font-size:0.85rem;"></span>
        <button class="btn btn-secondary btn-sm" id="nextPageBtn">Next Page ›</button>
      </div>
    </section>
  `);
})();
