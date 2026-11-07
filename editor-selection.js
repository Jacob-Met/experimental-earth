/**
 * The scientific model intentionally permits projects without an editor focus.
 * Only the interactive workspace needs a concrete cell to render observations.
 * Preserve all original scientific inputs, provenance and valid focused cells.
 */
export function admitEditorSelection(project) {
  if (project.selectedIndex === undefined) return { ...project, selectedIndex: 0 };
  return project;
}
