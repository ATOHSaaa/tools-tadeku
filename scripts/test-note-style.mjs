import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  PRESET,
  DEFAULTS,
  normalize,
  getTheme,
  buildCss,
  isReadingPath,
  TCY_CLASS,
} = require('../note-style/extension/settings.js');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const normalized = normalize({ fontSize: 99, letterSpacing: -5, writing: 'weird' });
assert(normalized.fontSize === 26, 'fontSize clamp');
assert(normalized.letterSpacing === 0, 'letterSpacing clamp');
assert(normalized.writing === 'vertical', 'writing fallback');

assert(isReadingPath('/o_ob/n/n217256c8fdc3'), 'note path');
assert(isReadingPath('/n/n217256c8fdc3'), 'note short path');
assert(!isReadingPath('/o_ob'), 'note non-reading path');
assert(!isReadingPath('/'), 'home path');

const css = buildCss(PRESET);
assert(css.includes('writing-mode: vertical-rl'), 'vertical css');
assert(css.includes('.note-common-styles__textnote-body'), 'note body selector');
assert(css.includes('.o-noteContentHeader__title'), 'note title selector');
assert(css.includes('display: none !important'), 'chrome hidden');
assert(css.includes('text-align: justify'), 'vertical justify css');
assert(css.includes('padding-block: 2.25rem'), 'vertical page padding-block');
assert(css.includes('padding-inline: 3.5rem 2.5rem'), 'vertical page padding-inline');
assert(css.includes('text-combine-upright: all'), 'tcy css');
assert(css.includes(`.${TCY_CLASS}`), 'tcy class css');
assert(css.includes('text-orientation: upright'), 'upright digit css');
assert(css.includes('.note-style-upright'), 'upright class css');
assert(css.includes('.note-style-landscape'), 'landscape class css');
assert(css.includes('height: calc(100dvh - 4.5rem)'), 'landscape viewport height');
assert(css.includes('.o-articleTopNotices'), 'hide article notices');
assert(css.includes('writing-mode: horizontal-tb'), 'embed horizontal');
assert(css.includes('background: #ffffff'), 'white theme css');
assert(css.includes('color: #1a1a1a'), 'white theme text css');

const horizontalCss = buildCss({ ...PRESET, writing: 'horizontal' });
assert(!horizontalCss.includes('text-align: justify'), 'no justify on horizontal');
assert(horizontalCss.includes('padding: 5vh 8vw'), 'horizontal padding');
assert(!horizontalCss.includes('text-combine-upright'), 'no tcy on horizontal');
assert(!horizontalCss.includes('text-orientation: upright'), 'no upright on horizontal');

const darkCss = buildCss({ ...PRESET, theme: 'dark' });
assert(darkCss.includes('background: #1c1c1e'), 'dark theme bg');
assert(darkCss.includes('color: #e8e6e1'), 'dark theme text');
assert(darkCss.includes('color: #9a9a9a'), 'dark theme muted');

assert(normalize({ theme: 'unknown' }).theme === 'white', 'theme fallback');
assert(getTheme('dark').bg === '#1c1c1e', 'getTheme');
assert(normalize(DEFAULTS).fontSize === DEFAULTS.fontSize, 'defaults stable');

console.log('test-note-style: ok');
