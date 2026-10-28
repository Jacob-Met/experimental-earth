import { searchCoolingWindows } from './shade-heat-window-search.js';
import { shadeHeatSourceLabel } from './shade-heat-source-label.js';

export function mountCoolingSearch({ host, getAccepted, inspect }) {
  const el = document.createElement('section'); el.id = 'shade-window-search';
  el.innerHTML = '<h4>Find a sampled window within available times</h4>' +
    '<p>Search settings stay on this page. This inquiry uses the accepted original inputs. Check a selected window above, then use Download window inputs to save that source and window.</p>' +
    '<form id="shade-window-search-form"><label>Available from minute<input name="availabilityFromMinute" type="number" min="0" max="1440" step="1" value="360" required></label>' +
    '<label>Available through minute<input name="availabilityToMinute" type="number" min="0" max="1440" step="1" value="1080" required></label>' +
    '<label>Endpoint span · minutes<input name="endpointSpanMinutes" type="number" min="0" max="1440" step="1" value="120" required></label>' +
    '<label>Required cooling · °C<input name="thresholdC" type="number" min="-1000" max="1000" step="any" value="6" required></label>' +
    '<label>Heat store<select name="store"><option value="surfaceC">Ground surface</option><option value="subsurfaceC">Lower heat store</option></select></label>' +
    '<button type="submit">Find sampled windows</button></form><p id="shade-window-search-status" role="status"></p><div id="shade-window-search-results"></div>';
  host.append(el);
  const form = el.querySelector('form'), status = el.querySelector('[role=status]'), results = el.querySelector('#shade-window-search-results');
  let result = null;
  const node = (tag, text) => { const el = document.createElement(tag); el.textContent = text; return el; };
  function invalidate() { result = null; results.replaceChildren(); status.textContent = 'No accepted availability search. Enter a query against the accepted sampling source.'; }
  form.addEventListener('input', invalidate); form.addEventListener('change', invalidate);
  form.addEventListener('submit', event => {
    event.preventDefault(); invalidate();
    try {
      const accepted = getAccepted(); if (!accepted) throw Error('Accept original sampling inputs first');
      const input = Object.fromEntries([...form.elements].filter(e => e.name).map(e => [e.name, e.name === 'store' ? e.value : Number(e.value)]));
      const report = searchCoolingWindows(accepted.report, input), q = report.query;
      result = { accepted, report };
      const captured = result;
      results.append(node('p', shadeHeatSourceLabel(accepted)),
        node('p', (q.store === 'surfaceC' ? 'Ground surface' : 'Lower heat store') + ' · availability ' + q.availabilityFromMinute + '–' + q.availabilityToMinute +
          ' inclusive · endpoint span ' + q.endpointSpanMinutes + ' minutes · ' + report.sampleCount + ' required integer samples per candidate · cooling ≥ ' + q.thresholdC + ' °C.'),
        node('p', 'Sample counts do not establish continuous coverage. Each solar grid stays separate; no preferred grid or physical optimum is inferred.'));
      for (const course of report.courses) {
        const section = node('section', ''); section.dataset.grid = course.solarStepMinutes;
        section.append(node('h5', course.solarStepMinutes + '-minute solar grid'));
        const best = course.firstSupported;
        section.append(node('p', best ? 'Earliest supported sampled window: ' + best.fromMinute + '–' + best.toMinute + '.' :
          course.firstUnresolved ? 'No supported window found; unresolved starts remain.' : 'Every eligible sampled start has a definite counterexample.'));
        section.append(node('p', (best ? 'Earlier starts: ' : 'All eligible starts: ') + course.earlierCounts.refuted + ' refuted; ' + course.earlierCounts.unresolved + ' unresolved.'));
        if (course.firstUnresolved) section.append(node('p', 'Earliest unresolved window: ' + course.firstUnresolved.fromMinute + '–' + course.firstUnresolved.toMinute +
          '. Earlier unresolved alternatives are not ruled out; a supported start is not established as the earliest physically workable start.'));
        if (best) {
          const button = node('button', 'Check ' + best.fromMinute + '–' + best.toMinute + ' in the existing checker'); button.type = 'button';
          button.dataset.grid = course.solarStepMinutes;
          button.addEventListener('click', () => {
            if (result !== captured || getAccepted() !== captured.accepted) return;
            inspect(captured.accepted, { fromMinute: best.fromMinute, toMinute: best.toMinute, thresholdC: q.thresholdC, store: q.store });
          }); section.append(button);
        }
        const details = node('details', ''), summary = node('summary', best ? 'Inspect every earlier eligible start' : 'Inspect every eligible start');
        const list = node('pre', course.earlierStarts.map(row => {
          const witness = row.firstFailure ?? row.firstAmbiguous;
          return row.fromMinute + '–' + row.toMinute + ': ' + row.state + '; first ' +
            (row.firstFailure ? 'definite counterexample' : 'ambiguous sample') + ' at ' + witness.minute +
            ' (' + witness.lowerC.toFixed(3) + ' / ' + witness.upperC.toFixed(3) + ' °C)';
        }).join('\n') || 'No earlier eligible starts.');
        list.style.whiteSpace = 'pre-wrap'; details.append(summary, list); section.append(details); results.append(section);
      }
      status.textContent = 'Searched every eligible integer start through the first supported window, or the full availability if none was supported.';
    } catch (error) { status.textContent = 'Refused: ' + error.message; }
  });
  invalidate(); return { invalidate };
}
