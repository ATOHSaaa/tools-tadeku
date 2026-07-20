import { workRoot, listDirRecursive, readText, writeText, pfs, ensureDir } from './fs.js';
import { commitAll, hasUncommittedChanges, getHeadOid } from './git.js';

const TOKEN_KEY = 'iwe-github-token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token.trim());
  else localStorage.removeItem(TOKEN_KEY);
}

export function getRepoSetting(workId) {
  return localStorage.getItem(`iwe-github-repo-${workId}`) || '';
}

export function setRepoSetting(workId, repo) {
  if (repo) localStorage.setItem(`iwe-github-repo-${workId}`, repo.trim());
  else localStorage.removeItem(`iwe-github-repo-${workId}`);
}

export function getSyncedSha(workId) {
  return localStorage.getItem(`iwe-github-synced-${workId}`) || '';
}

function setSyncedSha(workId, sha) {
  if (sha) localStorage.setItem(`iwe-github-synced-${workId}`, sha);
  else localStorage.removeItem(`iwe-github-synced-${workId}`);
}

function parseRepo(repo) {
  const m = (repo || '').trim().match(/^([^/]+)\/([^/]+)$/);
  if (!m) throw new Error('リポジトリは owner/repo 形式で入力してください');
  return { owner: m[1], repo: m[2] };
}

async function ghFetch(path, token, opts = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `GitHub API ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function getRemoteHead(token, owner, repo) {
  try {
    const ref = await ghFetch(`/repos/${owner}/${repo}/git/ref/heads/main`, token);
    return ref.object.sha;
  } catch (e) {
    if (/404/.test(String(e.message))) return null;
    throw e;
  }
}

function workPath(workId, rel) {
  return `${workRoot(workId)}/${rel}`;
}

async function collectLocalFiles(workId) {
  const rels = await listDirRecursive(workRoot(workId));
  /** @type {{ path: string, content: string }[]} */
  const files = [];
  for (const rel of rels) {
    if (rel.startsWith('.git')) continue;
    files.push({ path: rel, content: await readText(workPath(workId, rel)) });
  }
  return files;
}

async function createRemoteCommit(token, owner, repo, parentSha, message, files) {
  /** @type {Record<string, { mode: string, type: string, sha: string }>} */
  const treeMap = {};
  for (const f of files) {
    const blob = await ghFetch(`/repos/${owner}/${repo}/git/blobs`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: f.content, encoding: 'utf-8' }),
    });
    treeMap[f.path] = { mode: '100644', type: 'blob', sha: blob.sha };
  }
  const tree = await ghFetch(`/repos/${owner}/${repo}/git/trees`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tree: Object.entries(treeMap).map(([path, ent]) => ({ path, ...ent })) }),
  });
  const commitBody = { message, tree: tree.sha, author: { name: 'IWE', email: 'iwe@local.invalid' } };
  if (parentSha) commitBody.parents = [parentSha];
  const commit = await ghFetch(`/repos/${owner}/${repo}/git/commits`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(commitBody),
  });
  if (parentSha) {
    await ghFetch(`/repos/${owner}/${repo}/git/refs/heads/main`, token, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
  } else {
    await ghFetch(`/repos/${owner}/${repo}/git/refs`, token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'refs/heads/main', sha: commit.sha }),
    });
  }
  return commit.sha;
}

export async function uploadToGithub(workId, message) {
  const token = getToken();
  if (!token) throw new Error('GitHub トークンが未設定です');
  const { owner, repo } = parseRepo(getRepoSetting(workId));
  const remoteHead = await getRemoteHead(token, owner, repo);
  const synced = getSyncedSha(workId);
  if (remoteHead && synced && remoteHead !== synced) {
    throw new Error('リモートに新しい変更があります。先にダウンロードしてください');
  }
  const files = await collectLocalFiles(workId);
  const msg = message || `IWE sync: ${new Date().toISOString()}`;
  const sha = await createRemoteCommit(token, owner, repo, remoteHead, msg, files);
  setSyncedSha(workId, sha);
  return sha;
}

async function fetchRemoteFiles(token, owner, repo, treeSha) {
  const tree = await ghFetch(`/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, token);
  /** @type {{ path: string, sha: string }[]} */
  const blobs = (tree.tree || []).filter((t) => t.type === 'blob');
  /** @type {{ path: string, content: string }[]} */
  const files = [];
  for (const b of blobs) {
    const blob = await ghFetch(`/repos/${owner}/${repo}/git/blobs/${b.sha}`, token);
    const content = blob.encoding === 'base64'
      ? new TextDecoder().decode(Uint8Array.from(atob(blob.content.replace(/\n/g, '')), (c) => c.charCodeAt(0)))
      : blob.content;
    files.push({ path: b.path, content });
  }
  return files;
}

export async function downloadFromGithub(workId, conflictChoices) {
  const token = getToken();
  if (!token) throw new Error('GitHub トークンが未設定です');
  const { owner, repo } = parseRepo(getRepoSetting(workId));
  const remoteHead = await getRemoteHead(token, owner, repo);
  if (!remoteHead) throw new Error('リモートリポジトリが空です');
  const synced = getSyncedSha(workId);
  const localDirty = await hasUncommittedChanges(workId);
  const localHead = await getHeadOid(workId);
  const diverged = synced && localHead && localHead !== synced && remoteHead !== synced;

  if (diverged && localDirty && !conflictChoices) {
    const remoteCommit = await ghFetch(`/repos/${owner}/${repo}/git/commits/${remoteHead}`, token);
    const remoteFiles = await fetchRemoteFiles(token, owner, repo, remoteCommit.tree.sha);
    const localFiles = await collectLocalFiles(workId);
    const paths = new Set([...remoteFiles.map((f) => f.path), ...localFiles.map((f) => f.path)]);
    return { conflict: true, paths: [...paths].sort(), remoteFiles, localFiles };
  }

  const remoteCommit = await ghFetch(`/repos/${owner}/${repo}/git/commits/${remoteHead}`, token);
  const remoteFiles = await fetchRemoteFiles(token, owner, repo, remoteCommit.tree.sha);

  if (conflictChoices) {
    const localMap = Object.fromEntries((await collectLocalFiles(workId)).map((f) => [f.path, f.content]));
    const remoteMap = Object.fromEntries(remoteFiles.map((f) => [f.path, f.content]));
    for (const path of Object.keys(conflictChoices)) {
      const pick = conflictChoices[path];
      const content = pick === 'remote' ? remoteMap[path] : localMap[path];
      if (content != null) await writeText(workPath(workId, path), content);
      else {
        try { await pfs().unlink(workPath(workId, path)); } catch { /* */ }
      }
    }
  } else {
    const existing = await listDirRecursive(workRoot(workId));
    const remotePaths = new Set(remoteFiles.map((f) => f.path));
    for (const rel of existing) {
      if (rel.startsWith('.git') || rel === 'iwe.json') continue;
      if (!remotePaths.has(rel)) {
        try { await pfs().unlink(workPath(workId, rel)); } catch { /* */ }
      }
    }
    for (const f of remoteFiles) {
      await ensureDir(workPath(workId, f.path).substring(0, workPath(workId, f.path).lastIndexOf('/')));
      await writeText(workPath(workId, f.path), f.content);
    }
  }

  await commitAll(workId, `IWE sync pull: ${new Date().toISOString()}`);
  setSyncedSha(workId, remoteHead);
  return { conflict: false, sha: remoteHead };
}

export async function getGithubStatus(workId) {
  const token = getToken();
  const repo = getRepoSetting(workId);
  if (!token || !repo) return { configured: false };
  try {
    const { owner, repo: name } = parseRepo(repo);
    const remoteHead = await getRemoteHead(token, owner, name);
    const synced = getSyncedSha(workId);
    return {
      configured: true,
      remoteHead,
      synced,
      ahead: synced && remoteHead && remoteHead !== synced,
      localDirty: await hasUncommittedChanges(workId),
    };
  } catch (e) {
    return { configured: true, error: String(e.message || e) };
  }
}
