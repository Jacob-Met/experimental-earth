import { serializeObservationCSV } from './observation-export.js';

export function mountObservationExport({ getProject }) {
  const list = document.getElementById('observation-list');
  if (!list || document.getElementById('observation-export')) {
    throw new Error('The observation export needs one mounted notebook.');
  }
  const panel = document.createElement('div');
  panel.id = 'observation-export';
  panel.className = 'observation-export';
  const explanation = document.createElement('p');
  explanation.id = 'observation-export-description';
  explanation.className = 'mini-note';
  explanation.textContent = 'Share all retained readings as grid cells, modeled minutes and water depth and uncertainty in millimetres. Use Export JSON to keep the complete project and any retained original units, station mappings and clock details.';
  const actions = document.createElement('div');
  actions.className = 'obs-actions';
  const button = document.createElement('button');
  button.id = 'export-observation-csv';
  button.type = 'button';
  button.className = 'subtle';
  button.textContent = 'Export observation CSV';
  button.setAttribute('aria-describedby', explanation.id + ' observation-export-status');
  actions.append(button);
  const status = document.createElement('p');
  status.id = 'observation-export-status';
  status.className = 'mini-note';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  panel.append(explanation, actions, status);
  list.before(panel);

  function refresh() {
    const readings = getProject().observations;
    button.disabled = readings.length === 0;
    status.textContent = readings.length
      ? readings.length + (readings.length === 1 ? ' retained reading ready to export.' : ' retained readings ready to export.')
      : 'Retain a reading to enable CSV export.';
  }

  button.addEventListener('click', () => {
    let url, link;
    try {
      const project = getProject();
      const csv = serializeObservationCSV(project);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      url = URL.createObjectURL(blob);
      link = document.createElement('a');
      link.href = url;
      link.download = 'experimental-earth-observations.csv';
      document.body.append(link);
      link.click();
      status.textContent = 'CSV export started for ' + project.observations.length +
        (project.observations.length === 1 ? ' reading.' : ' readings.');
    } catch (error) {
      status.textContent = 'CSV export refused: ' + error.message + ' The notebook is unchanged.';
    } finally {
      link?.remove();
      if (url) setTimeout(() => URL.revokeObjectURL(url), 500);
    }
  });
  refresh();
  return { refresh };
}
