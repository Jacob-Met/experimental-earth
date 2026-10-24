/** Canonical internal edges; exterior outlets retain their existing model. */
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const directions = ['north', 'east', 'south', 'west'];
const record = value => value && typeof value === 'object' && !Array.isArray(value);

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
    if (!record(edges) || Object.keys(edges).some(key => !['east', 'south'].includes(key))) {
      throw Error('Internal barriers must use only canonical east/south edges.');
    }
    for (const key of Object.keys(edges)) {
      const edge = edges[key];
      if (!internalEdge(width, height, i, key)) throw Error('Internal barriers cannot replace exterior outlets.');
      if (!record(edge) || Object.keys(edge).some(k => !['closed', 'source'].includes(k)) ||
          !own(edge, 'closed') || typeof edge.closed !== 'boolean' ||
          typeof edge.source !== 'string' || !edge.source.trim() || edge.source.length > 240) {
        throw Error('Each declared internal edge needs a boolean closed state and a source of 1–240 characters.');
      }
    }
  }
}

export function internalEdgeClosed(cells, a, b, width) {
  return cells[a].internalBarriers?.[b === a + 1 ? 'east' : 'south']?.closed === true;
}

/** Provenance may differ between events; hydraulic connectivity must match. */
export function sameInternalBarriers(first, second) {
  return first.length === second.length && first.every((cell, i) =>
    ['east', 'south'].every(key =>
      (cell.internalBarriers?.[key]?.closed === true) === (second[i].internalBarriers?.[key]?.closed === true)));
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
    cell.internalBarriers?.[key]?.closed === true).length, 0);
}
