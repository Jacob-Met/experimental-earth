import { prepareShadeHeatProfileEvidence, parseShadeHeatProfileEvidence } from './shade-heat-profile-evidence.js';

self.onmessage = event => {
  try {
    const message = event.data;
    let result;
    if (message?.operation === 'prepare')
      result = prepareShadeHeatProfileEvidence(message.project, message.declaration, message.query);
    else if (message?.operation === 'parse') result = parseShadeHeatProfileEvidence(message.text);
    else throw Error('Unsupported original profile-reading request');
    self.postMessage({ ok: true, result });
  } catch (error) { self.postMessage({ ok: false, error: error.message }); }
};
