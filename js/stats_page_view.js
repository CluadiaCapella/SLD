/**
 * Stats Page View & Analytics Visualizer
 */

function renderStatsPage(stats) {
  document.getElementById('statTotal3Pinks').textContent = stats.total3PinkHearts;
  const leaderCard = document.getElementById('greyLeaderCard');
  if (stats.greyHeartLeader) {
    leaderCard.innerHTML = `
      <div style="width:60px; height:60px;">${renderMediaThumbnailHTML(stats.greyHeartLeader)}</div>
      <div><div>${stats.greyHeartLeader.filename}</div><div class="text-muted">Grey Heart Score: <strong>${stats.maxGreyPts} pts</strong></div></div>`;
  } else {
    leaderCard.innerHTML = `<span class="text-muted">No grey heart tags recorded.</span>`;
  }

  renderPinkAccumulationChart('pinkAccumulationChart', stats.timelineData);
  renderSubjectLeaderboardChart('subjectLeaderboardChart', stats.allSubjectStats);
  renderCombinationsChart('combinationsChart', stats.allCombinations);
}

window.renderStatsPage = renderStatsPage;
