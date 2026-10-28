/** Label only the validated original source attached to an accepted comparison. */
export function shadeHeatSourceLabel(accepted) {
  const { project, declaration } = accepted.investigation.source;
  const index = project.heatColumnStudy.heatStudy.cellIndex;
  const cell = String.fromCharCode(65 + index % project.width) + (Math.floor(index / project.width) + 1);
  return project.title + ' · ' + project.width + ' × ' + project.height +
    ' grid · receiver ' + cell + ' · weather day ' + declaration.path.startUtc.slice(0, 10) + ' UTC';
}
