/** Canonical internal edges; exterior outlets retain their existing model. */
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const directions = ['north', 'east', 'south', 'west'];
const record = value => value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;
const declaration = (cell, key) => own(cell, 'internalBarriers') && cell.internalBarriers && own(cell.internalBarriers, key) ? cell.internalBarriers[key] : undefined;

export function internalEdge(width, height, cellIndex, direction) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 2 ||
      !Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= width * height ||
      !directions.includes(direction)) throw Error('Choose a valid cell and internal edge.');
  const x = cellIndex % width, y = Math.floor(cellIndex / width);
  if ((direction === 'north' && y === 0) || (direction === 'west' && x === 0) ||
      (direction === 'east' && x === width - 1) || (direction === 'south' && y === height - 1)) return null;
  const neighborIndex = cellIndex + ({ north: -width, east: 1, south: width, west: -1 })[direction];
  return { ownerIndex: Math.min(cellIndex, neighborIndex), neighborIndex,
    key: direction === 'east' || direction === 'west' ? 'east' : 'south',
    a: Math.min(cellIndex, neighborIndex), b: Math.max(cellIndex, neighborIndex) };
}

export function validateInternalBarriers(cells, width, height) {
  for (let i = 0; i < cells.length; i++) {
    const edges = cells[i].internalBarriers;
    if (edges === undefined) continue;
    if (!own(cells[i], 'internalBarriers')) throw Error('Internal barriers must be explicit own declarations.');
    if (!record(edges) || Object.keys(edges).some(key => !['east', 'south'].includes(key))) {
      throw Error('Internal barriers must use only canonical east/south edges.');
    }
    for (const key of Object.keys(edges)) {
      const edge = edges[key];
      if (!internalEdge(width, height, i, key)) throw Error('Internal barriers cannot replace exterior outlets.');
      if (!record(edge) || Object.keys(edge).some(k => !['closed', 'crestElevationM', 'source'].includes(k)) ||
          (own(edge, 'closed') === own(edge, 'crestElevationM')) ||
          (own(edge, 'closed') && typeof edge.closed !== 'boolean') ||
          (own(edge, 'crestElevationM') && (typeof edge.crestElevationM !== 'number' ||
            !Number.isFinite(edge.crestElevationM) || edge.crestElevationM < -10 || edge.crestElevationM > 10)) ||
          typeof edge.source !== 'string' || !edge.source.trim() || edge.source.length > 240) {
        throw Error('Each internal edge needs either a boolean closed state or a finite crest elevation from −10 to 10 m, plus a source of 1–240 characters.');
      }
    }
  }
}

export function internalEdgeClosed(cells, a, b, width) {
  const edge = declaration(cells[a], b === a + 1 ? 'east' : 'south');
  return !!edge && own(edge, 'closed') && edge.closed === true;
}

/** A crest at/below the higher adjoining ground adds no obstruction. */
export function internalEdgeCrest(cells, a, b) {
  const edge = declaration(cells[a], b === a + 1 ? 'east' : 'south');
  const value = edge && own(edge, 'crestElevationM') ? edge.crestElevationM : undefined;
  return typeof value === 'number' && value > Math.max(cells[a].elevationM, cells[b].elevationM) ? value : null;
}
const hydraulicKey = edge => edge && own(edge, 'closed') && edge.closed === true ? 'closed' :
  edge && own(edge, 'crestElevationM') ? 'crest:' + edge.crestElevationM : 'open';

/** Provenance may differ; declared hydraulic states and crest elevations must match. */
export function sameInternalBarriers(first, second) {
  return first.length === second.length && first.every((cell, i) =>
    ['east', 'south'].every(key => hydraulicKey(declaration(cell, key)) ===
      hydraulicKey(declaration(second[i], key))));
}

/** Return a new project so a refused edit never mutates accepted inputs. */
export function withInternalBarrier(project, target, cellIndex, direction, closed, source) {
  if (!['existing', 'proposal'].includes(target)) throw Error('Choose an existing or proposed site.');
  if (typeof closed !== 'boolean' || typeof source !== 'string' || !source.trim() || source.length > 240) {
    throw Error('Describe the observation or hypothetical edge assumption in 1–240 characters.');
  }
  const edge = internalEdge(project.width, project.height, cellIndex, direction);
  if (!edge) throw Error('This is an exterior edge; its outlet settings are unchanged.');
  const next = structuredClone(project);
  const cell = next[target][edge.ownerIndex];
  cell.internalBarriers = { ...cell.internalBarriers, [edge.key]: { closed, source: source.trim() } };
  validateInternalBarriers(next[target], next.width, next.height);
  return next;
}

export function internalBarrierCount(cells) {
  return cells.reduce((count, cell) => count + ['east', 'south'].filter(key =>
    hydraulicKey(declaration(cell, key)) === 'closed').length, 0);
}

/** Both adjoining cells belong to the directly changed connectivity footprint. */
export function changedBarrierCells(first, second, width, height) {
  const changed = new Set();
  for (let i = 0; i < first.length; i++) for (const key of ['east', 'south']) {
    if (hydraulicKey(declaration(first[i], key)) === hydraulicKey(declaration(second[i], key))) continue;
    const edge = internalEdge(width, height, i, key);
    if (edge) { changed.add(edge.a); changed.add(edge.b); }
  }
  return [...changed].sort((a, b) => a - b);
}

/** Sourced absolute elevation in the same datum as the adjacent ground. */
export function withInternalCrest(project, target, cellIndex, direction, crestElevationM, source) {
  if (!['existing', 'proposal'].includes(target)) throw Error('Choose an existing or proposed site.');
  if (typeof crestElevationM !== 'number' || !Number.isFinite(crestElevationM) || crestElevationM < -10 || crestElevationM > 10)
    throw Error('Declare a finite crest elevation from −10 to 10 m in the site ground datum.');
  if (typeof source !== 'string' || !source.trim() || source.length > 240)
    throw Error('Describe the observation or hypothetical crest assumption in 1–240 characters.');
  const edge = internalEdge(project.width, project.height, cellIndex, direction);
  if (!edge) throw Error('This is an exterior edge; its outlet settings are unchanged.');
  const next = structuredClone(project), cell = next[target][edge.ownerIndex];
  cell.internalBarriers = { ...cell.internalBarriers,
    [edge.key]: { crestElevationM, source: source.trim() } };
  validateInternalBarriers(next[target], next.width, next.height);
  return next;
}
export function internalCrestCount(cells) {
  return cells.reduce((count, cell) => count + ['east', 'south'].filter(key =>
    hydraulicKey(declaration(cell, key)).startsWith('crest:')).length, 0);
}
