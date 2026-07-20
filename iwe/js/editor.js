import { escapeHtml, countChars, debounce } from './utils.js';

/** @typedef {{ onChange?: (body: string) => void, onSave?: () => void, onLinkClick?: (target: string) => void }} EditorOpts */

export class IweEditor {
  /** @param {HTMLElement} wrap @param {EditorOpts} opts */
  constructor(wrap, opts = {}) {
    this.wrap = wrap;
    this.opts = opts;
    this.meta = {};
    this.body = '';
    this.clip = wrap.querySelector('.editor-backdrop-clip');
    this.backdrop = wrap.querySelector('.editor-backdrop');
    this.ta = wrap.querySelector('textarea');
    this.titleEl = wrap.querySelector('.editor-doc-title');
    this._debouncedChange = debounce(() => this.opts.onChange?.(this.getBody()), 1000);
    this._debouncedBackdrop = debounce(() => this.renderBackdrop(), 80);
    this._debouncedPreview = debounce(() => this.opts.onPreviewInput?.(this.getBody()), 300);
    this.ta.addEventListener('input', () => {
      this.body = this.ta.value;
      this._debouncedBackdrop();
      this._debouncedChange();
      this._debouncedPreview();
      this.opts.onInput?.(this.getBody());
    });
    this.ta.addEventListener('scroll', () => this.syncScroll());
    this.ta.addEventListener('click', (e) => this.handleLinkClick(e));
    if (this.titleEl) {
      this.titleEl.addEventListener('input', () => {
        this.meta.title = this.titleEl.value;
        this._debouncedChange();
      });
    }
  }

  /** @param {{ meta: Record<string, unknown>, body: string }} doc */
  load(doc) {
    this.meta = { ...doc.meta };
    this.body = doc.body || '';
    if (this.titleEl) this.titleEl.value = this.meta.title || '';
    this.ta.value = this.body;
    this.renderBackdrop();
    this.syncScroll();
  }

  getBody() { return this.ta.value; }
  getMeta() { return { ...this.meta, title: this.titleEl?.value || this.meta.title || '' }; }

  /** @param {(name: string) => string|null|undefined} resolver */
  renderBackdrop(resolver) {
    const text = this.ta.value;
    let html = '';
    const re = /\[\[([^\]]+)\]\]|^##\s.+$|^###\s.+$|\|?[^\s|《]+《[^》]+》|《《[^》]+》》|\[break\]/gm;
    let last = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      html += escapeHtml(text.slice(last, m.index));
      const seg = m[0];
      if (seg.startsWith('[[')) {
        html += `<span class="hl-link" data-link="${escapeHtml(m[1])}">${escapeHtml(seg)}</span>`;
      } else if (seg.startsWith('##') || seg.startsWith('###')) {
        html += `<span class="hl-heading">${escapeHtml(seg)}</span>`;
      } else if (seg.startsWith('《《')) {
        html += `<span class="hl-emphasis">${escapeHtml(seg)}</span>`;
      } else if (seg === '[break]') {
        html += `<span class="hl-break">${escapeHtml(seg)}</span>`;
      } else {
        html += `<span class="hl-ruby">${escapeHtml(seg)}</span>`;
      }
      last = m.index + seg.length;
    }
    html += escapeHtml(text.slice(last));
    html = html.replace(/\n/g, '<br>');
    this.backdrop.innerHTML = html + '\n';
    this.syncScroll();
  }

  syncScroll() {
    this.backdrop.style.transform = `translate(${-this.ta.scrollLeft}px, ${-this.ta.scrollTop}px)`;
  }

  /** @param {MouseEvent} e */
  handleLinkClick(e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const pos = this.ta.selectionStart;
    const text = this.ta.value;
    const re = /\[\[([^\]]+)\]\]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (pos >= m.index && pos <= m.index + m[0].length) {
        e.preventDefault();
        this.opts.onLinkClick?.(m[1]);
        return;
      }
    }
  }

  focus() { this.ta.focus(); }
  charCount() { return countChars(this.getBody()); }
}
