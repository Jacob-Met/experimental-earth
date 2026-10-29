/** Copy only original, aligned whole-site totals from an accepted comparison. */
export function retainedWaterValues(comparison) {
  const existing = comparison?.existing?.snapshots;
  const proposed = comparison?.proposal?.snapshots;
  if (!Array.isArray(existing) || !Array.isArray(proposed) ||
      !existing.length || existing.length !== proposed.length) {
    throw new Error('Paired retained water snapshots are required');
  }
  return Object.freeze(existing.map((sample, i) => {
    const other = proposed[i];
    if (!sample || !other || !Number.isFinite(sample.minute) || sample.minute < 0 ||
        sample.minute !== other.minute || (i > 0 && sample.minute <= existing[i - 1].minute) ||
        !Number.isFinite(sample.storedLiters) || sample.storedLiters < 0 ||
        !Number.isFinite(other.storedLiters) || other.storedLiters < 0) {
      throw new Error('Retained water snapshots must have aligned increasing times and finite nonnegative totals');
    }
    return Object.freeze({
      minute: sample.minute, existingLiters: sample.storedLiters,
      proposedLiters: other.storedLiters, changeLiters: other.storedLiters - sample.storedLiters,
    });
  }));
}

/** JavaScript's shortest round-trip spelling, including an original negative zero. */
export function exactWaterNumber(value, signed = false) {
  if (!Number.isFinite(value)) throw new Error('A finite water value is required');
  return (signed && value > 0 ? '+' : '') + (Object.is(value, -0) ? '-0' : String(value));
}

/** Exact maxima of retained snapshots, not interpolated or continuous-time peaks. */
function peaksFromValues(values) {
  const peak = key => {
    let liters = values[0][key];
    for (const row of values) liters = Math.max(liters, row[key]);
    const indices = values.flatMap((row, index) => row[key] === liters ? [index] : []);
    return Object.freeze({ liters, indices: Object.freeze(indices),
      minutes: Object.freeze(indices.map(index => values[index].minute)) });
  };
  return Object.freeze({ existing: peak('existingLiters'), proposed: peak('proposedLiters') });
}

export function retainedWaterPeaks(comparison) {
  return peaksFromValues(retainedWaterValues(comparison));
}

export function createWaterHistoryValues(chartWrap) {
  const document = chartWrap.ownerDocument;
  const section = document.createElement('section');
  section.id = 'water-history-values';
  section.setAttribute('aria-labelledby', 'water-history-title');
  section.innerHTML = `
    <h3 id="water-history-title">Read a retained time</h3>
    <p id="water-history-source"></p>
    <label class="water-history-time" for="water-history-snapshot">Model time
      <output id="water-history-minute" for="water-history-snapshot"></output>
    </label>
    <input id="water-history-snapshot" type="range" min="0" max="0" step="1" value="0"
      aria-describedby="water-history-help" disabled>
    <div class="water-history-navigation">
      <button type="button" id="water-history-previous" class="subtle" disabled>Previous</button>
      <span id="water-history-position"></span>
      <button type="button" id="water-history-next" class="subtle" disabled>Next</button>
    </div>
    <table>
      <caption id="water-history-caption">Whole-site surface water</caption>
      <thead><tr><th scope="col">Scenario</th><th scope="col">Litres</th></tr></thead>
      <tbody>
        <tr><th scope="row">Existing</th><td id="water-history-existing"></td></tr>
        <tr><th scope="row">Proposed</th><td id="water-history-proposed"></td></tr>
        <tr><th scope="row">Change<br>(proposed − existing)</th><td id="water-history-change"></td></tr>
      </tbody>
    </table>
    <section id="water-history-peaks" aria-labelledby="water-history-peaks-title">
      <h4 id="water-history-peaks-title">When did standing water peak?</h4>
      <p>Each scenario has its own maximum across retained snapshots. Read paired values at either peak time to compare both scenarios at the same time. These are not continuous-time peaks.</p>
      <div class="water-peak-grid">
        <div>
          <h5>Existing peak</h5>
          <p id="water-history-existing-peak"></p>
          <label for="water-history-existing-peak-time">Existing peak time</label>
          <select id="water-history-existing-peak-time" disabled></select>
          <button type="button" id="water-history-existing-peak-read" class="subtle" disabled>Read paired values at existing peak</button>
        </div>
        <div>
          <h5>Proposed peak</h5>
          <p id="water-history-proposed-peak"></p>
          <label for="water-history-proposed-peak-time">Proposed peak time</label>
          <select id="water-history-proposed-peak-time" disabled></select>
          <button type="button" id="water-history-proposed-peak-read" class="subtle" disabled>Read paired values at proposed peak</button>
        </div>
      </div>
    </section>
    <p id="water-history-help">Whole-site model totals before display rounding. Arrow keys move one retained time; Home and End select the endpoints.</p>
    <p id="water-history-status" role="status"></p>`;
  chartWrap.append(section);
  const get = id => section.querySelector('#water-history-' + id);
  const slider = get('snapshot'), previous = get('previous'), next = get('next');
  const minute = get('minute'), position = get('position'), caption = get('caption');
  const existing = get('existing'), proposed = get('proposed'), change = get('change');
  const source = get('source'), status = get('status');
  const peakControls = ['existing', 'proposed'].map(scenario => ({
    scenario, summary: get(scenario + '-peak'),
    time: get(scenario + '-peak-time'), read: get(scenario + '-peak-read'),
  }));
  let course = [], selected = 0, available = false;
  function draw() {
    const sample = course[selected];
    slider.disabled = !available || !sample;
    previous.disabled = !available || !sample || selected === 0;
    next.disabled = !available || !sample || selected === course.length - 1;
    for (const peak of peakControls) {
      peak.time.disabled = !available || !sample;
      peak.read.disabled = !available || !sample;
    }
    section.dataset.state = available && sample ? 'ready' : 'unavailable';
    status.textContent = available && sample ? '' : course.length
      ? 'Showing the last completed comparison. Time selection is unavailable until the current comparison is ready.'
      : 'The water values will be available when the comparison is ready.';
    if (!sample) return;
    slider.value = String(selected);
    const time = exactWaterNumber(sample.minute) + ' min';
    minute.textContent = time;
    position.textContent = `Snapshot ${selected + 1} of ${course.length}`;
    slider.setAttribute('aria-valuetext', `${time}; ${position.textContent.toLowerCase()}`);
    caption.textContent = 'Whole-site surface water at ' + time;
    existing.textContent = exactWaterNumber(sample.existingLiters);
    proposed.textContent = exactWaterNumber(sample.proposedLiters);
    change.textContent = exactWaterNumber(sample.changeLiters, true);
  }
  function select(index) {
    if (available && Number.isInteger(index) && index >= 0 && index < course.length) selected = index;
    // Restore the retained choice even if a synthetic event changes a disabled input.
    draw();
  }
  slider.addEventListener('input', () => select(Number(slider.value)));
  previous.addEventListener('click', () => select(selected - 1));
  next.addEventListener('click', () => select(selected + 1));
  for (const peak of peakControls) peak.read.addEventListener('click', () => select(Number(peak.time.value)));
  draw();
  return {
    selectMinute(value) {
      const index = available && Number.isFinite(value) ? course.findIndex(row => row.minute === value) : -1;
      if (index < 0) return false;
      select(index); slider.focus(); return true;
    },
    update(comparison, projectTitle) {
      const values = retainedWaterValues(comparison);
      const previousMinute = course[selected]?.minute;
      const retained = values.findIndex(sample => sample.minute === previousMinute);
      const peaks = peaksFromValues(values);
      for (const control of peakControls) {
        const peak = peaks[control.scenario];
        control.summary.textContent = exactWaterNumber(peak.liters) + ' L · ' + peak.indices.length +
          (peak.indices.length === 1 ? ' retained peak time' : ' tied retained peak times');
        control.time.replaceChildren(...peak.indices.map((index, tie) => {
          const option = document.createElement('option');
          option.value = String(index);
          option.textContent = exactWaterNumber(values[index].minute) + ' min (peak time ' +
            (tie + 1) + ' of ' + peak.indices.length + ')';
          return option;
        }));
        control.time.value = String(peak.indices[0]);
      }
      course = values;
      selected = retained >= 0 ? retained : values.length - 1;
      slider.max = String(values.length - 1);
      source.textContent = 'Completed comparison: ' + projectTitle;
      draw();
    },
    setAvailable(value) { available = value === true; draw(); },
  };
}
