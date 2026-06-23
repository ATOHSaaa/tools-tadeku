(function () {
  const SITE_URL = 'https://tools.tadeku.net/';

  function applyBrandCrumb(el) {
    if (el.querySelector('.brand-home')) return;

    const toolName = (el.dataset.tool || el.textContent).trim();
    if (!toolName) return;

    el.textContent = '';
    el.dataset.tool = toolName;

    const home = document.createElement('a');
    home.className = 'brand-home';
    home.href = SITE_URL;
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
