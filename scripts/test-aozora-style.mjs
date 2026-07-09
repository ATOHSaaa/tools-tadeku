import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  PRESET,
  DEFAULTS,
  normalize,
  getTheme,
  buildCss,
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
assert(!buildCss({ ...PRESET, writing: 'horizontal' }).includes('text-align: justify'), 'no justify on horizontal');
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
assert(!css.includes('ruby rt'), 'no ruby override');

assert(normalize(DEFAULTS).fontSize === DEFAULTS.fontSize, 'defaults stable');

console.log('test-aozora-style: ok');
