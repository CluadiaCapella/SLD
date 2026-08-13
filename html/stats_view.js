/* Stats View Component Template */
(function() {
  const container = document.querySelector('main.main-content');
  if (!container) return;
  container.insertAdjacentHTML('beforeend', `
    <section id="statsView" class="view-page">
      <div class="page-header">
        <div class="page-title-group">
          <h1>📊 Derived Data & Analytics</h1>
          <p>Dynamic charts and accumulation analytics.</p>
        </div>
      </div>

      <div class="stats-overview-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:16px; margin-bottom:24px;">
        <div class="stat-card">
          <div class="stat-card-title">Total 🩷🥇 3 Pink Hearts</div>
          <div class="stat-card-number" id="statTotal3Pinks" style="color:var(--accent-pink);">0</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-title">Highest 🩶 Grey Heart Score</div>
          <div id="greyLeaderCard" style="display:flex; align-items:center; gap:12px; margin-top:8px;"></div>
        </div>
      </div>

      <div class="charts-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px;">
        <div class="chart-card">
          <h3>🩷 Pink Heart Accumulation Timeline</h3>
          <div id="pinkAccumulationChart" style="height:320px;"></div>
        </div>
        <div class="chart-card">
          <h3>🏆 Top 10 Subject Leaderboard</h3>
          <div id="subjectLeaderboardChart" style="height:320px;"></div>
        </div>
        <div class="chart-card full-width">
          <h3>⚡ Subject Combinations Score</h3>
          <div id="combinationsChart" style="height:320px;"></div>
        </div>
      </div>
    </section>
  `);
})();
