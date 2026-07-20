import { escapeHtml, stripExt, basename } from './utils.js';

/**
 * @param {string} query
 * @param {{ path: string, meta: Record<string, unknown>, body: string }[]} docs
 */
export function searchDocuments(query, docs) {
  const q = (query || '').trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  /** @type {{ path: string, title: string, lines: { num: number, text: string }[] }[]} */
  const results = [];
  for (const doc of docs) {
    const lines = (doc.body || '').split('\n');
    const hits = [];
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(lower) || (doc.meta.title || '').toLowerCase().includes(lower)) {
        hits.push({ num: i + 1, text: line });
      }
    });
    if (hits.length) results.push({ path: doc.path, title: String(doc.meta.title || basename(doc.path)), lines: hits.slice(0, 8) });
  }
  return results;
}

/**
 * @param {string} target
 * @param {{ path: string, meta: Record<string, unknown> }[]} docs
 */
export function resolveLinkTarget(target, docs) {
  const t = (target || '').trim();
  if (!t) return null;
  const exact = docs.filter((d) => d.path === t || d.path.endsWith('/' + t) || basename(d.path) === t);
  if (exact.length === 1) return exact[0].path;
  const base = stripExt(t);
  const byTitle = docs.filter((d) => stripExt(basename(d.path)) === base || d.meta.title === t || d.meta.title === base);
  if (byTitle.length === 1) return byTitle[0].path;
  if (byTitle.length > 1) return { ambiguous: byTitle.map((d) => d.path) };
  if (exact.length > 1) return { ambiguous: exact.map((d) => d.path) };
  return null;
}

/**
 * @param {string} currentPath
 * @param {{ path: string, meta: Record<string, unknown>, body: string }[]} docs
 */
export function findBacklinks(currentPath, docs) {
  const wiki = [];
  const source = [];
  const curBase = stripExt(basename(currentPath));
  const curTitle = docs.find((d) => d.path === currentPath)?.meta.title;
  for (const doc of docs) {
    if (doc.path === currentPath) continue;
    if (doc.meta.source === currentPath) source.push({ path: doc.path, title: doc.meta.title || basename(doc.path) });
    const re = /\[\[([^\]]+)\]\]/g;
    let m;
    while ((m = re.exec(doc.body || '')) !== null) {
      const t = m[1].trim();
      if (t === currentPath || t === basename(currentPath) || t === curBase || t === curTitle) {
        wiki.push({ path: doc.path, title: doc.meta.title || basename(doc.path) });
        break;
      }
    }
  }
  return { wiki, source };
}

export function renderSearchResults(container, results, onOpen) {
  container.innerHTML = '';
  if (!results.length) {
    container.innerHTML = '<p class="panel-empty">該当なし</p>';
    return;
  }
  for (const r of results) {
    const sec = document.createElement('section');
    sec.className = 'search-group';
    const h = document.createElement('button');
    h.type = 'button';
    h.className = 'search-file';
    h.textContent = r.title;
    h.addEventListener('click', () => onOpen(r.path));
    sec.appendChild(h);
    const ul = document.createElement('ul');
    for (const ln of r.lines) {
      const li = document.createElement('li');
      li.innerHTML = `<span class="ln">${ln.num}</span> ${escapeHtml(ln.text)}`;
      li.addEventListener('click', () => onOpen(r.path, ln.num));
      ul.appendChild(li);
    }
    sec.appendChild(ul);
    container.appendChild(sec);
  }
}

export function renderBacklinks(container, links, onOpen) {
  container.innerHTML = '';
  if (!links.wiki.length && !links.source.length) {
    container.innerHTML = '<p class="panel-empty">リンクはありません</p>';
    return;
  }
  if (links.source.length) {
    const h = document.createElement('h4');
    h.textContent = 'このファイルから派生';
    container.appendChild(h);
    const ul = document.createElement('ul');
    for (const l of links.source) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(l.title);
      btn.addEventListener('click', () => onOpen(l.path));
      li.appendChild(btn);
      ul.appendChild(li);
    }
    container.appendChild(ul);
  }
  if (links.wiki.length) {
    const h = document.createElement('h4');
    h.textContent = '[[リンク]] から参照';
    container.appendChild(h);
    const ul = document.createElement('ul');
    for (const l of links.wiki) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = String(l.title);
      btn.addEventListener('click', () => onOpen(l.path));
      li.appendChild(btn);
      ul.appendChild(li);
    }
    container.appendChild(ul);
  }
}
