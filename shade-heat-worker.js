import { prepareShadeHeatInvestigation, parseShadeHeatInvestigation, serializeShadeHeatInvestigation } from './shade-heat.js';
self.onmessage = event => {
  try {
    const message = event.data;
    let result;
    if (message?.operation === 'prepare') result = prepareShadeHeatInvestigation(message.project, message.declaration);
    else if (message?.operation === 'parse') result = parseShadeHeatInvestigation(message.text);
    else if (message?.operation === 'serialize') result = serializeShadeHeatInvestigation(message.project, message.declaration);
    else throw Error('Unsupported shade and heat calculation request');
    self.postMessage({ ok: true, result });
  } catch (error) { self.postMessage({ ok: false, error: error.message }); }
};
