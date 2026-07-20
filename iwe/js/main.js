import {
  listWorks, createWork, readWorkMeta, writeWorkMeta, listWorkFiles, readDocument,
  writeDocument, deleteDocument, createDocument, readAllDocuments, getManuscriptCharTotal,
} from './fs.js';
import { initRepo, commitAll, getLog, diffSummary, checkoutCommit, hasUncommittedChanges, estimateUncommittedChars } from './git.js';
import {
  getToken, setToken, getRepoSetting, setRepoSetting, uploadToGithub, downloadFromGithub, getGithubStatus,
} from './github.js';
import { IweEditor } from './editor.js';
import { IwePreview, renderReference } from './preview.js';
import { searchDocuments, resolveLinkTarget, findBacklinks, renderSearchResults, renderBacklinks } from './links.js';
import { recordDailyTotal, renderStatsChart } from './stats.js';
import { analyzeCharacters, renderCastPanel } from './cast.js';
import { DOC_TYPES, TYPE_DIRS, formatNowSnapshot, basename, escapeHtml } from './utils.js';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  workId: null,
  workMeta: null,
  currentPath: null,
  docs: [],
  dirty: false,
  saving: false,
  lastSavedAt: null,
};

const els = {
  workSelect: $('#work-select'),
  tree: $('#file-tree'),
  editorWrap: $('#editor-wrap'),
  rightPane: $('#right-pane'),
  previewHost: $('#preview-host'),
  refHost: $('#ref-host'),
  historyHost: $('#history-host'),
  castHost: $('#cast-host'),
  statsHost: $('#stats-host'),
  searchPanel: $('#search-panel'),
  searchInput: $('#search-input'),
  searchResults: $('#search-results'),
  backlinks: $('#backlinks'),
  statusBar: $('#status-bar'),
  snapshotBadge: $('#snapshot-badge'),
  welcome: $('#welcome'),
  workspace: $('#workspace'),
  conflictModal: $('#conflict-modal'),
  conflictList: $('#conflict-list'),
  settingsModal: $('#settings-modal'),
  githubToken: $('#github-token'),
  githubRepo: $('#github-repo'),
  targetChars: $('#target-chars'),
  promoteBar: $('#promote-bar'),
  homeView: $('#home-view'),
  listView: $('#list-view'),
  docList: $('#doc-list'),
};

const NAV_TYPES = {
  memo: { label: 'メモ', type: 'memo' },
  plot: { label: 'プロット', type: 'plot' },
  manuscript: { label: '作品', type: 'manuscript' },
};

let editor;
let preview;
let conflictPending = null;

function showToast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

async function refreshWorks() {
  const works = await listWorks();
  els.workSelect.innerHTML = '<option value="">— 作品を選択 —</option>';
  for (const w of works) {
    const opt = document.createElement('option');
    opt.value = w.id;
    opt.textContent = w.title;
    if (w.id === state.workId) opt.selected = true;
    els.workSelect.appendChild(opt);
  }
  $$('#welcome [data-home-nav]').forEach((btn) => {
    btn.disabled = works.length === 0;
  });
}

function sectionLabel(dir) {
  const map = { memos: 'メモ', plots: 'プロット', manuscript: '作品', characters: '人物' };
  return map[dir] || dir;
}

async function refreshTree() {
  if (!state.workId) return;
  const files = await listWorkFiles(state.workId);
  els.tree.innerHTML = '';
  const groups = { memos: [], plots: [], manuscript: [], characters: [] };
  for (const f of files) {
    const dir = f.split('/')[0];
    if (groups[dir]) groups[dir].push(f);
  }
  for (const [dir, list] of Object.entries(groups)) {
    const sec = document.createElement('section');
    sec.className = 'tree-section';
    const head = document.createElement('div');
    head.className = 'tree-head';
    head.innerHTML = `<span>${sectionLabel(dir)}</span>`;
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'tree-add';
    add.textContent = '+';
    add.title = '新規';
    add.addEventListener('click', () => createNewDoc(TYPE_DIRS[dir] || 'memo'));
    head.appendChild(add);
    sec.appendChild(head);
    const ul = document.createElement('ul');
    for (const path of list) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tree-file' + (path === state.currentPath ? ' active' : '');
      btn.textContent = basename(path).replace(/\.md$/i, '');
      btn.addEventListener('click', () => openFile(path));
      li.appendChild(btn);
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'tree-del';
      del.textContent = '×';
      del.title = '削除';
      del.addEventListener('click', (e) => { e.stopPropagation(); removeFile(path); });
      li.appendChild(del);
      ul.appendChild(li);
    }
    sec.appendChild(ul);
    els.tree.appendChild(sec);
  }
}

async function loadWork(workId) {
  if (state.dirty && state.currentPath) await saveCurrent();
  state.workId = workId;
  state.currentPath = null;
  state.docs = await readAllDocuments(workId);
  state.workMeta = await readWorkMeta(workId);
  els.welcome.hidden = true;
  els.workspace.hidden = false;
  await refreshTree();
  updatePromoteBar(null);
  updateStatus();
  await refreshRefSelect();
  recordDailyTotal(workId, await getManuscriptCharTotal(workId));
  renderStatsHost();
  showHome();
}

function showHome() {
  els.homeView.hidden = false;
  els.listView.hidden = true;
  els.editorWrap.classList.add('is-hidden');
  els.promoteBar.innerHTML = '';
  const titleEl = $('#home-work-title');
  if (titleEl) titleEl.textContent = state.workMeta?.title || '—';
  state.currentPath = null;
  refreshTree();
  updateStatus();
}

function showList(type) {
  const info = NAV_TYPES[type];
  if (!info) return;
  els.homeView.hidden = true;
  els.listView.hidden = false;
  els.editorWrap.classList.add('is-hidden');
  els.listView.dataset.type = type;
  const titleEl = $('#list-title');
  if (titleEl) titleEl.textContent = info.label;
  els.promoteBar.innerHTML = '';
  state.currentPath = null;
  refreshTree();
  renderDocList(type);
  updateStatus();
}

function showEditor() {
  els.homeView.hidden = true;
  els.listView.hidden = true;
  els.editorWrap.classList.remove('is-hidden');
}

function renderDocList(type) {
  if (!els.docList) return;
  const docs = state.docs.filter((d) => d.meta.type === type);
  els.docList.innerHTML = '';
  if (!docs.length) {
    els.docList.innerHTML = '<li class="doc-list-empty">まだありません。「+ 新規」から作成できます。</li>';
    return;
  }
  for (const doc of docs) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'doc-list-item';
    btn.textContent = String(doc.meta.title || basename(doc.path));
    btn.addEventListener('click', () => openFile(doc.path));
    li.appendChild(btn);
    els.docList.appendChild(li);
  }
}

async function openFile(path) {
  if (state.dirty && state.currentPath) await saveCurrent();
  const doc = await readDocument(state.workId, path);
  state.currentPath = path;
  state.dirty = false;
  showEditor();
  editor.load(doc);
  updatePromoteBar(doc);
  await refreshTree();
  refreshPreview();
  refreshBacklinks();
  updateStatus();
  const refPath = $('#ref-select')?.value;
  if (refPath) refreshReference(refPath);
}

async function saveCurrent() {
  if (!state.workId || !state.currentPath) return;
  state.saving = true;
  updateStatus();
  const meta = editor.getMeta();
  const body = editor.getBody();
  const type = meta.type || 'memo';
  await writeDocument(state.workId, state.currentPath, { ...meta, type }, body);
  state.dirty = false;
  state.saving = false;
  state.lastSavedAt = new Date();
  state.docs = await readAllDocuments(state.workId);
  const total = await getManuscriptCharTotal(state.workId);
  recordDailyTotal(state.workId, total);
  updateStatus();
}

function updatePromoteBar(doc) {
  if (!doc || !els.promoteBar) return;
  els.promoteBar.innerHTML = '';
  const type = doc.meta.type;
  if (type === 'memo') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = 'このメモからプロットを作る';
    btn.addEventListener('click', () => promote(doc, 'plot'));
    els.promoteBar.appendChild(btn);
  } else if (type === 'plot') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.textContent = 'このプロットから原稿を書き始める';
    btn.addEventListener('click', () => promote(doc, 'manuscript'));
    els.promoteBar.appendChild(btn);
  }
}

async function promote(doc, targetType) {
  const quote = (doc.body || '').split('\n').map((l) => `> ${l}`).join('\n');
  const body = `<!-- 由来: ${doc.path} -->\n\n${quote}\n\n`;
  const rel = await createDocument(state.workId, targetType, doc.meta.title || '無題', body, { source: doc.path });
  state.docs = await readAllDocuments(state.workId);
  await refreshTree();
  await openFile(rel);
  showToast('昇格しました');
}

async function createNewDoc(type) {
  const title = prompt('タイトル', '無題');
  if (title === null) return;
  const rel = await createDocument(state.workId, type, title || '無題', '');
  state.docs = await readAllDocuments(state.workId);
  await refreshTree();
  await openFile(rel);
}

async function removeFile(path) {
  if (!confirm(`${basename(path)} を削除しますか?`)) return;
  await deleteDocument(state.workId, path);
  if (state.currentPath === path) {
    state.currentPath = null;
    editor.load({ meta: { title: '', type: 'memo' }, body: '' });
    showHome();
  }
  state.docs = await readAllDocuments(state.workId);
  await refreshTree();
}

function refreshPreview() {
  if (!preview) return;
  preview.render(editor.getBody());
}

function refreshReference(path) {
  const doc = state.docs.find((d) => d.path === path);
  if (doc) renderReference(els.refHost, doc);
  else els.refHost.innerHTML = '<p class="panel-empty">ファイルが見つかりません</p>';
}

function refreshBacklinks() {
  if (!state.currentPath) return;
  renderBacklinks(els.backlinks, findBacklinks(state.currentPath, state.docs), (p) => openFile(p));
}

function renderStatsHost() {
  if (!state.workId) return;
  getManuscriptCharTotal(state.workId).then((total) => {
    renderStatsChart(els.statsHost, state.workId, state.workMeta?.targetChars || null, total);
  });
}

async function updateStatus() {
  const fileChars = editor ? editor.charCount() : 0;
  let total = 0;
  if (state.workId) total = await getManuscriptCharTotal(state.workId);
  const target = state.workMeta?.targetChars;
  const parts = [
    `このファイル: ${fileChars.toLocaleString()} 字`,
    `作品合計: ${total.toLocaleString()} 字`,
  ];
  if (target) parts.push(`目標 ${Math.round((total / target) * 100)}%`);
  if (state.saving) parts.push('保存中…');
  else if (state.dirty) parts.push('未保存');
  else if (state.lastSavedAt) parts.push('保存済み');
  els.statusBar.textContent = parts.join(' · ');
  if (state.workId) {
    const est = await estimateUncommittedChars(state.workId);
    els.snapshotBadge.hidden = est < 2000;
  }
}

async function renderHistory() {
  if (!state.workId) return;
  const log = await getLog(state.workId);
  els.historyHost.innerHTML = '';
  if (!log.length) {
    els.historyHost.innerHTML = '<p class="panel-empty">スナップショットがありません</p>';
    return;
  }
  for (const entry of log) {
    const row = document.createElement('div');
    row.className = 'history-item';
    const date = new Date(entry.commit.author.timestamp).toLocaleString('ja-JP');
    row.innerHTML = `<div class="history-msg">${escapeHtml(entry.commit.message)}</div><div class="history-meta">${date} · ${entry.oid.slice(0, 7)}</div>`;
    const actions = document.createElement('div');
    actions.className = 'history-actions';
    const diffBtn = document.createElement('button');
    diffBtn.type = 'button';
    diffBtn.textContent = '差分';
    diffBtn.addEventListener('click', async () => {
      const diffs = await diffSummary(state.workId, entry.oid, 'working');
      showDiffModal(diffs);
    });
    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.textContent = 'この時点に戻す';
    restoreBtn.addEventListener('click', async () => {
      if (!confirm('現在の内容をこの時点の状態に戻します。よろしいですか?')) return;
      await checkoutCommit(state.workId, entry.oid);
      state.docs = await readAllDocuments(state.workId);
      await refreshTree();
      if (state.currentPath) await openFile(state.currentPath);
      showToast('復元しました');
      await renderHistory();
    });
    actions.append(diffBtn, restoreBtn);
    row.appendChild(actions);
    els.historyHost.appendChild(row);
  }
}

function showDiffModal(diffs) {
  const modal = $('#diff-modal');
  const body = $('#diff-body');
  body.innerHTML = '';
  if (!diffs.length) {
    body.innerHTML = '<p class="panel-empty">差分なし</p>';
  } else {
    for (const d of diffs) {
      const sec = document.createElement('section');
      sec.innerHTML = `<h4>${escapeHtml(d.path)}</h4>`;
      const pre = document.createElement('pre');
      pre.className = 'diff-pre';
      pre.innerHTML = d.lines.map((ln) => {
        const cls = ln.type === 'add' ? 'diff-add' : ln.type === 'remove' ? 'diff-remove' : 'diff-same';
        const prefix = ln.type === 'add' ? '+ ' : ln.type === 'remove' ? '- ' : '  ';
        return `<span class="${cls}">${escapeHtml(prefix + ln.line)}</span>`;
      }).join('\n');
      sec.appendChild(pre);
      body.appendChild(sec);
    }
  }
  modal.hidden = false;
}

async function refreshRefSelect() {
  const sel = $('#ref-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">参照ファイル…</option>';
  for (const d of state.docs) {
    const opt = document.createElement('option');
    opt.value = d.path;
    opt.textContent = d.meta.title || basename(d.path);
    sel.appendChild(opt);
  }
}

async function runCastAnalysis() {
  state.docs = await readAllDocuments(state.workId);
  const analysis = analyzeCharacters(state.docs);
  renderCastPanel(els.castHost, analysis, (p) => openFile(p), async (name) => {
    const rel = await createDocument(state.workId, 'character', name, '', { name, aliases: [] });
    state.docs = await readAllDocuments(state.workId);
    await refreshTree();
    await openFile(rel);
  });
}

function populateConflictModal(data) {
  conflictPending = data;
  els.conflictList.innerHTML = '';
  for (const path of data.paths) {
    const row = document.createElement('div');
    row.className = 'conflict-row';
    row.innerHTML = `<span>${escapeHtml(path)}</span>`;
    const sel = document.createElement('select');
    sel.dataset.path = path;
    sel.innerHTML = '<option value="local">ローカルを残す</option><option value="remote">リモートを取り込む</option>';
    row.appendChild(sel);
    els.conflictList.appendChild(row);
  }
  els.conflictModal.hidden = false;
}

async function init() {
  preview = new IwePreview(els.previewHost);
  editor = new IweEditor(els.editorWrap, {
    onChange: async () => {
      state.dirty = true;
      updateStatus();
      await saveCurrent();
    },
    onInput: () => {
      state.dirty = true;
      refreshPreview();
      updateStatus();
    },
    onPreviewInput: () => refreshPreview(),
    onLinkClick: (target) => {
      const resolved = resolveLinkTarget(target, state.docs);
      if (typeof resolved === 'string') openFile(resolved);
      else if (resolved?.ambiguous) showToast('リンク先が複数あります');
      else showToast('リンク先が見つかりません');
    },
  });

  await refreshWorks();

  $$('[data-list-nav]').forEach((btn) => {
    btn.addEventListener('click', () => showList(btn.dataset.listNav));
  });

  $$('#welcome [data-home-nav]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const works = await listWorks();
      if (!works.length) {
        showToast('先に作品を作ってください');
        return;
      }
      els.workSelect.value = state.workId || works[0].id;
      if (els.workSelect.value !== state.workId) await loadWork(els.workSelect.value);
      showList(btn.dataset.homeNav);
    });
  });

  $('#btn-home')?.addEventListener('click', () => {
    if (state.workId) showHome();
  });

  $('#btn-list-back')?.addEventListener('click', showHome);

  $('#btn-list-new')?.addEventListener('click', () => {
    const type = els.listView?.dataset.type;
    if (type) createNewDoc(type);
  });

  els.workSelect.addEventListener('change', async () => {
    const id = els.workSelect.value;
    if (!id) {
      state.workId = null;
      els.welcome.hidden = false;
      els.workspace.hidden = true;
      return;
    }
    await loadWork(id);
  });

  $$('.preview-mode').forEach((btn) => {
    btn.addEventListener('click', () => {
      $$('.preview-mode').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      preview.setMode(btn.dataset.mode);
      refreshPreview();
    });
  });

  $$('.right-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      $$('.right-tab').forEach((t) => t.classList.remove('active'));
      $$('.right-panel').forEach((p) => p.hidden = true);
      tab.classList.add('active');
      const panel = $(`#panel-${tab.dataset.panel}`);
      if (panel) panel.hidden = false;
      if (tab.dataset.panel === 'ref') {
        refreshRefSelect().then(() => refreshBacklinks());
      }
      if (tab.dataset.panel === 'cast') runCastAnalysis();
      if (tab.dataset.panel === 'stats') renderStatsHost();
    });
  });

  $('#btn-snapshot')?.addEventListener('click', async () => {
    if (!state.workId) return;
    if (state.dirty) await saveCurrent();
    const msg = prompt('スナップショットのメモ(任意)', '');
    await commitAll(state.workId, msg || '');
    showToast('スナップショットを保存しました');
    els.snapshotBadge.hidden = true;
    await renderHistory();
  });

  $('#btn-github-upload')?.addEventListener('click', async () => {
    if (!state.workId) return;
    try {
      if (state.dirty) await saveCurrent();
      await uploadToGithub(state.workId);
      showToast('GitHub にアップロードしました');
    } catch (e) {
      alert(e.message || String(e));
    }
  });

  $('#btn-github-download')?.addEventListener('click', async () => {
    if (!state.workId) return;
    try {
      const res = await downloadFromGithub(state.workId);
      if (res.conflict) populateConflictModal(res);
      else {
        state.docs = await readAllDocuments(state.workId);
        await refreshTree();
        if (state.currentPath) await openFile(state.currentPath);
        showToast('GitHub から取り込みました');
      }
    } catch (e) {
      alert(e.message || String(e));
    }
  });

  $('#btn-settings')?.addEventListener('click', () => {
    els.githubToken.value = getToken();
    els.githubRepo.value = state.workId ? getRepoSetting(state.workId) : '';
    els.targetChars.value = state.workMeta?.targetChars ?? '';
    els.settingsModal.hidden = false;
  });

  $('#settings-save')?.addEventListener('click', async () => {
    setToken(els.githubToken.value);
    if (state.workId) {
      setRepoSetting(state.workId, els.githubRepo.value);
      const tc = parseInt(els.targetChars.value, 10);
      state.workMeta.targetChars = Number.isFinite(tc) && tc > 0 ? tc : null;
      await writeWorkMeta(state.workId, state.workMeta);
    }
    els.settingsModal.hidden = true;
    renderStatsHost();
    updateStatus();
    showToast('設定を保存しました');
  });

  $$('[data-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.close;
      if (id) $(`#${id}`).hidden = true;
    });
  });

  $('#conflict-apply')?.addEventListener('click', async () => {
    if (!conflictPending || !state.workId) return;
    /** @type {Record<string, string>} */
    const choices = {};
    $$('#conflict-list select').forEach((sel) => {
      choices[sel.dataset.path] = sel.value;
    });
    await downloadFromGithub(state.workId, choices);
    els.conflictModal.hidden = true;
    conflictPending = null;
    state.docs = await readAllDocuments(state.workId);
    await refreshTree();
    showToast('競合を解決しました');
  });

  els.searchInput?.addEventListener('input', () => {
    const q = els.searchInput.value;
    const results = searchDocuments(q, state.docs);
    renderSearchResults(els.searchResults, results, (path) => {
      openFile(path);
      els.searchPanel.hidden = true;
    });
  });

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      els.searchPanel.hidden = false;
      els.searchInput.focus();
    }
  });

  $('#btn-search')?.addEventListener('click', () => {
    els.searchPanel.hidden = !els.searchPanel.hidden;
    if (!els.searchPanel.hidden) els.searchInput.focus();
  });

  $('#ref-select')?.addEventListener('change', (e) => {
    const path = e.target.value;
    if (path) refreshReference(path);
  });

  $$('.drawer-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.body.classList.toggle(btn.dataset.drawer);
    });
  });

  $('#btn-close-right')?.addEventListener('click', () => {
    document.body.classList.remove('right-open');
  });

  state.docs = [];
  updateStatus();
}

init().catch((e) => {
  console.error(e);
  alert('IWE の初期化に失敗しました: ' + (e.message || e));
});
