/** Authored numerical control in the documented POWER response shape.
 * No value in this fixture is offered as a field observation or API download.
 */
export function authoredPowerWeather() {
  const day = '20250621';
  const values = {
    ALLSKY_SFC_SW_DNI: [0, 0, 0, 0, 20, 100, 150, 200, 300, 500, 650, 700, 680, 600, 500, 400, 300, 180, 80, 10, 0, 0, 0, 0],
    ALLSKY_SFC_SW_DIFF: [0, 0, 0, 0, 10, 30, 60, 80, 100, 120, 160, 180, 200, 180, 160, 120, 90, 60, 30, 10, 0, 0, 0, 0],
    T2M: [14, 13, 12, 12, 13, 14, 16, 19, 22, 24, 26, 27, 28, 28, 27, 26, 25, 24, 22, 20, 18, 17, 16, 15],
  };
  return { type: 'Feature', geometry: { type: 'Point', coordinates: [-.1, 51.5, 73] },
    header: { title: 'Authored POWER-format hourly control; no observed weather',
      api: { name: 'POWER Hourly API', version: 'authored-test-format' },
      sources: ['Authored numerical control'], fill_value: -999,
      time_standard: 'UTC', start: day, end: day },
    parameters: Object.fromEntries(Object.keys(values).map(key => [key, {
      units: key === 'T2M' ? 'C' : 'Wh/m^2', longname: 'Authored ' + key }])),
    properties: { parameter: Object.fromEntries(Object.entries(values).map(([key, rows]) =>
      [key, Object.fromEntries(rows.map((value, hour) => [day + String(hour).padStart(2, '0'), value]))])) }, messages: [] };
}
