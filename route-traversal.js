import {snapshotDepthsAtMinutes} from './ponding-exposure.js';

/**
 * Timing is a user-declared hypothetical journey, never an inferred walking
 * speed, flood passability classification, or source observation. Each step
 * may take its own positive number of modeled minutes.
 */
export function parseSegmentMinutes(text, routeLength) {
  if (typeof text !== 'string' || text.length > 512 ||
      !Number.isInteger(routeLength) || routeLength < 2 || routeLength > 128) {
    throw new Error('Supply positive minutes for a supported route.');
  }
  const parts = text.trim().split(/\s*,\s*/);
  if (parts.length !== 1 && parts.length !== routeLength - 1) {
    throw new Error('Enter one time for every step, or one time to repeat across steps.');
  }
  const minutes = parts.map(part => {
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(part)) {
      throw new Error('Step minutes must be explicit positive decimal numbers.');
    }
    const n = Number(part);
    if (!Number.isFinite(n) || n < .01 || n > 1440) {
      throw new Error('Each step must take between 0.01 and 1440 modeled minutes.');
    }
    return n;
  });
  return parts.length === 1 ? Array(routeLength - 1).fill(minutes[0]) : minutes;
}

function offsetsForRoute(indices, stepMinutes) {
  if (!Array.isArray(indices) || indices.length < 2 || indices.length > 128 ||
      !indices.every(i => Number.isInteger(i) && i >= 0) ||
      new Set(indices).size !== indices.length ||
      !Array.isArray(stepMinutes) || stepMinutes.length !== indices.length - 1) {
    throw new Error('A finite, distinct ordered route and a time for every step are required.');
  }
  const offsets = [0];
  for (const n of stepMinutes) {
    if (!Number.isFinite(n) || n < .01 || n > 1440) {
      throw new Error('Step times must be positive, bounded modeled minutes.');
    }
    offsets.push(offsets.at(-1) + n);
  }
  return offsets;
}

function validateTimes(offsets, first, last, earliest, latest) {
  if (![first,last,earliest,latest].every(Number.isFinite) ||
      first < 0 || last <= first || earliest < first ||
      latest <= earliest || latest + offsets.at(-1) > last + 1e-8) {
    throw new Error('Departure window and all cell arrival times must stay inside the modeled event.');
  }
}

/**
 * Intersect clear per-cell arrival conditions after translating each wet
 * interval backward by that cell's declared cumulative travel time.
 * The result is positive-duration departure windows; isolated boundary
 * instants are not represented as intervals. Exactly-at-threshold readings
 * are independently checkable with inspectTimedRoute.
 */
export function timedRouteWindows(exposureByCell, indices, stepMinutes,
                                  firstMinute, lastMinute,
                                  earliestDepartureMinute, latestDepartureMinute) {
  const offsets = offsetsForRoute(indices, stepMinutes);
  validateTimes(offsets,firstMinute,lastMinute,earliestDepartureMinute,latestDepartureMinute);
  if (!Array.isArray(exposureByCell)) throw new Error('Original modeled exposures are required.');
  const blocked = [];
  for (let k=0;k<indices.length;k++) {
    const entry=exposureByCell[indices[k]];
    if (!entry || !Array.isArray(entry.intervals)) {
      throw new Error('Every route cell must have original modeled threshold exposure.');
    }
    const offset=offsets[k];
    for (const interval of entry.intervals) {
      if (!interval || !Number.isFinite(interval.startMinute) ||
          !Number.isFinite(interval.endMinute) ||
          interval.startMinute < firstMinute - 1e-8 ||
          interval.endMinute > lastMinute + 1e-8 ||
          interval.endMinute <= interval.startMinute) {
        throw new Error('Invalid modeled exposure interval.');
      }
      const startMinute=Math.max(earliestDepartureMinute,interval.startMinute-offset);
      const endMinute=Math.min(latestDepartureMinute,interval.endMinute-offset);
      if (endMinute>startMinute) blocked.push({startMinute,endMinute});
    }
  }
  blocked.sort((a,b)=>a.startMinute-b.startMinute || a.endMinute-b.endMinute);
  const aboveWindows=[];
  for (const interval of blocked) {
    const previous=aboveWindows.at(-1);
    if (previous && interval.startMinute <= previous.endMinute + 1e-8) {
      previous.endMinute=Math.max(previous.endMinute,interval.endMinute);
    } else aboveWindows.push({...interval});
  }
  const clearWindows=[];
  let cursor=earliestDepartureMinute;
  for (const interval of aboveWindows) {
    if (interval.startMinute > cursor + 1e-8)
      clearWindows.push({startMinute:cursor,endMinute:interval.startMinute});
    cursor=Math.max(cursor,interval.endMinute);
  }
  if (cursor < latestDepartureMinute - 1e-8)
    clearWindows.push({startMinute:cursor,endMinute:latestDepartureMinute});
  return {
    arrivalOffsetsMinutes: offsets,
    clearWindows,aboveWindows,
    clearMinutes:clearWindows.reduce((total,w)=>total+w.endMinute-w.startMinute,0),
    earliestFeasibleDepartureMinute:clearWindows[0]?.startMinute??null,
    evaluatedDepartureWindow:{startMinute:earliestDepartureMinute,endMinute:latestDepartureMinute}
  };
}

/** Sample actual modeled replay at each declared arrival time, not at departure. */
export function inspectTimedRoute(result, indices, stepMinutes, departureMinute, thresholdMm) {
  const offsets=offsetsForRoute(indices,stepMinutes);
  if (!Number.isFinite(departureMinute) ||
      !Number.isFinite(thresholdMm) || thresholdMm<=0 || thresholdMm>1000) {
    throw new Error('Supply a valid modeled departure time and depth threshold.');
  }
  const arrivalMinutes=offsets.map(offset=>departureMinute+offset);
  const arrivalDepths=snapshotDepthsAtMinutes(result,arrivalMinutes);
  const arrivals=[];
  let firstFailure=null;
  for(let k=0;k<indices.length;k++) {
    const minute=arrivalMinutes[k],cellIndex=indices[k];
    const depths=arrivalDepths[k];
    if(cellIndex >= depths.length) throw new Error('Route cell is outside modeled site.');
    const depthMm=depths[cellIndex];
    arrivals.push({cellIndex,routePosition:k,minute,depthMm});
    if(!firstFailure && depthMm>thresholdMm) {
      firstFailure={cellIndex,routePosition:k,minute,depthMm};
    }
  }
  return {departureMinute,arrivals,allAtOrBelow:firstFailure===null,firstFailure};
}

