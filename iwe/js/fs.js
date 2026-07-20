import LightningFS from 'https://esm.sh/@isomorphic-git/lightning-fs@4.6.0';
import {
  randomId, parseFrontmatter, serializeFrontmatter, basename, dirname, countChars, DOC_TYPES,
} from './utils.js';

const FS_NAME = 'iwe-fs';
const WORKS_ROOT = '/works';

let fsInstance = null;

function getFs() {
  if (!fsInstance) fsInstance = new LightningFS(FS_NAME);
  return fsInstance;
}

function pfs() {
  return getFs().promises;
}

async function ensureDir(path) {
  const parts = path.split('/').filter(Boolean);
  let cur = '';
  for (const part of parts) {
    cur += '/' + part;
    try {
      await pfs().mkdir(cur);
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
}

async function exists(path) {
  try {
    await pfs().stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readText(path) {
  const buf = await pfs().readFile(path, { encoding: 'utf8' });
  return typeof buf === 'string' ? buf : new TextDecoder().decode(buf);
}

async function writeText(path, content) {
  await ensureDir(path.substring(0, path.lastIndexOf('/')));
  await pfs().writeFile(path, content, { encoding: 'utf8' });
}

async function listDirRecursive(dir, base = '') {
  /** @type {string[]} */
  const files = [];
  let entries;
  try {
    entries = await pfs().readdir(dir);
  } catch {
    return files;
  }
  for (const name of entries) {
    if (name === '.git') continue;
    const full = dir + '/' + name;
    const rel = base ? base + '/' + name : name;
    const st = await pfs().stat(full);
    if (st.isDirectory()) {
      files.push(...await listDirRecursive(full, rel));
    } else {
      files.push(rel);
    }
  }
  return files;
}

export function workRoot(workId) {
  return `${WORKS_ROOT}/${workId}`;
}

export function workPath(workId, rel = '') {
  const root = workRoot(workId);
  return rel ? `${root}/${rel.replace(/^\/+/, '')}` : root;
}

export async function listWorks() {
  await ensureDir(WORKS_ROOT);
  const entries = await pfs().readdir(WORKS_ROOT);
  /** @type {{ id: string, title: string, createdAt?: string, targetChars?: number|null }[]} */
  const works = [];
  for (const id of entries) {
    const metaPath = workPath(id, 'iwe.json');
    if (!(await exists(metaPath))) continue;
    try {
      const meta = JSON.parse(await readText(metaPath));
      works.push({ id, title: meta.title || id, createdAt: meta.createdAt, targetChars: meta.targetChars ?? null });
    } catch {
      works.push({ id, title: id });
    }
  }
  works.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return works;
}

export async function createWork(title) {
  const id = randomId();
  const root = workRoot(id);
  await ensureDir(root);
  for (const { dir } of Object.values(DOC_TYPES)) {
    await ensureDir(`${root}/${dir}`);
  }
  const meta = { title: title || '無題の作品', createdAt: new Date().toISOString(), targetChars: null };
  await writeText(`${root}/iwe.json`, JSON.stringify(meta, null, 2) + '\n');
  return { id, meta };
}

export async function readWorkMeta(workId) {
  const raw = await readText(workPath(workId, 'iwe.json'));
  return JSON.parse(raw);
}

export async function writeWorkMeta(workId, meta) {
  await writeText(workPath(workId, 'iwe.json'), JSON.stringify(meta, null, 2) + '\n');
}

export async function listWorkFiles(workId) {
  const files = await listDirRecursive(workRoot(workId));
  return files.filter((f) => f !== 'iwe.json' && f.endsWith('.md')).sort();
}

export async function readDocument(workId, relPath) {
  const content = await readText(workPath(workId, relPath));
  const { meta, body } = parseFrontmatter(content);
  return { meta, body, raw: content, path: relPath };
}

export async function writeDocument(workId, relPath, meta, body) {
  const content = serializeFrontmatter(meta, body);
  await writeText(workPath(workId, relPath), content);
  return content;
}

export async function deleteDocument(workId, relPath) {
  await pfs().unlink(workPath(workId, relPath));
}

export async function renameDocument(workId, fromRel, toRel) {
  await ensureDir(workPath(workId, dirname(toRel)));
  await pfs().rename(workPath(workId, fromRel), workPath(workId, toRel));
}

export async function createDocument(workId, type, title, body = '', extraMeta = {}) {
  const info = DOC_TYPES[type];
  if (!info) throw new Error('unknown type');
  const safe = (title || '無題').replace(/[/\\:*?"<>|]/g, '_').trim() || '無題';
  let filename;
  if (type === 'manuscript') {
    const existing = (await listWorkFiles(workId)).filter((f) => f.startsWith('manuscript/'));
    const nums = existing.map((f) => parseInt(basename(f), 10)).filter((n) => !Number.isNaN(n));
    const next = String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
    filename = `${next}-${safe}.md`;
  } else {
    filename = `${safe}.md`;
  }
  const rel = `${info.dir}/${filename}`;
  const meta = { title: title || safe, type, ...extraMeta };
  await writeDocument(workId, rel, meta, body);
  return rel;
}

export async function readAllDocuments(workId) {
  const paths = await listWorkFiles(workId);
  const docs = [];
  for (const path of paths) {
    docs.push({ path, ...(await readDocument(workId, path)) });
  }
  return docs;
}

export async function getManuscriptCharTotal(workId) {
  const docs = await readAllDocuments(workId);
  let total = 0;
  for (const d of docs) {
    if (d.meta.type === 'manuscript') total += countChars(d.body);
  }
  return total;
}

export function getFsInstance() {
  return getFs();
}

export { ensureDir, exists, readText, writeText, listDirRecursive, pfs };
