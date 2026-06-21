(function () {
  const segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter)
    ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
    : null;

  function graphemes(str) {
    if (!str) return [];
    if (segmenter) return [...segmenter.segment(str)].map(s => s.segment);
    return [...str];
  }

  function exportBasenameFromText(text) {
    const src = text || '';
    const nl = src.indexOf('\n');
    const firstLine = nl >= 0 ? src.slice(0, nl) : src;
    const head = graphemes(firstLine).slice(0, 20).join('');
    let safe = head.replace(/[\\/:*?"<>|\x00-\x1f]/g, '');
    safe = safe.replace(/^[\s、。．，,.]+|[\s、。．，,.]+$/g, '');
    safe = safe.replace(/[.\s]+$/g, '');
    return safe || '無題';
  }

  function exportFilename(text, format) {
    const base = exportBasenameFromText(text);
    if (format === 'jpg') return base + '.zip';
    return base + '.' + format;
  }

  function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function showExportFormatModal(message, focusEl) {
    return new Promise(resolve => {
      const overlay = document.getElementById('export-modal');
      if (!overlay) {
        resolve(null);
        return;
      }
      const formatBtns = overlay.querySelectorAll('.format-btn');
      const msgEl = document.getElementById('export-modal-message');
      if (msgEl) msgEl.textContent = message;

      overlay.hidden = false;

      function close(result) {
        overlay.hidden = true;
        document.removeEventListener('keydown', onKey);
        formatBtns.forEach(btn => { btn.onclick = null; });
        const cancelBtn = document.getElementById('export-modal-cancel');
        if (cancelBtn) cancelBtn.onclick = null;
        overlay.onclick = null;
        if (result && focusEl) setTimeout(() => focusEl.focus?.(), 0);
        resolve(result);
      }

      function onKey(ev) {
        if (ev.key === 'Escape') close(null);
      }

      formatBtns.forEach(btn => {
        btn.onclick = () => close(btn.dataset.format);
      });
      const cancelBtn = document.getElementById('export-modal-cancel');
      if (cancelBtn) cancelBtn.onclick = () => close(null);
      overlay.onclick = ev => { if (ev.target === overlay) close(null); };
      document.addEventListener('keydown', onKey);
      if (formatBtns[0]) formatBtns[0].focus();
    });
  }

  window.ExportUtils = {
    exportBasenameFromText,
    exportFilename,
    downloadBlob,
    showExportFormatModal,
  };
})();
