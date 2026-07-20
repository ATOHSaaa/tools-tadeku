/** @typedef {{ title?: string, type?: string, source?: string, name?: string, aliases?: string[] }} Frontmatter */

export function randomId(len = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const WHITESPACE = /[\s\u3000]/;

export function countChars(text) {
  if (!text) return 0;
  let n = 0;
  for (const ch of text) {
    if (!WHITESPACE.test(ch)) n++;
  }
  return n;
}

/**
 * @param {string} content
 * @returns {{ meta: Frontmatter, body: string }}
 */
export function parseFrontmatter(content) {
  const raw = content || '';
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    let val = kv[2].trim();
    if (val.startsWith('[') && val.endsWith(']')) {
      meta[key] = val.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      meta[key] = val;
    }
  }
  return { meta, body: m[2] };
}

/**
 * @param {Frontmatter} meta
 * @param {string} body
 */
export function serializeFrontmatter(meta, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(meta)) {
    if (v == null || v === '') continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.join(', ')}]`);
    else lines.push(`${k}: ${v}`);
  }
  lines.push('---', '');
  return lines.join('\n') + (body || '');
}

export function formatNowSnapshot() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function basename(path) {
  const p = path.replace(/\\/g, '/');
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(i + 1) : p;
}

export function dirname(path) {
  const p = path.replace(/\\/g, '/');
  const i = p.lastIndexOf('/');
  return i >= 0 ? p.slice(0, i) : '';
}

export function stripExt(name) {
  return name.replace(/\.md$/i, '');
}

/** @param {string} a @param {string} b */
export function lineDiff(a, b) {
  const la = (a || '').split('\n');
  const lb = (b || '').split('\n');
  const out = [];
  const max = Math.max(la.length, lb.length);
  for (let i = 0; i < max; i++) {
    const x = la[i];
    const y = lb[i];
    if (x === y) out.push({ type: 'same', line: x ?? '' });
    else {
      if (x !== undefined) out.push({ type: 'remove', line: x });
      if (y !== undefined) out.push({ type: 'add', line: y });
    }
  }
  return out;
}

export const DOC_TYPES = {
  memo: { dir: 'memos', label: 'メモ' },
  plot: { dir: 'plots', label: 'プロット' },
  manuscript: { dir: 'manuscript', label: '原稿' },
  character: { dir: 'characters', label: '人物' },
};

export const TYPE_DIRS = {
  memos: 'memo',
  plots: 'plot',
  manuscript: 'manuscript',
  characters: 'character',
};
