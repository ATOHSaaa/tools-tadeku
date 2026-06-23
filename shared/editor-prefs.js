(function (global) {
  const DB_NAME = 'tadeku-tools';
  // 不足しているオブジェクトストアを upgrade 経由で確実に追加するためのバージョン。
  const DB_VERSION = 4;
  const PREFS_ID = 'settings';
  const PREFS_STORE = 'prefs';
  const META_STORE = 'editorMeta';
  const DOCS_STORE = 'documents';

  const EDITORS = [
    { id: 'plain', name: 'Plain', path: 'plain/' },
    { id: 'stoic', name: 'Stoic', path: 'stoic/' },
    { id: 'tachometer', name: 'Tachometer', path: 'tachometer/' },
    { id: 'interval', name: 'Interval', path: 'Interval/' },
    { id: 'scene', name: 'Scene', path: 'scene/' },
    { id: 'cue', name: 'Cue', path: 'cue/' },
    { id: 'genko', name: 'Genko', path: 'genko/' },
    { id: 'length', name: 'Length', path: 'length/' },
    { id: 'seam', name: 'Seam', path: 'seam/' },
  ];

  const RESUME_EXCLUDED = new Set(['scene']);
  const RESUME_EDITORS = EDITORS.filter((e) => !RESUME_EXCLUDED.has(e.id));
  const LIBRARY_EDITOR_IDS = ['plain', 'stoic', 'tachometer', 'interval', 'cue', 'genko', 'length', 'seam'];
  const LIBRARY_EDITORS = LIBRARY_EDITOR_IDS
    .map((id) => EDITORS.find((e) => e.id === id))
    .filter(Boolean);

  function isResumeEditor(id) {
    return RESUME_EDITORS.some((e) => e.id === id);
  }

  let dbPromise = null;

  function setupSchema(db) {
    if (!db.objectStoreNames.contains(PREFS_STORE)) {
      db.createObjectStore(PREFS_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(META_STORE)) {
      db.createObjectStore(META_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(DOCS_STORE)) {
      const store = db.createObjectStore(DOCS_STORE, { keyPath: 'id' });
      store.createIndex('updatedAt', 'updatedAt', { unique: false });
      store.createIndex('editorId', 'editorId', { unique: false });
    }
  }

  const REQUIRED_STORES = [PREFS_STORE, META_STORE, DOCS_STORE];

  function hasAllStores(db) {
    return REQUIRED_STORES.every((name) => db.objectStoreNames.contains(name));
  }

  function deleteDatabase() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      } catch (_) {
        resolve();
      }
    });
  }

  function openOnce() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      let blocked = false;
      req.onblocked = () => {
        blocked = true;
        // 別タブが古い接続を掴んでアップグレードを阻んでいる。
        // 一定時間で諦めてエラーにし、無限待ちを避ける。
        setTimeout(() => {
          if (blocked) reject(new Error('db-upgrade-blocked'));
        }, 1500);
      };
      req.onupgradeneeded = () => {
        setupSchema(req.result);
      };
      req.onsuccess = () => {
        blocked = false;
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = (async () => {
      if (!global.indexedDB) {
        dbPromise = null;
        throw new Error('indexedDB unavailable');
      }
      let db = await openOnce();
      // 過去のバージョン更新が中途半端だった場合に備えた自己修復。
      if (!hasAllStores(db)) {
        db.close();
        await deleteDatabase();
        db = await openOnce();
        if (!hasAllStores(db)) {
          dbPromise = null;
          throw new Error('failed to initialize object stores');
        }
      }
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      return db;
    })().catch((err) => {
      dbPromise = null;
      throw err;
    });
    return dbPromise;
  }

  function runTransaction(storeName, mode, fn) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      if (!db.objectStoreNames.contains(storeName)) {
        reject(new Error(`Missing object store: ${storeName}`));
        return;
      }
      const tx = db.transaction(storeName, mode);
      let settled = false;
      const done = (value) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const fail = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };
      tx.oncomplete = () => done(output);
      tx.onerror = () => fail(tx.error);
      tx.onabort = () => fail(tx.error || new Error('Transaction aborted'));
      let output;
      try {
        output = fn(tx.objectStore(storeName));
      } catch (err) {
        fail(err);
      }
    }));
  }

  function promisifyRequest(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function getPrefsRecord() {
    const db = await openDB();
    const tx = db.transaction(PREFS_STORE, 'readonly');
    const record = await promisifyRequest(tx.objectStore(PREFS_STORE).get(PREFS_ID));
    return record || { id: PREFS_ID, lastEditor: null, defaultEditor: null };
  }

  async function putPrefsRecord(record) {
    const db = await openDB();
    const tx = db.transaction(PREFS_STORE, 'readwrite');
    await promisifyRequest(tx.objectStore(PREFS_STORE).put(record));
  }

  async function recordVisit(editorId) {
    if (!isResumeEditor(editorId)) return;
    const prefs = await getPrefsRecord();
    prefs.lastEditor = editorId;
    prefs.lastVisitedAt = Date.now();
    await putPrefsRecord(prefs);
  }

  async function updateDraftMeta(editorId, meta = {}) {
    if (!EDITORS.some((e) => e.id === editorId)) return;
    const db = await openDB();
    const tx = db.transaction(META_STORE, 'readwrite');
    await promisifyRequest(tx.objectStore(META_STORE).put({
      id: editorId,
      charCount: meta.charCount ?? 0,
      title: meta.title || '',
      updatedAt: Date.now(),
    }));
  }

  async function getDraftMeta(editorId) {
    const db = await openDB();
    const tx = db.transaction(META_STORE, 'readonly');
    return promisifyRequest(tx.objectStore(META_STORE).get(editorId));
  }

  async function getAllDraftMeta() {
    const db = await openDB();
    const tx = db.transaction(META_STORE, 'readonly');
    const all = await promisifyRequest(tx.objectStore(META_STORE).getAll());
    const map = {};
    for (const item of all) map[item.id] = item;
    return map;
  }

  async function setDefaultEditor(editorId) {
    const prefs = await getPrefsRecord();
    prefs.defaultEditor = editorId && isResumeEditor(editorId) ? editorId : null;
    await putPrefsRecord(prefs);
  }

  async function getResumeEditorId() {
    const prefs = await getPrefsRecord();
    if (prefs.defaultEditor && isResumeEditor(prefs.defaultEditor)) {
      return prefs.defaultEditor;
    }
    if (prefs.lastEditor && isResumeEditor(prefs.lastEditor)) {
      return prefs.lastEditor;
    }
    return null;
  }

  function uuid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function countChars(body) {
    return (body || '').replace(/\n/g, '').length;
  }

  async function saveDocument({ editorId, title, body }) {
    const now = Date.now();
    const doc = {
      id: uuid(),
      editorId: editorId || '',
      title: (title || '').trim(),
      body: body || '',
      charCount: countChars(body),
      createdAt: now,
      updatedAt: now,
    };
    await runTransaction(DOCS_STORE, 'readwrite', (store) => {
      store.put(doc);
    });
    return doc;
  }

  async function updateDocument(id, { editorId, title, body }) {
    const existing = await getDocument(id);
    if (!existing) throw new Error('Document not found');
    const now = Date.now();
    const doc = {
      ...existing,
      editorId: editorId || existing.editorId,
      title: (title || '').trim(),
      body: body || '',
      charCount: countChars(body),
      updatedAt: now,
    };
    await runTransaction(DOCS_STORE, 'readwrite', (store) => {
      store.put(doc);
    });
    return doc;
  }

  function formatDateTitle(ts) {
    const d = new Date(ts || Date.now());
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function isPlaceholderTitle(raw) {
    const t = (raw || '').trim();
    return !t || t === '無題' || /^無題 \(\d+\)$/.test(t);
  }

  function documentDisplayTitle(doc) {
    const t = (doc?.title || '').trim();
    if (t && !isPlaceholderTitle(t)) return t;
    return formatDateTitle(doc?.createdAt);
  }

  function displayTitle(raw) {
    const t = (raw || '').trim();
    return t || '無題';
  }

  async function resolveUniqueTitle(requestedRaw, excludeId) {
    const all = await getAllDocuments();
    const used = new Set(
      all.filter((d) => d.id !== excludeId).map((d) => documentDisplayTitle(d)),
    );
    const base = (requestedRaw || '').trim();
    if (!base) return '';
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base} (${n})`)) n++;
    return `${base} (${n})`;
  }

  async function getAllDocuments() {
    const db = await openDB();
    if (!db.objectStoreNames.contains(DOCS_STORE)) return [];
    const tx = db.transaction(DOCS_STORE, 'readonly');
    const all = await promisifyRequest(tx.objectStore(DOCS_STORE).getAll());
    return all.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function getDocument(id) {
    const db = await openDB();
    const tx = db.transaction(DOCS_STORE, 'readonly');
    return promisifyRequest(tx.objectStore(DOCS_STORE).get(id));
  }

  async function deleteDocument(id) {
    const db = await openDB();
    const tx = db.transaction(DOCS_STORE, 'readwrite');
    await promisifyRequest(tx.objectStore(DOCS_STORE).delete(id));
  }

  function getEditor(id) {
    return EDITORS.find((e) => e.id === id) || null;
  }

  // エディタ path はサイトルート基準。/library/ などから解決すると
  // /library/stoic/ になって 404 になるため、親ディレクトリを基準にする。
  function siteRootUrl(fromUrl) {
    const url = new URL(fromUrl || global.location?.href || '/');
    const path = url.pathname;
    if (path === '/' || path === '/index.html') {
      return new URL('/', url.origin).href;
    }
    const dir = path.endsWith('/') ? path : path.replace(/\/[^/]*$/, '/');
    if (dir === '/') return new URL('/', url.origin).href;
    const parent = dir.replace(/[^/]+\/$/, '') || '/';
    return new URL(parent, url.origin).href;
  }

  function editorHref(editor, baseUrl) {
    return new URL(editor.path, siteRootUrl(baseUrl)).href;
  }

  function editorDocHref(editorId, docId, baseUrl) {
    const editor = getEditor(editorId);
    if (!editor || !docId) return null;
    const url = new URL(editor.path, siteRootUrl(baseUrl));
    url.searchParams.set('doc', docId);
    return url.href;
  }

  async function getDefaultOpenEditorId(doc) {
    const prefs = await getPrefsRecord();
    if (prefs.lastEditor && LIBRARY_EDITORS.some((e) => e.id === prefs.lastEditor)) {
      return prefs.lastEditor;
    }
    if (doc?.editorId && LIBRARY_EDITORS.some((e) => e.id === doc.editorId)) {
      return doc.editorId;
    }
    return LIBRARY_EDITORS[0]?.id || null;
  }

  function syncDraftMeta(editorId, charCountOrMeta) {
    const meta = typeof charCountOrMeta === 'object' && charCountOrMeta !== null
      ? charCountOrMeta
      : { charCount: charCountOrMeta };
    updateDraftMeta(editorId, meta).catch(() => {});
  }

  function trackEditor(editorId) {
    recordVisit(editorId).catch(() => {});
  }

  global.TadekuEditorPrefs = {
    EDITORS,
    RESUME_EDITORS,
    LIBRARY_EDITORS,
    openDB,
    recordVisit,
    updateDraftMeta,
    getDraftMeta,
    getAllDraftMeta,
    getPrefs: getPrefsRecord,
    setDefaultEditor,
    getResumeEditorId,
    getEditor,
    editorHref,
    editorDocHref,
    getDefaultOpenEditorId,
    syncDraftMeta,
    trackEditor,
    saveDocument,
    updateDocument,
    resolveUniqueTitle,
    displayTitle,
    formatDateTitle,
    documentDisplayTitle,
    isPlaceholderTitle,
    getAllDocuments,
    getDocument,
    deleteDocument,
  };
})(typeof window !== 'undefined' ? window : globalThis);
