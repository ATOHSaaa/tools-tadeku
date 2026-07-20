import { escapeHtml } from './utils.js';

function stripFrontmatterBody(text) {
  const m = (text || '').match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return m ? m[1] : text || '';
}

function preprocessEmphasis(text) {
  return (text || '').replace(/《《([^》]+)》》/g, '⟦EM:$1⟧');
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 横書き二段組 HTML (簡易ルビ対応) */
function bodyToHorizontalHtml(text) {
  const lines = preprocessEmphasis(text).split('\n');
  const parts = [];
  for (const line of lines) {
    if (!line.trim()) { parts.push('<p class="iwe-p-gap"></p>'); continue; }
    if (/^##\s+/.test(line)) {
      parts.push(`<h2 class="iwe-h2">${esc(line.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }
    if (/^###\s+/.test(line)) {
      parts.push(`<h3 class="iwe-h3">${esc(line.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }
    if (line.trim() === '[break]') {
      parts.push('<div class="iwe-page-break"></div>');
      continue;
    }
    let html = esc(line);
    html = html.replace(/([^|《\s]+)《([^》]+)》/g, (_, base, ruby) => `<ruby>${esc(base)}<rt>${esc(ruby)}</rt></ruby>`);
    html = html.replace(/⟦EM:([^⟧]+)⟧/g, '<span class="iwe-emphasis-h">$1</span>');
    parts.push(`<p class="iwe-p">${html}</p>`);
  }
  return parts.join('');
}

export class IwePreview {
  /** @param {HTMLElement} host */
  constructor(host) {
    this.host = host;
    this.mode = 'vertical';
    this.scale = 0.55;
  }

  setMode(mode) {
    this.mode = mode;
    this.host.dataset.mode = mode;
  }

  /** @param {string} body */
  render(body) {
    const text = stripFrontmatterBody(body);
    this.host.innerHTML = '';
    if (this.mode === 'genko') {
      this.host.className = 'preview-host preview-genko';
      if (window.TadekuGenkoRender) {
        window.TadekuGenkoRender.renderPreview(this.host, text, { cellPx: 20 });
      } else {
        this.host.textContent = '原稿用紙プレビューを読み込めませんでした';
      }
      return;
    }
    if (this.mode === 'columns') {
      this.host.className = 'preview-host preview-columns';
      const sheet = document.createElement('div');
      sheet.className = 'iwe-columns-sheet';
      sheet.innerHTML = bodyToHorizontalHtml(text);
      this.host.appendChild(sheet);
      return;
    }
    this.renderVertical(text);
  }

  /** @param {string} text */
  renderVertical(text) {
    this.host.className = 'preview-host preview-vertical';
    const eng = window.NyukoEngine;
    const data = window.NyukoData;
    if (!eng || !data) {
      this.host.textContent = '縦書きプレビューを読み込めませんでした';
      return;
    }
    const formatted = eng.formatManuscript(text);
    const { formatId } = data.resolveDraftSettings({ formatId: 'a6' });
    const format = data.FORMATS[formatId] || data.FORMATS.a6;
    const font = data.FONTS.shippori || data.FONTS.mincho || Object.values(data.FONTS)[0];
    const result = eng.paginate(formatted, format, font, { writingDirection: 'vertical' });
    const wrap = document.createElement('div');
    wrap.className = 'nyuko-preview-wrap';
    wrap.style.transform = `scale(${this.scale})`;
    wrap.style.transformOrigin = 'top center';
    for (let i = 0; i < result.pages.length; i++) {
      const pageEl = eng.createPageElement(result.pages[i], format, font, 0, this.scale, i + 1, {
        writingDirection: 'vertical',
      });
      wrap.appendChild(pageEl);
    }
    if (!result.pages.length) {
      wrap.innerHTML = '<p class="preview-empty">プレビューする本文がありません</p>';
    }
    this.host.appendChild(wrap);
  }
}

export function renderReference(host, doc) {
  host.className = 'preview-host preview-reference';
  host.innerHTML = `<div class="ref-title">${escapeHtml(doc.meta.title || doc.path)}</div><pre class="ref-body">${escapeHtml(doc.body || '')}</pre>`;
}
