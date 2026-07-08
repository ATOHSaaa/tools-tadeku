import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '..');
const ctx = { window: {} };
ctx.window = ctx;
vm.runInNewContext(readFileSync(join(root, 'shared/kindai-author-quiz-data.js'), 'utf8'), ctx);
vm.runInNewContext(readFileSync(join(root, 'shared/kindai-author-quiz-engine.js'), 'utf8'), ctx);

const { QUESTIONS, ROUND_SIZE, QUESTION_COUNT } = ctx.window.KindaiAuthorQuizData;
const { startRound, scoreRound, resolveGrade } = ctx.window.KindaiAuthorQuizEngine;

const issues = [];

if (QUESTIONS.length !== 100) issues.push(`問題数: ${QUESTIONS.length}（100必要）`);
if (ROUND_SIZE !== 10) issues.push(`ROUND_SIZE: ${ROUND_SIZE}（10必要）`);

const texts = new Set();
QUESTIONS.forEach((q) => {
  if (new Set(q.choices).size !== 4) issues.push(`${q.id}: 選択肢重複`);
  if (q.correct < 0 || q.correct > 3) issues.push(`${q.id}: correct index`);
  if (!q.text.startsWith('『')) issues.push(`${q.id}: 問題文フォーマット`);
  if (texts.has(q.text)) issues.push(`${q.id}: 問題文重複`);
  texts.add(q.text);
});

const round = startRound();
if (round.length !== 10) issues.push(`startRound: ${round.length}問（10必要）`);

const answers = round.map((q) => q.correct);
const result = scoreRound(round, answers);
if (result.correct !== 10) issues.push(`scoreRound: ${result.correct}/10`);

const grade = resolveGrade(100);
if (!grade.name) issues.push('resolveGrade failed');

if (issues.length) {
  console.error('FAILED');
  issues.forEach((msg) => console.error(' -', msg));
  process.exit(1);
}

console.log('OK');
console.log(`  問題数: ${QUESTION_COUNT}`);
console.log(`  1ラウンド: ${ROUND_SIZE}問`);
console.log(`  サンプル: ${round[0].text}`);
