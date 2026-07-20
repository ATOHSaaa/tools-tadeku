(function (global) {
  'use strict';

  const DB_NAME = 'tadeku-etude';
  const DB_VERSION = 1;
  const STORE = 'sessions';
  const HASHTAG = '#etudeワンライ';
  const SITE_URL = 'https://tools.tadeku.net/etude/';
  const WRITING_DURATION_MS = 60 * 60 * 1000;

  let dbPromise = null;

  function hashSlotKey(slotKey) {
    let h = 2166136261;
    for (let i = 0; i < slotKey.length; i++) {
      h ^= slotKey.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function getSlotKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return (
      d.getFullYear() +
      '-' + pad2(d.getMonth() + 1) +
      '-' + pad2(d.getDate()) +
      'T' + pad2(d.getHours())
    );
  }

  function getSlotStart(date) {
    const d = new Date(date instanceof Date ? date : Date.now());
    d.setMinutes(0, 0, 0);
    return d;
  }

  function getSlotEnd(date) {
    const d = getSlotStart(date);
    d.setHours(d.getHours() + 1);
    return d;
  }

  function formatDate(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate());
  }

  function formatSlotRange(date) {
    const start = getSlotStart(date);
    return (
      formatDate(date) + ' ' +
      pad2(start.getHours()) + ':00 — ' + pad2(start.getHours()) + ':59'
    );
  }

  function formatSlotPromptLabel(date) {
    return formatSlotRange(date) + ' のお題';
  }

  function formatFinishedAt(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return (
      d.getFullYear() + '.' + pad2(d.getMonth() + 1) + '.' + pad2(d.getDate()) + ' ' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes())
    );
  }

  function makeWorkId(slotKey, finishedAt, seq) {
    return slotKey + '-' + finishedAt + (seq ? '-' + seq : '');
  }

  function buildLastWork(session, body, finishedAt, stoppedRemainingMs) {
    return {
      prompt: session.prompt,
      body: body || '',
      finishedAt,
      stoppedRemainingMs,
      charCount: (body || '').length,
    };
  }

  function normalizeSessionWorks(session) {
    if (!session) return session;
    if (!Array.isArray(session.finishedWorks)) {
      session.finishedWorks = [];
    }
    if (session.lastWork && String(session.lastWork.body || '').trim()) {
      const finishedAt = session.lastWork.finishedAt ?? session.finishedAt ?? Date.now();
      const workId = session.lastWork.workId || makeWorkId(session.slotKey, finishedAt, 0);
      const exists = session.finishedWorks.some((w) => w.workId === workId);
      if (!exists) {
        session.finishedWorks.push({
          ...session.lastWork,
          slotKey: session.slotKey,
          finishedAt,
          workId,
          charCount: session.lastWork.charCount ?? String(session.lastWork.body).length,
        });
      }
    }
    session.finishedWorks = session.finishedWorks.filter((w) => String(w.body || '').trim());
    for (const work of session.finishedWorks) {
      if (!work.workId) {
        work.workId = makeWorkId(work.slotKey || session.slotKey, work.finishedAt || Date.now(), 0);
      }
      if (!work.slotKey) work.slotKey = session.slotKey;
    }
    return session;
  }

  function mapFinishedWork(work, session) {
    const slotKey = work.slotKey || session.slotKey;
    return {
      workId: work.workId,
      slotKey,
      prompt: work.prompt || session.prompt,
      body: work.body,
      charCount: work.charCount ?? String(work.body).length,
      finishedAt: work.finishedAt,
      slotRange: formatSlotRange(slotKeyToDate(slotKey)),
      finishedLabel: formatFinishedAt(work.finishedAt),
    };
  }

  function getWritingEnd(session) {
    if (!session || !session.startedAt) return null;
    return session.startedAt + WRITING_DURATION_MS;
  }

  function getRemainingMs(date, session) {
    if (!session || !session.startedAt) return WRITING_DURATION_MS;
    if (session.finishedAt) {
      if (session.stoppedRemainingMs != null) return session.stoppedRemainingMs;
      const end = session.startedAt + WRITING_DURATION_MS;
      const t = session.finishedAt;
      return Math.max(0, end - t);
    }
    const end = getWritingEnd(session);
    const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
    return Math.max(0, end - t);
  }

  function formatCountdown(ms) {
    const total = Math.ceil(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return pad2(m) + ':' + pad2(s);
  }

  function getPromptForSlot(slotKey, prompts) {
    const list = prompts && prompts.length ? prompts : ['白紙の手紙'];
    return list[hashSlotKey(slotKey) % list.length];
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
          db.createObjectStore(STORE, { keyPath: 'slotKey' });
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

  async function getSession(slotKey) {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    return dbRequest(tx.objectStore(STORE).get(slotKey));
  }

  async function putSession(session) {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(session);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('put failed'));
    });
  }

  function slotKeyToDate(slotKey) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})$/.exec(slotKey || '');
    if (!m) return new Date(0);
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], 0, 0, 0);
  }

  async function listAllSessions() {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    return dbRequest(tx.objectStore(STORE).getAll());
  }

  function isAbandonedDraft(session, date) {
    if (!session || !session.startedAt || session.finishedAt) return false;
    if (!String(session.body || '').trim()) return false;
    if (isTimerActive(date, session)) return false;
    // 同じ時間帯ならロック画面から「書き終わる」できるので、まだ履歴化しない
    if (getSlotKey(date) === session.slotKey) return false;
    return true;
  }

  async function salvageAbandonedDraft(session, date) {
    if (!isAbandonedDraft(session, date)) return null;
    const end = getWritingEnd(session) || Date.now();
    const finishedAt = Math.min(end, date instanceof Date ? date.getTime() : new Date(date).getTime());
    const work = await finishWriting(session, session.body, finishedAt, 0);
    work.timedOut = true;
    if (session.lastWork) session.lastWork.timedOut = true;
    await putSession(session);
    return work;
  }

  async function salvageAbandonedDrafts(date) {
    const all = await listAllSessions();
    const salvaged = [];
    for (const session of all) {
      normalizeSessionWorks(session);
      if (!isAbandonedDraft(session, date)) continue;
      const work = await salvageAbandonedDraft(session, date);
      if (work) salvaged.push(work);
    }
    return salvaged;
  }

  async function listFinishedWorks(date) {
    const when = date || new Date();
    await salvageAbandonedDrafts(when);
    const all = await listAllSessions();
    const works = [];
    for (const session of all) {
      normalizeSessionWorks(session);
      for (const work of session.finishedWorks) {
        if (String(work.body || '').trim()) {
          works.push({
            ...mapFinishedWork(work, session),
            timedOut: !!work.timedOut,
          });
        }
      }
    }
    return works.sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
  }

  async function deleteFinishedWork(workId) {
    const all = await listAllSessions();
    for (const session of all) {
      normalizeSessionWorks(session);
      const index = session.finishedWorks.findIndex((w) => w.workId === workId);
      if (index === -1) continue;
      session.finishedWorks.splice(index, 1);
      if (session.lastWork && session.lastWork.workId === workId) {
        session.lastWork = session.finishedWorks.length
          ? session.finishedWorks.reduce((best, w) => (
            (w.finishedAt || 0) > (best.finishedAt || 0) ? w : best
          ))
          : null;
      }
      if (!session.finishedWorks.length && session.finishedAt) {
        session.finishedAt = null;
        session.stoppedRemainingMs = null;
      }
      await putSession(session);
      return;
    }
  }

  async function finishWriting(session, body, finishedAt, stoppedRemainingMs) {
    normalizeSessionWorks(session);
    const base = buildLastWork(session, body, finishedAt, stoppedRemainingMs);
    let seq = session.finishedWorks.length;
    let workId = makeWorkId(session.slotKey, finishedAt, seq);
    while (session.finishedWorks.some((w) => w.workId === workId)) {
      seq += 1;
      workId = makeWorkId(session.slotKey, finishedAt, seq);
    }
    const work = {
      ...base,
      workId,
      slotKey: session.slotKey,
    };
    session.finishedWorks.push(work);
    session.lastWork = work;
    session.body = body || '';
    session.finishedAt = finishedAt;
    session.stoppedRemainingMs = stoppedRemainingMs;
    await putSession(session);
    return work;
  }

  async function findActiveSession(date) {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readonly');
    const all = await dbRequest(tx.objectStore(STORE).getAll());
    const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
    let best = null;
    for (const s of all) {
      if (!s.startedAt || s.finishedAt) continue;
      const end = s.startedAt + WRITING_DURATION_MS;
      if (end > t && (!best || s.startedAt > best.startedAt)) {
        best = s;
      }
    }
    return best;
  }

  async function loadOrCreateSession(date, prompts) {
    await salvageAbandonedDrafts(date);

    const active = await findActiveSession(date);
    if (active) {
      return normalizeSessionWorks({ ...active, prompt: active.prompt || getPromptForSlot(active.slotKey, prompts) });
    }

    const slotKey = getSlotKey(date);
    const prompt = getPromptForSlot(slotKey, prompts);
    const existing = await getSession(slotKey);
    if (existing) {
      return normalizeSessionWorks({ ...existing, prompt: existing.prompt || prompt });
    }
    return {
      slotKey,
      prompt,
      body: '',
      startedAt: null,
      finishedAt: null,
    };
  }

  function isTimerActive(date, session) {
    if (!session || !session.startedAt || session.finishedAt) return false;
    const end = session.startedAt + WRITING_DURATION_MS;
    const t = date instanceof Date ? date.getTime() : new Date(date).getTime();
    return end > t;
  }

  function isLocked(date, session) {
    if (!session || !session.startedAt) return false;
    return getRemainingMs(date, session) <= 0;
  }

  function isWriting(session) {
    return !!(session && session.startedAt && !session.finishedAt);
  }

  function isFinished(session) {
    return !!(session && session.finishedAt);
  }

  function buildStartShareText(prompt) {
    return 'お題「' + prompt + '」で書き始めました！ ' + HASHTAG + '\n' + SITE_URL + ' @tadeku_net #TadekuTools';
  }

  function buildFinishShareText(prompt, charCount) {
    return 'お題「' + prompt + '」で書き終わりました！ ' + HASHTAG + '\n' + SITE_URL + ' @tadeku_net #TadekuTools';
  }

  function openTwitterIntent(text) {
    const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
    global.open(url, '_blank', 'noopener,noreferrer,width=550,height=520');
  }

  function splitHorizontalByLines(text, linesPerPage) {
    const normalized = String(text || '');
    if (!normalized.trim()) return [''];

    const W = 1200;
    const pad = 64;
    const fs = 32;
    const innerW = W - pad * 2;
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = fs + 'px "Noto Sans JP", sans-serif';
    const lines = wrapLines(measure, normalized, innerW);
    const perPage = Math.max(1, linesPerPage | 0);
    const parts = [];

    for (let i = 0; i < lines.length; i += perPage) {
      parts.push(lines.slice(i, i + perPage).join('\n'));
    }

    return parts.length ? parts : [''];
  }

  function splitByLinesPerPage(text, linesPerPage, orientation) {
    const perPage = Math.max(1, linesPerPage | 0);
    if (orientation === 'vertical') {
      const G = global.TadekuGenkoRender;
      const split = G && G.splitVerticalText;
      // 縦書きの「行数」= 1枚の列数。字詰め（1列の文字数）は固定。
      const rows = (G && G.ETUDE_ROWS) || 26;
      if (split) return split(text, rows, perPage);
      const normalized = String(text || '');
      return normalized.trim() ? [normalized] : [''];
    }
    return splitHorizontalByLines(text, perPage);
  }

  /** 1枚あたりの行数の初期値（縦書きは列数、横書きは折り返し行数） */
  function suggestLinesPerPage(charCount, orientation) {
    if (orientation === 'vertical') {
      const cols = global.TadekuGenkoRender && global.TadekuGenkoRender.ETUDE_COLS;
      return cols || 18;
    }
    const n = Math.max(0, Number(charCount) || 0);
    if (n <= 400) return 21;
    if (n <= 900) return 27;
    return 33;
  }

  function getLinesPerPageRange(orientation) {
    if (orientation === 'vertical') {
      return { min: 12, max: 24, step: 1 };
    }
    return { min: 15, max: 48, step: 1 };
  }

  async function ensureFont(fontSpec) {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await document.fonts.load(fontSpec);
      await document.fonts.ready;
    } catch (_) { /* ignore */ }
  }

  const LINE_START_FORBIDDEN = new Set([
    ...'、。，．,.！？!?…‥・:;；',
    ...')）]］｝}〕〉》」』】〙〗｠»',
    ...'ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶー々',
  ]);
  const LINE_END_FORBIDDEN = new Set([...'(（[［｛{〔〈《「『【〘〖｟«']);

  function isLineStartForbidden(ch) {
    return ch !== undefined && LINE_START_FORBIDDEN.has(ch);
  }

  function isLineEndForbidden(ch) {
    return ch !== undefined && LINE_END_FORBIDDEN.has(ch);
  }

  function wrapLines(ctx, text, maxWidth) {
    const paragraphs = text.split('\n');
    const lines = [];

    for (const para of paragraphs) {
      if (!para) {
        lines.push('');
        continue;
      }

      let line = '';
      for (const ch of para) {
        const test = line + ch;
        if (line && ctx.measureText(test).width > maxWidth) {
          if (isLineStartForbidden(ch)) {
            line = test;
          } else if (isLineEndForbidden(line[line.length - 1])) {
            const last = line[line.length - 1];
            lines.push(line.slice(0, -1));
            line = last + ch;
          } else {
            lines.push(line);
            line = ch;
          }
        } else {
          line = test;
        }
      }

      if (line) lines.push(line);
    }

    return lines;
  }

  async function renderHorizontalTextImage({ prompt, body, partLabel, width, padding, fontSize, lineHeight }) {
    await ensureFont(fontSize + 'px "Noto Sans JP"');

    const W = width || 1200;
    const pad = padding || 64;
    const fs = fontSize || 32;
    const lh = lineHeight || 1.85;
    const innerW = W - pad * 2;

    const measure = document.createElement('canvas').getContext('2d');
    measure.font = '700 ' + (fs * 0.72) + 'px "Noto Sans JP", sans-serif';

    const headerLines = wrapLines(measure, 'お題：' + prompt, innerW);
    const bodyMeasure = document.createElement('canvas').getContext('2d');
    bodyMeasure.font = fs + 'px "Noto Sans JP", sans-serif';
    const bodyLines = wrapLines(bodyMeasure, body, innerW);

    const headerFs = fs * 0.72;
    const headerLh = headerFs * 1.6;
    const bodyLhPx = fs * lh;
    const gap = fs * 0.9;
    const footerH = partLabel ? fs * 1.2 : 0;
    const H = Math.ceil(
      pad * 2 +
      headerLines.length * headerLh +
      gap +
      bodyLines.length * bodyLhPx +
      footerH,
    );

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = Math.max(H, 400);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#faf8f4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let y = pad;
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '700 ' + headerFs + 'px "Noto Sans JP", sans-serif';
    ctx.textBaseline = 'top';
    for (const line of headerLines) {
      ctx.fillText(line, pad, y);
      y += headerLh;
    }

    y += gap;
    ctx.font = fs + 'px "Noto Sans JP", sans-serif';
    for (const line of bodyLines) {
      ctx.fillText(line, pad, y);
      y += bodyLhPx;
    }

    if (partLabel) {
      ctx.fillStyle = '#999';
      ctx.font = '700 ' + (fs * 0.55) + 'px "Noto Sans JP", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(partLabel, W - pad, canvas.height - pad * 0.65);
      ctx.textAlign = 'left';
    }

    return canvas;
  }

  async function renderVerticalTextImage(options) {
    const render = global.TadekuGenkoRender && global.TadekuGenkoRender.renderEtudeVerticalImage;
    if (!render) {
      throw new Error('TadekuGenkoRender is unavailable');
    }
    return render(options);
  }

  async function renderTextImage(options) {
    if (options && options.orientation === 'vertical') {
      const G = global.TadekuGenkoRender;
      return renderVerticalTextImage({
        ...options,
        rowsPerPage: (G && G.ETUDE_ROWS) || 26,
        colsPerPage: options.linesPerPage,
      });
    }
    return renderHorizontalTextImage(options);
  }

  async function renderTextImages({ prompt, body, linesPerPage, orientation }) {
    const parts = splitByLinesPerPage(body, linesPerPage, orientation);
    const images = [];
    for (let i = 0; i < parts.length; i++) {
      const label = parts.length > 1 ? (i + 1) + ' / ' + parts.length : '';
      const canvas = await renderTextImage({
        prompt,
        body: parts[i],
        partLabel: label,
        orientation,
        linesPerPage,
      });
      images.push(canvas);
    }
    return images;
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        'image/png',
      );
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function buildWorkTxtContent(work) {
    const meta = [
      work.finishedLabel || formatFinishedAt(work.finishedAt),
      work.charCount + '字',
    ].filter(Boolean).join(' · ');
    return [
      'お題：' + work.prompt,
      work.slotRange,
      meta,
      '',
      work.body || '',
    ].join('\n');
  }

  function workTxtEntryName(work, used) {
    const base = 'etude-' + String(work.workId || work.slotKey).replace(/[^a-zA-Z0-9._-]/g, '-');
    let name = base + '.txt';
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    let n = 2;
    while (used.has(`${base} (${n}).txt`)) n += 1;
    name = `${base} (${n}).txt`;
    used.add(name);
    return name;
  }

  function finishedWorksZipFilename() {
    const d = new Date();
    return `etude-works-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}.zip`;
  }

  async function downloadFinishedWorksTxtZip() {
    if (!global.JSZip) throw new Error('JSZip missing');
    const works = await listFinishedWorks();
    if (!works.length) return 0;
    const zip = new global.JSZip();
    const used = new Set();
    for (const work of works) {
      zip.file(workTxtEntryName(work, used), buildWorkTxtContent(work));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, finishedWorksZipFilename());
    return works.length;
  }

  async function downloadTextImages({ prompt, body, linesPerPage, slotKey, orientation }) {
    const canvases = await renderTextImages({ prompt, body, linesPerPage, orientation });
    for (let i = 0; i < canvases.length; i++) {
      const blob = await canvasToBlob(canvases[i]);
      const suffix = canvases.length > 1 ? '-' + (i + 1) : '';
      downloadBlob(blob, 'etude-' + slotKey + suffix + '.png');
      if (i < canvases.length - 1) {
        await new Promise((r) => setTimeout(r, 120));
      }
    }
    return canvases.length;
  }

  global.TadekuEtude = {
    DB_NAME,
    HASHTAG,
    SITE_URL,
    getSlotKey,
    getSlotStart,
    getSlotEnd,
    WRITING_DURATION_MS,
    getWritingEnd,
    formatDate,
    formatSlotRange,
    formatSlotPromptLabel,
    formatFinishedAt,
    getRemainingMs,
    formatCountdown,
    getPromptForSlot,
    slotKeyToDate,
    listFinishedWorks,
    deleteFinishedWork,
    finishWriting,
    salvageAbandonedDrafts,
    loadOrCreateSession,
    putSession,
    getSession,
    isLocked,
    isFinished,
    isTimerActive,
    isWriting,
    buildStartShareText,
    buildFinishShareText,
    buildLastWork,
    openTwitterIntent,
    splitByLinesPerPage,
    suggestLinesPerPage,
    getLinesPerPageRange,
    renderTextImages,
    downloadTextImages,
    downloadFinishedWorksTxtZip,
  };
})(typeof window !== 'undefined' ? window : globalThis);
