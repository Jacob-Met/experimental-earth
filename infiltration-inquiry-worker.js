import {createInfiltrationInquiry} from './infiltration-inquiry.js';

self.onmessage = ({data}) => {
  const {id,project,target,coverage} = data;
  try {
    const {steps} = createInfiltrationInquiry(project,target,coverage);
    let next, lastProgress = 0;
    do {
      next = steps.next();
      if (!next.done && (performance.now()-lastProgress >= 40 || next.value.evaluatedCount === 1)) {
        self.postMessage({id,result:next.value}); lastProgress=performance.now();
      }
    } while (!next.done);
    self.postMessage({id,result:next.value});
  } catch(error) { self.postMessage({id,result:{status:'error',message:error.message}}); }
};
