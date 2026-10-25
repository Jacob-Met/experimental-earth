import {observedStorage} from './observed-storage.js';

/** Conditional change in original cell-representative bands, not a treatment effect. */
export function observedStorageChange(project, results, query) {
  const {startMinute, endMinute, ...shared} = query ?? {};
  if (!Number.isFinite(startMinute) || !Number.isFinite(endMinute) || endMinute <= startMinute) throw Error('Choose two increasing exact event minutes');
  const before = observedStorage(project, results, {...shared, minute:startMinute});
  const after = observedStorage(project, results, {...shared, minute:endMinute});
  const context = {before, after, startMinute, endMinute};
  if (before.status === 'contradictory' || after.status === 'contradictory') return {...context,status:'contradictory',cells:[],observedChangeLiters:null,siteChangeLiters:null};
  const prior = new Map(before.cells.map(cell => [cell.cellIndex, cell]));
  const cells = after.cells.filter(cell => prior.has(cell.cellIndex)).map(cell => {
    const first = prior.get(cell.cellIndex), area = before.areaM2;
    return {cellIndex:cell.cellIndex,before:first,after:cell,lowerLiters:(cell.lowerMm-first.upperMm)*area,upperLiters:(cell.upperMm-first.lowerMm)*area};
  });
  if (!cells.length) return {...context,status:'no-common-readings',cells,observedChangeLiters:null,siteChangeLiters:null};
  const lower = cells.reduce((sum,cell)=>sum+cell.lowerLiters,0);
  const upper = cells.reduce((sum,cell)=>sum+cell.upperLiters,0);
  return {...context,status:'bounded',cells,observedChangeLiters:{lower,upper},siteChangeLiters:cells.length === before.totalCells ? {lower,upper} : null,
    missingCells:before.totalCells-cells.length,
    interpretation:'After minus before on cells observed at both exact times. Bounds assume only the original bands; shared sensor error cancellation is not inferred. A change does not identify its cause.'};
}
