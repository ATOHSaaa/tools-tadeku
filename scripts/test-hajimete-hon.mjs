import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const ctx = { window: {} };
ctx.window = ctx;
vm.runInNewContext(readFileSync(join(root, 'shared/hajimete-hon-data.js'), 'utf8'), ctx);
vm.runInNewContext(readFileSync(join(root, 'shared/hajimete-hon-engine.js'), 'utf8'), ctx);

const { QUESTIONS, BOOKS, meta } = ctx.window.HajimeteHonData;
const { rankBooks } = ctx.window.HajimeteHonEngine;

if (QUESTIONS.length !== 10) {
  console.error('QUESTIONS must be 10, got', QUESTIONS.length);
  process.exit(1);
}

if (BOOKS.length < 200) {
  console.error('BOOKS should have at least 200 entries, got', BOOKS.length);
  process.exit(1);
}

const winners = BOOKS.filter((b) => b.hontai?.won).length;
if (winners < 20) {
  console.error('Expected at least 20 winners, got', winners);
  process.exit(1);
}

function runProfile(label, pick) {
  const answers = QUESTIONS.map((q, i) => q.choices[pick(i)]);
  const { top } = rankBooks(answers);
  console.log(`${label}: ${top.name} (${top.matchPct}%)`);
  return top.id;
}

const unique = new Set();
unique.add(runProfile('コメディ好き', (i) => ([0, 1].includes(i) ? 0 : i === 6 ? 3 : 2)));
unique.add(runProfile('サスペンス好き', (i) => ([1, 4, 9].includes(i) ? 2 : i === 2 ? 2 : 1)));
unique.add(runProfile('短時間派', (i) => ([2, 3, 9].includes(i) ? (i === 9 ? 3 : 0) : 1)));
unique.add(runProfile('深く読みたい', (i) => ([5, 6, 8].includes(i) ? 1 : 2)));
unique.add(runProfile('日常ドラマ', (i) => ([1, 4, 7].includes(i) ? 1 : 0)));

let epicurusWins = 0;
for (let t = 0; t < 2000; t += 1) {
  const answers = QUESTIONS.map((q) => q.choices[Math.floor(Math.random() * q.choices.length)]);
  const { top } = rankBooks(answers);
  if (top.name === 'エピクロスの処方箋') epicurusWins += 1;
}

console.log(`\nBooks: ${BOOKS.length}, winners: ${winners}, catalog: ${meta?.catalog || 'n/a'}`);
console.log(`Unique top picks: ${unique.size}`);
console.log(`Epicurus random-win rate: ${(epicurusWins / 20).toFixed(1)}%`);

if (unique.size < 4) {
  console.error('Too few unique winners — check dimension balance');
  process.exit(1);
}

if (epicurusWins > 400) {
  console.error('エピクロスの処方箋が出すぎます — check dimension balance');
  process.exit(1);
}

console.log('OK');
