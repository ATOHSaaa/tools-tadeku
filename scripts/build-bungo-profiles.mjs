#!/usr/bin/env node
/**
 * 青空文庫テキストから文豪プロファイルを生成する。
 * 実行: node scripts/build-bungo-profiles.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { execSync, spawnSync } from 'child_process';
import {
  cleanAozoraText,
  extractScores,
  scoresToArray,
  extractTrigrams,
  computeStats,
  EXCERPT_CHARS,
} from '../shared/bungo-core.mjs';
import kuromoji from 'kuromoji';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIC_PATH = join(ROOT, 'node_modules', 'kuromoji', 'dict');
const CATALOG_ZIP = join(ROOT, 'scripts', '.cache', 'aozora_catalog.zip');
const CATALOG_CSV = join(ROOT, 'scripts', '.cache', 'list_person_all_extended_utf8.csv');

const AUTHORS = [
  { id: 'natsume', name: '夏目漱石', era: '1867–1916', family: '夏目', given: '漱石', titles: ['こころ', '坊っちゃん', '三四郎'] },
  { id: 'akutagawa', name: '芥川龍之介', era: '1892–1927', family: '芥川', given: '竜之介', altGiven: ['龍之介'], titles: ['羅生門', '鼻', '地獄変'] },
  { id: 'dazai', name: '太宰治', era: '1909–1948', family: '太宰', given: '治', titles: ['人間失格', '走れメロス', '斜陽'] },
  { id: 'tanizaki', name: '谷崎潤一郎', era: '1886–1965', family: '谷崎', given: '潤一郎', titles: ['春琴抄', '卍', '痴人の愛'] },
  { id: 'mori', name: '森鴎外', era: '1862–1922', family: '森', given: '鴎外', altGiven: ['鷗外'], titles: ['舞姫', 'うたかたの記', '高瀬舟'] },
  { id: 'higuchi', name: '樋口一葉', era: '1872–1896', family: '樋口', given: '一葉', titles: ['たけくらべ', 'にごりえ', '十三夜'] },
  { id: 'kyoka', name: '泉鏡花', era: '1873–1939', family: '泉', given: '鏡花', titles: ['草迷宮', '悪獣篇', '愛と婚姻'] },
  { id: 'miyazawa', name: '宮沢賢治', era: '1896–1933', family: '宮沢', given: '賢治', altFamily: ['宮泽'], titles: ['銀河鉄道の夜', '注文の多い料理店', '風の又三郎'] },
  { id: 'rampo', name: '江戸川乱歩', era: '1894–1965', family: '江戸川', given: '乱歩', titles: ['怪人二十面相', '人間椅子', '二銭銅貨'] },
  { id: 'kunikida', name: '国木田独歩', era: '1872–1908', family: '国木田', given: '独歩', titles: ['武蔵野', '春の鳥', 'あの時分'] },
  { id: 'shimazaki', name: '島崎藤村', era: '1872–1943', family: '島崎', given: '藤村', titles: ['夜明け前', '家', '追慕'] },
  { id: 'kajii', name: '梶井基次郎', era: '1901–1932', family: '梶井', given: '基次郎', titles: ['檸檬', '愛撫', '臥床'] },
  { id: 'yokomitsu', name: '横光利一', era: '1898–1947', family: '横光', given: '利一', titles: ['上海', '美しい家', '機械'] },
  { id: 'yosano', name: '与謝野晶子', era: '1878–1942', family: '与謝野', given: '晶子', titles: ['みだれ髪', '君死にたまふことなかれ', '舞姫の旅'] },
  { id: 'hagiwara', name: '萩原朔太郎', era: '1886–1942', family: '萩原', given: '朔太郎', titles: ['月に吠える', '猫使い', '犬吠える'] },
  { id: 'koda', name: '幸田露伴', era: '1867–1947', family: '幸田', given: '露伴', titles: ['五重塔', '運命', '老師'] },
  { id: 'futabatei', name: '二葉亭四迷', era: '1864–1909', family: '二葉亭', given: '四迷', titles: ['浮雲', '小説総論', '旅日記'] },
  { id: 'tayama', name: '田山花袋', era: '1872–1930', family: '田山', given: '花袋', titles: ['蒲団', '紅色', '濁世'] },
];

function loadTokenizer() {
  return new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: DIC_PATH }).build((err, tokenizer) => {
      if (err) reject(err);
      else resolve(tokenizer);
    });
  });
}

function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i += 1; }
        else inQuote = false;
      } else cur += ch;
    } else if (ch === '"') inQuote = true;
    else if (ch === ',') { fields.push(cur); cur = ''; }
    else cur += ch;
  }
  fields.push(cur);
  return fields;
}

function authorMatches(row, author) {
  if (row['役割フラグ'] !== '著者') return false;
  const familyOk = row['姓'] === author.family || (author.altFamily || []).includes(row['姓']);
  if (!familyOk) return false;
  const givens = [author.given, ...(author.altGiven || [])];
  return givens.includes(row['名']);
}

async function ensureCatalog() {
  const cacheDir = join(ROOT, 'scripts', '.cache');
  execSync(`mkdir -p "${cacheDir}"`);
  if (!existsSync(CATALOG_CSV)) {
    console.log('カタログをダウンロード中…');
    execSync(`curl -sL "https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip" -o "${CATALOG_ZIP}"`);
    execSync(`unzip -o "${CATALOG_ZIP}" -d "${cacheDir}"`);
  }
  return readFileSync(CATALOG_CSV, 'utf8');
}

function loadCatalog(csvText) {
  const lines = csvText.split('\n').filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const fields = parseCsvLine(lines[i]);
    const row = {};
    header.forEach((h, j) => { row[h] = fields[j] || ''; });
    rows.push(row);
  }
  return rows;
}

function findWorks(catalog, author) {
  const matches = catalog.filter((row) => authorMatches(row, author));
  const found = [];
  for (const title of author.titles) {
    const hit = matches.find((row) => row['作品名'] === title && row['テキストファイルURL'].endsWith('.zip'));
    if (hit) {
      const htmlUrl = hit['XHTML/HTMLファイルURL'] || hit['図書カードURL'] || '';
      found.push({ title, url: hit['テキストファイルURL'], htmlUrl });
    } else console.warn(`  ? ${author.name} — 「${title}」が見つかりません`);
  }
  return found;
}

async function fetchTextFromZip(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const tmpZip = join(ROOT, 'scripts', '.cache', 'tmp_work.zip');
  writeFileSync(tmpZip, buf);
  const listing = execSync(`unzip -l "${tmpZip}"`, { encoding: 'utf8' });
  const txtMatch = listing.match(/\s+(\S+\.txt)\s*$/m);
  if (!txtMatch) throw new Error('txt not found in zip');
  const txtName = txtMatch[1].trim();
  const result = spawnSync('sh', ['-c', `unzip -p "${tmpZip}" "${txtName}" | iconv -f cp932 -t utf8`], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || 'iconv failed');
  return result.stdout;
}

async function buildAuthor(author, catalog, tokenizer) {
  if (author.skip) return null;
  const works = findWorks(catalog, author);
  if (!works.length) return null;

  const workProfiles = [];
  for (const work of works) {
    try {
      const raw = await fetchTextFromZip(work.url);
      const cleaned = cleanAozoraText(raw);
      const excerpt = cleaned.slice(0, EXCERPT_CHARS);
      const tokens = tokenizer.tokenize(excerpt.replace(/\n+/g, ''));
      const features = extractScores(excerpt, tokens);
      if (features) {
        workProfiles.push({
          title: work.title,
          htmlUrl: work.htmlUrl || '',
          scores: scoresToArray(features).map((v) => Math.round(v * 10000) / 10000),
          trigrams: extractTrigrams(excerpt),
        });
        console.log(`  ✓ ${author.name} — ${work.title}`);
      } else {
        console.warn(`  ✗ ${author.name} — ${work.title}: 特徴量不足`);
      }
    } catch (err) {
      console.warn(`  ✗ ${author.name} — ${work.title}: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!workProfiles.length) return null;
  return {
    id: author.id,
    name: author.name,
    era: author.era,
    works: workProfiles,
  };
}

async function patchWorkUrls() {
  const profilesPath = join(ROOT, 'shared', 'bungo-profiles.js');
  const code = readFileSync(profilesPath, 'utf8');
  const statsMatch = code.match(/window\.BUNGO_STATS = (\{[\s\S]*?\});/);
  const profilesMatch = code.match(/window\.BUNGO_PROFILES = (\[[\s\S]*\]);/);
  if (!statsMatch || !profilesMatch) throw new Error('bungo-profiles.js の形式が想定外です');

  const stats = JSON.parse(statsMatch[1]);
  const profiles = JSON.parse(profilesMatch[1]);
  const csv = await ensureCatalog();
  const catalog = loadCatalog(csv);

  for (const profile of profiles) {
    const author = AUTHORS.find((item) => item.id === profile.id);
    if (!author) continue;
    const catalogWorks = findWorks(catalog, author);
    for (const work of profile.works) {
      const hit = catalogWorks.find((item) => item.title === work.title);
      if (hit?.htmlUrl) work.htmlUrl = hit.htmlUrl;
    }
  }

  const js = [
    `window.BUNGO_STATS = ${JSON.stringify(stats, null, 2)};`,
    `window.BUNGO_PROFILES = ${JSON.stringify(profiles, null, 2)};`,
    '',
  ].join('\n');
  writeFileSync(profilesPath, js, 'utf8');
  console.log(`参照作品 URL を ${profilesPath} に反映しました。`);
}

async function main() {
  if (process.argv.includes('--patch-urls')) {
    await patchWorkUrls();
    return;
  }
  console.log('形態素解析辞書を読み込み中…');
  const tokenizer = await loadTokenizer();
  console.log('青空文庫から文豪プロファイルを生成中…\n');
  const csv = await ensureCatalog();
  const catalog = loadCatalog(csv);

  const profiles = [];
  const seenIds = new Set();
  for (const author of AUTHORS) {
    if (author.skip || seenIds.has(author.id)) continue;
    console.log(author.name);
    const profile = await buildAuthor(author, catalog, tokenizer);
    if (profile) {
      profiles.push(profile);
      seenIds.add(author.id);
    }
  }

  if (profiles.length < 5) {
    console.error(`\n取得できた著者が少なすぎます (${profiles.length})。`);
    process.exit(1);
  }

  const allWorkScores = profiles.flatMap((p) => p.works.map((w) => w.scores));
  const stats = computeStats(allWorkScores);
  const round = (arr) => arr.map((v) => Math.round(v * 10000) / 10000);

  const outPath = join(ROOT, 'shared', 'bungo-profiles.js');
  const js = [
    `window.BUNGO_STATS = ${JSON.stringify({ means: round(stats.means), stds: round(stats.stds) }, null, 2)};`,
    `window.BUNGO_PROFILES = ${JSON.stringify(profiles, null, 2)};`,
    '',
  ].join('\n');
  writeFileSync(outPath, js, 'utf8');
  console.log(`\n${profiles.length} 著者のプロファイルを ${outPath} に書き出しました。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
