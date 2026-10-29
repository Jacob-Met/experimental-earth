import { prepareEpochSkyEvidence, parseEpochSkyEvidence } from './shade-heat-epoch-evidence.js';
self.onmessage = event => {
  try {
    const request = event.data;
    let result;
    if (request?.operation === 'prepare') result = prepareEpochSkyEvidence(request.originals, request.query);
    else if (request?.operation === 'parse') result = parseEpochSkyEvidence(request.text);
    else throw Error('Unsupported two-epoch reading operation');
    self.postMessage({ ok: true, result });
  } catch (error) { self.postMessage({ ok: false, error: error.message }); }
};
