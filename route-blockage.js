import {routeThresholdWindows} from './route-ponding.js';

/**
 * Explain simultaneous route blockage in retained, interpolated model exposures.
 * Sole minutes identify one above-threshold cell; shared minutes identify two or
 * more distinct cells. This is attribution of model conditions, not a forecast
 * of what changing any cell would do to the coupled water model.
 */
export function routeBlockageAttribution(exposureByCell, indices, firstMinute, lastMinute) {
  // Keep source, route and horizon refusal consistent with the window query.
  routeThresholdWindows(exposureByCell, indices, firstMinute, lastMinute);
  const cells = [...new Set(indices)].map((cellIndex, routeOrder) => ({
    cellIndex, routeOrder, minutesAbove: 0, soleAboveMinutes: 0
  }));
  const byIndex = new Map(cells.map(cell => [cell.cellIndex, cell]));
  const events = [];
  for (const cell of cells) {
    const intervals = exposureByCell[cell.cellIndex].intervals.map(interval => ({
      startMinute: Math.max(firstMinute, interval.startMinute),
      endMinute: Math.min(lastMinute, interval.endMinute)
    })).filter(interval => interval.endMinute > interval.startMinute)
      .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);
    const merged = [];
    for (const interval of intervals) {
      const previous = merged.at(-1);
      if (previous && interval.startMinute <= previous.endMinute) {
        previous.endMinute = Math.max(previous.endMinute, interval.endMinute);
      } else merged.push({...interval});
    }
    for (const interval of merged) {
      cell.minutesAbove += interval.endMinute - interval.startMinute;
      events.push({minute: interval.startMinute, cellIndex: cell.cellIndex, delta: 1});
      events.push({minute: interval.endMinute, cellIndex: cell.cellIndex, delta: -1});
    }
  }
  events.sort((a, b) => a.minute - b.minute);
  const active = new Set();
  let previousMinute = firstMinute, aboveMinutes = 0, multipleAboveMinutes = 0;
  for (let i = 0; i < events.length;) {
    const minute = events[i].minute;
    const duration = minute - previousMinute;
    if (active.size) aboveMinutes += duration;
    if (active.size === 1) byIndex.get(active.values().next().value).soleAboveMinutes += duration;
    else if (active.size > 1) multipleAboveMinutes += duration;
    // Crossings at one instant have zero duration. Apply the entire group before
    // assessing the next span so touching intervals do not become shared time.
    while (i < events.length && events[i].minute === minute) {
      const event = events[i++];
      if (event.delta > 0) active.add(event.cellIndex);
      else active.delete(event.cellIndex);
    }
    previousMinute = minute;
  }
  cells.sort((a, b) => b.soleAboveMinutes - a.soleAboveMinutes || a.routeOrder - b.routeOrder);
  return {
    cells: cells.map(({routeOrder, ...cell}) => cell),
    aboveMinutes,
    multipleAboveMinutes,
    clearMinutes: Math.max(0, lastMinute - firstMinute - aboveMinutes)
  };
}
