import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const ctx = { window: {} };
ctx.window = ctx;
vm.runInNewContext(readFileSync(join(root, 'shared/dazai-work-quiz-data.js'), 'utf8'), ctx);
vm.runInNewContext(readFileSync(join(root, 'shared/dazai-work-quiz-engine.js'), 'utf8'), ctx);

const { QUESTIONS, WORKS } = ctx.window.DazaiWorkQuizData;
const { rankWorks } = ctx.window.DazaiWorkQuizEngine;

function runProfile(label, pick) {
  const answers = QUESTIONS.map((q, i) => q.choices[pick(i)]);
  const { ranked, top } = rankWorks(answers);
  console.log(`\n${label}`);
  console.log(`  1位: ${top.name} (${top.matchPct}%)`);
  console.log(`  2-3位: ${ranked[1].name} ${ranked[1].matchPct}% / ${ranked[2].name} ${ranked[2].matchPct}%`);
  return top.name;
}

const profiles = [
  ['A. 全問1番目', () => 0],
  ['B. 全問2番目', () => 1],
  ['C. 全問3番目', () => 2],
  ['D. 全問4番目', () => 3],
  ['E. 人間失格狙い（q1,q4,q6,q7=0）', (i) => ([0, 3, 5, 6].includes(i) ? 0 : 2)],
  ['F. 走れメロス狙い（q1,q4,q6=1）', (i) => ([0, 3, 5].includes(i) ? 1 : 0)],
  ['G. 津軽狙い（q1,q2,q8=2）', (i) => ([0, 1, 7].includes(i) ? 2 : 0)],
  ['H. 斜陽狙い（q1,q3,q7=3）', (i) => ([0, 2, 6].includes(i) ? 3 : 1)],
];

const winners = [];
for (const [label, pick] of profiles) {
  winners.push(runProfile(label, pick));
}

console.log('\n=== サマリー ===');
const counts = {};
for (const w of winners) counts[w] = (counts[w] || 0) + 1;
console.log('1位の内訳:', Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(', '));

const canWin = {};
for (const w of WORKS) canWin[w.name] = false;
for (let mask = 0; mask < 65536; mask++) {
  const picks = [];
  for (let i = 0; i < 8; i++) picks.push((mask >> (i * 2)) & 3);
  const answers = QUESTIONS.map((q, i) => q.choices[picks[i]]);
  canWin[rankWorks(answers).top.name] = true;
}
console.log('\n=== 全4096通りで1位になりうる作品 ===');
for (const w of WORKS) {
  console.log(`${canWin[w.name] ? '○' : '×'} ${w.name}`);
}
