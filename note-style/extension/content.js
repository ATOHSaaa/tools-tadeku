(function () {
  const STYLE_ID = 'note-style-injected';
  const WIDGET_HOST_ID = 'note-style-widget-host';
  const STORAGE_KEY = 'noteStyle';
  const NUM_ATTR = 'data-note-style-num';
  const LANDSCAPE_ATTR = 'data-note-style-landscape';
  // 数字と、それに付く通貨・記号。英字は触らない。
  const NUM_RE = /[$¥€£#＃]?\d+[%％]?/g;
  const NUM_OR_SYMBOL_RE = /[\d$¥€£#＃％%]/;
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE',
    'SVG', 'MATH', 'IFRAME', 'INPUT', 'SELECT', 'BUTTON',
  ]);

  let verticalWheelScroll = false;
  let lastPayload = { enabled: true, settings: NoteStyleSettings.DEFAULTS };
  let observedRoot = null;
  let tcyApplied = false;
  let landscapeApplied = false;

  function isReadingPage() {
    return NoteStyleSettings.isReadingPath(location.pathname)
      && Boolean(document.querySelector(
        '.note-common-styles__textnote-body, .o-noteContentHeader__title, main.p-article'
      ));
  }

  function getStyleEl() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    return el;
  }

  function clearStyles() {
    const styleEl = document.getElementById(STYLE_ID);
    if (styleEl) styleEl.remove();
  }

  function unmountWidget() {
    const host = document.getElementById(WIDGET_HOST_ID);
    if (host) host.remove();
  }

  function getTcyRoots() {
    return Array.from(document.querySelectorAll(
      '.o-noteContentHeader__title, .o-noteContentHeader__name, .note-common-styles__textnote-body'
    ));
  }

  function unwrapNumbers(root) {
    root.querySelectorAll(`span[${NUM_ATTR}]`).forEach((span) => {
      const parent = span.parentNode;
      if (!parent) return;
      while (span.firstChild) parent.insertBefore(span.firstChild, span);
      parent.removeChild(span);
      parent.normalize();
    });
  }

  function shouldSkipTextNode(node) {
    let el = node.parentElement;
    while (el) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.getAttribute?.(NUM_ATTR) != null) return true;
      if (el.classList?.contains(NoteStyleSettings.TCY_CLASS)) return true;
      if (el.classList?.contains(NoteStyleSettings.UPRIGHT_CLASS)) return true;
      if (el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }

  function appendDigitSpan(frag, text, className) {
    const span = document.createElement('span');
    span.className = className;
    span.setAttribute(NUM_ATTR, '');
    span.textContent = text;
    frag.appendChild(span);
  }

  function digitCount(token) {
    return (token.match(/\d/g) || []).length;
  }

  function wrapNumbersInTextNode(textNode) {
    const text = textNode.nodeValue;
    if (!text || !NUM_OR_SYMBOL_RE.test(text)) return;

    NUM_RE.lastIndex = 0;
    if (!NUM_RE.test(text)) return;
    NUM_RE.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let last = 0;
    let match;
    while ((match = NUM_RE.exec(text))) {
      if (match.index > last) {
        frag.appendChild(document.createTextNode(text.slice(last, match.index)));
      }
      const token = match[0];
      if (digitCount(token) <= 3) {
        // $250 / 10 / 50% など → まとめて縦中横
        appendDigitSpan(frag, token, NoteStyleSettings.TCY_CLASS);
      } else {
        // $2024 / 2024 など → 記号も含め1字ずつ正立
        for (const ch of token) {
          appendDigitSpan(frag, ch, NoteStyleSettings.UPRIGHT_CLASS);
        }
      }
      last = match.index + token.length;
    }
    if (last < text.length) {
      frag.appendChild(document.createTextNode(text.slice(last)));
    }
    textNode.parentNode.replaceChild(frag, textNode);
  }

  function applyNumbers(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !NUM_OR_SYMBOL_RE.test(node.nodeValue)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (shouldSkipTextNode(node)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let current = walker.nextNode();
    while (current) {
      nodes.push(current);
      current = walker.nextNode();
    }
    nodes.forEach(wrapNumbersInTextNode);
  }

  function syncNumbers(enabledVertical) {
    const roots = getTcyRoots();
    if (!roots.length) return;

    if (!enabledVertical) {
      roots.forEach(unwrapNumbers);
      tcyApplied = false;
      return;
    }

    roots.forEach(applyNumbers);
    tcyApplied = true;
  }

  function clearNumbersAll() {
    getTcyRoots().forEach(unwrapNumbers);
    tcyApplied = false;
  }

  function getMediaSize(el) {
    if (el.tagName === 'VIDEO') {
      return {
        width: el.videoWidth || Number(el.getAttribute('width')) || 0,
        height: el.videoHeight || Number(el.getAttribute('height')) || 0,
      };
    }
    return {
      width: el.naturalWidth || Number(el.getAttribute('width')) || 0,
      height: el.naturalHeight || Number(el.getAttribute('height')) || 0,
    };
  }

  function isLandscapeMedia(el) {
    const { width, height } = getMediaSize(el);
    if (!width || !height) return false;
    return width > height;
  }

  function clearLandscapeAll() {
    document.querySelectorAll(`[${LANDSCAPE_ATTR}]`).forEach((el) => {
      el.classList.remove(NoteStyleSettings.LANDSCAPE_CLASS);
      el.removeAttribute(LANDSCAPE_ATTR);
    });
    landscapeApplied = false;
  }

  function markCenteredTarget(target) {
    if (!target || target.getAttribute(LANDSCAPE_ATTR) != null) return;
    target.classList.add(NoteStyleSettings.LANDSCAPE_CLASS);
    target.setAttribute(LANDSCAPE_ATTR, '');
  }

  function markLandscapeTarget(media) {
    if (!isLandscapeMedia(media)) return;
    markCenteredTarget(media.closest('figure') || media);
  }

  function applyLinkCards() {
    const cards = document.querySelectorAll([
      '.note-common-styles__textnote-body figure[embedded-service="external-article"]',
      '.note-common-styles__textnote-body figure[embedded-service="note"]',
      '.note-common-styles__textnote-body .external-article-widget',
      '.note-common-styles__textnote-body iframe.note-embed',
    ].join(', '));

    cards.forEach((el) => {
      const target = el.closest('figure') || el;
      markCenteredTarget(target);
    });
  }

  function applyLandscape() {
    const mediaList = document.querySelectorAll(
      '.note-common-styles__textnote-body img, .note-common-styles__textnote-body video'
    );
    mediaList.forEach((el) => {
      const ready = el.tagName === 'VIDEO'
        ? el.readyState >= 1 || (el.videoWidth > 0 && el.videoHeight > 0)
        : el.complete && el.naturalWidth > 0;

      if (ready) {
        markLandscapeTarget(el);
        return;
      }

      const onReady = () => markLandscapeTarget(el);
      el.addEventListener(el.tagName === 'VIDEO' ? 'loadedmetadata' : 'load', onReady, { once: true });
    });
    applyLinkCards();
    landscapeApplied = true;
  }

  function syncLandscape(enabledVertical) {
    if (!enabledVertical || !isReadingPage()) {
      clearLandscapeAll();
      return;
    }
    applyLandscape();
  }

  function apply(data) {
    lastPayload = data || lastPayload;

    if (!isReadingPage()) {
      clearStyles();
      clearNumbersAll();
      clearLandscapeAll();
      unmountWidget();
      verticalWheelScroll = false;
      return;
    }

    const enabled = lastPayload?.enabled !== false;
    const settings = NoteStyleSettings.normalize(lastPayload?.settings || {});

    if (!enabled) {
      clearStyles();
      clearNumbersAll();
      clearLandscapeAll();
      verticalWheelScroll = false;
      mountWidget();
      return;
    }

    verticalWheelScroll = settings.writing === 'vertical';
    getStyleEl().textContent = NoteStyleSettings.buildCss(settings);
    syncNumbers(settings.writing === 'vertical');
    syncLandscape(settings.writing === 'vertical');
    mountWidget();
  }

  function onWheel(e) {
    if (!verticalWheelScroll) return;

    const host = document.getElementById(WIDGET_HOST_ID);
    if (host && e.composedPath().includes(host)) return;

    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

    const root = document.documentElement;
    const before = root.scrollLeft;
    root.scrollLeft -= e.deltaY;

    if (root.scrollLeft !== before) {
      e.preventDefault();
    }
  }

  function mountWidget() {
    if (document.getElementById(WIDGET_HOST_ID)) return;
    if (!isReadingPage()) return;

    const host = document.createElement('div');
    host.id = WIDGET_HOST_ID;
    host.style.cssText = [
      'position:fixed',
      'bottom:20px',
      'right:20px',
      'z-index:2147483647',
      'pointer-events:none',
    ].join(';');

    const shadow = host.attachShadow({ mode: 'open' });
    NoteStylePanel.init(shadow);
    document.documentElement.appendChild(host);
  }

  function ensureWidget() {
    mountWidget();
    if (!document.getElementById(WIDGET_HOST_ID) && document.readyState !== 'complete') {
      window.addEventListener('load', () => apply(lastPayload), { once: true });
    }
  }

  function loadAndApply() {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      apply(result[STORAGE_KEY] || { enabled: true, settings: NoteStyleSettings.DEFAULTS });
    });
  }

  function watchSpaNavigation() {
    let lastUrl = location.href;
    const check = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        tcyApplied = false;
        landscapeApplied = false;
      }
      apply(lastPayload);
    };

    const observer = new MutationObserver(() => {
      window.clearTimeout(watchSpaNavigation._timer);
      watchSpaNavigation._timer = window.setTimeout(() => {
        if (verticalWheelScroll && isReadingPage()) {
          if (!tcyApplied) syncNumbers(true);
          if (!landscapeApplied) syncLandscape(true);
          else applyLandscape();
        }
        check();
      }, 120);
    });

    const start = () => {
      if (observedRoot === document.body) return;
      if (!document.body) return;
      observedRoot = document.body;
      observer.observe(document.body, { childList: true, subtree: true });
    };

    start();
    if (!document.body) {
      window.addEventListener('DOMContentLoaded', start, { once: true });
    }

    window.addEventListener('popstate', check);
    ['pushState', 'replaceState'].forEach((method) => {
      const original = history[method];
      if (typeof original !== 'function' || original.__noteStylePatched) return;
      const wrapped = function (...args) {
        const result = original.apply(this, args);
        check();
        return result;
      };
      wrapped.__noteStylePatched = true;
      history[method] = wrapped;
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[STORAGE_KEY]) return;
    apply(changes[STORAGE_KEY].newValue);
  });

  ensureWidget();
  document.addEventListener('wheel', onWheel, { passive: false });
  loadAndApply();
  watchSpaNavigation();
})();
