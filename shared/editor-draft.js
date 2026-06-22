(function (global) {
  function parseDraft(raw) {
    if (raw == null || raw === '') return { title: '', body: '' };
    if (raw.startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'body' in parsed) {
          return {
            title: typeof parsed.title === 'string' ? parsed.title : '',
            body: typeof parsed.body === 'string' ? parsed.body : '',
          };
        }
      } catch (_) {}
    }
    return { title: '', body: raw };
  }

  function loadDraft(key, legacyKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return parseDraft(raw);
      if (legacyKeys) {
        for (const legacyKey of legacyKeys) {
          const legacyRaw = localStorage.getItem(legacyKey);
          if (legacyRaw != null) return parseDraft(legacyRaw);
        }
      }
    } catch (_) {}
    return { title: '', body: '' };
  }

  function saveDraft(key, { title, body }) {
    try {
      localStorage.setItem(key, JSON.stringify({
        title: title || '',
        body: body || '',
      }));
    } catch (_) {}
  }

  function sanitizeBasename(text) {
    let safe = (text || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '');
    safe = safe.replace(/^[\s、。．，,.]+|[\s、。．，,.]+$/g, '');
    safe = safe.replace(/[.\s]+$/g, '');
    return safe || '無題';
  }

  function basenameFromDraft(title, body) {
    const trimmed = (title || '').trim();
    if (trimmed) {
      const segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter)
        ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
        : null;
      let head = trimmed;
      if (segmenter) {
        head = [...segmenter.segment(trimmed)].slice(0, 20).map((s) => s.segment).join('');
      } else {
        head = [...trimmed].slice(0, 20).join('');
      }
      return sanitizeBasename(head);
    }
    if (global.ExportUtils) return global.ExportUtils.exportBasenameFromText(body);
    return sanitizeBasename((body || '').split('\n')[0].slice(0, 20));
  }

  global.TadekuEditorDraft = {
    loadDraft,
    saveDraft,
    basenameFromDraft,
  };
})(typeof window !== 'undefined' ? window : globalThis);
