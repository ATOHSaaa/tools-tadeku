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

`
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
    buildCss,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.AozoraStyleSettings = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
