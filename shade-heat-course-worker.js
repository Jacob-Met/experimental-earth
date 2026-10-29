import { prepareSkyCourseEvidence, parseSkyCourseEvidence } from './shade-heat-course-evidence.js';
self.onmessage = event => {
  try {
    const request = event.data;
    let result;
    if (request?.operation === 'prepare') result = prepareSkyCourseEvidence(request.originals, request.query);
    else if (request?.operation === 'parse') result = parseSkyCourseEvidence(request.text);
    else throw Error('Unsupported original sky-course operation');
    self.postMessage({ ok: true, result });
  } catch (error) { self.postMessage({ ok: false, error: error.message }); }
};
