// Bounded reader for this explicit table contract, including quoted commas,
// escaped double quotes, CRLF and quoted multiline source descriptions.
export function records(text, { maxRows = 100, label = 'Observation table', rowLabel = 'observation' } = {}) {
  if (typeof text !== 'string' || text.length > 128000) throw new Error(`${label} exceeds the 128 KB text limit`);
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let fields = [], field = '', quoted = false, closed = false, line = 1, startLine = 1;
  const finishField = () => { fields.push(field); field = ''; closed = false; };
  const finishRow = () => {
    finishField();
    if (fields.some(value => value.trim() !== '')) rows.push({ fields, line: startLine });
    if (rows.length > maxRows + 1) throw new Error(`At most ${maxRows} ${rowLabel} rows may be imported`);
    fields = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; closed = true; }
      } else if (c === '\r' || c === '\n') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        field += '\n'; line++;
      } else field += c;
    } else if (c === ',') finishField();
    else if (c === '\r' || c === '\n') {
      finishRow(); if (c === '\r' && text[i + 1] === '\n') i++;
      line++; startLine = line;
    } else if (c === '"') {
      if (field !== '' || closed) throw new Error(`Line ${line}: unexpected quote`);
      quoted = true;
    } else {
      if (closed) throw new Error(`Line ${line}: text after a closing quote`);
      field += c;
    }
  }
  if (quoted) throw new Error(`Line ${startLine}: unclosed quoted field`);
  if (fields.length || field !== '' || closed) finishRow();
  return rows;
}

