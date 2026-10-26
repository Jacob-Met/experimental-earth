const compact = value => String(value ?? '').replace(/\s+/gu, ' ').trim();
const searchable = value => compact(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** Literal words may occur in either the original question or its introduction. */
export function filterInvestigations(entries, query) {
  const words = searchable(query).split(' ').filter(Boolean);
  return entries.filter(entry => {
    const text = searchable([entry.title, entry.description, entry.topic].join(' '));
    return words.every(word => text.includes(word));
  });
}

export function mountInvestigationNavigation() {
  const workspace = document.querySelector('.workspace');
  if (!workspace || document.getElementById('investigation-navigation')) return null;

  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./investigation-navigation.css', import.meta.url);
  document.head.append(style);

  const nav = document.createElement('nav');
  nav.id = 'investigation-navigation';
  nav.className = 'investigation-navigation';
  nav.setAttribute('aria-labelledby', 'investigation-navigation-title');
  nav.innerHTML = `<div class="investigation-navigation-heading">
      <div><span class="eyebrow">EXPLORE THE FIELD LAB</span>
        <h2 id="investigation-navigation-title">What would you like to investigate?</h2></div>
      <p>Find a question and open its workbench.</p>
    </div>
    <label for="investigation-search">Find an investigation</label>
    <div class="investigation-search-controls">
      <input id="investigation-search" type="search" placeholder="Try rain, shade, soil or temperature" autocomplete="off" aria-describedby="investigation-search-status" aria-controls="investigation-results">
      <button id="investigation-search-clear" type="button" disabled>Clear</button>
    </div>
    <p id="investigation-search-status" role="status" aria-live="polite" aria-atomic="true"></p>
    <details id="investigation-browse"><summary>Browse investigations</summary>
      <ul id="investigation-results"></ul>
    </details>`;
  (workspace.closest('.layout') ?? workspace).before(nav);

  const returnLink = document.createElement('a');
  returnLink.className = 'investigation-return';
  returnLink.href = '#investigation-navigation';
  returnLink.textContent = 'Find an investigation ↑';
  returnLink.hidden = true;
  document.body.append(returnLink);

  const input = nav.querySelector('#investigation-search');
  const clear = nav.querySelector('#investigation-search-clear');
  const status = nav.querySelector('#investigation-search-status');
  const browse = nav.querySelector('#investigation-browse');
  const summary = browse.querySelector('summary');
  const list = nav.querySelector('#investigation-results');
  let entries = [], signature = '', queued = false, pendingHash = window.location.hash;

  function uniqueId(suggestion, element) {
    let id = suggestion, suffix = 2;
    while (document.getElementById(id) && document.getElementById(id) !== element) id = suggestion + '-' + suffix++;
    return id;
  }

  function collect() {
    return [...workspace.querySelectorAll('section.panel')].flatMap(panel => {
      if (panel.closest('[hidden], [aria-hidden="true"]')) return [];
      const heading = panel.querySelector('h2, h3');
      if (!heading || heading.closest('section.panel') !== panel) return [];
      const title = compact(heading.textContent);
      if (!title) return [];
      const paragraph = [...panel.querySelectorAll('p')].find(p => p.closest('section.panel') === panel);
      const eyebrow = [...panel.querySelectorAll('.eyebrow')].find(p => p.closest('section.panel') === panel);
      let anchor = panel.id && document.getElementById(panel.id) === panel ? panel : heading;
      if (!anchor.id || document.getElementById(anchor.id) !== anchor) {
        const slug = searchable(title).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'question';
        anchor.id = uniqueId('investigation-' + slug, anchor);
      }
      return [{id: anchor.id, title, description: compact(paragraph?.textContent),
        topic: compact(eyebrow?.textContent), anchor, heading}];
    });
  }

  function reveal(entry) {
    for (let ancestor = entry.heading.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === 'DETAILS') ancestor.open = true;
    }
    if (!entry.heading.hasAttribute('tabindex')) entry.heading.tabIndex = -1;
    entry.heading.dataset.investigationHeading = '';
    entry.heading.focus({preventScroll: true});
  }

  function followHash() {
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { pendingHash = null; return; }
    if (id === nav.id) {
      pendingHash = null;
      input.focus({preventScroll: true});
      nav.scrollIntoView({block: 'start', behavior: 'instant'});
      return;
    }
    const entry = entries.find(candidate => candidate.id === id || candidate.heading.id === id);
    if (entry) {
      pendingHash = null;
      reveal(entry);
      entry.anchor.scrollIntoView({block: 'start', behavior: 'instant'});
    } else pendingHash = window.location.hash || null;
  }

  function render() {
    const matches = filterInvestigations(entries, input.value);
    const hasQuery = compact(input.value).length > 0;
    const focusedId = document.activeElement?.closest('#investigation-results a')?.dataset.investigationId;
    clear.disabled = !input.value;
    status.textContent = hasQuery
      ? matches.length ? matches.length + ' of ' + entries.length + ' investigations match.'
        : 'No matching investigations. Try fewer words or clear the search to browse.'
      : entries.length + ' investigations available. Search or browse their questions.';
    summary.textContent = hasQuery ? 'Matching questions (' + matches.length + ')' : 'Browse all ' + entries.length + ' investigations';
    const fragment = document.createDocumentFragment();
    for (const entry of matches) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = '#' + encodeURIComponent(entry.id);
      link.dataset.investigationId = entry.id;
      const title = document.createElement('strong');
      title.textContent = entry.title;
      link.append(title);
      if (entry.description) {
        const description = document.createElement('span');
        description.textContent = entry.description.length > 190 ? entry.description.slice(0, 187).trimEnd() + '…' : entry.description;
        link.append(description);
      }
      item.append(link);
      fragment.append(item);
    }
    list.replaceChildren(fragment);
    if (focusedId) {
      [...list.querySelectorAll('a')].find(link => link.dataset.investigationId === focusedId)?.focus({preventScroll: true});
    }
  }

  function refresh() {
    queued = false;
    const next = collect();
    const nextSignature = JSON.stringify(next.map(({id, title, description, topic}) => [id, title, description, topic]));
    if (nextSignature === signature) return;
    entries = next;
    signature = nextSignature;
    render();
    // Resolve a not-yet-mounted deep link without stealing focus on later updates.
    if (pendingHash && pendingHash === window.location.hash) followHash();
  }

  function search() {
    browse.open = Boolean(compact(input.value));
    render();
  }
  function resetSearch() {
    input.value = '';
    search();
    input.focus({preventScroll: true});
  }
  input.addEventListener('input', search);
  input.addEventListener('search', search);
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape' && input.value) { event.preventDefault(); resetSearch(); }
    if (event.key === 'Enter') {
      const first = list.querySelector('a');
      if (first) { event.preventDefault(); first.click(); }
    }
  });
  clear.addEventListener('click', resetSearch);
  list.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const link = event.target.closest('a[data-investigation-id]');
    const entry = entries.find(candidate => candidate.id === link?.dataset.investigationId);
    if (entry) reveal(entry); // Native anchors retain browser history and new-tab behavior.
  });
  returnLink.addEventListener('click', event => {
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) input.focus({preventScroll: true});
  });
  window.addEventListener('hashchange', followHash);

  const observer = new MutationObserver(records => {
    const relevant = records.some(record => {
      if (record.type === 'attributes') return record.target.matches('section.panel') || record.target.querySelector?.('section.panel');
      if (entries.some(entry => entry.heading.contains(record.target))) return true;
      return [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 &&
        (node.matches('section.panel') || node.querySelector('section.panel')));
    });
    if (relevant && !queued) { queued = true; queueMicrotask(refresh); }
  });
  refresh();
  observer.observe(workspace, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden']});
  const visibility = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
    returnLink.hidden = entry.isIntersecting;
  }) : null;
  visibility?.observe(nav);
  if (!visibility) returnLink.hidden = false;
  return {refresh, destroy() {
    observer.disconnect(); visibility?.disconnect();
    window.removeEventListener('hashchange', followHash);
    nav.remove(); returnLink.remove(); style.remove();
  }};
}
