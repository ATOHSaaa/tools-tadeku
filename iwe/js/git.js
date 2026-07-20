import git from 'https://esm.sh/isomorphic-git@1.27.1';
import { getFsInstance, workRoot, listDirRecursive, readText, writeText, ensureDir, pfs } from './fs.js';
import { formatNowSnapshot, lineDiff } from './utils.js';

const AUTHOR = { name: 'IWE User', email: 'iwe@local.invalid' };

function dirFor(workId) {
  return workRoot(workId);
}

export async function initRepo(workId) {
  const fs = getFsInstance();
  const dir = dirFor(workId);
  try {
    await git.init({ fs, dir, defaultBranch: 'main' });
  } catch (e) {
    if (!/already exists/i.test(String(e.message))) throw e;
  }
  await commitAll(workId, '初期スナップショット');
}

export async function commitAll(workId, message) {
  const fs = getFsInstance();
  const dir = dirFor(workId);
  const files = await listDirRecursive(dir);
  for (const rel of files) {
    if (rel.startsWith('.git')) continue;
    await git.add({ fs, dir, filepath: rel });
  }
  const msg = (message || '').trim() || `${formatNowSnapshot()} のスナップショット`;
  const oid = await git.commit({ fs, dir, message: msg, author: AUTHOR });
  return oid;
}

export async function getLog(workId, depth = 30) {
  const fs = getFsInstance();
  const dir = dirFor(workId);
  try {
    return await git.log({ fs, dir, ref: 'main', depth });
  } catch {
    return [];
  }
}

export async function hasUncommittedChanges(workId) {
  const fs = getFsInstance();
  const dir = dirFor(workId);
  try {
    const matrix = await git.statusMatrix({ fs, dir });
    return matrix.some(([, head, workdir]) => head !== workdir);
  } catch {
    return false;
  }
}

export async function getHeadOid(workId) {
  const fs = getFsInstance();
  const dir = dirFor(workId);
  try {
    return await git.resolveRef({ fs, dir, ref: 'HEAD' });
  } catch {
    return null;
  }
}

async function readFileFromCommit(workId, commitOid, relPath) {
  const fs = getFsInstance();
  const dir = dirFor(workId);
  let content = null;
  await git.walk({
    fs,
    dir,
    ref: commitOid,
    map: async (path, [entry]) => {
      if (path !== relPath) return;
      const type = await entry.type();
      if (type !== 'blob') return;
      const oid = await entry.oid();
      const { blob } = await git.readBlob({ fs, dir, oid });
      content = new TextDecoder().decode(blob);
    },
  });
  return content ?? '';
}

export async function diffSummary(workId, oidA, oidB) {
  const files = await listDirRecursive(dirFor(workId));
  /** @type {{ path: string, lines: ReturnType<typeof lineDiff> }[]} */
  const out = [];
  const allPaths = new Set(files.filter((f) => f.endsWith('.md') || f === 'iwe.json'));
  if (oidA) {
    const treeFiles = await readTreeAt(workId, oidA);
    treeFiles.forEach((f) => allPaths.add(f.path));
  }
  for (const rel of allPaths) {
    if (rel.startsWith('.git')) continue;
    let a = '';
    let b = '';
    if (oidA) a = await readFileFromCommit(workId, oidA, rel);
    if (oidB === 'working') {
      try { b = await readText(workPath(workId, rel)); } catch { b = ''; }
    } else if (oidB) b = await readFileFromCommit(workId, oidB, rel);
    if (a !== b) out.push({ path: rel, lines: lineDiff(a, b) });
  }
  return out;
}

function workPath(workId, rel) {
  return `${workRoot(workId)}/${rel}`;
}

export async function diffFile(workId, relPath, oidA, oidB) {
  let a = '';
  let b = '';
  if (oidA) a = await readFileFromCommit(workId, oidA, relPath);
  if (oidB === 'working') {
    try { b = await readText(workPath(workId, relPath)); } catch { b = ''; }
  } else if (oidB) b = await readFileFromCommit(workId, oidB, relPath);
  return lineDiff(a, b);
}

export async function checkoutCommit(workId, oid) {
  const fs = getFsInstance();
  const dir = dirFor(workId);
  await git.checkout({ fs, dir, ref: oid, force: true });
  const msg = `${formatNowSnapshot()} — スナップショット ${oid.slice(0, 7)} に戻しました`;
  return commitAll(workId, msg);
}

export async function readTreeAt(workId, oid) {
  const fs = getFsInstance();
  const dir = dirFor(workId);
  const { commit } = await git.readCommit({ fs, dir, oid });
  const { tree } = await git.readTree({ fs, dir, oid: commit.tree });
  /** @type {{ path: string, oid: string, mode: string }[]} */
  const files = [];
  async function walk(prefix, entries) {
    for (const ent of entries) {
      const path = prefix ? `${prefix}/${ent.path}` : ent.path;
      if (ent.type === 'tree') {
        const sub = await git.readTree({ fs, dir, oid: ent.oid });
        await walk(path, sub.tree);
      } else if (ent.type === 'blob') {
        files.push({ path, oid: ent.oid, mode: ent.mode });
      }
    }
  }
  await walk('', tree);
  return files;
}

export async function writeTreeToWorkdir(workId, oid) {
  const fs = getFsInstance();
  const dir = dirFor(workId);
  const files = await readTreeAt(workId, oid);
  const keep = new Set(files.map((f) => f.path));
  const existing = await listDirRecursive(dir);
  for (const rel of existing) {
    if (rel.startsWith('.git') || rel === 'iwe.json') continue;
    if (!keep.has(rel)) {
      try { await pfs().unlink(workPath(workId, rel)); } catch { /* ok */ }
    }
  }
  for (const f of files) {
    if (f.path.startsWith('.git')) continue;
    const { blob } = await git.readBlob({ fs, dir, oid: f.oid });
    const text = new TextDecoder().decode(blob);
    await writeText(workPath(workId, f.path), text);
  }
}

export async function estimateUncommittedChars(workId) {
  const fs = getFsInstance();
  const dir = dirFor(workId);
  try {
    const matrix = await git.statusMatrix({ fs, dir });
    let chars = 0;
    for (const [filepath, head, workdir, stage] of matrix) {
      if (head === workdir && stage === head) continue;
      if (!filepath.endsWith('.md')) continue;
      let cur = '';
      let prev = '';
      try { cur = await readText(workPath(workId, filepath)); } catch { /* */ }
      if (head) {
        try {
          const { blob } = await git.readBlob({ fs, dir, oid: head });
          prev = new TextDecoder().decode(blob);
        } catch { /* */ }
      }
      chars += Math.abs(cur.length - prev.length);
    }
    return chars;
  } catch {
    return 0;
  }
}

export { git };
