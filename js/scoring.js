/**
 * Derived Statistics & Scoring Calculation Engine
 */

export function getHeartPointsForCount(count, weights) {
  if (count === 1) return weights.heart1 ?? 1;
  if (count === 2) return weights.heart2 ?? 3;
  if (count === 3) return weights.heart3 ?? 10;
  return 0;
}

export function calculateMediaHeartPoints(media, weights) {
  if (!media || !media.heartTags) return { pinkPts: 0, greyPts: 0, bluePts: 0, totalHeartPts: 0 };
  const pinkPts = getHeartPointsForCount(media.heartTags.pink || 0, weights);
  const greyPts = getHeartPointsForCount(media.heartTags.grey || 0, weights);
  const bluePts = getHeartPointsForCount(media.heartTags.blue || 0, weights);
  return {
    pinkPts,
    greyPts,
    bluePts,
    totalHeartPts: pinkPts + greyPts + bluePts
  };
}

export function calculateEventPointsForSubject(cCount, weights) {
  if (!cCount || cCount <= 0) return 0;
  return (cCount * (weights.eventCCount ?? 10)) + (weights.eventTag ?? 1);
}

export function processAllStats(mediaList = [], subjectsList = [], eventsList = [], weights) {
  const defaultWeights = {
    heart1: 1,
    heart2: 3,
    heart3: 10,
    eventCCount: 10,
    eventTag: 1,
    ...weights
  };

  // 1. Overall & Media Level Derived Metrics
  let total3PinkHearts = 0;
  let maxGreyPts = -1;
  let greyHeartLeader = null;
  const pinkAccumulationByDate = new Map();

  const mediaStatsMap = new Map();

  for (const m of mediaList) {
    const pts = calculateMediaHeartPoints(m, defaultWeights);
    mediaStatsMap.set(m.id, pts);

    if (m.heartTags?.pink === 3) {
      total3PinkHearts++;
    }

    if (pts.greyPts > maxGreyPts) {
      maxGreyPts = pts.greyPts;
      greyHeartLeader = m;
    }

    // Accumulation by Date
    if (m.dateTag) {
      const dateKey = m.dateTag.split('T')[0]; // YYYY-MM-DD
      const existing = pinkAccumulationByDate.get(dateKey) || { pinkCount: 0, pinkPts: 0 };
      pinkAccumulationByDate.set(dateKey, {
        pinkCount: existing.pinkCount + (m.heartTags?.pink || 0),
        pinkPts: existing.pinkPts + pts.pinkPts
      });
    }
  }

  // Chronologically sorted timeline for Plotly chart
  const sortedDates = Array.from(pinkAccumulationByDate.keys()).sort();
  let cumulativePinkHearts = 0;
  let cumulativePinkPts = 0;
  const timelineData = sortedDates.map(date => {
    const entry = pinkAccumulationByDate.get(date);
    cumulativePinkHearts += entry.pinkCount;
    cumulativePinkPts += entry.pinkPts;
    return {
      date,
      dailyPinkCount: entry.pinkCount,
      dailyPinkPts: entry.pinkPts,
      cumulativePinkHearts,
      cumulativePinkPts
    };
  });

  // 2. Subject Statistics Map
  const subjectStatsMap = new Map();
  for (const s of subjectsList) {
    subjectStatsMap.set(s.id, {
      subject: s,
      heartPoints: 0,
      eventPoints: 0,
      totalPoints: 0,
      mediaCount: 0,
      soloMediaCount: 0,
      eventsCount: 0,
      totalCCount: 0,
      coOccurrences: new Map() // subjectId -> count
    });
  }

  // Calculate Subject Heart Points from Media
  for (const m of mediaList) {
    const pts = mediaStatsMap.get(m.id) || { totalHeartPts: 0 };
    const tags = m.subjectTags || [];

    for (const subId of tags) {
      const sStat = subjectStatsMap.get(subId);
      if (sStat) {
        sStat.heartPoints += pts.totalHeartPts;
        sStat.mediaCount++;
        if (tags.length === 1) {
          sStat.soloMediaCount++;
        }

        // Track co-occurrences
        for (const otherId of tags) {
          if (otherId !== subId) {
            sStat.coOccurrences.set(otherId, (sStat.coOccurrences.get(otherId) || 0) + 1);
          }
        }
      }
    }
  }

  // Calculate Subject Event Points from Events
  for (const e of eventsList) {
    const subCounts = e.subjectCounts || {};
    const subIds = Object.keys(subCounts);

    for (const subId of subIds) {
      const cCount = subCounts[subId] || 0;
      const evtPts = calculateEventPointsForSubject(cCount, defaultWeights);
      const sStat = subjectStatsMap.get(subId);
      if (sStat) {
        sStat.eventPoints += evtPts;
        sStat.eventsCount++;
        sStat.totalCCount += cCount;
      }
    }
  }

  // Compute Total Points & Rank Top Subjects
  const allSubjectStats = Array.from(subjectStatsMap.values()).map(stat => {
    stat.totalPoints = stat.heartPoints + stat.eventPoints;
    return stat;
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  // 3. Subject Combination Statistics (Pairs)
  const combinationMap = new Map();

  for (const m of mediaList) {
    const tags = (m.subjectTags || []).slice().sort();
    if (tags.length >= 2) {
      const pts = mediaStatsMap.get(m.id) || { totalHeartPts: 0 };

      // Generate pairs
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const comboKey = `${tags[i]}::${tags[j]}`;
          const combo = combinationMap.get(comboKey) || {
            subjectId1: tags[i],
            subjectId2: tags[j],
            mediaCount: 0,
            heartPoints: 0,
            eventPoints: 0,
            totalPoints: 0
          };
          combo.mediaCount++;
          combo.heartPoints += pts.totalHeartPts;
          combinationMap.set(comboKey, combo);
        }
      }
    }
  }

  // Add event combo stats
  for (const e of eventsList) {
    const subCounts = e.subjectCounts || {};
    const subIds = Object.keys(subCounts).sort();

    if (subIds.length >= 2) {
      for (let i = 0; i < subIds.length; i++) {
        for (let j = i + 1; j < subIds.length; j++) {
          const comboKey = `${subIds[i]}::${subIds[j]}`;
          const combo = combinationMap.get(comboKey) || {
            subjectId1: subIds[i],
            subjectId2: subIds[j],
            mediaCount: 0,
            heartPoints: 0,
            eventPoints: 0,
            totalPoints: 0
          };
          const pts1 = calculateEventPointsForSubject(subCounts[subIds[i]], defaultWeights);
          const pts2 = calculateEventPointsForSubject(subCounts[subIds[j]], defaultWeights);
          combo.eventPoints += (pts1 + pts2);
          combinationMap.set(comboKey, combo);
        }
      }
    }
  }

  const allCombinations = Array.from(combinationMap.values()).map(c => {
    c.totalPoints = c.heartPoints + c.eventPoints;
    const sub1 = subjectsList.find(s => s.id === c.subjectId1);
    const sub2 = subjectsList.find(s => s.id === c.subjectId2);
    c.name = `${sub1 ? sub1.name : 'Unknown'} & ${sub2 ? sub2.name : 'Unknown'}`;
    c.sub1 = sub1;
    c.sub2 = sub2;
    return c;
  }).sort((a, b) => b.totalPoints - a.totalPoints);

  return {
    total3PinkHearts,
    greyHeartLeader,
    maxGreyPts,
    timelineData,
    allSubjectStats,
    allCombinations,
    mediaStatsMap
  };
}
