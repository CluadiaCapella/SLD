/**
 * Media Thumbnail Renderer & Heart Points Calculations Engine
 */

function renderMediaThumbnailHTML(m, customClass = 'media-thumbnail') {
  if (m.customThumbnail) {
    return `<img src="${m.customThumbnail}" class="${customClass}" alt="${m.filename}">`;
  }
  if (m.thumbnailUrl) {
    return `<img src="${m.thumbnailUrl}" class="${customClass}" alt="${m.filename}">`;
  }
  if (m.type?.startsWith('video')) {
    return `<video src="${m.dataUrl}#t=0.5" class="${customClass}" muted preload="metadata"></video>`;
  }
  return `<img src="${m.dataUrl}" class="${customClass}" alt="${m.filename}">`;
}

function getHeartPointsForCount(count) {
  if (count === 1) return currentMedalSettings.bronzePts ?? 0.1;
  if (count === 2) return currentMedalSettings.silverPts ?? 0.3;
  if (count === 3) return currentMedalSettings.goldPts ?? 1.0;
  return 0;
}

function calculateMediaHeartPoints(media) {
  let pinkPts = 0, greyPts = 0, bluePts = 0, totalHeartPts = 0;
  const events = media.blueBookEvents || [];

  for (const be of events) {
    if (be.heartTags) {
      pinkPts += getHeartPointsForCount(be.heartTags.pink || 0);
      greyPts += getHeartPointsForCount(be.heartTags.grey || 0);
      bluePts += getHeartPointsForCount(be.heartTags.blue || 0);
    }
  }
  totalHeartPts = pinkPts + greyPts + bluePts;
  return { pinkPts, greyPts, bluePts, totalHeartPts };
}

function calculateEventPointsForSubject(eventCode, cCount, weights) {
  if (!cCount || cCount <= 0) return 0;
  const codePts = currentActionPointsMap[eventCode] ?? (DEFAULT_ACTION_POINTS[eventCode] || 0.1);
  const raw = (cCount * (weights.eventCCount ?? 10)) + (codePts * 10);
  return Math.round(raw * 100) / 100;
}

window.renderMediaThumbnailHTML = renderMediaThumbnailHTML;
window.getHeartPointsForCount = getHeartPointsForCount;
window.calculateMediaHeartPoints = calculateMediaHeartPoints;
window.calculateEventPointsForSubject = calculateEventPointsForSubject;
