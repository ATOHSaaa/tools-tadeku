(function () {
  const STORAGE_KEY = 'aozoraStyle';
  const PANEL_HTML = `
<div class="aozora-style-ui">
  <div class="panel" id="panel" role="dialog" aria-label="Aozora Style">
    <div class="wrap ui-root" id="ui-root" data-enabled="true">
      <div class="header">
        <div class="title">Aozora Style</div>
        <label class="enable-label">
          <input type="checkbox" id="enabled-toggle" checked>
          有効
        </label>
      </div>

      <div class="controls">
        <div class="section-label">プリセット</div>
        <button type="button" class="action-btn primary" id="preset-btn">縦書きゴシック</button>
        <button type="button" class="action-btn" id="reset-btn">初期値に戻す</button>

        <div class="section-label">組み方向・フォント</div>
        <div class="toggle-group" id="writing-group">
          <button type="button" class="toggle-btn active" data-writing="vertical">縦書き</button>
          <button type="button" class="toggle-btn" data-writing="horizontal">横書き</button>
        </div>
        <div class="toggle-group" id="font-group" style="margin-top:0.3rem">
          <button type="button" class="toggle-btn active" data-font="sans">ゴシック</button>
          <button type="button" class="toggle-btn" data-font="serif">明朝</button>
        </div>

        <div class="section-label">背景色</div>
        <div class="toggle-group color-group" id="theme-group">
          <button type="button" class="toggle-btn color-btn active" data-theme="white"><span class="color-swatch" style="background:#ffffff"></span>白</button>
          <button type="button" class="toggle-btn color-btn" data-theme="cream"><span class="color-swatch" style="background:#f5f0e6"></span>クリーム</button>
          <button type="button" class="toggle-btn color-btn" data-theme="washi"><span class="color-swatch" style="background:#faf6ed"></span>生成り</button>
          <button type="button" class="toggle-btn color-btn" data-theme="sepia"><span class="color-swatch" style="background:#ebe4d5"></span>セピア</button>
          <button type="button" class="toggle-btn color-btn" data-theme="dark"><span class="color-swatch" style="background:#1c1c1e"></span>ダーク</button>
          <button type="button" class="toggle-btn color-btn" data-theme="night"><span class="color-swatch" style="background:#2a2836"></span>夜読み</button>
        </div>

        <div class="section-label">文字サイズ・行間・字間</div>
        <div class="spacing-field">
          <div class="spacing-field-head">文字サイズ <span id="font-size-value">18px</span></div>
          <input type="range" id="font-size-slider" min="14" max="26" step="1" value="18">
        </div>
        <div class="spacing-field">
          <div class="spacing-field-head">行間 <span id="line-height-value">2.0</span></div>
          <input type="range" id="line-height-slider" min="14" max="30" step="1" value="20">
        </div>
        <div class="spacing-field">
          <div class="spacing-field-head">字間 <span id="letter-spacing-value">0.05em</span></div>
          <input type="range" id="letter-spacing-slider" min="0" max="20" value="5">
        </div>
      </div>
    </div>
  </div>
  <button type="button" class="fab" id="fab" aria-label="Aozora Style" aria-expanded="false" title="Aozora Style">Ao</button>
</div>`;

  function init(shadow) {
    const { PRESET, DEFAULTS, lineHeightFromSlider, letterSpacingFromSlider, normalize } = AozoraStyleSettings;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('panel.css');
    shadow.appendChild(link);

    const mount = document.createElement('template');
    mount.innerHTML = PANEL_HTML.trim();
    shadow.appendChild(mount.content.firstElementChild);

    const payload = {
      enabled: true,
      settings: { ...DEFAULTS },
    };

    const els = {
      fab: shadow.getElementById('fab'),
      panel: shadow.getElementById('panel'),
      uiRoot: shadow.getElementById('ui-root'),
      enabledToggle: shadow.getElementById('enabled-toggle'),
      fontSizeSlider: shadow.getElementById('font-size-slider'),
      fontSizeValue: shadow.getElementById('font-size-value'),
      lineHeightSlider: shadow.getElementById('line-height-slider'),
      lineHeightValue: shadow.getElementById('line-height-value'),
      letterSpacingSlider: shadow.getElementById('letter-spacing-slider'),
      letterSpacingValue: shadow.getElementById('letter-spacing-value'),
    };

    function setPanelOpen(open) {
      els.panel.classList.toggle('open', open);
      els.fab.setAttribute('aria-expanded', open ? 'true' : 'false');
      els.fab.textContent = open ? '×' : 'Ao';
    }

    function syncUI() {
      const s = payload.settings;
      els.enabledToggle.checked = payload.enabled;
      els.uiRoot.dataset.enabled = payload.enabled ? 'true' : 'false';

      els.fontSizeSlider.value = String(s.fontSize);
      els.fontSizeValue.textContent = s.fontSize + 'px';
      els.lineHeightSlider.value = String(s.lineHeight);
      els.lineHeightValue.textContent = lineHeightFromSlider(s.lineHeight);
      els.letterSpacingSlider.value = String(s.letterSpacing);
      els.letterSpacingValue.textContent = letterSpacingFromSlider(s.letterSpacing);

      shadow.querySelectorAll('#writing-group .toggle-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.writing === s.writing);
      });
      shadow.querySelectorAll('#font-group .toggle-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.font === s.font);
      });
      shadow.querySelectorAll('#theme-group .toggle-btn').forEach((btn) => {
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

    els.fab.addEventListener('click', (e) => {
      e.stopPropagation();
      setPanelOpen(!els.panel.classList.contains('open'));
    });

    els.enabledToggle.addEventListener('change', () => {
      payload.enabled = els.enabledToggle.checked;
      persist();
    });

    els.fontSizeSlider.addEventListener('input', () => setSettings({ fontSize: Number(els.fontSizeSlider.value) }));
    els.lineHeightSlider.addEventListener('input', () => setSettings({ lineHeight: Number(els.lineHeightSlider.value) }));
    els.letterSpacingSlider.addEventListener('input', () => setSettings({ letterSpacing: Number(els.letterSpacingSlider.value) }));

    shadow.getElementById('writing-group').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-writing]');
      if (!btn) return;
      setSettings({ writing: btn.dataset.writing });
    });

    shadow.getElementById('font-group').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-font]');
      if (!btn) return;
      setSettings({ font: btn.dataset.font });
    });

    shadow.getElementById('theme-group').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme]');
      if (!btn) return;
      setSettings({ theme: btn.dataset.theme });
    });

    shadow.getElementById('preset-btn').addEventListener('click', () => {
      payload.settings = { ...PRESET };
      persist();
    });

    shadow.getElementById('reset-btn').addEventListener('click', () => {
      payload.settings = { ...DEFAULTS };
      persist();
    });

    document.addEventListener('click', (e) => {
      if (!els.panel.classList.contains('open')) return;
      const path = e.composedPath();
      if (path.includes(shadow.host)) return;
      setPanelOpen(false);
    });

    chrome.storage.sync.get(STORAGE_KEY, (result) => {
      const saved = result[STORAGE_KEY];
      if (saved) {
        payload.enabled = saved.enabled !== false;
        payload.settings = normalize(saved.settings || {});
      }
      syncUI();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !changes[STORAGE_KEY]) return;
      const saved = changes[STORAGE_KEY].newValue;
      if (!saved) return;
      payload.enabled = saved.enabled !== false;
      payload.settings = normalize(saved.settings || {});
      syncUI();
    });
  }

  window.AozoraStylePanel = { init };
})();
