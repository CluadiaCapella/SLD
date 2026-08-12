/**
 * Section 4: Scoring & Statistics Engine (Medal Points, Action Points, Subject Stats & Combinations)
 */

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

function processAllStats(mediaList = [], subjectsList = [], eventsList = [], weights = {}) {
  const defaultWeights = { heart1: 1, heart2: 3, heart3: 10, eventCCount: 10, eventTag: 1, ...weights };

  let total3PinkHearts = 0;
  let maxGreyPts = -1;
  let greyHeartLeader = null;
  const pinkAccumulationByDate = new Map();
  const mediaStatsMap = new Map();

  for (const m of mediaList) {
    const pts = calculateMediaHeartPoints(m);
    mediaStatsMap.set(m.id, pts);

    const has3Pink = (m.blueBookEvents || []).some(be => be.heartTags?.pink === 3);
    if (has3Pink) total3PinkHearts++;

    if (pts.greyPts > maxGreyPts && pts.greyPts > 0) {
      maxGreyPts = pts.greyPts;
      greyHeartLeader = m;
    }

    for (const be of (m.blueBookEvents || [])) {
      if (be.dateTag) {
        const isoDate = convertDateTagToIso(be.dateTag).split('T')[0];
        const pinkCount = be.heartTags?.pink || 0;
        const pPts = getHeartPointsForCount(pinkCount);

        const existing = pinkAccumulationByDate.get(isoDate) || { pinkCount: 0, pinkPts: 0 };
        pinkAccumulationByDate.set(isoDate, {
          pinkCount: existing.pinkCount + pinkCount,
          pinkPts: existing.pinkPts + pPts
        });
      }
    }
  }

  const sortedDates = Array.from(pinkAccumulationByDate.keys()).sort();
  let cumulativePinkHearts = 0;
  let cumulativePinkPts = 0;
  const timelineData = sortedDates.map(date => {
    const entry = pinkAccumulationByDate.get(date);
    cumulativePinkHearts += entry.pinkCount;
    cumulativePinkPts += entry.pinkPts;
    return { date, dailyPinkCount: entry.pinkCount, dailyPinkPts: entry.pinkPts, cumulativePinkHearts, cumulativePinkPts };
  });

  const subjectStatsMap = new Map();
  for (const s of subjectsList) {
    subjectStatsMap.set(s.id, {
      subject: s,
      heartPoints: 0,
      pinkPoints: 0,
      greyPoints: 0,
      bluePoints: 0,
      eventPoints: 0,
      totalPoints: 0,
      mediaCount: 0,
      eventsCount: 0,
      totalCCount: 0,
      latestEventDate: null,
      coOccurrences: new Map()
    });
  }

  for (const m of mediaList) {
    const pts = mediaStatsMap.get(m.id) || { totalHeartPts: 0, pinkPts: 0, greyPts: 0, bluePts: 0 };
    const tags = m.subjectTags || [];

    for (const subId of tags) {
      const sStat = subjectStatsMap.get(subId);
      if (sStat) {
        sStat.heartPoints += pts.totalHeartPts;
        sStat.pinkPoints += pts.pinkPts || 0;
        sStat.greyPoints += pts.greyPts || 0;
        sStat.bluePoints += pts.bluePts || 0;
        sStat.mediaCount++;

        for (const otherId of tags) {
          if (otherId !== subId) {
            sStat.coOccurrences.set(otherId, (sStat.coOccurrences.get(otherId) || 0) + 1);
          }
        }
      }
    }
  }

  for (const e of eventsList) {
    const subCounts = e.subjectCounts || {};
    const code = e.eventCode || 1;
    const parsedDate = e.dateTag ? convertDateTagToIso(e.dateTag) : null;
    for (const subId of Object.keys(subCounts)) {
      const cCount = subCounts[subId] || 0;
      const evtPts = calculateEventPointsForSubject(code, cCount, defaultWeights);
      const sStat = subjectStatsMap.get(subId);
      if (sStat) {
        sStat.eventPoints += evtPts;
        sStat.eventsCount++;
        sStat.totalCCount += cCount;
        if (parsedDate) {
          if (!sStat.latestEventDate || parsedDate > sStat.latestEventDate) {
            sStat.latestEventDate = parsedDate;
          }
        }
      }
    }
  }

  const allSubjectStats = Array.from(subjectStatsMap.values()).map(stat => {
    stat.totalPoints = Math.round((stat.heartPoints + stat.eventPoints) * 100) / 100;
    return stat;
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  const firstMetMap = new Map();
  const sortedEventsByDate = eventsList.slice().sort((a, b) => convertDateTagToIso(a.dateTag || '').localeCompare(convertDateTagToIso(b.dateTag || '')));

  for (const e of sortedEventsByDate) {
    const subCounts = e.subjectCounts || {};
    const presentIds = Object.keys(subCounts).filter(id => (subCounts[id] || 0) > 0);
    if (presentIds.length >= 2) {
      for (let i = 0; i < presentIds.length; i++) {
        for (let j = i + 1; j < presentIds.length; j++) {
          const pairKey = [presentIds[i], presentIds[j]].sort().join('::');
          if (!firstMetMap.has(pairKey)) {
            firstMetMap.set(pairKey, { eventId: e.id, dateTag: e.dateTag || e.date });
          }
        }
      }
    }
  }

  const combinationMap = new Map();
  for (const m of mediaList) {
    const rawTags = (m.subjectTags || []).slice();
    const tags = Array.from(new Set(rawTags)).sort();
    if (tags.length >= 2 && tags[0] !== tags[1]) {
      const pts = mediaStatsMap.get(m.id) || { totalHeartPts: 0, pinkPts: 0, greyPts: 0, bluePts: 0 };
      const comboKey = tags.join('::');
      const combo = combinationMap.get(comboKey) || {
        subjectIds: tags,
        subjectId1: tags[0],
        subjectId2: tags[1],
        mediaCount: 0,
        heartPoints: 0,
        pinkPoints: 0,
        greyPoints: 0,
        bluePoints: 0,
        eventPoints: 0,
        totalPoints: 0,
        maxActionCode: 0,
        firstMet: firstMetMap.get(comboKey) || null
      };
      combo.mediaCount++;
      combo.heartPoints += pts.totalHeartPts || 0;
      combo.pinkPoints += pts.pinkPts || 0;
      combo.greyPoints += pts.greyPts || 0;
      combo.bluePoints += pts.bluePts || 0;
      for (const be of (m.blueBookEvents || [])) {
        if (be.actionCode) combo.maxActionCode = Math.max(combo.maxActionCode, be.actionCode);
      }
      combinationMap.set(comboKey, combo);
    }
  }

  for (const e of eventsList) {
    const subCounts = e.subjectCounts || {};
    const presentIds = Array.from(new Set(Object.keys(subCounts).filter(id => (subCounts[id] || 0) > 0))).sort();
    if (presentIds.length >= 2 && presentIds[0] !== presentIds[1]) {
      const comboKey = presentIds.join('::');
      const combo = combinationMap.get(comboKey) || {
        subjectIds: presentIds,
        subjectId1: presentIds[0],
        subjectId2: presentIds[1],
        mediaCount: 0,
        heartPoints: 0,
        pinkPoints: 0,
        greyPoints: 0,
        bluePoints: 0,
        eventPoints: 0,
        totalPoints: 0,
        maxActionCode: 0,
        firstMet: firstMetMap.get(comboKey) || null
      };
      let comboEvtPts = 0;
      const code = e.eventCode || 1;
      combo.maxActionCode = Math.max(combo.maxActionCode, code);
      for (const subId of presentIds) {
        comboEvtPts += calculateEventPointsForSubject(code, subCounts[subId], defaultWeights);
      }
      combo.eventPoints += comboEvtPts;
      combinationMap.set(comboKey, combo);
    }
  }

  const allCombinations = Array.from(combinationMap.values()).map(c => {
    c.totalPoints = Math.round((c.heartPoints + c.eventPoints) * 100) / 100;
    const subs = (c.subjectIds || [c.subjectId1, c.subjectId2]).map(id => subjectsList.find(s => s.id === id)).filter(Boolean);
    c.subs = subs;
    c.name = subs.map(s => getSubjectDisplayName(s)).join(' & ');
    if (!c.firstMet) c.firstMet = firstMetMap.get((c.subjectIds || [c.subjectId1, c.subjectId2]).slice().sort().join('::')) || null;
    return c;
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  return { total3PinkHearts, greyHeartLeader, maxGreyPts, timelineData, allSubjectStats, allCombinations, mediaStatsMap, firstMetMap };
}

window.getHeartPointsForCount = getHeartPointsForCount;
window.calculateMediaHeartPoints = calculateMediaHeartPoints;
window.calculateEventPointsForSubject = calculateEventPointsForSubject;
window.processAllStats = processAllStats;
