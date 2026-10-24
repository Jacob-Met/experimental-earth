import { internalEdge, withInternalBarrier, withInternalCrest, internalBarrierCount, internalCrestCount } from './internal-barriers.js';

export function mountInternalBarriers({ getProject, replaceProject, notice }) {
  const panel = document.createElement('section');
  panel.id = 'internal-barriers'; panel.className = 'internal-barrier-panel';
  panel.setAttribute('aria-labelledby', 'barrier-heading');
  panel.innerHTML = '<h3 id="barrier-heading">Walls, crests and openings</h3>' +
    '<p class="caption">Close an internal edge, declare a finite crest, or open a gap. Brown map lines stay closed; blue lines mark finite crests that can overflow. Outside outlets keep their existing settings.</p>' +
    '<p id="barrier-selection"></p><div class="barrier-inputs">' +
    '<label class="input-label">Site<select id="barrier-target"><option value="proposal">Proposal</option><option value="existing">Existing</option></select></label>' +
    '<label class="input-label">Edge of selected cell<select id="barrier-direction"><option value="north">North</option><option value="east">East</option><option value="south">South</option><option value="west">West</option></select></label></div>' +
    '<p id="barrier-edge-state" aria-live="polite"></p>' +
    '<label class="input-label">Source or hypothetical assumption<input id="barrier-source" maxlength="240" placeholder="For example: proposed wall with an opening here"></label>' +
    '<label class="input-label">Finite crest elevation (m, same datum as ground)<input id="barrier-crest" type="number" min="-10" max="10" step="0.001"></label>' +
    '<div class="barrier-actions"><button id="barrier-close" type="button">Close this edge</button><button id="barrier-open" type="button">Open this edge</button><button id="barrier-set-crest" type="button">Set finite crest</button></div>' +
    '<p id="barrier-status" role="status"></p>' +
    '<details><summary>Edge assumptions at this cell</summary><ul id="barrier-details"></ul></details>' +
    '<p class="caption">A closed edge stays impermeable. Finite crests use a separate conceptual overflow approximation; results can change with the time step. A crest at or below the higher adjoining ground adds no obstruction. Leakage, erosion and structural strength are not modeled. Retained measurements are unchanged; check that they still describe the edited site.</p>';
  document.getElementById('selection').after(panel);
  const $ = id => panel.querySelector('#' + id);
  const name = (project, index) => String.fromCharCode(65 + index % project.width) + (Math.floor(index / project.width) + 1);
  let displayedContext = '';
  function context(project) {
    return JSON.stringify({ width: project.width, height: project.height, selectedIndex: project.selectedIndex,
      existing: project.existing, proposal: project.proposal });
  }
  function refresh() {
    const p = getProject(), index = p.selectedIndex ?? 0;
    $('barrier-selection').textContent = 'Selected ' + name(p, index) + ' · existing: ' + internalBarrierCount(p.existing) +
      ' closed, ' + internalCrestCount(p.existing) + ' finite crests · proposal: ' + internalBarrierCount(p.proposal) + ' closed, ' + internalCrestCount(p.proposal) + ' finite crests';
    for (const option of $('barrier-direction').options) option.disabled = !internalEdge(p.width, p.height, index, option.value);
    if ($('barrier-direction').selectedOptions[0]?.disabled) {
      $('barrier-direction').value = [...$('barrier-direction').options].find(option => !option.disabled).value;
    }
    const target = $('barrier-target').value, direction = $('barrier-direction').value;
    const edge = internalEdge(p.width, p.height, index, direction);
    const state = p[target][edge.ownerIndex].internalBarriers?.[edge.key];
    const ground = Math.max(p[target][edge.a].elevationM, p[target][edge.b].elevationM);
    const finite = typeof state?.crestElevationM === 'number';
    $('barrier-crest').value = finite ? state.crestElevationM : Number(Math.min(10, ground + .05).toFixed(3));
    $('barrier-edge-state').textContent = target + ' ' + name(p, index) + ' ↔ ' + name(p, edge.neighborIndex) + ': ' +
      (finite ? 'crest at ' + state.crestElevationM + ' m (' + (state.crestElevationM > ground ? Number((state.crestElevationM-ground).toFixed(4)) + ' m above higher adjoining ground' : 'no added obstruction at/below higher adjoining ground') + ')' : state?.closed ? 'closed to modeled flow' : state ? 'declared opening' : 'open by default');
    $('barrier-source').value = state?.source ?? '';
    const list = $('barrier-details'); list.replaceChildren();
    for (const side of ['north', 'east', 'south', 'west']) {
      const link = internalEdge(p.width, p.height, index, side);
      const li = document.createElement('li');
      if (!link) li.textContent = side + ': exterior outlet, unchanged';
      else {
        li.textContent = side + ' toward ' + name(p, link.neighborIndex) + ' — ' +
          ['existing', 'proposal'].map(site => {
            const e = p[site][link.ownerIndex].internalBarriers?.[link.key];
            return site + ': ' + (typeof e?.crestElevationM === 'number' ? 'crest ' + e.crestElevationM + ' m' : e?.closed ? 'closed' : 'open') + ' (' + (e?.source ?? 'default model connection') + ')';
          }).join('; ');
      }
      list.append(li);
    }
    $('barrier-status').textContent = '';
    displayedContext = context(p);
  }
  function apply(mode) {
    try {
      const p = getProject();
      if (displayedContext !== context(p)) { refresh(); throw Error('Site changed. Review the selected edge before applying.'); }
      const target = $('barrier-target').value, index = p.selectedIndex ?? 0;
      if (mode === 'crest' && !$('barrier-crest').value.trim()) throw Error('Declare the finite crest elevation in meters.');
      const next = mode === 'crest' ? withInternalCrest(p, target, index, $('barrier-direction').value, Number($('barrier-crest').value), $('barrier-source').value) : withInternalBarrier(p, target, index, $('barrier-direction').value, mode === 'closed', $('barrier-source').value);
      replaceProject(next);
      const message = target + ' edge ' + (mode === 'crest' ? 'given a finite crest' : mode === 'closed' ? 'closed' : 'opened') + '; both rain scenarios recalculated.';
      $('barrier-status').textContent = message; notice(message);
    } catch (error) { $('barrier-status').textContent = error.message; }
  }
  $('barrier-target').addEventListener('change', refresh);
  $('barrier-direction').addEventListener('change', refresh);
  $('barrier-close').addEventListener('click', () => apply('closed'));
  $('barrier-open').addEventListener('click', () => apply('open'));
  $('barrier-set-crest').addEventListener('click', () => apply('crest'));
  return { refresh };
}
