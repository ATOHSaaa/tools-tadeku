/* global globalThis */
(function (root) {
  const COLOR_THEMES = {
    white: { label: '白', bg: '#ffffff', color: '#1a1a1a', muted: '#444444' },
    cream: { label: 'クリーム', bg: '#f5f0e6', color: '#2c2416', muted: '#5c4f3a' },
    washi: { label: '生成り', bg: '#faf6ed', color: '#1f1c18', muted: '#5a5248' },
    sepia: { label: 'セピア', bg: '#ebe4d5', color: '#3d3225', muted: '#6b5d4a' },
    dark: { label: 'ダーク', bg: '#1c1c1e', color: '#e8e6e1', muted: '#9a9a9a' },
    night: { label: '夜読み', bg: '#2a2836', color: '#d8d4cc', muted: '#8a8698' },
  };

  const PRESET = {
    writing: 'vertical',
    font: 'sans',
    fontSize: 18,
    lineHeight: 20,
    letterSpacing: 5,
    theme: 'white',
  };

  const DEFAULTS = { ...PRESET };

  const FONT_SANS = '"Hiragino Sans", "Noto Sans JP", "Yu Gothic UI", sans-serif';
  const FONT_SERIF = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

  const FIXED = {
    titleScale: 1.8,
  };

  function lineHeightFromSlider(v) {
    return (v / 10).toFixed(1);
  }

  function letterSpacingFromSlider(v) {
    return (v / 100).toFixed(2) + 'em';
  }

  function normalize(input) {
    const state = { ...DEFAULTS, ...input };
    state.fontSize = clamp(Number(state.fontSize) || DEFAULTS.fontSize, 14, 26);
    state.lineHeight = clamp(Number(state.lineHeight) || DEFAULTS.lineHeight, 14, 30);
    state.letterSpacing = clamp(Number(state.letterSpacing) || DEFAULTS.letterSpacing, 0, 20);
    if (state.writing !== 'horizontal') state.writing = 'vertical';
    if (state.font !== 'serif') state.font = 'sans';
    if (!COLOR_THEMES[state.theme]) state.theme = 'white';
    return state;
  }

  function getTheme(themeId) {
    return COLOR_THEMES[themeId] || COLOR_THEMES.white;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  // 縦組みでは横組み用の " " をダブルミニュート 〝 〟 に置き換える。
  const VERTICAL_QUOTE_OPEN = '\u301D';
  const VERTICAL_QUOTE_CLOSE = '\u301E';
  const DOUBLE_QUOTE_OPEN = new Set(['\u201C', '\u201E']);
  const DOUBLE_QUOTE_CLOSE = new Set(['\u201D', '\u201F']);

  function toVerticalDoubleQuotes(text) {
    if (!text || !/["\u201C\u201D\u201E\u201F]/.test(text)) return text;

    let useOpen = true;
    let out = '';
    for (const ch of text) {
      if (ch === VERTICAL_QUOTE_OPEN) {
        out += ch;
        useOpen = false;
      } else if (ch === VERTICAL_QUOTE_CLOSE) {
        out += ch;
        useOpen = true;
      } else if (DOUBLE_QUOTE_OPEN.has(ch)) {
        out += VERTICAL_QUOTE_OPEN;
        useOpen = false;
      } else if (DOUBLE_QUOTE_CLOSE.has(ch)) {
        out += VERTICAL_QUOTE_CLOSE;
        useOpen = true;
      } else if (ch === '"') {
        out += useOpen ? VERTICAL_QUOTE_OPEN : VERTICAL_QUOTE_CLOSE;
        useOpen = !useOpen;
      } else {
        out += ch;
      }
    }
    return out;
  }

  // 青空文庫注記一覧「強調」のクラス名に対応。
  // https://www.aozora.gr.jp/annotation/emphasis.html
  // aozora.css は横書き用 PNG (background + repeat-x) で傍点・傍線を描くため、
  // writing-mode: vertical-rl では文字の脇ではなく箱の上辺に崩れる。
  // 縦書き時は text-emphasis / text-decoration に差し替える。
  const BOTEN_STYLES = [
    ['sesame_dot', 'filled sesame'],                 // 傍点（黒ゴマ）
    ['white_sesame_dot', 'open sesame'],              // 白ゴマ傍点
    ['black_circle', 'filled circle'],               // 丸傍点
    ['white_circle', 'open circle'],                 // 白丸傍点
    ['black_up-pointing_triangle', 'filled triangle'], // 黒三角傍点
    ['white_up-pointing_triangle', 'open triangle'], // 白三角傍点
    ['bullseye', 'filled double-circle'],            // 二重丸傍点
    ['fisheye', '"◉"'],                              // 蛇の目傍点
    ['saltire', '"×"'],                              // ばつ傍点
  ];

  const BOSEN_STYLES = [
    ['solid', 'solid'],   // 傍線
    ['double', 'double'], // 二重傍線
    ['dotted', 'dotted'], // 鎖線
    ['dashed', 'dashed'], // 破線
    ['wave', 'wavy'],     // 波線
  ];

  function emphasisCss() {
    const reset = 'font-style: normal !important; padding: 0 !important; background: none !important;';
    const rules = [];

    for (const [cls, style] of BOTEN_STYLES) {
      const emphasis = [
        `text-emphasis: ${style} !important`,
        `-webkit-text-emphasis: ${style} !important`,
      ].join('; ');
      // 右傍点（縦組みでは文字の右 = over）
      rules.push(`.${cls} { ${reset} ${emphasis}; text-emphasis-position: over !important; -webkit-text-emphasis-position: over right !important; }`);
      // 左傍点（*_after / 縦組みでは文字の左 = under）
      rules.push(`.${cls}_after { ${reset} ${emphasis}; text-emphasis-position: under !important; -webkit-text-emphasis-position: under left !important; }`);
    }

    for (const [cls, style] of BOSEN_STYLES) {
      const deco = [
        'text-decoration-line: underline !important',
        `text-decoration-style: ${style} !important`,
        'text-decoration-thickness: from-font !important',
      ].join('; ');
      const underlineCls = `underline_${cls}`;
      const overlineCls = `overline_${cls}`;
      const rbBorder = style === 'double'
        ? 'border-right: 3px double currentColor !important'
        : `border-right: 1px ${style} currentColor !important`;

      // underline_* = 右傍線、overline_* = 左傍線
      rules.push(`.${underlineCls} { ${reset} ${deco}; text-underline-position: under right !important; }`);
      rules.push(`.${overlineCls} { ${reset} ${deco}; text-underline-position: under left !important; }`);

      // 縦組みではルビ（rt）も右側に来るため、em 全体への傍線は rt と重なる。
      // ルビ付きは傍線を rb の右辺に移し、読み（rt）の列とは分ける。
      rules.push(`.${underlineCls}:has(ruby) { text-decoration-line: none !important; }`);
      rules.push(`.${underlineCls}:has(ruby) ruby rb { ${reset} ${rbBorder}; }`);
      rules.push(`.${underlineCls} ruby rt, .${underlineCls} ruby rp { text-decoration: none !important; }`);
    }

    return `${rules.join('\n')}\n\n`;
  }

  function buildCss(state) {
    const s = normalize(state);
    const theme = getTheme(s.theme);
    const writingMode = s.writing === 'vertical' ? 'vertical-rl' : 'horizontal-tb';
    const fontFamily = s.font === 'sans' ? FONT_SANS : FONT_SERIF;
    const lineHeight = lineHeightFromSlider(s.lineHeight);
    const letterSpacing = letterSpacingFromSlider(s.letterSpacing);
    const verticalExtras = s.writing === 'vertical'
      ? `html {
  overflow-x: auto !important;
}

body,
.main_text,
div.main_text {
  text-align: justify !important;
  text-justify: inter-character !important;
  line-break: strict !important;
  hanging-punctuation: allow-end !important;
}

h1.title,
h2.author,
h3,
h4,
h5,
h6 {
  text-align: start !important;
}

div[class*="jisage"] {
  margin-left: 0 !important;
  text-indent: 0 !important;
}

.jisage_1 { margin-block-start: 1em !important; }
.jisage_2 { margin-block-start: 2em !important; }
.jisage_3 { margin-block-start: 3em !important; }
.jisage_4 { margin-block-start: 4em !important; }
.jisage_5 { margin-block-start: 5em !important; }

${emphasisCss()}`
      : '';

    return `${verticalExtras}body {
  margin: 0 !important;
  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
  padding: 8vh 8vw !important;
  background: ${theme.bg} !important;
  color: ${theme.color} !important;
  font-family: ${fontFamily} !important;
  writing-mode: ${writingMode} !important;
  text-orientation: mixed !important;
  font-size: ${s.fontSize}px !important;
  line-height: ${lineHeight} !important;
  letter-spacing: ${letterSpacing} !important;
}

h1.title {
  font-size: calc(${s.fontSize}px * ${FIXED.titleScale}) !important;
  font-weight: 700 !important;
  letter-spacing: 0.12em !important;
  line-height: 1.4 !important;
}

h2.author {
  font-size: calc(${s.fontSize}px * 1.1) !important;
  color: ${theme.muted} !important;
  letter-spacing: 0.08em !important;
  line-height: 1.4 !important;
}

.main_text,
div.main_text {
  line-height: ${lineHeight} !important;
}

img.gaiji {
  width: 1em !important;
  height: 1em !important;
  vertical-align: text-top !important;
}`;
  }

  const api = {
    PRESET,
    DEFAULTS,
    COLOR_THEMES,
    FIXED,
    FONT_SANS,
    FONT_SERIF,
    lineHeightFromSlider,
    letterSpacingFromSlider,
    normalize,
    getTheme,
    toVerticalDoubleQuotes,
    buildCss,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.AozoraStyleSettings = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
