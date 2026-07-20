(function () {
  const STORAGE_KEY = 'noteStyle';
  const { PRESET, DEFAULTS, lineHeightFromSlider, letterSpacingFromSlider, normalize } = NoteStyleSettings;

  const payload = {
    enabled: true,
    settings: { ...DEFAULTS },
  };

  const els = {
    body: document.body,
    enabledToggle: document.getElementById('enabled-toggle'),
    fontSizeSlider: document.getElementById('font-size-slider'),
    fontSizeValue: document.getElementById('font-size-value'),
    lineHeightSlider: document.getElementById('line-height-slider'),
    lineHeightValue: document.getElementById('line-height-value'),
    letterSpacingSlider: document.getElementById('letter-spacing-slider'),
    letterSpacingValue: document.getElementById('letter-spacing-value'),
  };

  function syncUI() {
    const s = payload.settings;
    els.enabledToggle.checked = payload.enabled;
    els.body.dataset.enabled = payload.enabled ? 'true' : 'false';

    els.fontSizeSlider.value = String(s.fontSize);
    els.fontSizeValue.textContent = s.fontSize + 'px';
    els.lineHeightSlider.value = String(s.lineHeight);
    els.lineHeightValue.textContent = lineHeightFromSlider(s.lineHeight);
    els.letterSpacingSlider.value = String(s.letterSpacing);
    els.letterSpacingValue.textContent = letterSpacingFromSlider(s.letterSpacing);

    document.querySelectorAll('#writing-group .toggle-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.writing === s.writing);
    });
    document.querySelectorAll('#font-group .toggle-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.font === s.font);
    });
    document.querySelectorAll('#theme-group .toggle-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.theme === s.theme);
    });
  }

  function persist() {
    payload.settings = normalize(payload.settings);
    chrome.storage.sync.set({ [STORAGE_KEY]: payload });
    syncUI();
  }

  function setSettings(patch) {
    Object.assign(payload.settings, patch);
    persist();
  }

  els.enabledToggle.addEventListener('change', () => {
    payload.enabled = els.enabledToggle.checked;
    persist();
  });

  els.fontSizeSlider.addEventListener('input', () => setSettings({ fontSize: Number(els.fontSizeSlider.value) }));
  els.lineHeightSlider.addEventListener('input', () => setSettings({ lineHeight: Number(els.lineHeightSlider.value) }));
  els.letterSpacingSlider.addEventListener('input', () => setSettings({ letterSpacing: Number(els.letterSpacingSlider.value) }));

  document.getElementById('writing-group').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-writing]');
    if (!btn) return;
    setSettings({ writing: btn.dataset.writing });
  });

  document.getElementById('font-group').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-font]');
    if (!btn) return;
    setSettings({ font: btn.dataset.font });
  });

  document.getElementById('theme-group').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-theme]');
    if (!btn) return;
    setSettings({ theme: btn.dataset.theme });
  });

  document.getElementById('preset-btn').addEventListener('click', () => {
    payload.settings = { ...PRESET };
    persist();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    payload.settings = { ...DEFAULTS };
    persist();
  });

  chrome.storage.sync.get(STORAGE_KEY, (result) => {
    const saved = result[STORAGE_KEY];
    if (saved) {
      payload.enabled = saved.enabled !== false;
      payload.settings = normalize(saved.settings || {});
    }
    syncUI();
  });
})();
