(function () {
  const STYLE_ID = 'aozora-style-injected';
  const WIDGET_HOST_ID = 'aozora-style-widget-host';
  const STORAGE_KEY = 'aozoraStyle';

  let verticalWheelScroll = false;
  const quoteOriginals = new WeakMap();

  function isReadingPage() {
    return Boolean(document.querySelector('.main_text, h1.title'));
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
    applyVerticalQuotes(false);
  }

  function shouldSkipQuoteNode(node) {
    const parent = node.parentElement;
    if (!parent) return true;
    const tag = parent.tagName;
    return tag === 'RT' || tag === 'SCRIPT' || tag === 'STYLE';
  }

  function applyVerticalQuotes(enabled) {
    const roots = document.querySelectorAll('.main_text, div.main_text');
    roots.forEach((root) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let current;
      while ((current = walker.nextNode())) {
        if (shouldSkipQuoteNode(current)) continue;
        if (!/["\u201C\u201D\u201E\u201F\u301D\u301E]/.test(current.textContent)) continue;
        nodes.push(current);
      }

      nodes.forEach((node) => {
        if (enabled) {
          if (!quoteOriginals.has(node)) quoteOriginals.set(node, node.textContent);
          node.textContent = AozoraStyleSettings.toVerticalDoubleQuotes(quoteOriginals.get(node));
          return;
        }
        if (quoteOriginals.has(node)) {
          node.textContent = quoteOriginals.get(node);
          quoteOriginals.delete(node);
        }
      });
    });
  }

  function apply(data) {
    if (!isReadingPage()) return;

    const enabled = data?.enabled !== false;
    const settings = AozoraStyleSettings.normalize(data?.settings || {});

    if (!enabled) {
      clearStyles();
      verticalWheelScroll = false;
      return;
    }

    verticalWheelScroll = settings.writing === 'vertical';
    getStyleEl().textContent = AozoraStyleSettings.buildCss(settings);
    applyVerticalQuotes(verticalWheelScroll);
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
    AozoraStylePanel.init(shadow);
    document.documentElement.appendChild(host);
  }

  function ensureWidget() {
    mountWidget();
    if (!document.getElementById(WIDGET_HOST_ID) && document.readyState !== 'complete') {
      window.addEventListener('load', mountWidget, { once: true });
    }
  }

  function loadAndApply() {
    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      apply(result[STORAGE_KEY] || { enabled: true, settings: AozoraStyleSettings.DEFAULTS });
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes[STORAGE_KEY]) return;
    apply(changes[STORAGE_KEY].newValue);
  });

  ensureWidget();
  document.addEventListener('wheel', onWheel, { passive: false });
  loadAndApply();
})();
