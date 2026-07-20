/**
 * 文体診断ロゴーン（logoon.org）を参考にした10項目の粗点と一致指数。
 * CI = 100 - (10/n) * Σ( d + 2d² )  … d = |ss[a,i] - ss[b,i]| / 40
 * 表示用の一致指数は matchScore を 0–100 にスケールする。
 */

const CI_SS_UNIT = 40;
const CI_QUAD_WEIGHT = 2;
const DISPLAY_MATCH_SCALE = 2.4;

export const FEATURE_KEYS = [
  'avgSentLen',
  'avgPunctGap',
  'specialRate',
  'nounRate',
  'verbRate',
  'adjRate',
  'particleRate',
  'auxRate',
  'hiraganaRate',
  'hapaxRate',
];

export const FEATURE_LABELS = [
  '平均文長',
  '平均句読点間隔',
  '特殊語出現率',
  '名詞出現率',
  '動詞出現率',
  '形容詞出現率',
  '助詞出現率',
  '助動詞出現率',
  'ひらがな出現率',
  '異なり形態素比率',
];

export const EXCERPT_CHARS = 2000;
export const HAPAX_MIN_MORPHEMES = 400;

const HIRA_RE = /^[\u3040-\u309fー]+$/;
const KATA_RE = /^[\u30a0-\u30ffー]+$/;

function findBodyLineIndex(lines) {
  let hrCount = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^-{3,}$/.test(lines[i].trim())) {
      hrCount += 1;
      if (hrCount >= 2) return i + 1;
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    if (/^【テキスト中に現れる記号/.test(lines[i].trim())) {
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^-{3,}$/.test(lines[j].trim())) return j + 1;
      }
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    if (/^　\S/.test(lines[i])) return i;
  }
  return 0;
}

function stripAozoraMarkup(text) {
  text = text.replace(/［＃[^］]*］/g, '');
  text = text.replace(/[｜|][^《]*《[^》]*》/g, (m) => {
    const idx = Math.max(m.lastIndexOf('｜'), m.lastIndexOf('|'));
    return m.slice(idx + 1).replace(/《[^》]*》/, '');
  });
  text = text.replace(/([\u3400-\u9fff\uf900-\ufaff]+)《[^》]*》/g, '$1');
  text = text.replace(/《[^》]*》/g, '');
  text = text.replace(/［[^］]*］/g, '');
  text = text.replace(/^[─—\-一＝=]+$/gm, '');
  text = text.replace(/^[　\s]+/gm, '');
  return text.trim();
}

export function cleanAozoraText(raw) {
  let text = String(raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n');
  const startIdx = findBodyLineIndex(lines);
  const bodyLines = [];
  for (let i = startIdx; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith('#')) continue;
    if (/^(底本|入力|校正|初出|表記|参考文献|翻訳)/.test(line)) continue;
    if (/^-{3,}$/.test(line.trim())) continue;
    if (/^【.+】/.test(line.trim())) continue;
    if (/^（例）/.test(line.trim())) continue;
    if (/^《》|^｜：|^［＃］/.test(line.trim())) continue;
    if (line.trim() === '') continue;
    bodyLines.push(line);
  }
  text = stripAozoraMarkup(bodyLines.join('\n'));
  text = text.replace(/^(はしがき|序|序章)\s*$/gm, '');
  return text.trim();
}

function countMatches(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

function tokenSurface(token) {
  return token.surface_form || token.surface || '';
}

function posFamily(token) {
  const pos = token.pos || '';
  const pos1 = token.pos_detail_1 || '';
  const surface = tokenSurface(token);
  if (pos === '記号') return 'special';
  if (pos === '名詞') return 'noun';
  if (pos === '動詞') return 'verb';
  if (pos === '形容詞' || pos === '形容動詞') return 'adj';
  if (pos === '助詞') return 'particle';
  if (pos === '助動詞') return 'aux';
  if (pos === '副詞' && HIRA_RE.test(surface)) return 'hiragana';
  if (pos === '感動詞') return 'special';
  if (HIRA_RE.test(surface) && pos1 === '*') return 'hiragana';
  if (KATA_RE.test(surface)) return 'special';
  return null;
}

export function extractScores(cleaned, tokens) {
  if (!cleaned || cleaned.length < 80) return null;

  const body = cleaned.replace(/\s/g, '');
  const totalChars = [...body].length;
  if (totalChars < 80) return null;

  const sentCount = Math.max(1, countMatches(cleaned, /[。！？!?…‥\u2049\u203C\u2047]/g));
  const punctCount = Math.max(1, countMatches(cleaned, /[、。！？…‥\u2049\u203C\u2047]/g));

  const morphemes = (tokens || []).filter((t) => {
    const surface = tokenSurface(t);
    return t && surface && (t.pos !== '記号' || surface.length > 0);
  });
  const morphemeCount = Math.max(1, morphemes.length);

  const posCounts = { special: 0, noun: 0, verb: 0, adj: 0, particle: 0, aux: 0, hiragana: 0 };
  const surfaceCounts = {};

  morphemes.forEach((token) => {
    const surface = tokenSurface(token);
    const family = posFamily(token);
    if (family && posCounts[family] !== undefined) posCounts[family] += 1;
    if (HIRA_RE.test(surface)) posCounts.hiragana += 1;
    surfaceCounts[surface] = (surfaceCounts[surface] || 0) + 1;
  });

  const hapax = Object.values(surfaceCounts).filter((n) => n === 1).length;

  return {
    avgSentLen: totalChars / sentCount,
    avgPunctGap: totalChars / punctCount,
    specialRate: posCounts.special / morphemeCount,
    nounRate: posCounts.noun / morphemeCount,
    verbRate: posCounts.verb / morphemeCount,
    adjRate: posCounts.adj / morphemeCount,
    particleRate: posCounts.particle / morphemeCount,
    auxRate: posCounts.aux / morphemeCount,
    hiraganaRate: posCounts.hiragana / morphemeCount,
    hapaxRate: hapax / morphemeCount,
    morphemeCount,
  };
}

export function scoresToArray(scores) {
  return FEATURE_KEYS.map((key) => scores[key] || 0);
}

export function activeFeatureIndices(morphemeCount) {
  const indices = FEATURE_KEYS.map((_, i) => i);
  if (morphemeCount < HAPAX_MIN_MORPHEMES) {
    return indices.filter((i) => i !== 9);
  }
  return indices;
}

export function extractTrigrams(cleaned) {
  const body = cleaned.replace(/\s/g, '');
  const grams = {};
  for (let i = 0; i < body.length - 2; i += 1) {
    const tri = body.slice(i, i + 3);
    grams[tri] = (grams[tri] || 0) + 1;
  }
  return grams;
}

export function trigramCosine(a, b) {
  if (!a || !b) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  Object.keys(a).forEach((key) => { na += a[key] * a[key]; });
  Object.keys(b).forEach((key) => { nb += b[key] * b[key]; });
  Object.keys(a).forEach((key) => {
    if (b[key]) dot += a[key] * b[key];
  });
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function computeStats(workScores) {
  const dim = FEATURE_KEYS.length;
  const n = workScores.length;
  const means = new Array(dim).fill(0);
  const stds = new Array(dim).fill(0);

  workScores.forEach((scores) => {
    scores.forEach((v, i) => { means[i] += v; });
  });
  means.forEach((_, i) => { means[i] /= n; });

  workScores.forEach((scores) => {
    scores.forEach((v, i) => {
      const d = v - means[i];
      stds[i] += d * d;
    });
  });
  stds.forEach((_, i) => {
    stds[i] = Math.sqrt(stds[i] / n) || 1;
  });

  return { means, stds };
}

export function deviationScores(scores, stats) {
  return scores.map((v, i) => 50 + 10 * ((v - stats.means[i]) / stats.stds[i]));
}

export function consistencyIndex(authorSS, userSS, activeIndices) {
  const indices = activeIndices || userSS.map((_, i) => i);
  if (!indices.length) return 0;
  let sum = 0;
  indices.forEach((i) => {
    const d = Math.abs(authorSS[i] - userSS[i]) / CI_SS_UNIT;
    sum += d + CI_QUAD_WEIGHT * d * d;
  });
  const ci = 100 - (10 / indices.length) * sum;
  return Math.min(100, Math.max(0, ci));
}

export function displayConsistencyIndex(ci, triSim, morphemeCount) {
  return Math.min(100, Math.max(0, Math.round(matchScore(ci, triSim, morphemeCount) * DISPLAY_MATCH_SCALE)));
}

export function matchScore(ci, triSim, morphemeCount) {
  const triPct = triSim * 100;
  if (morphemeCount < HAPAX_MIN_MORPHEMES) {
    return triPct * 0.72 + ci * 0.28;
  }
  return triPct * 0.4 + ci * 0.6;
}

export function rankAuthors(userScores, userSS, userTrigrams, morphemeCount, profiles, stats) {
  const active = activeFeatureIndices(morphemeCount);

  const ranked = profiles.map((author) => {
    let bestCI = 0;
    let bestTri = 0;
    let bestScore = 0;
    let matchedWork = author.works[0]?.title || '';

    author.works.forEach((work) => {
      const authorSS = deviationScores(work.scores, stats);
      const ci = consistencyIndex(authorSS, userSS, active);
      const tri = trigramCosine(userTrigrams, work.trigrams);
      const rankScore = matchScore(ci, tri, morphemeCount);
      if (rankScore > bestScore || (rankScore === bestScore && ci > bestCI)) {
        bestScore = rankScore;
        bestCI = ci;
        bestTri = tri;
        matchedWork = work.title;
      }
    });

    return {
      id: author.id,
      name: author.name,
      era: author.era,
      works: author.works.map((w) => w.title),
      matchedWork,
      score: bestScore,
      ci: displayConsistencyIndex(bestCI, bestTri, morphemeCount),
      triSim: bestTri,
    };
  });

  ranked.sort((a, b) => b.score - a.score || b.ci - a.ci || b.triSim - a.triSim);
  return ranked;
}

export function describeMatch(userScores, authorScores, stats, morphemeCount) {
  return analyzeMatchDetails(userScores, authorScores, stats, morphemeCount).similar
    .slice(0, 4)
    .map((item) => item.text);
}

const FEATURE_TENDENCY = [
  { high: '文が長め', low: '文が短め', mid: '文長は標準的' },
  { high: '句読点の間隔が広め', low: '句読点が多め', mid: '句読点の間隔は標準的' },
  { high: '記号・特殊語が多め', low: '記号・特殊語が少なめ', mid: '記号・特殊語は標準的' },
  { high: '名詞が多め', low: '名詞が少なめ', mid: '名詞の比率は標準的' },
  { high: '動詞が多め', low: '動詞が少なめ', mid: '動詞の比率は標準的' },
  { high: '形容詞が多め', low: '形容詞が少なめ', mid: '形容詞の比率は標準的' },
  { high: '助詞が多め', low: '助詞が少なめ', mid: '助詞の比率は標準的' },
  { high: '助動詞が多め', low: '助動詞が少なめ', mid: '助動詞の比率は標準的' },
  { high: 'ひらがなが多め', low: '漢字・固い表記が多め', mid: 'ひらがなと漢字のバランスは標準的' },
  { high: '語彙の幅が広め', low: '語の反復が多め', mid: '語彙の多様さは標準的' },
];

function tendencyText(index, ss) {
  const avg = ss[index];
  const t = FEATURE_TENDENCY[index];
  if (avg >= 56) return t.high;
  if (avg <= 44) return t.low;
  return t.mid;
}

export function analyzeMatchDetails(userScores, authorScores, stats, morphemeCount, triSim = 0, authorName = '') {
  const active = activeFeatureIndices(morphemeCount);
  const userSS = deviationScores(userScores, stats);
  const authorSS = deviationScores(authorScores, stats);

  const compared = active.map((index) => ({
    index,
    label: FEATURE_LABELS[index],
    diff: Math.abs(userSS[index] - authorSS[index]),
  }));

  const avgSS = userSS.map((v, i) => (userSS[i] + authorSS[i]) / 2);

  const similar = compared
    .filter((item) => item.diff <= 10)
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 6)
    .map((item) => ({
      index: item.index,
      label: item.label,
      text: tendencyText(item.index, avgSS),
      closeness: item.diff <= 4 ? 'close' : 'near',
    }));

  const different = compared
    .filter((item) => item.diff >= 14)
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 2)
    .map((item) => ({
      label: item.label,
      text: authorName
        ? `あなたの文は${tendencyText(item.index, userSS)}、${authorName}は${tendencyText(item.index, authorSS)}`
        : `あなたの文は${tendencyText(item.index, userSS)}、参照作品は${tendencyText(item.index, authorSS)}`,
    }));

  const phrases = [];
  if (triSim >= 0.12) phrases.push({ text: '語の並び・言い回しがとても近い' });
  else if (triSim >= 0.06) phrases.push({ text: '語句のリズムがやや近い' });
  else if (triSim >= 0.03) phrases.push({ text: '一部の言い回しが近い' });

  return { similar, different, phrases };
}
