import {validateProject} from './core.js';
import {compareDrainingHypotheses, validateDrainingHypotheses, hypothesisLayer} from './draining-layer-evidence.js';
import {surfaceElevationEdits, edgeGroundEdits, COMPONENT_WORK_LIMIT} from './proposal-components.js';
import {compareThreeFactors} from './proposal-factorial.js';

/** Support belongs to original observations; hypothetical worlds never refit it. */
export function compareReceivingEvidenceComponents(project, study, {subset='all'}={}) {
  validateProject(project); validateDrainingHypotheses(study);
  if (!['all','calibration','surviving'].includes(subset)) throw Error('Choose all offered, calibration-compatible or surviving receiving explanations.');
  const ground=surfaceElevationEdits(project), edges=edgeGroundEdits(project);
  if (!ground.surfaceIndices.length || !ground.elevationIndices.length || !edges.edgeIndices.length) throw Error('Declare surface, elevation and internal-edge changes for the eight-world comparison.');
  // Two original inference worlds and eight component worlds for every offered
  // explanation are bounded before inference. Filtering cannot evade the bound.
  const estimatedCellSteps=10*study.hypotheses.length*project.existing.length*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
  if (estimatedCellSteps>COMPONENT_WORK_LIMIT) throw Error('Complete receiving evidence and component comparison exceeds the ten-world-per-explanation work budget.');
  const inference=compareDrainingHypotheses(project,study);
  const base={study:structuredClone(study),subset,inference,estimatedCellSteps};
  if (inference.status==='surface-absent') return {...base,status:'surface-absent',candidates:[]};
  if (subset!=='all' && !inference.counts.calibration) return {...base,status:'need-calibration',candidates:[]};
  if (subset==='surviving' && !inference.counts.challenge) return {...base,status:'need-challenge',candidates:[]};
  const ids=subset==='all'?study.hypotheses.map(h=>h.id):subset==='calibration'?inference.compatibleIds:inference.survivingIds;
  if (!ids.length) return {...base,status:'no-supported-explanations',candidates:[]};
  const candidates=inference.candidates.filter(c=>ids.includes(c.hypothesis.id)).map(c=>({
    hypothesis:structuredClone(c.hypothesis), calibration:structuredClone(c.calibration),challenge:structuredClone(c.challenge),
    result:compareThreeFactors(project,{drainingLayer:hypothesisLayer(study,c.hypothesis)})
  }));
  return {...base,status:'compared',candidates};
}
