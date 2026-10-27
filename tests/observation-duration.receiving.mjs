import assert from 'node:assert/strict';

/** Receive manual observation times through the ordinary duration and form controls. */
export async function receiveObservationDuration({ evaluate, send, report }) {
  const previousWorkspace = await evaluate("localStorage.getItem('experimental-earth-site-v1')");
  const snapshot = () => evaluate(`(() => {
    const project = JSON.parse(localStorage.getItem('experimental-earth-site-v1'));
    const minute = document.querySelector('#obs-minute');
    return {
      duration: Number(document.querySelector('#duration').value),
      storedDuration: project.weather.durationMinutes,
      storm: project.weather.stormMinutes,
      selectedIndex: project.selectedIndex,
      maximum: minute.max,
      minute: minute.value,
      valid: minute.validity.valid,
      rangeOverflow: minute.validity.rangeOverflow,
      depth: document.querySelector('#obs-depth').value,
      source: document.querySelector('#obs-source').value,
      draftStatus: document.querySelector('#observation-draft-status').textContent,
      observations: project.observations,
    };
  })()`);
  const changeDuration = value => evaluate(`(() => {
    const input = document.querySelector('#duration');
    input.value = ${JSON.stringify(String(value))};
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  const prepareReading = (minute, source, depth = '14') => evaluate(`(() => {
    const values = ${JSON.stringify({ minute: String(minute), source, depth })};
    const input = (id, value) => {
      const element = document.querySelector(id);
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
    };
    // Retarget first, as a person would, then enter the new reading and source.
    input('#obs-minute', values.minute);
    input('#obs-depth', values.depth);
    input('#obs-uncertainty', '3');
    input('#obs-source', values.source);
    document.querySelector('#obs-scenario').value = 'existing';
    document.querySelector('#obs-use').value = 'challenge';
  })()`);
  const submit = async () => {
    // requestSubmit exercises native form constraints; dispatching a submit
    // event directly would bypass the range limit that caused this failure.
    await evaluate("document.querySelector('#observe-form').requestSubmit()");
    return snapshot();
  };

  await evaluate("document.querySelector('#reset').click()");
  let state = await snapshot();
  assert.equal(state.storedDuration, 240);
  assert.equal(state.maximum, '240');
  assert.equal(state.observations.length, 0);

  await prepareReading(200, 'duration receiving: unchanged in-range draft');
  await changeDuration(360);
  state = await snapshot();
  assert.equal(state.storedDuration, 360, 'the longer simulation horizon is saved');
  assert.equal(state.maximum, '360', 'the observation maximum follows the accepted duration without reload');
  assert.equal(state.minute, '200');
  assert.equal(state.depth, '14', 'extending the horizon preserves an in-range draft');
  assert.equal(state.source, 'duration receiving: unchanged in-range draft');
  assert.equal(state.valid, true);
  assert.equal(state.observations.length, 0);

  await prepareReading(300, 'duration receiving: later authored reading');
  state = await snapshot();
  assert.equal(state.valid, true, 'minute 300 is admissible within the extended horizon');
  assert.equal(state.rangeOverflow, false);
  const selectedIndex = state.selectedIndex;
  state = await submit();
  assert.equal(state.observations.length, 1, 'ordinary form submission retains the later reading');
  assert.deepEqual(state.observations[0], {
    cellIndex: selectedIndex, minute: 300, depthMm: 14, uncertaintyMm: 3,
    source: 'duration receiving: later authored reading', scenario: 'existing', use: 'challenge',
  });
  const retained = state.observations;
  report.push('manual duration extension updates the observation bound, preserves an in-range draft, and accepts a sourced minute-300 reading');

  await prepareReading(361, 'duration receiving: outside the extended horizon');
  state = await snapshot();
  assert.equal(state.rangeOverflow, true, 'extending the horizon keeps an actual upper bound');
  assert.equal(state.valid, false);
  state = await submit();
  assert.deepEqual(state.observations, retained, 'an out-of-horizon reading is not retained');

  await prepareReading(330, 'duration receiving: draft after rejected shortening', '9');
  await changeDuration(240);
  state = await snapshot();
  assert.equal(state.storedDuration, 360, 'a retained minute-300 reading prevents shortening to 240');
  assert.equal(state.duration, 360);
  assert.equal(state.maximum, '360', 'a rejected edit preserves the last accepted observation maximum');
  assert.equal(state.minute, '330');
  assert.equal(state.depth, '9');
  assert.equal(state.source, 'duration receiving: draft after rejected shortening');
  assert.deepEqual(state.observations, retained);

  // The caller supplies the maintained ready-aware reload wrapper. A raw
  // Page.reload acknowledgement alone does not mean the new app is mounted.
  await send('Page.reload', { ignoreCache: true });
  state = await snapshot();
  assert.equal(state.storedDuration, 360);
  assert.equal(state.maximum, '360');
  assert.deepEqual(state.observations, retained, 'the accepted later reading survives a real reload');
  report.push('out-of-horizon submission and invalid shortening preserve retained readings; the longer horizon and minute-300 reading survive reload');

  await evaluate("document.querySelector('#reset').click()");
  await prepareReading(200, 'duration receiving: draft beyond a shorter horizon', '8');
  await changeDuration(120);
  state = await snapshot();
  assert.equal(state.storedDuration, 120);
  assert.equal(state.maximum, '120');
  assert.equal(state.minute, String(state.storm), 'an out-of-range draft retargets using the existing storm-time policy');
  assert.equal(state.depth, '', 'retargeting does not attach the old depth to the new time');
  assert.equal(state.source, '', 'retargeting does not attach the old source to the new time');
  assert.match(state.draftStatus, /Unsaved reading cleared.*observation time changed/i);
  assert.equal(state.observations.length, 0);

  await prepareReading(121, 'duration receiving: outside the shorter horizon');
  state = await snapshot();
  assert.equal(state.rangeOverflow, true, 'the shorter horizon also updates native form validation');
  state = await submit();
  assert.equal(state.observations.length, 0);

  await prepareReading(90, 'duration receiving: draft after rejected weather', '6');
  await changeDuration(30); // The example storm lasts 60 minutes.
  state = await snapshot();
  assert.equal(state.storedDuration, 120);
  assert.equal(state.duration, 120);
  assert.equal(state.maximum, '120');
  assert.equal(state.minute, '90');
  assert.equal(state.depth, '6');
  assert.equal(state.source, 'duration receiving: draft after rejected weather');
  assert.equal(state.observations.length, 0);

  await prepareReading(120, 'duration receiving: exact horizon boundary', '2');
  state = await snapshot();
  assert.equal(state.valid, true, 'the horizon boundary remains inclusive');
  state = await submit();
  assert.equal(state.observations.length, 1);
  assert.equal(state.observations[0].minute, 120);
  assert.equal(state.observations[0].depthMm, 2);
  assert.equal(state.observations[0].source, 'duration receiving: exact horizon boundary');
  report.push('accepted shortening clears only the retargeted draft; invalid weather preserves the draft; the exact shorter-horizon boundary remains usable');

  // Restore this isolated test profile's incoming saved workspace on success,
  // so subsequent receiving courses do not inherit these fixture readings.
  await evaluate(previousWorkspace === null
    ? "localStorage.removeItem('experimental-earth-site-v1')"
    : `localStorage.setItem('experimental-earth-site-v1', ${JSON.stringify(previousWorkspace)})`);
  await send('Page.reload', { ignoreCache: true });
}
