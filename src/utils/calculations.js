const ZONE_HALF_WIDTH = 0.708; // 17 inches / 2 in feet

export function calcMissDistance(px, pz, szTop, szBot) {
  const dx = Math.max(0, Math.abs(px) - ZONE_HALF_WIDTH);
  let dz = 0;
  if (pz > szTop) dz = pz - szTop;
  else if (pz < szBot) dz = szBot - pz;
  const dist = Math.sqrt(dx * dx + dz * dz);
  return dist;
}

export function feetToInches(ft) {
  return ft * 12;
}

export function isInZone(px, pz, szTop, szBot) {
  return Math.abs(px) <= ZONE_HALF_WIDTH && pz >= szBot && pz <= szTop;
}

export function nearestZoneEdge(px, pz, szTop, szBot) {
  const edgeX = Math.max(-ZONE_HALF_WIDTH, Math.min(ZONE_HALF_WIDTH, px));
  const edgeZ = Math.max(szBot, Math.min(szTop, pz));
  return { edgeX, edgeZ };
}

export function aggregateByField(challenges, field) {
  const map = {};
  for (const c of challenges) {
    const key = c[field] || 'Unknown';
    if (!map[key]) map[key] = { name: key, total: 0, overturned: 0, confirmed: 0 };
    map[key].total++;
    if (c.overturned) map[key].overturned++;
    else map[key].confirmed++;
  }
  return Object.values(map).map(item => ({
    ...item,
    overturnRate: item.total > 0 ? (item.overturned / item.total * 100) : 0,
  })).sort((a, b) => b.total - a.total);
}

export function getMissDistanceBuckets(challenges) {
  const buckets = [
    { label: 'In Zone', min: -1, max: 0, total: 0, overturned: 0 },
    { label: '0-0.5"', min: 0, max: 0.5, total: 0, overturned: 0 },
    { label: '0.5-1"', min: 0.5, max: 1, total: 0, overturned: 0 },
    { label: '1-2"', min: 1, max: 2, total: 0, overturned: 0 },
    { label: '2-3"', min: 2, max: 3, total: 0, overturned: 0 },
    { label: '3-5"', min: 3, max: 5, total: 0, overturned: 0 },
    { label: '5"+', min: 5, max: Infinity, total: 0, overturned: 0 },
  ];

  for (const c of challenges) {
    const inches = c.missDistanceInches ?? feetToInches(c.missDistance ?? 0);
    if (c.inZone) {
      buckets[0].total++;
      if (c.overturned) buckets[0].overturned++;
    } else {
      for (let i = 1; i < buckets.length; i++) {
        if (inches >= buckets[i].min && inches < buckets[i].max) {
          buckets[i].total++;
          if (c.overturned) buckets[i].overturned++;
          break;
        }
      }
    }
  }

  return buckets.map(b => ({
    ...b,
    confirmed: b.total - b.overturned,
    overturnRate: b.total > 0 ? (b.overturned / b.total * 100) : 0,
  }));
}

export function getDailyTotals(challenges) {
  const map = {};
  for (const c of challenges) {
    const d = c.date;
    if (!map[d]) map[d] = { date: d, total: 0, overturned: 0 };
    map[d].total++;
    if (c.overturned) map[d].overturned++;
  }
  return Object.values(map)
    .map(item => ({ ...item, overturnRate: item.total > 0 ? (item.overturned / item.total * 100) : 0 }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function getMissDistanceHistogram(challenges, binSize = 0.5) {
  const maxInches = 10;
  const bins = [];
  for (let i = 0; i < maxInches; i += binSize) {
    bins.push({ min: i, max: i + binSize, label: `${i}-${i + binSize}"`, overturned: 0, confirmed: 0 });
  }
  for (const c of challenges) {
    if (c.inZone) continue;
    const inches = c.missDistanceInches ?? feetToInches(c.missDistance ?? 0);
    const idx = Math.min(Math.floor(inches / binSize), bins.length - 1);
    if (idx >= 0 && idx < bins.length) {
      if (c.overturned) bins[idx].overturned++;
      else bins[idx].confirmed++;
    }
  }
  return bins;
}
