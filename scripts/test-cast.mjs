import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const dir = dirname(fileURLToPath(import.meta.url));
const enginePath = join(dir, '../shared/cast-engine.js');
const code = readFileSync(enginePath, 'utf8');
const context = { window: {}, globalThis: {} };
context.window = context;
vm.runInNewContext(code, context);
const { analyzeCast } = context.window.TadekuCastEngine;

const sample = `
　神宮寺さんは窓辺に立っていた。神宮寺が言った。
「今日は暑いね」
　太郎くんは頷いた。たろうは笑った。
　ミカエルは黙っていた。ミカエルが神宮寺の肩を叩く。
`;

const userSample = `
　斎藤さんは言った。斎藤さんの声は低かった。
　ケンくんは頷いた。ケンくんがこちらを見た。
　というのは、そういうことではない。というのは言えない。
　他人の目を気にして、そういうことにしておいた。
`;

const noisySample = `
　彼女は窓の外を見ていた。時間が過ぎていく。
　自分の心の声が聞こえる。世界は静かだった。
　学校の教室で、問題を考えていた。女性は立ち上がった。
`;

function assertNames(result, expected, label) {
  const names = result.groups.map((g) => g.primary).sort();
  const missing = expected.filter((n) => !names.includes(n));
  const unexpected = names.filter((n) => !expected.includes(n));
  if (missing.length || unexpected.length) {
    console.error(`${label} failed`);
    console.error('  expected:', expected.join(', '));
    console.error('  got:', names.join(', ') || '(none)');
    process.exit(1);
  }
}

const result = analyzeCast(sample, { minCount: 2 });
const user = analyzeCast(userSample, { minCount: 2 });
const noisy = analyzeCast(noisySample, { minCount: 2 });

assertNames(result, ['ミカエル', '太郎くん', '神宮寺さん'], 'sample');
assertNames(user, ['ケンくん', '斎藤さん'], 'userSample');

const taro = result.groups.find((g) => g.primary === '太郎くん');
if (!taro || !taro.variants) {
  console.error('expected 太郎くん variant info');
  process.exit(1);
}

if (noisy.groups.length > 0) {
  console.error('common nouns should not be detected:', noisy.groups.map((g) => g.primary).join(', '));
  process.exit(1);
}

console.log('ok');
