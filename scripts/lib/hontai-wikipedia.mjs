import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function cleanWikiCell(raw) {
  return String(raw || '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/rowspan="[^"]*"/gi, '')
    .replace(/colspan="[^"]*"/gi, '')
    .replace(/&nbsp;/g, '')
    .trim();
}

function normalizeTitle(title) {
  return title
    .replace(/\s+/g, '')
    .replace(/[！!？?…・:：\-―ー「」『』（）()［］\[\]【】]/g, '')
    .toLowerCase();
}

function normalizeAuthor(author) {
  return author.replace(/\s+/g, '').replace(/　/g, '');
}

function slugId(title, author) {
  const base = normalizeTitle(title) + '-' + normalizeAuthor(author).slice(0, 12);
  return base.slice(0, 56) || 'book';
}

export async function fetchHontaiWikitext() {
  const url = new URL('https://ja.wikipedia.org/w/api.php');
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', '本屋大賞');
  url.searchParams.set('prop', 'wikitext');
  url.searchParams.set('format', 'json');

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Wikipedia API failed: ${res.status}`);
  const data = await res.json();
  return data.parse.wikitext['*'];
}

export function parseHontaiNominees(wikitext) {
  const sectionRe = /=== (\d{4})年（第\d+回） ===/g;
  const matches = [...wikitext.matchAll(sectionRe)];
  const entries = [];

  for (let i = 0; i < matches.length; i += 1) {
    const year = Number(matches[i][1]);
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : wikitext.length;
    const section = wikitext.slice(start, end);

    const headerIdx = section.indexOf('!順位!!受賞作');
    if (headerIdx === -1) continue;

    const tableStart = section.indexOf('{|', section.indexOf('発表'));
    const tableEnd = section.indexOf('|}', tableStart);
    if (tableStart === -1 || tableEnd === -1) continue;

    const table = section.slice(tableStart, tableEnd);
    const rows = table.split('|-');
    let department = '本屋大賞';

    for (const row of rows) {
      if (!row.includes('||')) continue;
      if (row.includes('翻訳小説部門') || row.includes('超発掘本') || row.includes('colspan=')) {
        if (row.includes('翻訳小説部門')) department = '翻訳小説部門';
        continue;
      }
      if (row.includes('|本屋大賞') || row.includes('rowspan') && row.includes('本屋大賞')) {
        department = '本屋大賞';
      }
      if (department !== '本屋大賞') continue;

      const rankM = row.match(/\{\{Center\|(\d+)\}\}/);
      if (!rankM) continue;
      const rank = Number(rankM[1]);
      if (!rank || rank > 15) continue;

      const afterCenter = row.split(/\{\{Center\|\d+\}\}\|\|/)[1];
      if (!afterCenter) continue;

      const parts = afterCenter.split('||').map(cleanWikiCell).filter(Boolean);
      const title = parts[0];
      const author = parts[1]?.replace(/\s+/g, ' ').trim();
      const scoreCell = parts.find((p) => p.includes('点')) || '';
      const publisher = parts.find((p) => p !== title && p !== author && p !== scoreCell) || '';

      if (!title || !author) continue;
      if (title.includes('順位') || title.includes('受賞作') || title === '本屋大賞') continue;
      if (author.includes('（訳）') || author.includes('訳）')) continue;
      if (/^\d+点/.test(author)) continue;

      entries.push({
        year,
        rank,
        title,
        author,
        publisher,
        score: scoreCell,
      });
    }
  }

  const byKey = new Map();
  for (const entry of entries) {
    const key = `${normalizeTitle(entry.title)}::${normalizeAuthor(entry.author)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        title: entry.title,
        author: entry.author,
        nominations: [entry],
        bestRank: entry.rank,
        bestYear: entry.year,
        won: entry.rank === 1,
      });
      continue;
    }
    existing.nominations.push(entry);
    if (entry.rank < existing.bestRank) {
      existing.bestRank = entry.rank;
      existing.bestYear = entry.year;
    }
    if (entry.rank === 1) existing.won = true;
  }

  return [...byKey.values()].sort((a, b) => {
    if (a.bestYear !== b.bestYear) return b.bestYear - a.bestYear;
    return a.bestRank - b.bestRank;
  });
}

function hashUnit(...parts) {
  const s = parts.join('\0');
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function bump(dims, key, amount) {
  dims[key] = (dims[key] || 0) + amount;
}

function applyPatternBoosts(dims, text) {
  if (/殺|謎|探偵|ミステリ|犯人|事件|屍|硝子|教場|告白|クジラ|連続|崩れる|屍人|黒牢|爆弾|方舟|真相|虚像|ラプター|盤上/.test(text)) {
    bump(dims, 'pace', 3);
    bump(dims, 'fun', 1);
  }
  if (/笑|ババア|ホルモー|ピクニック|ハケン|ボックス|バラエティ|コメディ|ふがいない|ランチ|アッコ|カフカ|しゃぼん|しっぽ/.test(text)) {
    bump(dims, 'fun', 3);
    bump(dims, 'easy', 2);
  }
  if (/孤城|新世界|鹿男|魔王|羊と|かがみ|異世界|ペンギン|夜は短し|有頂天|ツバキ|櫻風堂|風のマジム/.test(text)) {
    bump(dims, 'pace', 2);
    bump(dims, 'deep', 2);
  }
  if (/汝|蜜蜂|流浪|舟を編|博士|天地明察|ゴールデンスランバー|一瞬の風|同志少女|盤上の向日葵/.test(text)) {
    bump(dims, 'deep', 3);
    bump(dims, 'real', 1);
  }
  if (/コンビニ|阪急|ナミヤ|火花|横道|植物図鑑|花屋|カモミエ|暁星|エピクロス|病院|医師|看護|家族|母|父|子/.test(text)) {
    bump(dims, 'real', 3);
    bump(dims, 'easy', 1);
  }
  if (/愛|恋|青春|恋文|恋と|恋が|恋は|恋の|恋する/.test(text)) {
    bump(dims, 'real', 2);
    bump(dims, 'deep', 1);
  }
  if (/戦争|歴史|昭和|平成|時代|革命|皇帝|王国|武士|侍/.test(text)) {
    bump(dims, 'deep', 2);
    bump(dims, 'pace', -1);
  }
  if (/ファンタジー|魔法|竜|異世界|魔王|精霊|冒険|旅|幻想/.test(text)) {
    bump(dims, 'pace', 2);
    bump(dims, 'fun', 2);
  }
  if (/エッセイ|随筆|日記|エピソード|コラム/.test(text)) {
    bump(dims, 'short', 3);
    bump(dims, 'easy', 2);
  }
  if (/図書館|本屋|古書|文庫|カルテ|書店/.test(text)) {
    bump(dims, 'easy', 2);
    bump(dims, 'real', 1);
  }
  if (/ホラー|怪談|幽霊|呪い|恐怖|悪夢/.test(text)) {
    bump(dims, 'pace', 2);
    bump(dims, 'deep', 1);
  }
}

function applyAuthorBoosts(dims, author) {
  const a = author.replace(/\s+/g, '');
  if (/東野圭吾|湊かなえ|米澤穂信|伊坂幸太郎|宮部みゆき/.test(a)) {
    bump(dims, 'pace', 2);
    bump(dims, 'fun', 1);
  }
  if (/村田沙耶香|又吉直樹|町田康平|柚月裕子/.test(a)) {
    bump(dims, 'real', 2);
    bump(dims, 'easy', 1);
  }
  if (/恩田陸|小川洋子|角田光代|梨木香歩|川上弘美/.test(a)) {
    bump(dims, 'deep', 2);
    bump(dims, 'real', 1);
  }
  if (/上田秋成|古川日出男|若竹千佐子/.test(a)) {
    bump(dims, 'deep', 2);
  }
  if (/西尾維新|成田良悟|舞城王太郎/.test(a)) {
    bump(dims, 'pace', 2);
    bump(dims, 'fun', 2);
  }
  if (/夏川草介|原田マハ|柚木麻子/.test(a)) {
    bump(dims, 'real', 2);
    bump(dims, 'deep', 1);
  }
}

export function inferDims(title, meta, author = '', synopsis = '') {
  const dims = {};
  for (const key of ['easy', 'fun', 'deep', 'pace', 'short', 'real']) {
    dims[key] = 4 + Math.round(hashUnit(title, author, key) * 4);
  }

  if (meta.won) bump(dims, 'deep', 2);
  if (meta.bestRank <= 3) bump(dims, 'deep', 1);
  if (meta.bestRank === 1) bump(dims, 'pace', 1);
  if (meta.bestRank >= 8) bump(dims, 'easy', 1);

  const age = 2026 - (meta.bestYear || 2020);
  if (age <= 2) {
    bump(dims, 'pace', 1);
    bump(dims, 'fun', 1);
  } else if (age >= 12) {
    bump(dims, 'deep', 1);
  }

  if (title.length <= 8 || /短篇|物語集|エッセイ|短編/.test(title)) {
    bump(dims, 'short', 3);
  } else if (title.length >= 14) {
    bump(dims, 'short', -1);
    bump(dims, 'deep', 1);
  }

  applyPatternBoosts(dims, `${title}\n${author}\n${synopsis}`);
  applyAuthorBoosts(dims, author);

  for (const key of Object.keys(dims)) {
    dims[key] = Math.max(3, Math.min(10, dims[key]));
  }
  return dims;
}

export function buildBookRecord(meta) {
  const { title, author, bestYear, bestRank, won, nominations } = meta;
  const publisher = nominations.find((n) => n.publisher)?.publisher || '';
  const typeName = won ? '本屋大賞受賞作' : `ノミネート（${bestYear}年 ${bestRank}位）`;
  const traits = [
    won ? '本屋大賞受賞' : '本屋大賞ノミネート',
    `${bestYear}年`,
  ];
  if (bestRank <= 3) traits.push('上位ノミネート');

  const blurb = won
    ? `${bestYear}年本屋大賞を受賞した${author}の作品。全国の書店員が「いちばん売りたい本」として選んだ一冊です。`
    : `${bestYear}年本屋大賞で${bestRank}位にノミネートされた${author}の作品。書店員から支持を集めた話題作です。`;

  return {
    id: slugId(title, author),
    name: title,
    author,
    year: `${bestYear}年`,
    typeName,
    traits,
    dims: inferDims(title, meta, author),
    blurb,
    hontai: {
      bestYear,
      bestRank,
      won,
      nominations: nominations.map((n) => ({
        year: n.year,
        rank: n.rank,
        publisher: n.publisher,
      })),
    },
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const wikitext = await fetchHontaiWikitext();
  const nominees = parseHontaiNominees(wikitext);
  const out = path.join(__dirname, 'hontai-nominees.json');
  fs.writeFileSync(out, JSON.stringify(nominees, null, 2), 'utf8');
  console.log(`Parsed ${nominees.length} unique books -> ${out}`);
}
