import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  PRESET,
  DEFAULTS,
  normalize,
  getTheme,
  buildCss,
  toVerticalDoubleQuotes,
} = require('../aozora-style/extension/settings.js');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const normalized = normalize({ fontSize: 99, letterSpacing: -5, writing: 'weird' });
assert(normalized.fontSize === 26, 'fontSize clamp');
assert(normalized.letterSpacing === 0, 'letterSpacing clamp');
assert(normalized.writing === 'vertical', 'writing fallback');

const css = buildCss(PRESET);
assert(css.includes('writing-mode: vertical-rl'), 'vertical css');
assert(css.includes('text-align: justify'), 'vertical justify css');
assert(css.includes('.sesame_dot {'), 'boten override css');
assert(css.includes('text-emphasis: filled sesame'), 'boten text-emphasis');
assert(css.includes('text-emphasis: filled triangle'), 'black triangle boten');
assert(css.includes('.sesame_dot_after {'), 'boten left-side override');
assert(css.includes('text-emphasis-position: under'), 'boten under position');
assert(css.includes('.underline_solid {'), 'bosen override css');
assert(css.includes('.overline_wave {'), 'left bosen override');
assert(css.includes('text-underline-position: under right'), 'bosen right side');
assert(css.includes('text-decoration-style: wavy'), 'wave bosen');
assert(css.includes('.underline_solid:has(ruby)'), 'ruby-aware bosen reset');
assert(css.includes('.underline_solid:has(ruby) ruby rb'), 'ruby-aware bosen on rb');
assert(css.includes('border-right: 1px solid currentColor'), 'ruby bosen border');
const horizontalCss = buildCss({ ...PRESET, writing: 'horizontal' });
assert(!horizontalCss.includes('text-align: justify'), 'no justify on horizontal');
assert(!horizontalCss.includes('.sesame_dot {'), 'no boten override on horizontal');
assert(!horizontalCss.includes('.underline_solid {'), 'no bosen override on horizontal');
assert(css.includes('padding: 8vh 8vw'), 'page padding css');
assert(css.includes('background: #ffffff'), 'white theme css');
assert(css.includes('color: #1a1a1a'), 'white theme text css');

const darkCss = buildCss({ ...PRESET, theme: 'dark' });
assert(darkCss.includes('background: #1c1c1e'), 'dark theme bg');
assert(darkCss.includes('color: #e8e6e1'), 'dark theme text');
assert(darkCss.includes('color: #9a9a9a'), 'dark theme muted');

assert(normalize({ theme: 'unknown' }).theme === 'white', 'theme fallback');
assert(getTheme('dark').bg === '#1c1c1e', 'getTheme');
assert(!css.includes('html {\n  background'), 'no html background css');
assert(!css.includes('#aozora-style-root'), 'no card wrapper css');

assert(normalize(DEFAULTS).fontSize === DEFAULTS.fontSize, 'defaults stable');

assert(
  toVerticalDoubleQuotes('"hello"') === '\u301Dhello\u301E',
  'straight double quotes to vertical',
);
assert(
  toVerticalDoubleQuotes('\u201Chello\u201D') === '\u301Dhello\u301E',
  'curly double quotes to vertical',
);
assert(
  toVerticalDoubleQuotes('\u301Dalready\u301E') === '\u301Dalready\u301E',
  'preserve existing vertical quotes',
);
assert(
  toVerticalDoubleQuotes('no quotes') === 'no quotes',
  'unchanged without quotes',
);

console.log('test-aozora-style: ok');
