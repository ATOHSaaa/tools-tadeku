(function () {
  if (document.querySelector('.site-link')) return;

  const a = document.createElement('a');
  a.className = 'site-link';
  a.href = new URL('../', window.location.href).href;
  a.textContent = 'tadeku-tools';
  document.body.appendChild(a);
})();
