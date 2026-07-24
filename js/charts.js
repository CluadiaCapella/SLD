/**
 * Plotly.js Interactive Charts Engine
 */

export function renderPinkAccumulationChart(containerId, timelineData = []) {
  const container = document.getElementById(containerId);
  if (!container || !window.Plotly) return;

  if (timelineData.length === 0) {
    container.innerHTML = `<div class="empty-state">No date-tagged media found to display accumulation timeline.</div>`;
    return;
  }

  const dates = timelineData.map(d => d.date);
  const cumulativeCount = timelineData.map(d => d.cumulativePinkHearts);
  const cumulativePts = timelineData.map(d => d.cumulativePinkPts);

  const trace1 = {
    x: dates,
    y: cumulativeCount,
    name: 'Total 💖 Pink Hearts',
    type: 'scatter',
    mode: 'lines+markers',
    fill: 'tozeroy',
    line: { color: '#ec4899', width: 3 },
    marker: { size: 8, color: '#ec4899' }
  };

  const trace2 = {
    x: dates,
    y: cumulativePts,
    name: 'Pink Heart Points',
    type: 'scatter',
    mode: 'lines+markers',
    line: { color: '#a855f7', width: 2, dash: 'dot' },
    marker: { size: 6, color: '#a855f7' }
  };

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#94a3b8', family: 'Inter, sans-serif' },
    margin: { l: 40, r: 20, t: 20, b: 40 },
    xaxis: { gridcolor: 'rgba(255,255,255,0.05)', title: 'Date' },
    yaxis: { gridcolor: 'rgba(255,255,255,0.05)', title: 'Count / Points' },
    legend: { orientation: 'h', y: 1.15 },
    autosize: true
  };

  const config = { responsive: true, displayModeBar: false };
  window.Plotly.newPlot(containerId, [trace1, trace2], layout, config);
}

export function renderSubjectLeaderboardChart(containerId, subjectStats = []) {
  const container = document.getElementById(containerId);
  if (!container || !window.Plotly) return;

  if (subjectStats.length === 0) {
    container.innerHTML = `<div class="empty-state">No subject statistics available yet.</div>`;
    return;
  }

  const topSubjects = subjectStats.slice(0, 10).reverse(); // Top 10
  const names = topSubjects.map(s => s.subject.name);
  const heartPts = topSubjects.map(s => s.heartPoints);
  const eventPts = topSubjects.map(s => s.eventPoints);

  const traceHeart = {
    x: heartPts,
    y: names,
    name: 'Heart Points',
    type: 'bar',
    orientation: 'h',
    marker: { color: '#ec4899' }
  };

  const traceEvent = {
    x: eventPts,
    y: names,
    name: 'Event Points',
    type: 'bar',
    orientation: 'h',
    marker: { color: '#38bdf8' }
  };

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#94a3b8', family: 'Inter, sans-serif' },
    barmode: 'stack',
    margin: { l: 100, r: 20, t: 20, b: 40 },
    xaxis: { gridcolor: 'rgba(255,255,255,0.05)', title: 'Total Points' },
    yaxis: { gridcolor: 'transparent' },
    legend: { orientation: 'h', y: 1.15 },
    autosize: true
  };

  const config = { responsive: true, displayModeBar: false };
  window.Plotly.newPlot(containerId, [traceHeart, traceEvent], layout, config);
}

export function renderCombinationsChart(containerId, combinations = []) {
  const container = document.getElementById(containerId);
  if (!container || !window.Plotly) return;

  if (combinations.length === 0) {
    container.innerHTML = `<div class="empty-state">No subject combinations found.</div>`;
    return;
  }

  const topCombos = combinations.slice(0, 8).reverse();
  const comboNames = topCombos.map(c => c.name);
  const comboPts = topCombos.map(c => c.totalPoints);

  const trace = {
    x: comboPts,
    y: comboNames,
    type: 'bar',
    orientation: 'h',
    marker: {
      color: comboPts,
      colorscale: 'Viridis'
    }
  };

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#94a3b8', family: 'Inter, sans-serif' },
    margin: { l: 140, r: 20, t: 20, b: 40 },
    xaxis: { gridcolor: 'rgba(255,255,255,0.05)', title: 'Combined Points' },
    yaxis: { gridcolor: 'transparent' },
    autosize: true
  };

  const config = { responsive: true, displayModeBar: false };
  window.Plotly.newPlot(containerId, [trace], layout, config);
}
