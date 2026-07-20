(function (global) {
  'use strict';

  const DB_NAME = 'tadeku-suiko';
  const DB_VERSION = 1;
  const STORE = 'projects';
  const MAX_STEP = 5;

  const STEP_LABELS = ['初稿', '第二稿', '第三稿', '第四稿', '第五稿', '第六稿'];

  let dbPromise = null;

  function makeId() {
    return 'suiko-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function formatDateTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return (
      d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()) + ' ' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes())
    );
  }

  function stepLabel(step) {
    return STEP_LABELS[step] || String(step);
  }

  function progressLabel(project) {
    if (!project) return '';
    if (project.status === 'complete') return '完了';
    return stepLabel(project.step);
  }

  function getPreviousVersion(project) {
    if (!project || project.step <= 0) return null;
    return project.versions.find((v) => v.step === project.step - 1) || null;
  }

  function getVersionByStep(project, step) {
    if (!project || step == null) return null;
    return project.versions.find((v) => v.step === step) || null;
  }

  function getViewableVersions(project) {
    if (!project || !project.versions) return [];
    return [...project.versions]
      .filter((v) => v.step < project.step)
      .sort((a, b) => a.step - b.step);
  }

  function defaultRefStep(project) {
    if (!project || project.step <= 0) return null;
    return project.step - 1;
  }

  function getPreviousBody(project) {
    const prev = getPreviousVersion(project);
    return prev ? prev.body || '' : '';
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        reject(new Error('indexedDB unavailable'));
        return;
      }
      const req = global.indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error || new Error('open failed'));
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
    });
    return dbPromise;
  }

  function dbRequest(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('idb request failed'));
    });
  }

  async function listProjects() {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const all = await dbRequest(tx.objectStore(STORE).getAll());
    return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function getProject(id) {
    if (!id) return null;
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    return dbRequest(tx.objectStore(STORE).get(id));
  }

  async function putProject(project) {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(project);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(project);
      tx.onerror = () => reject(tx.error || new Error('put failed'));
    });
  }

  async function createProject() {
    const now = Date.now();
    const project = {
      id: makeId(),
      title: '',
      step: 0,
      status: 'draft',
      versions: [],
      draftBody: '',
      createdAt: now,
      updatedAt: now,
    };
    await putProject(project);
    return project;
  }

  async function saveDraft(id, { title, body }) {
    const project = await getProject(id);
    if (!project || project.status === 'complete') return project;
    project.title = title != null ? title : project.title;
    project.draftBody = body != null ? body : project.draftBody;
    project.updatedAt = Date.now();
    return putProject(project);
  }

  async function finishStep(id, { title, body }) {
    const project = await getProject(id);
    if (!project || project.status === 'complete') return project;
    const text = String(body || '');
    if (!text.trim()) throw new Error('empty body');

    project.title = title != null ? title : project.title;
    project.versions.push({
      step: project.step,
      body: text,
      finishedAt: Date.now(),
      charCount: text.length,
    });

    if (project.step >= MAX_STEP) {
      project.status = 'complete';
      project.draftBody = '';
    } else {
      project.step += 1;
      project.draftBody = '';
    }
    project.updatedAt = Date.now();
    return putProject(project);
  }

  async function deleteProject(id) {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('delete failed'));
    });
  }

  function buildExportTxt(project) {
    const lines = [];
    const title = (project.title || '').trim();
    if (title) {
      lines.push(title, '');
    }
    const versions = [...(project.versions || [])].sort((a, b) => a.step - b.step);
    for (const v of versions) {
      lines.push(
        '--- ' + stepLabel(v.step) + ' (' + v.charCount + '字) · ' + formatDateTime(v.finishedAt) + ' ---',
        '',
        v.body || '',
        '',
      );
    }
    return lines.join('\n').trimEnd() + '\n';
  }

  function safeFilename(title) {
    const base = String(title || 'suiko')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, '-')
      .slice(0, 48);
    return base || 'suiko';
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function exportProjectTxt(project) {
    const blob = new Blob([buildExportTxt(project)], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, safeFilename(project.title) + '.txt');
  }

  global.TadekuSuiko = {
    DB_NAME,
    MAX_STEP,
    STEP_LABELS,
    stepLabel,
    progressLabel,
    formatDateTime,
    getPreviousBody,
    getPreviousVersion,
    getVersionByStep,
    getViewableVersions,
    defaultRefStep,
    listProjects,
    getProject,
    createProject,
    saveDraft,
    finishStep,
    deleteProject,
    buildExportTxt,
    exportProjectTxt,
  };
})(typeof window !== 'undefined' ? window : globalThis);
