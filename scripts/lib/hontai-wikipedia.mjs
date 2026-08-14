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

export function inferDims(title, meta) {
  const t = title;
  const dims = { easy: 6, fun: 6, deep: 6, pace: 6, short: 6, real: 6 };

  if (meta.won) dims.deep += 2;
  if (meta.bestRank <= 3) dims.deep += 1;
  if (meta.bestRank === 1) dims.pace += 1;

  if (/殺|謎|探偵|ミステリ|犯人|事件|屍|硝子|教場|告白|クジラ|連続|崩れる|屍人|黒牢|爆弾|方舟|真相/.test(t)) {
    dims.pace += 3;
    dims.fun += 1;
  }
  if (/笑|ババア|ホルモー|ピクニック|ハケン|ボックス|バラエティ|コメディ|ふがいない/.test(t)) {
    dims.fun += 3;
    dims.easy += 2;
  }
  if (/孤城|新世界|鹿男|魔王|羊と|かがみ|異世界|ペンギン|夜は短し|有頂天|ツバキ|櫻風堂/.test(t)) {
    dims.pace += 2;
    dims.deep += 2;
  }
  if (/汝|蜜蜂|流浪|舟を編|博士|天地明察|ゴールデンスランバー|一瞬の風|同志少女/.test(t)) {
    dims.deep += 3;
    dims.real += 1;
  }
  if (/コンビニ|阪急|ナミヤ|火花|横道|植物図鑑|ツバキ|ランチ|花屋/.test(t)) {
    dims.real += 3;
    dims.easy += 1;
  }
  if (t.length <= 8 || /短篇|物語集|エッセイ/.test(t)) {
    dims.short += 3;
  }
  if (/図書館|本屋|古書|文庫|カルテ/.test(t)) {
    dims.easy += 2;
    dims.real += 1;
  }

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
    dims: inferDims(title, meta),
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
