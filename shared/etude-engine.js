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
    const active = await findActiveSession(date);
    if (active) {
      return { ...active, prompt: active.prompt || getPromptForSlot(active.slotKey, prompts) };
    }

    const slotKey = getSlotKey(date);
    const prompt = getPromptForSlot(slotKey, prompts);
    const existing = await getSession(slotKey);
    if (existing) {
      return { ...existing, prompt: existing.prompt || prompt };
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
    return 'お題「' + prompt + '」で書き始めました ' + HASHTAG + '\n' + SITE_URL + ' @tadeku_net';
  }

  function buildFinishShareText(prompt, charCount) {
    return 'お題「' + prompt + '」\n' + charCount + '字 ' + HASHTAG + '\n' + SITE_URL + ' @tadeku_net';
  }

  function openTwitterIntent(text) {
    const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
    global.open(url, '_blank', 'noopener,noreferrer,width=550,height=520');
  }

  function splitText(text, parts) {
    const n = Math.max(1, Math.min(4, parts | 0));
    const trimmed = text.trim();
    if (!trimmed) return [''];
    if (n === 1) return [trimmed];

    const chars = [...trimmed];
    const chunkSize = Math.ceil(chars.length / n);
    const result = [];

    for (let i = 0; i < n; i++) {
      const start = i * chunkSize;
      if (start >= chars.length) break;
      let end = Math.min(chars.length, (i + 1) * chunkSize);
      if (i < n - 1 && end < chars.length) {
        const slice = chars.slice(start, end).join('');
        const breakAt = Math.max(
          slice.lastIndexOf('\n'),
          slice.lastIndexOf('。'),
          slice.lastIndexOf('！'),
          slice.lastIndexOf('？'),
        );
        if (breakAt > slice.length * 0.4) {
          end = start + breakAt + 1;
        }
      }
      result.push(chars.slice(start, end).join('').trim());
    }

    return result.filter(Boolean);
  }

  async function ensureFont(fontSpec) {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await document.fonts.load(fontSpec);
      await document.fonts.ready;
    } catch (_) { /* ignore */ }
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
          lines.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  async function renderTextImage({ prompt, body, partLabel, width, padding, fontSize, lineHeight }) {
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

    ctx.fillStyle = '#f6f4ef';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#e8913a';
    ctx.fillRect(pad, pad * 0.55, 48, 4);

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

  async function renderTextImages({ prompt, body, splits }) {
    const parts = splitText(body, splits);
    const images = [];
    for (let i = 0; i < parts.length; i++) {
      const label = parts.length > 1 ? (i + 1) + ' / ' + parts.length : '';
      const canvas = await renderTextImage({
        prompt,
        body: parts[i],
        partLabel: label,
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

  async function downloadTextImages({ prompt, body, splits, slotKey }) {
    const canvases = await renderTextImages({ prompt, body, splits });
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

  function buildLastWork(session, body, finishedAt, stoppedRemainingMs) {
    return {
      prompt: session.prompt,
      body: body || '',
      finishedAt,
      stoppedRemainingMs,
      charCount: (body || '').length,
    };
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
    getRemainingMs,
    formatCountdown,
    getPromptForSlot,
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
    downloadTextImages,
  };
})(typeof window !== 'undefined' ? window : globalThis);
