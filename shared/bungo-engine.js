(function () {
  const FEATURE_KEYS = [
    'avgSentLen', 'avgPunctGap', 'specialRate', 'nounRate', 'verbRate',
    'adjRate', 'particleRate', 'auxRate', 'hiraganaRate', 'hapaxRate',
  ];

  const FEATURE_LABELS = [
    '平均文長', '平均句読点間隔', '特殊語出現率', '名詞出現率', '動詞出現率',
    '形容詞出現率', '助詞出現率', '助動詞出現率', 'ひらがな出現率', '異なり形態素比率',
  ];

  const HAPAX_MIN_MORPHEMES = 400;
  const KUROMOJI_DIC = 'https://cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict/';
  let tokenizerPromise = null;

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

  function cleanAozoraText(raw) {
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

  function extractScores(cleaned, tokens) {
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

  function scoresToArray(scores) {
    return FEATURE_KEYS.map((key) => scores[key] || 0);
  }

  function activeFeatureIndices(morphemeCount) {
    const indices = FEATURE_KEYS.map((_, i) => i);
    if (morphemeCount < HAPAX_MIN_MORPHEMES) return indices.filter((i) => i !== 9);
    return indices;
  }

  function extractTrigrams(cleaned) {
    const body = cleaned.replace(/\s/g, '');
    const grams = {};
    for (let i = 0; i < body.length - 2; i += 1) {
      const tri = body.slice(i, i + 3);
      grams[tri] = (grams[tri] || 0) + 1;
    }
    return grams;
  }

  function trigramCosine(a, b) {
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

  function deviationScores(scores, stats) {
    return scores.map((v, i) => 50 + 10 * ((v - stats.means[i]) / stats.stds[i]));
  }

  function consistencyIndex(authorSS, userSS, activeIndices) {
    const indices = activeIndices || userSS.map((_, i) => i);
    if (!indices.length) return 0;
    let sum = 0;
    indices.forEach((i) => { sum += Math.abs(authorSS[i] - userSS[i]) / 40; });
    return Math.max(0, 100 - (10 / indices.length) * sum);
  }

  function matchScore(ci, triSim, morphemeCount) {
    const triPct = triSim * 100;
    if (morphemeCount < HAPAX_MIN_MORPHEMES) {
      return triPct * 0.72 + ci * 0.28;
    }
    return triPct * 0.4 + ci * 0.6;
  }

  function loadTokenizer() {
    if (tokenizerPromise) return tokenizerPromise;
    tokenizerPromise = new Promise((resolve, reject) => {
      if (typeof kuromoji === 'undefined') {
        reject(new Error('kuromoji'));
        return;
      }
      kuromoji.builder({ dicPath: KUROMOJI_DIC }).build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
    });
    return tokenizerPromise;
  }

  function rankAuthors(text, profiles, stats) {
    return loadTokenizer().then((tokenizer) => {
      const cleaned = cleanAozoraText(text);
      const tokens = tokenizer.tokenize(cleaned.replace(/\n+/g, ''));
      const features = extractScores(cleaned, tokens);
      if (!features) return { ok: false, reason: 'short' };

      const userScores = scoresToArray(features);
      const userSS = deviationScores(userScores, stats);
      const userTrigrams = extractTrigrams(cleaned);
      const active = activeFeatureIndices(features.morphemeCount);

      const ranked = profiles.map((author) => {
        let bestScore = 0;
        let bestCI = 0;
        let matchedWork = author.works[0]?.title || '';

        author.works.forEach((work) => {
          const authorSS = deviationScores(work.scores, stats);
          const ci = consistencyIndex(authorSS, userSS, active);
          const tri = trigramCosine(userTrigrams, work.trigrams);
          const score = matchScore(ci, tri, features.morphemeCount);
          if (score > bestScore) {
            bestScore = score;
            bestCI = ci;
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
          ci: bestCI,
        };
      });

      ranked.sort((a, b) => b.score - a.score);
      return {
        ok: true,
        features,
        userScores,
        morphemeCount: features.morphemeCount,
        ranked,
        top: ranked[0],
      };
    });
  }

  function describeMatch(userScores, authorScores, stats, morphemeCount) {
    const active = activeFeatureIndices(morphemeCount);
    const userSS = deviationScores(userScores, stats);
    const authorSS = deviationScores(authorScores, stats);
    const traits = [];
    const checks = [
      { i: 0, low: '短い文', high: '長い文' },
      { i: 3, low: '名詞が少ない', high: '名詞が多い' },
      { i: 4, low: '動詞が少ない', high: '動詞が多い' },
      { i: 6, low: '助詞が少ない', high: '助詞が多い' },
      { i: 8, low: '漢字中心', high: 'ひらがな多め' },
    ];
    checks.forEach(({ i, low, high }) => {
      if (!active.includes(i)) return;
      const diff = userSS[i] - authorSS[i];
      if (Math.abs(diff) < 4) traits.push(high);
      else if (diff > 0) traits.push(high);
      else traits.push(low);
    });
    return [...new Set(traits)].slice(0, 4);
  }

  window.BungoEngine = {
    FEATURE_KEYS,
    FEATURE_LABELS,
    HAPAX_MIN_MORPHEMES,
    cleanAozoraText,
    extractScores,
    scoresToArray,
    activeFeatureIndices,
    extractTrigrams,
    trigramCosine,
    deviationScores,
    consistencyIndex,
    matchScore,
    loadTokenizer,
    rankAuthors,
    describeMatch,
  };
})();
