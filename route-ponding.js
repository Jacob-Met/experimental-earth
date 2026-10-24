/**
 * Static, source-bound grid route questions over the existing ponding replay.
 * All listed cells are assessed at the SAME modeled minute, not along a moving
 * traveler or a measured/certified safe route.
 */
export function parseRouteCells(text, width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) ||
      width < 2 || width > 24 || height < 2 || height > 24) {
    throw new Error('A supported site grid is required to inspect a route.');
  }
  if (typeof text !== 'string' || !text.trim() || text.length > 1024) {
    throw new Error('Enter a route of 2–128 adjacent cells, such as A1 B1 C1.');
  }
  const labels = text.trim().toUpperCase().split(/[\s,;→]+/);
  if (labels.length < 2 || labels.length > Math.min(128, width * height)) {
    throw new Error('Choose between 2 and 128 distinct route cells within this grid.');
  }
  const indices = [];
  const seen = new Set();
  for (const label of labels) {
    const match = /^([A-X])([1-9]|1[0-9]|2[0-4])$/.exec(label);
    const x = match ? match[1].charCodeAt(0) - 65 : -1;
    const y = match ? Number(match[2]) - 1 : -1;
    if (x < 0 || x >= width || y < 0 || y >= height) {
      throw new Error('Route cell ' + label + ' is outside the current site grid.');
    }
    const index = y * width + x;
    if (seen.has(index)) throw new Error('Do not repeat a cell in this same-time route.');
    if (indices.length) {
      const prev = indices[indices.length - 1];
      const px = prev % width, py = Math.floor(prev / width);
      if (Math.abs(px - x) + Math.abs(py - y) !== 1) {
        throw new Error('Route steps must be edge-adjacent: ' + labels[indices.length - 1] + ' to ' + label + ' is disconnected.');
      }
    }
    seen.add(index);
    indices.push(index);
  }
  return { indices, labels };
}

function validateIndices(indices, count) {
  if (!Array.isArray(indices) || indices.length < 2 || indices.length > 128 ||
      !Number.isInteger(count) || count < 2 ||
      indices.some(i => !Number.isInteger(i) || i < 0 || i >= count)) {
    throw new Error('Route cells do not match this modeled grid.');
  }
}

/** Find all nonzero-duration intervals when no listed cell exceeds threshold. */
export function routeThresholdWindows(exposureByCell, indices, firstMinute, lastMinute) {
  if (!Array.isArray(exposureByCell)) throw new Error('Modeled cell exposures are required.');
  validateIndices(indices, exposureByCell.length);
  if (!Number.isFinite(firstMinute) || !Number.isFinite(lastMinute) || firstMinute < 0 ||
      lastMinute <= firstMinute) throw new Error('Invalid modeled time horizon.');
  const blocked = [];
  let aboveAtStart = false, aboveAtEnd = false;
  for (const index of new Set(indices)) {
    const exposure = exposureByCell[index];
    if (!exposure || !Array.isArray(exposure.intervals)) {
      throw new Error('Missing exposure for route cell.');
    }
    aboveAtStart ||= exposure.aboveAtStart === true;
    aboveAtEnd ||= exposure.aboveAtEnd === true;
    for (const interval of exposure.intervals) {
      if (!interval || !Number.isFinite(interval.startMinute) ||
          !Number.isFinite(interval.endMinute) ||
          interval.startMinute < firstMinute - 1e-8 ||
          interval.endMinute > lastMinute + 1e-8 ||
          interval.startMinute >= interval.endMinute) {
        throw new Error('Invalid modeled threshold interval.');
      }
      blocked.push({startMinute: Math.max(firstMinute, interval.startMinute),
        endMinute: Math.min(lastMinute, interval.endMinute)});
    }
  }
  blocked.sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
  const aboveWindows = [];
  for (const interval of blocked) {
    const previous = aboveWindows.at(-1);
    if (previous && interval.startMinute <= previous.endMinute + 1e-8) {
      previous.endMinute = Math.max(previous.endMinute, interval.endMinute);
    } else aboveWindows.push({...interval});
  }
  const clearWindows = [];
  let cursor = firstMinute;
  for (const interval of aboveWindows) {
    if (interval.startMinute > cursor + 1e-8) {
      clearWindows.push({startMinute: cursor, endMinute: interval.startMinute});
    }
    cursor = Math.max(cursor, interval.endMinute);
  }
  if (cursor < lastMinute - 1e-8) clearWindows.push({startMinute: cursor, endMinute: lastMinute});
  return {clearWindows, aboveWindows,
    clearMinutes: clearWindows.reduce((sum, w) => sum + w.endMinute - w.startMinute, 0),
    aboveAtStart, aboveAtEnd};
}

/** The worst route location AT the selected replay minute, with stable tie order. */
export function routeDepthAtMinute(depths, indices, thresholdMm) {
  if (!Array.isArray(depths)) throw new Error('Modeled depths are required.');
  validateIndices(indices, depths.length);
  if (!Number.isFinite(thresholdMm) || thresholdMm <= 0 || thresholdMm > 1000) {
    throw new Error('Choose a depth threshold greater than 0 and at most 1000 mm.');
  }
  let maxDepthMm = -1, maxCellIndex = -1;
  for (const index of indices) {
    const depth = depths[index];
    if (!Number.isFinite(depth) || depth < 0) throw new Error('Invalid modeled route depth.');
    if (depth > maxDepthMm) {maxDepthMm = depth;maxCellIndex = index;}
  }
  return {maxDepthMm, maxCellIndex, everyCellAtOrBelow: maxDepthMm <= thresholdMm};
}

