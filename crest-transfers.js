/** Donor-layer limiter for declared finite crests; frozen-head explicit requests. */
export function allocateCrestTransfers(water, links) {
  const affected = new Set(links.filter(link => link.stopDepthMm !== undefined).map(link => link.src));
  if (!affected.size) return null;
  const accepted = Array(links.length);
  const groups = new Map([...affected].map(src => [src, []]));
  links.forEach((link, index) => {
    if (groups.has(link.src)) { groups.get(link.src).push(index); accepted[index] = 0; }
  });
  for (const [src, indices] of groups) {
    let depth = water[src], remaining = 1;
    let active = indices.filter(i => links[i].requested > 0 && depth > (links[i].stopDepthMm ?? 0));
    // Each completed layer removes at least one finite threshold (then the dry floor).
    // Incoming water is deliberately unavailable until the common transfer step ends.
    while (active.length && remaining > 0 && depth > 0) {
      const floor = Math.max(0, ...active.map(i => links[i].stopDepthMm ?? 0));
      const rate = active.reduce((sum, i) => sum + links[i].requested, 0);
      const toFloor = (depth - floor) / rate;
      const interval = Math.min(remaining, toFloor);
      for (const i of active) accepted[i] += links[i].requested * interval;
      remaining = Math.max(0, remaining - interval);
      if (toFloor <= interval) {
        depth = floor;
        active = active.filter(i => (links[i].stopDepthMm ?? 0) < depth);
      } else { depth -= rate * interval; break; }
    }
    // Roundoff only: never make more donor water available than entered this step.
    const total = indices.reduce((sum, i) => sum + accepted[i], 0);
    if (total > water[src]) for (const i of indices) accepted[i] *= water[src] / total;
  }
  return accepted;
}
