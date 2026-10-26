// Keyboard-only spatial traversal of an existing rectangular original-site grid.
// Returns null for a non-arrow key, the same index for a blocked edge, or a neighbor.
export function arrowGridIndex(index, width, count, key) {
  if (!Number.isSafeInteger(index) || !Number.isSafeInteger(width)
      || !Number.isSafeInteger(count) || width <= 0 || count <= 0
      || count % width !== 0 || index < 0 || index >= count) {
    throw new RangeError('A valid rectangular grid and cell index are required.');
  }
  const column = index % width;
  if (key === 'ArrowLeft') return column > 0 ? index - 1 : index;
  if (key === 'ArrowRight') return column < width - 1 ? index + 1 : index;
  if (key === 'ArrowUp') return index >= width ? index - width : index;
  if (key === 'ArrowDown') return index + width < count ? index + width : index;
  return null;
}
