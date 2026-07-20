(function () {
  const MM_TO_PX = 96 / 25.4;

  const BASE_FORMATS = {
    a6: {
      width: 105,
      height: 148,
      marginTop: 16,
      marginBottom: 16,
      marginInner: 13,
      marginOuter: 10,
      colsPerLine: 39,
      linesPerPage: 16,
    },
    b6: {
      width: 128,
      height: 182,
      marginTop: 18,
      marginBottom: 18,
      marginInner: 15,
      marginOuter: 12,
      colsPerLine: 40,
      linesPerPage: 20,
    },
    a5: {
      width: 148,
      height: 210,
      marginTop: 22,
      marginBottom: 22,
      marginInner: 18,
      marginOuter: 15,
      colsPerLine: 42,
      linesPerPage: 22,
    },
    b5: {
      width: 182,
      height: 257,
      marginTop: 24,
      marginBottom: 24,
      marginInner: 20,
      marginOuter: 17,
      colsPerLine: 44,
      linesPerPage: 28,
    },
  };

  function makeFormat(id, baseKey) {
    const base = BASE_FORMATS[baseKey];
    const name = baseKey.toUpperCase();
    const size = `${base.width}×${base.height}mm`;
    return {
      id,
      baseKey,
      label: `${name}（${size}）`,
      ...base,
    };
  }

  const FORMATS = {
    a6: makeFormat('a6', 'a6'),
    b6: makeFormat('b6', 'b6'),
    a5: makeFormat('a5', 'a5'),
    b5: makeFormat('b5', 'b5'),
  };

  const DEFAULT_BLEED_MM = 3;

  const BLEED_OPTIONS = [
    { id: 'off', label: 'なし' },
    { id: 'on', label: 'あり（3mm）' },
  ];

  const LEGACY_FORMAT_MAP = {
    bunko: 'a6',
    shinsho: 'a6',
    'a6-bleed': 'a6',
    'b6-bleed': 'b6',
    'a5-bleed': 'a5',
    'b5-bleed': 'b5',
  };

  const FONTS = {
    shippori: {
      id: 'shippori',
      label: 'しっぽり明朝',
      family: '"Shippori Mincho", "Zen Old Mincho", serif',
      googleCssFamily: 'Shippori+Mincho:wght@400;700',
      size: 8.5,
      lineHeight: 1.55,
    },
    literary: {
      id: 'literary',
      label: 'Zen Old Mincho',
      family: '"Zen Old Mincho", "Shippori Mincho", serif',
      googleCssFamily: 'Zen+Old+Mincho:wght@400;700',
      size: 8.5,
      lineHeight: 1.55,
    },
    standard: {
      id: 'standard',
      label: 'Noto Serif JP',
      family: '"Noto Serif JP", serif',
      googleCssFamily: 'Noto+Serif+JP:wght@400;700',
      size: 9,
      lineHeight: 1.5,
    },
    gothic: {
      id: 'gothic',
      label: 'Noto Sans JP',
      family: '"Noto Sans JP", sans-serif',
      googleCssFamily: 'Noto+Sans+JP:wght@400;700',
      size: 9,
      lineHeight: 1.5,
    },
  };

  const NONBULE_POSITIONS = [
    { id: 'spread', label: '右下・左下' },
    { id: 'center', label: '下中央' },
  ];

  const NONBULE_START_ANCHORS = [
    { id: 'body', label: '本文1頁目' },
    { id: 'first', label: '物理1頁目' },
    { id: 'custom', label: '指定頁' },
  ];

  const COLUMN_COUNTS = [
    { id: 1, label: '1段' },
    { id: 2, label: '2段' },
  ];

  const WRITING_DIRECTIONS = [
    { id: 'vertical', label: '縦書き' },
    { id: 'horizontal', label: '横書き' },
  ];

  const CHAPTER_MODES = [
    { id: 'recto', label: '章タイトルを必ず右頁に' },
    { id: 'break-before', label: '章タイトルの直前で改頁' },
    { id: 'none', label: '何もしない' },
  ];

  const DEFAULT_COLUMN_GAP_MM = 2;

  const DEFAULT_PAGE_SPACERS = {
    beforeToc: 0,
    afterToc: 0,
    afterBody: 0,
    afterColophon: 0,
  };

  function clampPageSpacerCount(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 0) return 0;
    return Math.min(99, Math.floor(v));
  }

  function normalizePageSpacers(input) {
    const src = input || {};
    return {
      beforeToc: clampPageSpacerCount(src.beforeToc),
      afterToc: clampPageSpacerCount(src.afterToc),
      afterBody: clampPageSpacerCount(src.afterBody),
      afterColophon: clampPageSpacerCount(src.afterColophon),
    };
  }

  function nonbulePositionLabel(id) {
    const item = NONBULE_POSITIONS.find((p) => p.id === id);
    return item ? item.label : NONBULE_POSITIONS[0].label;
  }

  function clampNonbuleStartPage(n, pageCount) {
    const v = Number(n);
    const max = Math.max(1, pageCount || 1);
    if (!Number.isFinite(v) || v < 1) return 1;
    return Math.min(max, Math.floor(v));
  }

  function normalizeNonbuleStartAnchor(id) {
    return NONBULE_START_ANCHORS.some((item) => item.id === id) ? id : 'body';
  }

  const H_MM = 0.25;

  function ptToMm(pt) {
    return pt * 25.4 / 72;
  }

  function lineGapMm(h) {
    return h * H_MM;
  }

  /** 行間 nH（n×0.25mm）を CSS line-height 倍率へ */
  function lineHeightFromH(h, fontSizePt) {
    const fontMm = ptToMm(fontSizePt);
    return (fontMm + lineGapMm(h)) / fontMm;
  }

  function hFromLineHeight(lineHeight, fontSizePt) {
    const fontMm = ptToMm(fontSizePt);
    const gapMm = fontMm * (lineHeight - 1);
    return Math.round(gapMm / H_MM * 2) / 2;
  }

  function snapLineHeightH(h) {
    return Math.min(15, Math.max(5, Math.round(h * 2) / 2));
  }

  function formatLineHeightLabel(h, fontSizePt) {
    const gapMm = lineGapMm(h);
    const leadingPt = fontSizePt * lineHeightFromH(h, fontSizePt);
    return h + 'H（' + gapMm.toFixed(2) + 'mm・行送り ' + leadingPt.toFixed(1) + 'pt）';
  }

  function computeGutter(format) {
    return Object.assign({}, format, { gutterNote: '' });
  }

  const MARGIN_MIN_MM = 5;
  const MARGIN_MIN_BODY_MM = 35;
  /** 判型標準の地余白における、本文下端〜ノンブルの固定間隔（mm） */
  const NONBULE_BODY_GAP_RATIO = 0.58;

  function nonbuleBodyGapMm(format) {
    const baseKey = format.baseKey || format.id;
    const base = BASE_FORMATS[baseKey];
    const refBottom = base ? base.marginBottom : format.marginBottom;
    return refBottom * NONBULE_BODY_GAP_RATIO;
  }

  function effectiveMargins(format, overrides) {
    const src = overrides || {};
    return {
      top: Number.isFinite(src.top) ? src.top : format.marginTop,
      bottom: Number.isFinite(src.bottom) ? src.bottom : format.marginBottom,
      inner: Number.isFinite(src.inner) ? src.inner : format.marginInner,
      outer: Number.isFinite(src.outer) ? src.outer : format.marginOuter,
    };
  }

  function applyMargins(format, margins) {
    const m = margins || effectiveMargins(format, null);
    return {
      ...format,
      marginTop: m.top,
      marginBottom: m.bottom,
      marginInner: m.inner,
      marginOuter: m.outer,
    };
  }

  function marginLimitsForFormat(format) {
    const vertMax = Math.max(MARGIN_MIN_MM, format.height - MARGIN_MIN_BODY_MM - MARGIN_MIN_MM);
    const horizMax = Math.max(MARGIN_MIN_MM, format.width - MARGIN_MIN_BODY_MM - MARGIN_MIN_MM);
    return {
      top: { min: MARGIN_MIN_MM, max: vertMax },
      bottom: { min: MARGIN_MIN_MM, max: vertMax },
      inner: { min: MARGIN_MIN_MM, max: horizMax },
      outer: { min: MARGIN_MIN_MM, max: horizMax },
    };
  }

  function mmToPx(mm) {
    return mm * MM_TO_PX;
  }

  function bodySize(format) {
    return {
      width: format.width - format.marginInner - format.marginOuter,
      height: format.height - format.marginTop - format.marginBottom,
    };
  }

  function summaryText(format, font, nonbulePosition, lineHeightH, columnCount, bleedMm) {
    const body = bodySize(format);
    const bleed = bleedMm ? `${bleedMm}mm` : 'なし';
    const h = lineHeightH != null ? lineHeightH : 8;
    const cols = columnCount === 2 ? 2 : 1;
    return {
      size: format.label,
      margins: `天${format.marginTop} / 地${format.marginBottom} / ノド${format.marginInner}${format.gutterNote || ''} / 小口${format.marginOuter}`,
      font: `${font.size}pt / 行送り ${formatLineHeightLabel(h, font.size)}`,
      grid: `1行 ${format.colsPerLine}字 / 1頁 ${format.linesPerPage}行`,
      columns: cols === 2 ? `2段（段間 ${DEFAULT_COLUMN_GAP_MM}mm）` : '1段',
      body: `版面 ${body.width.toFixed(1)}×${body.height.toFixed(1)}mm`,
      bleed,
      nonbule: nonbulePositionLabel(nonbulePosition || 'spread'),
    };
  }

  function resolveDraftSettings(data) {
    const input = data || {};
    let formatId = 'a6';
    let bleed = 'on';
    const rawId = input.formatId ? String(input.formatId) : '';

    if (typeof input.bleed === 'string' && (input.bleed === 'on' || input.bleed === 'off')) {
      bleed = input.bleed;
    } else if (input.bleedId === '0') {
      bleed = 'off';
    } else if (input.bleedId === '1') {
      bleed = 'on';
    } else if (rawId.endsWith('-bleed')) {
      bleed = 'on';
    } else if (FORMATS[rawId]) {
      bleed = 'off';
    } else if (rawId === 'bunko' || rawId === 'shinsho') {
      bleed = 'on';
    }

    if (rawId.endsWith('-bleed')) {
      formatId = rawId.replace('-bleed', '');
    } else if (FORMATS[rawId]) {
      formatId = rawId;
    } else if (LEGACY_FORMAT_MAP[rawId]) {
      formatId = LEGACY_FORMAT_MAP[rawId];
    }

    if (!FORMATS[formatId]) formatId = 'a6';
    return { formatId, bleed };
  }

  function bleedMmFromSetting(bleed) {
    return bleed === 'on' ? DEFAULT_BLEED_MM : 0;
  }

  window.NyukoData = {
    FORMATS,
    FORMAT_ORDER: ['a6', 'b6', 'a5', 'b5'],
    FONTS,
    MM_TO_PX,
    mmToPx,
    bodySize,
    summaryText,
    computeGutter,
    effectiveMargins,
    applyMargins,
    marginLimitsForFormat,
    nonbuleBodyGapMm,
    NONBULE_BODY_GAP_RATIO,
    resolveDraftSettings,
    bleedMmFromSetting,
    BLEED_OPTIONS,
    DEFAULT_BLEED_MM,
    NONBULE_POSITIONS,
    NONBULE_START_ANCHORS,
    nonbulePositionLabel,
    clampNonbuleStartPage,
    normalizeNonbuleStartAnchor,
    COLUMN_COUNTS,
    WRITING_DIRECTIONS,
    CHAPTER_MODES,
    DEFAULT_COLUMN_GAP_MM,
    DEFAULT_PAGE_SPACERS,
    normalizePageSpacers,
    lineHeightFromH,
    hFromLineHeight,
    snapLineHeightH,
    formatLineHeightLabel,
    H_MM,
    lineGapMm,
  };
})();
