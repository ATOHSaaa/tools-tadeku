(function (global) {
  const CAST_COLOR_COUNT = 8;

  const HONORIFIC = '(?:さん|くん|ちゃん|君|様|殿|氏|先生)';
  const HONORIFIC_CAPTURE = '(さん|くん|ちゃん|君|様|殿|氏|先生)';
  const KANJI_NAME = '[\\u4e00-\\u9fff\\u3400-\\u4dbf々]{1,4}';
  const HIRA_NICK = '[ぁ-ん]{2,4}';
  const KATA_NAME = '[ァ-ヴー]{1,8}';
  const LATIN_NAME = '[A-Za-z][A-Za-z0-9]{0,7}';
  const NAME_WITH_HONORIFIC = `(?:${KANJI_NAME}|${HIRA_NICK}|${KATA_NAME}|${LATIN_NAME})`;
  const SPEECH_NAME = `(?:${KANJI_NAME}|${KATA_NAME}|${LATIN_NAME})`;

  const SPEECH_VERBS = '言|答|叫|囁|呟|尋ね|尋|喊|叫び|呟き|語|述|説|尋ねた|言った|答えた|叫んだ|続け|説明|問い|訊いた|訊ね|声を上げ|声を張|呟いた|叫び|語り|述べ|説いた|尋ねる|問うた|問った';

  const HONORIFIC_ALONE = new Set(['さん', 'くん', 'ちゃん', '君', '様', '殿', '氏']);

  const HIRA_PHRASE_STOPS = new Set([
    'というの', 'いうの', 'そういうこと', 'ということ', 'そういう', 'こういう', 'ああいう', 'どういう',
    'という', 'いう', 'わけ', 'はず', 'ため', 'うち', 'ところ', 'もの', 'こと', 'ほう', 'みたい',
    'とおり', 'あいだ', 'あと', 'まえ', 'なか', 'そと', 'うえ', 'した', 'みぎ', 'ひだり', 'やつ',
    'みんな', 'おれ', 'おまえ', 'あいつ', 'こいつ', 'そいつ', 'だれ', 'なに', 'なん', 'どれ',
  ]);

  const KATAKANA_LOANWORDS = new Set([
    'テレビ', 'ラジオ', 'コンピュータ', 'コンピューター', 'パソコン', 'インターネット', 'ネット',
    'スマホ', 'スマートフォン', 'ケータイ', 'レストラン', 'カフェ', 'コーヒー', 'ハンバーガー',
    'サンドイッチ', 'ピザ', 'パスタ', 'ビール', 'ワイン', 'ウイスキー', 'ジュース', 'アイス',
    'クリーム', 'チョコ', 'チョコレート', 'ケーキ', 'パン', 'バター', 'チーズ', 'ミルク',
    'エレベーター', 'エスカレーター', 'タクシー', 'バス', 'トラック', 'バイク', '飛行機',
    'ヘリ', 'ヘリコプター', 'ニュース', 'メール', 'メッセージ', 'チャット', 'アプリ',
    'サイト', 'ページ', 'データ', 'ファイル', 'フォルダ', 'サーバー', 'システム', 'プログラム',
    'ソフト', 'ソフトウェア', 'ハード', 'ハードウェア', 'デザイン', 'デザイナー', 'マネージャー',
    'ディレクター', 'プロデューサー', 'アーティスト', 'ミュージシャン', 'アイドル', 'スター',
    'セレブ', 'ファン', 'イベント', 'フェス', 'ライブ', 'コンサート', 'ステージ', 'ショー',
    'ドラマ', 'アニメ', 'マンガ', 'ゲーム', 'プレイ', 'レベル', 'ポイント', 'スコア',
    'チーム', 'クラブ', 'グループ', 'パーティー', 'ミーティング', 'プレゼン',
    'レポート', 'ノート', 'ペン', 'ボールペン', 'シャーペン', 'テキスト', 'マニュアル',
    'エンジン', 'モーター', 'ボタン', 'スイッチ', 'リモコン', 'カメラ', 'レンズ', 'フラッシュ',
    'バッテリー', 'コンセント', 'プラグ', 'コード', 'ケーブル', 'アダプター', 'イヤホン',
    'ヘッドホン', 'スピーカー', 'マイク', 'ボイス', 'サウンド', 'ミュージック',
    'エアコン', 'クーラー', 'ヒーター', 'ランプ', 'ライト', 'ネオン', 'サイン', 'ロゴ',
    'ブランド', 'ショップ', 'ストア', 'モール', 'デパート', 'スーパー', 'コンビニ',
    'ホテル', 'マンション', 'アパート', 'ルーム', 'キッチン', 'リビング', 'トイレ', 'バス',
    'シャワー', 'ベッド', 'ソファ', 'テーブル', 'チェア', 'ドア', 'ウィンドウ', 'ガラス',
  ]);

  const STOP_NAMES = new Set([
    '今日', '明日', '昨日', '今', '午前', '午後', '朝', '昼', '夜', '夕', '方', '時', '時間',
    '今年', '来年', '去年', '今月', '来月', '先月', '毎日', '毎朝', '毎晩', '最近', '将来', '過去', '現在',
    '彼', '彼女', '彼ら', '彼女ら', '自分', '自身', '俺', '僕', '私', 'あたし', 'わたし', 'オレ', 'ワタシ',
    'これ', 'それ', 'あれ', 'どれ', 'この', 'その', 'あの', 'どの', 'ここ', 'そこ', 'あそこ', 'どこ',
    'こちら', 'そちら', 'あちら', 'どちら', 'こっち', 'そっち', 'あっち', 'どっち',
    'あいつ', 'こいつ', 'そいつ', 'どいつ', 'みんな', '皆', '自分たち', '我々', '我ら', 'あなた', 'あんた',
    '人', '人間', '人々', '男', '女', '子', '子供', '大人', '老人', '若者', '少年', '少女', '青年', '他人',
    '世界', '社会', '学校', '教室', '部屋', '場所', '問題', '意味', '理由', '方法', '結果', '原因',
    '状況', '場合', '動き', '存在', '雰囲気', '空気', '感じ', '気持', '気持ち', '心', '目', '手', '声',
    '言葉', '名前', '顔', '背', '姿', '家', '部', '課', '局', '国', '町', '村', '市', '県',
    '日本', '東京', '大阪', '京都', '先生', '医者', '警察', '警官', '店員', '主人', '奥', '母', '父',
    '兄', '姉', '弟', '妹', '親', '家族', '友', '友人', '友達', '相手', '隣', '前', '後', '上', '下',
    '左', '右', '中', '外', '内', '先', '後ろ', '横', '側', '間', '程度', '以上', '以下', '以外',
    '何', '誰', 'どれ', 'いつ', 'どう', 'なぜ', '何故', 'どこ', 'どちら', 'どの', 'どんな',
    '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万',
    '最初', '最後', '突然', '次', '始', '終', '最', '全', '各', '別', '同',
    '女性', '男性', '子ども', '学生', '教師', '職員', '社員', '店長', '客', '利用者',
    '声', '視線', '表情', '笑', '涙', '怒', '驚', '戸惑', '困惑', '不安', '恐怖', '希望', '絶望',
    '記憶', '未来', '夢', '現実', '真実', '嘘', '秘密', '約束', '関係', '距離', '温度',
    '冷', '暖', '暑', '寒', '静', '騒', '暗', '明', '光', '影', '色', '形', '音', '匂', '味',
    '窓', '扉', '床', '壁', '天井', '階段', '廊下', '玄関', '庭', '公園', '道', '路', '角', '信号',
    '車', '電車', '駅', '空港', '港', '船', '自転車', '交差点', '建物', 'ビル', '塔',
    '会社', '事務', '仕事', '会議', '報告', '連絡', '電話', '手紙', '封筒', '机', '椅子', '本',
    '紙', 'ページ', '文字', '文章', '段落', '行', '文', '語', '単語', '言', '話', '会話', '沈黙',
    '朝食', '昼食', '夕食', '食事', '料理', '服', '靴', '帽子', '鞄', '財布',
    '春', '夏', '秋', '冬', '季節', '天気', '雨', '雪', '風', '雲', '空', '太陽', '月', '星',
    '頭', '髪', '額', '眉', '鼻', '口', '唇', '歯', '舌', '喉', '肩', '腕', '指', '胸', '腹',
    '背中', '腰', '足', '膝', '爪', '皮膚', '血', '骨', '命', '死', '生', '病', '怪我', '痛',
    '病院', '救急', '看護', '薬', '注射', '手術', '診察', '検査', '記録', '書類',
  ]);

  const COMMON_NOUN_SUFFIX = /(?:性|型|式|度|率|感|力|法|学|区|室|館|線|局面|側|方|化|料|費|品|物|者|員|形|状|色|声|眼|耳|鼻|語|文|字|事|時|間|所|場|境|界|系|部|局|課|組|隊|群|団|会|派|党|軍|則|点|段|層|類|種|列|号|版|巻|章|節|条|項|則)$/;

  const PATTERNS = [
    {
      re: new RegExp(`(${NAME_WITH_HONORIFIC})(${HONORIFIC_CAPTURE})`, 'g'),
      kind: 'honorific',
      weight: 5,
      honorific: true,
    },
    {
      re: new RegExp(`(${SPEECH_NAME})(?:が|は)(?:${SPEECH_VERBS})`, 'g'),
      kind: 'speech',
      weight: 5,
    },
    {
      re: new RegExp(`(${KATA_NAME})(?:は|が)(?:黙|立|座|歩|走|笑|泣|頷|叫|驚|戸惑|困|怒|向|振り向|振り返)`, 'g'),
      kind: 'speech',
      weight: 4,
    },
    {
      re: new RegExp(`(${HIRA_NICK})(?:は|が)(?:${SPEECH_VERBS}|黙|立|座|歩|走|笑|泣|頷|叫|驚|戸惑|困|怒|向|振り向|振り返)`, 'g'),
      kind: 'speech',
      weight: 3,
      hiraganaNick: true,
    },
    {
      re: new RegExp(`(${LATIN_NAME})(?:\\s+(?:said|says|asked|replied|whispered|shouted))`, 'gi'),
      kind: 'speech',
      weight: 5,
    },
  ];

  function normalizeSurface(text) {
    return (text || '').normalize('NFKC').trim();
  }

  function stripHonorific(text) {
    return normalizeSurface(text).replace(/(さん|くん|ちゃん|君|様|殿|氏|先生)$/, '');
  }

  function canonicalKey(name) {
    const text = stripHonorific(normalizeSurface(name));
    if (!text) return '';

    const kanji = text.match(/[\u4e00-\u9fff\u3400-\u4dbf々]+/g);
    if (kanji && kanji.length) return `k:${kanji.join('')}`;

    if (/^[ぁ-んー]+$/.test(text)) return `h:${text}`;
    if (/^[ァ-ヴー]+$/.test(text)) return `a:${text}`;
    if (/^[A-Za-z0-9]+$/.test(text)) return `e:${text.toLowerCase()}`;

    return `x:${text.toLowerCase()}`;
  }

  function isKanjiName(text) {
    return /^[\u4e00-\u9fff\u3400-\u4dbf々]{1,4}$/.test(text);
  }

  function isKatakanaName(text) {
    return /^[ァ-ヴー]{1,8}$/.test(text);
  }

  function isHiraganaNick(text) {
    return /^[ぁ-ん]{2,4}$/.test(text);
  }

  function isLatinName(text) {
    return /^[A-Za-z][A-Za-z0-9]{0,7}$/.test(text);
  }

  function isValidNameShape(text) {
    return isKanjiName(text) || isKatakanaName(text) || isHiraganaNick(text) || isLatinName(text);
  }

  function isLikelyHiraganaPhrase(text) {
    const surface = normalizeSurface(text);
    if (!/^[ぁ-ん]{2,6}$/.test(surface)) return false;
    if (HIRA_PHRASE_STOPS.has(surface)) return true;
    if (/(?:という|いう|そう|こう|ああ|どう|みたい|ように|わけ|はず|とおり)/.test(surface)) return true;
    return false;
  }

  function isLikelyCommonNoun(text) {
    const surface = normalizeSurface(text);
    if (!surface) return true;
    if (HONORIFIC_ALONE.has(surface)) return true;
    if (STOP_NAMES.has(surface)) return true;
    if (KATAKANA_LOANWORDS.has(surface)) return true;
    if (COMMON_NOUN_SUFFIX.test(surface)) return true;
    if (isLikelyHiraganaPhrase(surface)) return true;
    return false;
  }

  function buildExcludeSet(excludes) {
    const set = new Set();
    for (const word of STOP_NAMES) set.add(word);
    for (const word of excludes || []) {
      const norm = normalizeSurface(word);
      if (norm) {
        set.add(norm);
        set.add(canonicalKey(norm));
      }
    }
    return set;
  }

  function isExcluded(name, excludeSet) {
    const surface = stripHonorific(normalizeSurface(name));
    if (!surface) return true;
    if (isLikelyCommonNoun(surface)) return true;
    if (excludeSet.has(surface)) return true;
    if (excludeSet.has(canonicalKey(surface))) return true;
    return false;
  }

  function createGroup(key) {
    return {
      key,
      surfaces: new Map(),
      honorificForms: new Map(),
      spans: [],
      score: 0,
      honorificHits: 0,
      speechHits: 0,
      pinned: false,
    };
  }

  function addOccurrence(map, name, start, end, weight, kind, excludeSet, opts = {}) {
    const core = stripHonorific(normalizeSurface(name));
    const label = normalizeSurface(opts.label || name);
    if (!core || !isValidNameShape(core)) return;
    if (isExcluded(core, excludeSet)) return;
    if (opts.hiraganaNick && isLikelyHiraganaPhrase(core)) return;

    const key = canonicalKey(core);
    if (!key) return;

    if (!map.has(key)) map.set(key, createGroup(key));

    const group = map.get(key);
    group.surfaces.set(core, (group.surfaces.get(core) || 0) + 1);
    if (opts.honorificForm) {
      group.honorificForms.set(
        opts.honorificForm,
        (group.honorificForms.get(opts.honorificForm) || 0) + 1,
      );
    }
    group.spans.push({ start, end, surface: label });
    group.score += weight;
    if (kind === 'honorific') group.honorificHits += 1;
    if (kind === 'speech') group.speechHits += 1;
  }

  function hasStrongSignal(group) {
    if (group.pinned) return true;
    if (group.honorificHits > 0) return true;
    if (group.speechHits > 0) return true;
    return false;
  }

  function mergeCrossScriptVariants(map) {
    const groups = [...map.values()];
    const absorbed = new Set();

    for (const hiraGroup of groups) {
      if (!hiraGroup.key.startsWith('h:') || absorbed.has(hiraGroup.key)) continue;
      if (hiraGroup.speechHits < 1 && hiraGroup.honorificHits < 1) continue;

      let bestKanji = null;
      let bestDistance = Infinity;
      const hiraStart = hiraGroup.spans.length
        ? Math.min(...hiraGroup.spans.map((s) => s.start))
        : Number.MAX_SAFE_INTEGER;

      for (const kanjiGroup of groups) {
        if (!kanjiGroup.key.startsWith('k:') || absorbed.has(kanjiGroup.key)) continue;
        if (kanjiGroup.honorificHits < 1 && kanjiGroup.speechHits < 1) continue;

        const kanjiStart = kanjiGroup.spans.length
          ? Math.min(...kanjiGroup.spans.map((s) => s.start))
          : Number.MAX_SAFE_INTEGER;
        const distance = Math.abs(kanjiStart - hiraStart);

        if (distance <= 400 && distance < bestDistance) {
          bestDistance = distance;
          bestKanji = kanjiGroup;
        }
      }

      if (!bestKanji) continue;

      for (const [surface, count] of hiraGroup.surfaces.entries()) {
        bestKanji.surfaces.set(surface, (bestKanji.surfaces.get(surface) || 0) + count);
      }
      for (const [form, count] of hiraGroup.honorificForms.entries()) {
        bestKanji.honorificForms.set(form, (bestKanji.honorificForms.get(form) || 0) + count);
      }
      bestKanji.spans.push(...hiraGroup.spans);
      bestKanji.score += hiraGroup.score;
      bestKanji.speechHits += hiraGroup.speechHits;
      bestKanji.honorificHits += hiraGroup.honorificHits;
      absorbed.add(hiraGroup.key);
    }

    for (const key of absorbed) map.delete(key);
  }

  function scanPatterns(text, map, excludeSet) {
    for (const pattern of PATTERNS) {
      pattern.re.lastIndex = 0;
      let match = pattern.re.exec(text);
      while (match) {
        if (pattern.honorific) {
          const core = match[1];
          const suffix = match[2];
          const fullForm = core + suffix;
          addOccurrence(
            map,
            core,
            match.index,
            match.index + fullForm.length,
            pattern.weight,
            pattern.kind,
            excludeSet,
            { label: fullForm, honorificForm: fullForm },
          );
        } else {
          addOccurrence(
            map,
            match[1],
            match.index,
            match.index + match[1].length,
            pattern.weight,
            pattern.kind,
            excludeSet,
            { hiraganaNick: Boolean(pattern.hiraganaNick) },
          );
        }
        match = pattern.re.exec(text);
      }
    }
  }

  function addPinned(map, pinned, excludeSet) {
    for (const name of pinned || []) {
      const label = normalizeSurface(name);
      const core = stripHonorific(label);
      if (!core || isExcluded(core, excludeSet)) continue;
      const key = canonicalKey(core);
      if (!map.has(key)) {
        const group = createGroup(key);
        group.surfaces.set(core, 0);
        if (label !== core && /(?:さん|くん|ちゃん|君|様|殿|氏|先生)$/.test(label)) {
          group.honorificForms.set(label, 0);
        }
        group.score = 10;
        group.pinned = true;
        map.set(key, group);
      } else {
        const group = map.get(key);
        group.pinned = true;
        group.score += 10;
        if (!group.surfaces.has(core)) group.surfaces.set(core, 0);
      }
    }
  }

  function expandTargets(group) {
    if (group.honorificForms.size > 0) return [...group.honorificForms.keys()];
    return [...group.surfaces.keys()];
  }

  function expandGroupOccurrences(text, group) {
    for (const target of expandTargets(group)) {
      let index = 0;
      while ((index = text.indexOf(target, index)) !== -1) {
        const end = index + target.length;
        const exists = group.spans.some((span) => span.start === index && span.end === end);
        if (!exists) group.spans.push({ start: index, end, surface: target });
        index = end;
      }
      const count = text.split(target).length - 1;
      if (count > 0) {
        if (group.honorificForms.has(target)) group.honorificForms.set(target, count);
        else group.surfaces.set(target, count);
      }
    }
  }

  function mergeSpans(spans) {
    if (!spans.length) return [];
    const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
    const merged = [];

    for (const span of sorted) {
      const prev = merged[merged.length - 1];
      if (prev && span.start < prev.end && span.end <= prev.end) continue;
      if (prev && span.start === prev.start && span.end === prev.end) continue;
      merged.push({ ...span });
    }

    return merged;
  }

  function countOccurrences(group) {
    let total = 0;
    for (const count of group.honorificForms.values()) total += count;
    if (total === 0) {
      for (const count of group.surfaces.values()) total += count;
    }
    return Math.max(total, group.spans.length);
  }

  function primarySurface(group) {
    if (group.honorificForms.size > 0) {
      let best = '';
      let bestCount = -1;
      for (const [form, count] of group.honorificForms.entries()) {
        if (count > bestCount) {
          best = form;
          bestCount = count;
        }
      }
      if (best) return best;
    }

    let best = '';
    let bestCount = -1;
    for (const [surface, count] of group.surfaces.entries()) {
      if (count > bestCount) {
        best = surface;
        bestCount = count;
      }
    }
    return best || [...group.surfaces.keys()][0] || '';
  }

  function listedSurfaces(group) {
    if (group.honorificForms.size > 0) {
      return [...group.honorificForms.keys()].sort((a, b) => {
        return (group.honorificForms.get(b) || 0) - (group.honorificForms.get(a) || 0);
      });
    }
    return [...group.surfaces.keys()].sort((a, b) => {
      return (group.surfaces.get(b) || 0) - (group.surfaces.get(a) || 0);
    });
  }

  function analyzeCast(text, options = {}) {
    const minCount = Number.isFinite(options.minCount) ? Math.max(1, options.minCount) : 2;
    const excludes = options.excludes || [];
    const pinned = options.pinned || [];
    const excludeSet = buildExcludeSet(excludes);

    if (!text || !text.trim()) {
      return { groups: [], spans: [], warnings: 0 };
    }

    const map = new Map();
    scanPatterns(text, map, excludeSet);
    mergeCrossScriptVariants(map);
    addPinned(map, pinned, excludeSet);

    const groups = [];

    for (const group of map.values()) {
      if (!hasStrongSignal(group)) continue;
      if (isExcluded(stripHonorific(primarySurface(group)), excludeSet)) continue;

      expandGroupOccurrences(text, group);

      const count = countOccurrences(group);
      if (!group.pinned && count < minCount && group.honorificHits < 1) continue;

      const surfaces = listedSurfaces(group);
      const coreSurfaces = [...group.surfaces.keys()];
      const variants = coreSurfaces.length > 1
        || (group.honorificForms.size > 1)
        || surfaces.some((form) => stripHonorific(form) !== coreSurfaces[0]);

      groups.push({
        key: group.key,
        primary: primarySurface(group),
        surfaces,
        count,
        variants,
        pinned: Boolean(group.pinned),
        firstStart: group.spans.length
          ? Math.min(...group.spans.map((s) => s.start))
          : Number.MAX_SAFE_INTEGER,
        spans: mergeSpans(group.spans),
      });
    }

    groups.sort((a, b) => a.firstStart - b.firstStart || b.count - a.count);

    const colorMap = new Map();
    groups.forEach((group, index) => {
      colorMap.set(group.key, index % CAST_COLOR_COUNT);
    });

    const spans = [];
    for (const group of groups) {
      for (const span of group.spans) {
        spans.push({
          start: span.start,
          end: span.end,
          colorIndex: colorMap.get(group.key),
          key: group.key,
        });
      }
    }

    spans.sort((a, b) => a.start - b.start || a.end - b.end);

    return {
      groups: groups.map((group) => ({
        key: group.key,
        primary: group.primary,
        surfaces: group.surfaces,
        count: group.count,
        variants: group.variants,
        pinned: group.pinned,
        colorIndex: colorMap.get(group.key),
      })),
      spans,
      warnings: groups.filter((g) => g.variants).length,
    };
  }

  global.TadekuCastEngine = {
    CAST_COLOR_COUNT,
    analyzeCast,
    canonicalKey,
    normalizeSurface,
  };
})(typeof window !== 'undefined' ? window : globalThis);
