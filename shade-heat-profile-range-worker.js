import { prepareShadeHeatProfileRange, parseShadeHeatProfileRange } from './shade-heat-profile-range.js';

self.onmessage = event => {
  try {
    const message = event.data;
    let result;
    if (message?.operation === 'prepare')
      result = prepareShadeHeatProfileRange(message.project, message.declaration, message.query);
    else if (message?.operation === 'parse') result = parseShadeHeatProfileRange(message.text);
    else throw Error('Unsupported shared-profile inquiry request');
    self.postMessage({ ok: true, result });
  } catch (error) { self.postMessage({ ok: false, error: error.message }); }
};
