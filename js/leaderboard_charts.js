/**
 * Plotly Visualizations & Leaderboard Charts Subsystem
 */

function renderPinkAccumulationChart(containerId, timelineData = []) {
  const container = document.getElementById(containerId);
  if (!container || !window.Plotly) return;

  if (timelineData.length === 0) {
    container.innerHTML = `<div class="empty-state">No date-tagged media found to display accumulation.</div>`;
    return;
  }

  const dates = timelineData.map(d => d.date);
  const counts = timelineData.map(d => d.cumulativePinkHearts);
  const pts = timelineData.map(d => d.cumulativePinkPts);

  const trace1 = { x: dates, y: counts, name: 'Total 🩷 Pink Hearts', type: 'scatter', mode: 'lines+markers', fill: 'tozeroy', line: { color: '#ff69b4', width: 3 } };
  const trace2 = { x: dates, y: pts, name: 'Pink Heart Points', type: 'scatter', mode: 'lines+markers', line: { color: '#a855f7', width: 2, dash: 'dot' } };

  const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, margin: { l: 40, r: 20, t: 20, b: 40 } };
  window.Plotly.newPlot(containerId, [trace1, trace2], layout, { responsive: true, displayModeBar: false });
}

function renderSubjectLeaderboardChart(containerId, subjectStats = []) {
  const container = document.getElementById(containerId);
  if (!container || !window.Plotly) return;

  if (subjectStats.length === 0) { container.innerHTML = `<div class="empty-state">No subject stats recorded.</div>`; return; }

  const top = subjectStats.slice(0, 10).reverse();
  const names = top.map(s => getSubjectDisplayName(s.subject));
  const heartPts = top.map(s => s.heartPoints);
  const eventPts = top.map(s => s.eventPoints);

  const trace1 = { x: heartPts, y: names, name: 'Heart Points', type: 'bar', orientation: 'h', marker: { color: '#ff69b4' } };
  const trace2 = { x: eventPts, y: names, name: 'Event Points', type: 'bar', orientation: 'h', marker: { color: '#38bdf8' } };

  const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, barmode: 'stack', margin: { l: 100, r: 20, t: 20, b: 40 } };
  window.Plotly.newPlot(containerId, [trace1, trace2], layout, { responsive: true, displayModeBar: false });
}

function renderCombinationsChart(containerId, combinations = []) {
  const container = document.getElementById(containerId);
  if (!container || !window.Plotly) return;
  if (combinations.length === 0) { container.innerHTML = `<div class="empty-state">No subject combinations found.</div>`; return; }

  const top = combinations.slice(0, 8).reverse();
  const names = top.map(c => c.name);
  const pts = top.map(c => c.totalPoints);

  const trace = { x: pts, y: names, type: 'bar', orientation: 'h', marker: { color: pts, colorscale: 'Viridis' } };
  const layout = { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent', font: { color: '#94a3b8' }, margin: { l: 140, r: 20, t: 20, b: 40 } };
  window.Plotly.newPlot(containerId, [trace], layout, { responsive: true, displayModeBar: false });
}

window.renderPinkAccumulationChart = renderPinkAccumulationChart;
window.renderSubjectLeaderboardChart = renderSubjectLeaderboardChart;
window.renderCombinationsChart = renderCombinationsChart;
