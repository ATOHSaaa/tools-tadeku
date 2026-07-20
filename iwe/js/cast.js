import { escapeHtml, basename } from './utils.js';

function normalizeName(s) {
  return String(s || '').trim();
}

function charSheets(docs) {
  return docs.filter((d) => d.meta.type === 'character');
}

function manuscriptText(docs) {
  return docs.filter((d) => d.meta.type === 'manuscript').map((d) => d.body || '').join('\n');
}

function knownNames(sheets) {
  const set = new Set();
  for (const s of sheets) {
    if (s.meta.name) set.add(normalizeName(s.meta.name));
    const aliases = s.meta.aliases;
    if (Array.isArray(aliases)) aliases.forEach((a) => set.add(normalizeName(a)));
  }
  return set;
}

/**
 * @param {{ path: string, meta: Record<string, unknown>, body: string }[]} docs
 */
export function analyzeCharacters(docs) {
  const eng = window.TadekuCastEngine;
  if (!eng) return { error: 'Cast エンジンが読み込まれていません' };
  const sheets = charSheets(docs);
  const text = manuscriptText(docs);
  const result = eng.analyzeCast(text);
  const known = knownNames(sheets);
  const unregistered = [];
  const seen = new Set();
  for (const g of result.groups || []) {
    const name = normalizeName(g.primary || g.key);
    if (!name || known.has(name) || seen.has(name)) continue;
    seen.add(name);
    unregistered.push(name);
  }
  const variants = (result.groups || []).filter((g) => g.variants).map((g) => ({
    canonical: g.primary || g.key,
    forms: g.surfaces instanceof Map ? [...g.surfaces.keys()] : Object.keys(g.surfaces || {}),
  }));
  return { sheets, unregistered, variants, warnings: result.warnings || 0 };
}

export function renderCastPanel(container, analysis, onOpenSheet, onCreateSheet) {
  container.innerHTML = '';
  if (analysis.error) {
    container.innerHTML = `<p class="panel-empty">${escapeHtml(analysis.error)}</p>`;
    return;
  }
  const h1 = document.createElement('h4');
  h1.textContent = '人物シート';
  container.appendChild(h1);
  const list = document.createElement('ul');
  list.className = 'cast-list';
  for (const s of analysis.sheets) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = String(s.meta.name || s.meta.title || basename(s.path));
    btn.addEventListener('click', () => onOpenSheet(s.path));
    li.appendChild(btn);
    list.appendChild(li);
  }
  if (!analysis.sheets.length) list.innerHTML = '<li class="panel-empty">シートなし</li>';
  container.appendChild(list);

  const h2 = document.createElement('h4');
  h2.textContent = '未登録の名前';
  container.appendChild(h2);
  const unreg = document.createElement('ul');
  unreg.className = 'cast-list';
  for (const name of analysis.unregistered.slice(0, 30)) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = name;
    btn.addEventListener('click', () => onCreateSheet(name));
    li.appendChild(btn);
    unreg.appendChild(li);
  }
  if (!analysis.unregistered.length) unreg.innerHTML = '<li class="panel-empty">なし</li>';
  container.appendChild(unreg);

  if (analysis.variants.length) {
    const h3 = document.createElement('h4');
    h3.textContent = '表記ゆれ';
    container.appendChild(h3);
    const ul = document.createElement('ul');
    ul.className = 'cast-warn';
    for (const v of analysis.variants) {
      const li = document.createElement('li');
      li.textContent = `${v.canonical}: ${(v.forms || []).join(' / ')}`;
      ul.appendChild(li);
    }
    container.appendChild(ul);
  }
}
