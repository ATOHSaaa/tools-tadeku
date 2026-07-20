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

  const TCY_CLASS = 'note-style-tcy';
  const UPRIGHT_CLASS = 'note-style-upright';
  const LANDSCAPE_CLASS = 'note-style-landscape';

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

  function isReadingPath(pathname) {
    return /\/n\/[0-9A-Za-z]+/.test(pathname || '');
  }

  function buildCss(state) {
    const s = normalize(state);
    const theme = getTheme(s.theme);
    const writingMode = s.writing === 'vertical' ? 'vertical-rl' : 'horizontal-tb';
    const fontFamily = s.font === 'sans' ? FONT_SANS : FONT_SERIF;
    const lineHeight = lineHeightFromSlider(s.lineHeight);
    const letterSpacing = letterSpacingFromSlider(s.letterSpacing);
    const pagePadding = s.writing === 'vertical'
      ? 'padding-block: 2.25rem !important;\n  padding-inline: 3.5rem 2.5rem !important;'
      : 'padding: 5vh 8vw !important;';

    const verticalExtras = s.writing === 'vertical'
      ? `html {
  overflow-x: auto !important;
}

body,
.note-common-styles__textnote-body,
.o-noteContentText {
  text-align: justify !important;
  text-justify: inter-character !important;
  line-break: strict !important;
  hanging-punctuation: allow-end !important;
}

.o-noteContentHeader__title,
.o-noteContentHeader__name,
.note-common-styles__textnote-body h1,
.note-common-styles__textnote-body h2,
.note-common-styles__textnote-body h3,
.note-common-styles__textnote-body h4,
.note-common-styles__textnote-body h5,
.note-common-styles__textnote-body h6 {
  text-align: start !important;
}

.${TCY_CLASS} {
  text-combine-upright: all !important;
  -webkit-text-combine: horizontal !important;
  letter-spacing: 0 !important;
  white-space: nowrap !important;
}

.${UPRIGHT_CLASS} {
  text-orientation: upright !important;
  letter-spacing: 0 !important;
}

.note-common-styles__textnote-body figure,
.note-common-styles__textnote-body table,
.note-common-styles__textnote-body pre,
.note-common-styles__textnote-body .twitter-tweet,
.note-common-styles__textnote-body iframe,
.note-common-styles__textnote-body [data-type="embed"],
.note-common-styles__textnote-body [class*="embed"] {
  writing-mode: horizontal-tb !important;
  text-orientation: mixed !important;
  max-inline-size: min(36em, 72vh) !important;
  max-block-size: none !important;
  margin-block: 2em !important;
  margin-inline: 0 !important;
}

.${LANDSCAPE_CLASS} {
  writing-mode: horizontal-tb !important;
  text-orientation: mixed !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  box-sizing: border-box !important;
  width: min(36em, 72vh) !important;
  max-width: min(36em, 72vh) !important;
  height: calc(100dvh - 4.5rem) !important;
  max-height: calc(100dvh - 4.5rem) !important;
  margin-block: 2em !important;
  margin-inline: 0 !important;
  padding: 0 !important;
}

.${LANDSCAPE_CLASS} img,
.${LANDSCAPE_CLASS} video {
  display: block !important;
  max-width: 100% !important;
  max-height: calc(100dvh - 6rem) !important;
  width: auto !important;
  height: auto !important;
  object-fit: contain !important;
}

.${LANDSCAPE_CLASS} .external-article-widget,
.${LANDSCAPE_CLASS} iframe.note-embed,
.${LANDSCAPE_CLASS} [data-name="embedContainer"] {
  width: 100% !important;
  max-width: 100% !important;
  margin: 0 !important;
}

.${LANDSCAPE_CLASS} .external-article-widget {
  writing-mode: horizontal-tb !important;
  text-orientation: mixed !important;
}

img.${LANDSCAPE_CLASS},
video.${LANDSCAPE_CLASS} {
  writing-mode: horizontal-tb !important;
  display: block !important;
  box-sizing: border-box !important;
  width: auto !important;
  max-width: min(36em, 72vh) !important;
  height: auto !important;
  max-height: calc(100dvh - 6rem) !important;
  margin-block: 2em !important;
  margin-inline: auto !important;
  object-fit: contain !important;
}

`
      : '';

    return `${verticalExtras}header,
.o-navbarMessage,
.o-cautionBar,
.o-articleTopNotices,
.o-footer,
[class*="o-navbar"],
.p-article__sideCreatorInfo,
.p-article__action,
.p-article__hashtags,
.p-article__creator,
.p-article__extraItemContainer,
.p-article__breadcrumb,
.p-article__supportAppeal,
.o-supportAppealBox,
.o-noteLikeV3,
.o-actionControl,
.o-viewComment,
.o-creatorProfile,
.m-noteBreadcrumb,
.o-noteEyecatch,
.o-noteContentHeader__titleAttachment,
.o-noteContentHeader__avatar,
.o-noteContentHeader__status,
.o-noteContentHeader__date,
.o-noteContentHeader__followButton,
.m-before-purchasing-button,
.m-follow {
  display: none !important;
}

:root {
  --color-background-primary: ${theme.bg} !important;
  --color-text-primary: ${theme.color} !important;
  --color-text-secondary: ${theme.muted} !important;
  --color-surface-normal: ${theme.bg} !important;
}

html,
body {
  background: ${theme.bg} !important;
}

body {
  margin: 0 !important;
  min-height: 100vh;
  min-height: 100dvh;
  box-sizing: border-box;
  ${pagePadding}
  background: ${theme.bg} !important;
  color: ${theme.color} !important;
  font-family: ${fontFamily} !important;
  writing-mode: ${writingMode} !important;
  text-orientation: mixed !important;
  font-size: ${s.fontSize}px !important;
  line-height: ${lineHeight} !important;
  letter-spacing: ${letterSpacing} !important;
}

main.p-article,
.p-article__articleWrapper,
.p-article__body,
.p-article__content,
.o-noteContentText,
.o-noteContentText__header,
.o-noteContentHeader,
.note-common-styles__textnote-body {
  width: auto !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  color: inherit !important;
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  letter-spacing: inherit !important;
}

.o-noteContentHeader {
  margin-block: 0 2.75em !important;
  margin-inline: 0 !important;
}

.o-noteContentHeader__title {
  font-size: calc(${s.fontSize}px * ${FIXED.titleScale}) !important;
  font-weight: 700 !important;
  letter-spacing: 0.12em !important;
  line-height: 1.35 !important;
  color: ${theme.color} !important;
  font-family: inherit !important;
  margin: 0 !important;
}

.o-noteContentHeader__name,
.o-noteContentHeader__name a {
  font-size: calc(${s.fontSize}px * 1.05) !important;
  color: ${theme.muted} !important;
  letter-spacing: 0.08em !important;
  line-height: 1.4 !important;
  font-family: inherit !important;
}

.o-noteContentHeader__creatorInfo,
.o-noteContentHeader__info {
  margin-block: 0.85em 0 !important;
  margin-inline: 0 !important;
  padding: 0 !important;
}

.o-noteContentHeader__titleContainer {
  margin: 0 !important;
}

.note-common-styles__textnote-body {
  overflow: visible !important;
  color: ${theme.color} !important;
  font-family: inherit !important;
  line-height: ${lineHeight} !important;
}

.note-common-styles__textnote-body p,
.note-common-styles__textnote-body li {
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  letter-spacing: inherit !important;
  color: inherit !important;
}

.note-common-styles__textnote-body h2,
.note-common-styles__textnote-body h3,
.note-common-styles__textnote-body h4 {
  margin-block: 2.25em 1.25em !important;
  margin-inline: 0 !important;
  letter-spacing: 0.08em !important;
  line-height: 1.4 !important;
}

.note-common-styles__textnote-body p,
.note-common-styles__textnote-body ul,
.note-common-styles__textnote-body ol,
.note-common-styles__textnote-body blockquote {
  margin-block: 1.1em !important;
  margin-inline: 0 !important;
}

.note-common-styles__textnote-body li {
  margin-block: 0.45em !important;
  margin-inline: 0 !important;
}

.note-common-styles__textnote-body img,
.note-common-styles__textnote-body video {
  max-inline-size: min(36em, 72vh) !important;
  max-block-size: none !important;
  height: auto !important;
  width: auto !important;
}

.note-common-styles__textnote-body .${LANDSCAPE_CLASS} img,
.note-common-styles__textnote-body .${LANDSCAPE_CLASS} video {
  max-inline-size: none !important;
}`;
  }

  const api = {
    PRESET,
    DEFAULTS,
    COLOR_THEMES,
    FIXED,
    FONT_SANS,
    FONT_SERIF,
    TCY_CLASS,
    UPRIGHT_CLASS,
    LANDSCAPE_CLASS,
    lineHeightFromSlider,
    letterSpacingFromSlider,
    normalize,
    getTheme,
    isReadingPath,
    buildCss,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.NoteStyleSettings = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);
