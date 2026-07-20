(function () {
  const SITE_URL = 'https://tools.tadeku.net/';

  function toolNameFromPageTitle() {
    const titleEl = document.querySelector('.page-title');
    if (!titleEl) return '';
    const clone = titleEl.cloneNode(true);
    clone.querySelectorAll('.brand-home, .brand-sep').forEach((node) => node.remove());
    return clone.textContent.trim();
  }

  function resolveToolName(el) {
    if (el.dataset.tool) return el.dataset.tool.trim();
    const fromTitle = toolNameFromPageTitle();
    if (fromTitle) return fromTitle;
    const raw = el.textContent.trim();
    if (!raw || raw.toLowerCase() === 'tadeku-tools') return '';
    return raw;
  }

  function applyBrandCrumb(el) {
    if (el.querySelector('.brand-home')) return;

    const toolName = resolveToolName(el);
    if (!toolName) return;

    const homeHref = el.getAttribute('href') || SITE_URL;
    el.textContent = '';
    el.dataset.tool = toolName;
    if (el.tagName === 'A') el.removeAttribute('href');

    const home = document.createElement('a');
    home.className = 'brand-home';
    home.href = homeHref;
    home.textContent = 'tadeku-tools';

    const sep = document.createElement('span');
    sep.className = 'brand-sep';
    sep.textContent = ' / ';

    el.append(home, sep, document.createTextNode(toolName));
  }

  function init() {
    document.querySelectorAll('.brand').forEach(applyBrandCrumb);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
