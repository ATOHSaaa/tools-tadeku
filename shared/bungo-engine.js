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
  const CI_SS_UNIT = 40;
  const CI_QUAD_WEIGHT = 2;
  const DISPLAY_MATCH_SCALE = 2.4;
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
    indices.forEach((i) => {
      const d = Math.abs(authorSS[i] - userSS[i]) / CI_SS_UNIT;
      sum += d + CI_QUAD_WEIGHT * d * d;
    });
    const ci = 100 - (10 / indices.length) * sum;
    return Math.min(100, Math.max(0, ci));
  }

  function displayConsistencyIndex(ci, triSim, morphemeCount) {
    return Math.min(100, Math.max(0, Math.round(matchScore(ci, triSim, morphemeCount) * DISPLAY_MATCH_SCALE)));
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
        let bestTri = 0;
        let matchedWork = author.works[0]?.title || '';

        author.works.forEach((work) => {
          const authorSS = deviationScores(work.scores, stats);
          const ci = consistencyIndex(authorSS, userSS, active);
          const tri = trigramCosine(userTrigrams, work.trigrams);
          const rankScore = matchScore(ci, tri, features.morphemeCount);
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
          ci: displayConsistencyIndex(bestCI, bestTri, features.morphemeCount),
          triSim: bestTri,
        };
      });

      ranked.sort((a, b) => b.score - a.score || b.ci - a.ci);
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

  const FEATURE_AXIS_SHORT = [
    '文の長さ',
    '句読点',
    '記号・特殊語',
    '名詞',
    '動詞',
    '形容詞',
    '助詞',
    '助動詞',
    'ひらがな',
    '語彙の幅',
  ];

  function tendencyText(index, ss) {
    const avg = ss[index];
    const t = FEATURE_TENDENCY[index];
    if (avg >= 56) return t.high;
    if (avg <= 44) return t.low;
    return t.mid;
  }

  function analyzeMatchDetails(userScores, authorScores, stats, morphemeCount, triSim, authorName) {
    const active = activeFeatureIndices(morphemeCount);
    const userSS = deviationScores(userScores, stats);
    const authorSS = deviationScores(authorScores, stats);
    const name = authorName || '';

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
        text: name
          ? `あなたの文は${tendencyText(item.index, userSS)}、${name}は${tendencyText(item.index, authorSS)}`
          : `あなたの文は${tendencyText(item.index, userSS)}、参照作品は${tendencyText(item.index, authorSS)}`,
      }));

    const phrases = [];
    if (triSim >= 0.12) phrases.push({ text: '語の並び・言い回しがとても近い' });
    else if (triSim >= 0.06) phrases.push({ text: '語句のリズムがやや近い' });
    else if (triSim >= 0.03) phrases.push({ text: '一部の言い回しが近い' });

    return { similar, different, phrases };
  }

  function variance(values) {
    if (!values.length) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  }

  function interquartileRange(values) {
    if (values.length < 4) {
      return Math.max(Math.max(...values) - Math.min(...values), 0.5);
    }
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor((sorted.length - 1) * 0.25)];
    const q3 = sorted[Math.floor((sorted.length - 1) * 0.75)];
    return Math.max(q3 - q1, 0.5);
  }

  function rankScale(values) {
    const n = values.length;
    if (n === 1) return [50];
    const order = values
      .map((v, i) => ({ v, i }))
      .sort((a, b) => a.v - b.v || a.i - b.i);
    const coords = new Array(n);
    let rank = 0;
    while (rank < n) {
      let end = rank;
      while (end + 1 < n && order[end + 1].v === order[rank].v) end += 1;
      const midRank = (rank + end) / 2;
      const coord = 12 + (midRank / (n - 1)) * 76;
      for (let j = rank; j <= end; j += 1) {
        coords[order[j].i] = coord;
      }
      rank = end + 1;
    }
    return coords;
  }

  function pickQuadrantAxes(similar, active, points) {
    const similarSet = new Set(
      similar
        .map((item) => (item.index != null ? item.index : FEATURE_LABELS.indexOf(item.label)))
        .filter((index) => index >= 0 && active.includes(index))
    );

    let bestPair = [active[0], active[1] ?? active[0]];
    let bestScore = -1;

    for (let a = 0; a < active.length; a += 1) {
      for (let b = a + 1; b < active.length; b += 1) {
        const xi = active[a];
        const yi = active[b];
        const xs = points.map((p) => p.ss[xi]);
        const ys = points.map((p) => p.ss[yi]);
        const spread = interquartileRange(xs) * interquartileRange(ys);
        const bonus = (similarSet.has(xi) ? 1.35 : 1) * (similarSet.has(yi) ? 1.35 : 1);
        const score = spread * bonus;
        if (score > bestScore) {
          bestScore = score;
          bestPair = [xi, yi];
        }
      }
    }
    return bestPair;
  }

  function tendencySide(index, ss) {
    const t = FEATURE_TENDENCY[index];
    if (ss >= 56) return t.high;
    if (ss <= 44) return t.low;
    return t.mid;
  }

  function resolveAxisSelection(axisIndices, active, similar, plotPoints) {
    const picked = [...new Set(
      (axisIndices || [])
        .filter((index) => typeof index === 'number' && active.includes(index))
    )].slice(0, 2);

    if (picked.length >= 2) {
      return { mode: '2d', indices: picked, auto: false };
    }
    if (picked.length === 1) {
      return { mode: '1d', indices: picked, auto: false };
    }
    const [xIndex, yIndex] = pickQuadrantAxes(similar, active, plotPoints);
    return { mode: '2d', indices: [xIndex, yIndex], auto: true };
  }

  function rankJitterY(plotXCoords, center) {
    const mid = center == null ? 50 : center;
    const groups = new Map();
    plotXCoords.forEach((x, i) => {
      const key = x.toFixed(3);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(i);
    });
    const ys = new Array(plotXCoords.length);
    groups.forEach((indices) => {
      if (indices.length === 1) {
        ys[indices[0]] = mid;
        return;
      }
      const spread = Math.min(28, Math.max(12, indices.length * 5));
      indices.forEach((idx, j) => {
        ys[idx] = mid - spread / 2 + (j / (indices.length - 1)) * spread;
      });
    });
    return ys;
  }

  function buildStyleMapSummary(mode, userPt, topPt, topName) {
    if (!userPt || !topPt) return '';
    if (mode === '1d') {
      const dist = Math.abs(userPt.plotX - topPt.plotX);
      if (dist < 5) {
        return 'あなたは「' + topName + '」と、選んだ特徴ではほぼ同じあたりにいます。';
      }
      if (dist < 16) {
        return 'あなたは「' + topName + '」と近い位置にいます。';
      }
      return 'あなたは「' + topName + '」とは、選んだ特徴ではやや離れた位置にいます。';
    }
    const dist = Math.hypot(userPt.plotX - topPt.plotX, userPt.plotY - topPt.plotY);
    if (dist < 14) {
      return 'あなたは「' + topName + '」と、選んだ2つの特徴ではほぼ同じあたりにいます。';
    }
    if (dist < 30) {
      return 'あなたは「' + topName + '」と近いゾーンにいます。';
    }
    return 'あなたは「' + topName + '」とは、選んだ特徴ではやや離れた位置にいます。';
  }

  function buildStyleMap(userScores, ranked, profiles, stats, morphemeCount, matchDetail, axisIndices) {
    const active = activeFeatureIndices(morphemeCount);
    const userSS = deviationScores(userScores, stats);
    const topId = ranked[0]?.id || '';
    const topName = ranked[0]?.name || '';
    const similar = (matchDetail && matchDetail.similar) || [];

    const authorEntries = profiles.map((profile) => {
      const rank = ranked.find((item) => item.id === profile.id);
      const workTitle = rank?.matchedWork || profile.works[0].title;
      const work = profile.works.find((w) => w.title === workTitle) || profile.works[0];
      return {
        id: profile.id,
        name: profile.name,
        ss: deviationScores(work.scores, stats),
      };
    });

    const plotPoints = [...authorEntries, { id: 'user', name: 'あなた', ss: userSS }];
    const selection = resolveAxisSelection(axisIndices, active, similar, plotPoints);
    const [xIndex, yIndex] = selection.indices;
    const xT = FEATURE_TENDENCY[xIndex];

    const rawPoints = authorEntries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      x: entry.ss[xIndex],
      y: selection.mode === '2d' ? entry.ss[yIndex] : null,
      kind: entry.id === topId ? 'top' : 'author',
    }));
    rawPoints.push({
      id: 'user',
      name: 'あなた',
      x: userSS[xIndex],
      y: selection.mode === '2d' ? userSS[yIndex] : null,
      kind: 'user',
    });

    if (selection.mode === '1d') {
      const plotX = rankScale(rawPoints.map((p) => p.x));
      const plotY = rankJitterY(plotX);
      const points = rawPoints.map((p, i) => ({
        ...p,
        plotX: plotX[i],
        plotY: plotY[i],
        vText: tendencySide(xIndex, p.x),
      }));
      const userPt = points.find((p) => p.kind === 'user');
      const topPt = points.find((p) => p.kind === 'top');

      return {
        mode: '1d',
        activeIndices: active,
        selectedIndices: [xIndex],
        autoSelected: selection.auto,
        axis: FEATURE_AXIS_SHORT[xIndex],
        axisLow: xT.low,
        axisHigh: xT.high,
        summary: buildStyleMapSummary('1d', userPt, topPt, topName),
        points,
      };
    }

    const yT = FEATURE_TENDENCY[yIndex];
    const xCoords = rankScale(rawPoints.map((p) => p.x));
    const yCoords = rankScale(rawPoints.map((p) => p.y));
    const points = rawPoints.map((p, i) => ({
      ...p,
      plotX: xCoords[i],
      plotY: yCoords[i],
      xText: tendencySide(xIndex, p.x),
      yText: tendencySide(yIndex, p.y),
    }));
    const userPt = points.find((p) => p.kind === 'user');
    const topPt = points.find((p) => p.kind === 'top');

    return {
      mode: '2d',
      activeIndices: active,
      selectedIndices: [xIndex, yIndex],
      autoSelected: selection.auto,
      xAxis: FEATURE_AXIS_SHORT[xIndex],
      yAxis: FEATURE_AXIS_SHORT[yIndex],
      xLow: xT.low,
      xHigh: xT.high,
      yLow: yT.low,
      yHigh: yT.high,
      summary: buildStyleMapSummary('2d', userPt, topPt, topName),
      points,
    };
  }

  window.BungoEngine = {
    FEATURE_KEYS,
    FEATURE_LABELS,
    FEATURE_AXIS_SHORT,
    HAPAX_MIN_MORPHEMES,
    cleanAozoraText,
    extractScores,
    scoresToArray,
    activeFeatureIndices,
    extractTrigrams,
    trigramCosine,
    deviationScores,
    consistencyIndex,
    displayConsistencyIndex,
    matchScore,
    loadTokenizer,
    rankAuthors,
    describeMatch,
    analyzeMatchDetails,
    buildStyleMap,
  };
})();
