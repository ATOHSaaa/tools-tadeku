import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const ctx = { window: {} };
ctx.window = ctx;
vm.runInNewContext(readFileSync(join(root, 'shared/bungaku-ha-quiz-data.js'), 'utf8'), ctx);
vm.runInNewContext(readFileSync(join(root, 'shared/bungaku-ha-quiz-engine.js'), 'utf8'), ctx);

const { QUESTIONS, MOVEMENTS } = ctx.window.BungakuHaQuizData;
const { rankMovements } = ctx.window.BungakuHaQuizEngine;

function runProfile(label, pick) {
  const answers = QUESTIONS.map((q, i) => q.choices[pick(i)]);
  const { ranked, top } = rankMovements(answers);
  console.log(`\n${label}`);
  console.log(`  1位: ${top.name} (${top.matchPct}%)`);
  console.log(`  2-3位: ${ranked[1].name} ${ranked[1].matchPct}% / ${ranked[2].name} ${ranked[2].matchPct}%`);
  console.log(`  4-6位: ${ranked.slice(3, 6).map((r) => `${r.name} ${r.matchPct}%`).join(' / ')}`);
  return top.name;
}

const profiles = [
  ['A. 全問1番目', () => 0],
  ['B. 全問2番目', () => 1],
  ['C. 全問3番目', () => 2],
  ['D. 全問4番目', () => 3],
  ['E. 自然主義狙い（q1,q5,q6=0）', (i) => ([0, 4, 5].includes(i) ? 0 : 2)],
  ['F. 新感覚派狙い（q1,q7=1）', (i) => ([0, 6].includes(i) ? 1 : 0)],
  ['G. 白樺派狙い', (i) => ([0, 3, 5].includes(i) ? 3 : 2)],
  ['H. 写実主義狙い', (i) => ([0, 2, 6, 7].includes(i) ? ([0, 2, 6, 7].indexOf(i) === 0 ? 2 : [0, 2, 6, 7].indexOf(i) === 1 ? 0 : [0, 2, 6, 7].indexOf(i) === 2 ? 0 : 2) : 0)],
  ['I. 幻想文学狙い', (i) => ([1, 4, 5, 7].includes(i) ? 1 : 0)],
  ['J. バランス型（01230123）', (i) => i % 4],
];

const winners = [];
for (const [label, pick] of profiles) {
  winners.push(runProfile(label, pick));
}

console.log('\n=== サマリー ===');
const counts = {};
for (const w of winners) counts[w] = (counts[w] || 0) + 1;
console.log('1位の内訳:', Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(', '));
console.log('ユニーク流派数:', Object.keys(counts).length, '/ 10');

const randCounts = {};
for (let n = 0; n < 10000; n++) {
  const answers = QUESTIONS.map((q) => q.choices[Math.floor(Math.random() * 4)]);
  randCounts[rankMovements(answers).top.name] = (randCounts[rankMovements(answers).top.name] || 0) + 1;
}
console.log('\n=== ランダム10000回 ===');
const vals = Object.values(randCounts);
const mean = 1000;
const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
console.log(`標準偏差: ${std.toFixed(0)} (理想1000±${std.toFixed(0)})`);
console.log(Object.entries(randCounts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${(v / 100).toFixed(1)}%`).join('\n'));
console.log('出現流派数:', Object.keys(randCounts).length, '/ 10');

const canWin = {};
for (const m of MOVEMENTS) canWin[m.name] = false;
for (let mask = 0; mask < 65536; mask++) {
  const picks = [];
  for (let i = 0; i < 8; i++) picks.push((mask >> (i * 2)) & 3);
  const answers = QUESTIONS.map((q, i) => q.choices[picks[i]]);
  canWin[rankMovements(answers).top.name] = true;
}
console.log('\n=== 全4096通りで1位になりうる流派 ===');
for (const m of MOVEMENTS) {
  console.log(`${canWin[m.name] ? '○' : '×'} ${m.name}`);
}
