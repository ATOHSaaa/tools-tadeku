/** genko/index.html から切り出した原稿用紙プレビュー(読み取り専用) + Etude 縦書き画像 */
(function (global) {
  const COLS = 20;
  const ROWS = 20;
  const PER_PAGE = COLS * ROWS;
  /** Etude 縦書き画像: 字詰めは固定、行数スライダーは列数（右→左の行） */
  const ETUDE_COLS = 18;
  const ETUDE_ROWS = 26;

  const KUTOUTEN = new Set([...'、。，．,.']);
  const KINSOKU_CLOSE = new Set([...')）]］｝}〕〉》」』】〙〗｠»']);
  const KINSOKU_END = new Set([...'(（[［｛{〔〈《「『【〘〖｟«']);

  const VERT_FORMS = {
    '「': '﹁', '」': '﹂', '『': '﹃', '』': '﹄',
    '（': '︵', '）': '︶', '(': '︵', ')': '︶',
    '〔': '︹', '〕': '︺', '［': '︻', '］': '︼', '[': '︻', ']': '︼',
    '｛': '︷', '｝': '︸', '{': '︷', '}': '︸',
    '【': '︻', '】': '︼', '〖': '︗', '〗': '︘',
    '〈': '︿', '〉': '﹀', '《': '︽', '》': '︾',
  };

  // もともと縦形／正立のままにする記号
  const UPRIGHT_SPECIAL = new Set('々〻〱・ゝゞヽヾ|｜');
  // 長音・ダッシュ類は SVG 縦組み（回転だとフォント依存で反転しやすい）
  const CANVAS_VERTICAL_ROTATE = new Set('ーｰ―─‐‑–—－−');
  // リーダー・波ダッシュ・半角括弧・引用符・演算子など横組み約物
  const ROTATE_SIDEWAYS = new Set(
    '…‥⋯'
    + '=＝+＋*＊/／\\＼~～〜`｀@＠#＃$＄%％&＆^＾<>＜＞«»‹›:：;；_'
    + '-﹣'
    + '!?'
    + '()[]{}'
    + '"\'“”‘’'
  );
  const ETUDE_FONT_SCALES = [0.92, 0.90, 0.82, 0.78, 0.72, 0.68, 0.60, 0.58, 0.52, 0.48];
  const EXPORT_FONT_FAMILY = 'Hiragino Mincho ProN, Yu Mincho, Noto Serif JP, YuMincho, serif';
  const vGlyphCache = new Map();

  function isKutouten(ch) { return ch !== undefined && KUTOUTEN.has(ch); }
  function isClose(ch) { return ch !== undefined && KINSOKU_CLOSE.has(ch); }
  function isExclamationOrQuestion(ch) {
    return ch === '！' || ch === '？' || ch === '!' || ch === '?';
  }
  function canHang(ch) {
    return isKutouten(ch) || isExclamationOrQuestion(ch) || isClose(ch);
  }
  function isEndForbidden(ch) { return ch !== undefined && KINSOKU_END.has(ch); }
  function tokenRole(ch) {
    if (isKutouten(ch)) return 'kutouten';
    if (isClose(ch)) return 'close';
    if (isEndForbidden(ch)) return 'open';
    return 'text';
  }
  function vForm(ch) { return VERT_FORMS[ch] || ch; }
  function normalizeDrawChar(ch) {
    if (ch === ',' || ch === '，') return '、';
    if (ch === '.' || ch === '．') return '。';
    return ch;
  }
  function isCjkScriptChar(ch) {
    if (!ch) return false;
    const c = ch.codePointAt(0);
    return (c >= 0x3040 && c <= 0x309F)
      || (c >= 0x30A0 && c <= 0x30FF)
      || (c >= 0x4E00 && c <= 0x9FFF)
      || (c >= 0x3400 && c <= 0x4DBF)
      || (c >= 0xF900 && c <= 0xFAFF);
  }
  function isUprightYakumono(ch) {
    // 句読点・全角！？は正立。半角 !? は回転
    return isKutouten(ch) || ch === '！' || ch === '？';
  }
  function needsCanvasVerticalRotate(ch) { return ch !== undefined && CANVAS_VERTICAL_ROTATE.has(ch); }
  function needsSidewaysDraw(ch) {
    if (ch === undefined) return false;
    const c = normalizeDrawChar(ch);
    if (!c || /\s/.test(c)) return false;
    if (UPRIGHT_SPECIAL.has(c)) return false;
    if (isUprightYakumono(c)) return false;
    if (needsCanvasVerticalRotate(c)) return false;
    // 全角括弧は縦組み字形を優先（半角は下で回転）
    if (Object.prototype.hasOwnProperty.call(VERT_FORMS, c) && !/[()\[\]{}]/.test(c)) return false;
    if (ROTATE_SIDEWAYS.has(c)) return true;
    if (/[A-Za-z0-9]/.test(c)) return true;
    // CJK 以外の記号は原則 90° 回転（漏れ防止）
    if (!isCjkScriptChar(c)) return true;
    return false;
  }
  function needsSvgVerticalGlyph(ch) {
    if (ch === undefined) return false;
    const c = normalizeDrawChar(ch);
    // 長音・句読点・括弧・！？は SVG 縦組みで字枠内の正しい位置に置く
    return needsCanvasVerticalRotate(c)
      || isKutouten(c)
      || isExclamationOrQuestion(c)
      || isClose(c)
      || isEndForbidden(c);
  }
  function verticalSvgChar(ch) {
    const c = normalizeDrawChar(ch);
    if (isClose(c) || isEndForbidden(c)) return vForm(c);
    return c;
  }
  function drawSidewaysGlyph(ctx, x, y, ch) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
  function escapeXml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function markFor(docArr, token, slot) {
    return { token, char: docArr[token], role: tokenRole(docArr[token]), slot };
  }
  function makeNormalCell(docArr, token) {
    return { kind: 'normal', main: token, mainChar: docArr[token], marks: [], tokens: [token], role: tokenRole(docArr[token]) };
  }
  function makeYakumonoPairCell(docArr, a, b) {
    return { kind: 'yakumonoPair', main: null, marks: [markFor(docArr, a, 'auto'), markFor(docArr, b, 'auto')], tokens: [a, b] };
  }
  function normalizeCellKind(cell) {
    const hasKutouten = cell.marks.some((m) => m.role === 'kutouten');
    const hasClose = cell.marks.some((m) => m.role === 'close');
    if (cell.main === null) {
      cell.kind = hasKutouten && hasClose ? 'yakumonoPair' : 'normal';
      return;
    }
    if (hasKutouten && hasClose) cell.kind = 'hangBoth';
    else if (hasKutouten) cell.kind = 'hangKutouten';
    else if (hasClose) cell.kind = 'hangClose';
    else if (cell.marks.length > 0) cell.kind = 'hang';
    else cell.kind = 'normal';
  }
  function hangMarkOnCell(lastCell, docArr, token) {
    if (lastCell.kind === 'normal' && lastCell.role === 'close' && isKutouten(docArr[token])) {
      return makeYakumonoPairCell(docArr, token, lastCell.main);
    }
    addMarkToCell(lastCell, docArr, token);
    return lastCell;
  }
  function pullHangToPreviousColumn(lines, docArr, token) {
    if (!lines.length) return false;
    const prevLine = lines[lines.length - 1];
    if (prevLine.nl !== null || !prevLine.cells.length) return false;
    const lastIdx = prevLine.cells.length - 1;
    prevLine.cells[lastIdx] = hangMarkOnCell(prevLine.cells[lastIdx], docArr, token);
    return true;
  }
  function addMarkToCell(cell, docArr, token) {
    cell.marks.push(markFor(docArr, token, 'auto'));
    cell.tokens.push(token);
    normalizeCellKind(cell);
  }

  function computeColumns(docArr, rowsPerColumn) {
    const maxRows = rowsPerColumn ?? ROWS;
    const lines = [];
    let cur = [];
    const flush = (nl) => { lines.push({ cells: cur, nl }); cur = []; };
    for (let i = 0; i < docArr.length; i++) {
      const ch = docArr[i];
      if (ch === '\n') { flush(i); continue; }
      if (isClose(ch) && cur.length > 0) {
        const lastCell = cur[cur.length - 1];
        if (lastCell.kind === 'normal' && isKutouten(docArr[lastCell.main])) {
          cur[cur.length - 1] = makeYakumonoPairCell(docArr, lastCell.main, i);
          continue;
        }
        if (lastCell.main !== null && lastCell.marks.some((m) => m.role === 'kutouten')) {
          addMarkToCell(lastCell, docArr, i);
          continue;
        }
      }
      if (isKutouten(ch) && cur.length > 0) {
        const lastCell = cur[cur.length - 1];
        if (lastCell.kind === 'normal' && isClose(docArr[lastCell.main])) {
          cur[cur.length - 1] = makeYakumonoPairCell(docArr, i, lastCell.main);
          continue;
        }
        if (lastCell.main !== null && lastCell.marks.some((m) => m.role === 'close')) {
          addMarkToCell(lastCell, docArr, i);
          continue;
        }
      }
      if (cur.length >= maxRows) {
        if (canHang(ch)) {
          const lastCell = cur[cur.length - 1];
          cur[cur.length - 1] = hangMarkOnCell(lastCell, docArr, i);
          continue;
        }
        if (isEndForbidden(docArr[cur[cur.length - 1].main])) {
          const moved = cur.splice(cur.length - 1);
          flush(null);
          cur = moved;
        } else {
          flush(null);
        }
      }
      if (cur.length === 0 && canHang(ch) && pullHangToPreviousColumn(lines, docArr, i)) {
        continue;
      }
      cur.push(makeNormalCell(docArr, i));
    }
    if (cur.length > 0) flush(null);
    return lines;
  }

  function columnsToText(columns, docArr) {
    let min = Infinity;
    let max = -1;
    for (const col of columns) {
      for (const cell of col.cells) {
        for (const ti of cell.tokens) {
          if (ti < min) min = ti;
          if (ti > max) max = ti;
        }
      }
    }
    if (max < 0) return '';
    return docArr.slice(min, max + 1).join('');
  }

  function splitVerticalText(text, rowsPerPage, colsPerPage) {
    const normalized = String(text || '').replace(/\r\n/g, '\n');
    if (!normalized.trim()) return [''];
    const docArr = [...normalized];
    const columns = computeColumns(docArr, rowsPerPage);
    const maxCols = colsPerPage || COLS;
    const parts = [];
    for (let i = 0; i < columns.length; i += maxCols) {
      const part = columnsToText(columns.slice(i, i + maxCols), docArr);
      if (part) parts.push(part);
    }
    return parts.length ? parts : [''];
  }

  function computeLayout(docArr, opts) {
    const rows = (opts && opts.rows) || ROWS;
    const colsPerPage = (opts && opts.cols) || COLS;
    const cellViewAt = new Map();
    const lines = computeColumns(docArr, rows);
    let colNum = 0;
    let lastLinear = -1;
    for (const line of lines) {
      for (let r = 0; r < line.cells.length; r++) {
        const cellObj = line.cells[r];
        const col = colNum;
        const row = r;
        const page = Math.floor(col / colsPerPage);
        const colInPage = col % colsPerPage;
        const cell = colInPage * rows + row;
        cellViewAt.set(`${page}:${cell}`, cellObj);
        lastLinear = col * rows + row;
      }
      colNum++;
    }
    const pageCount = Math.max(1, Math.ceil(lines.length / colsPerPage));
    return { cellViewAt, pageCount, lines, lastLinear, rows, colsPerPage };
  }

  function markText(cellView, role) {
    return cellView.marks.filter((m) => m.role === role).map((m) => m.char).join('');
  }

  function vGlyphKey(px, ch, mode) { return (mode || 'vert') + '|' + px + '|' + ch; }

  function buildVerticalGlyphImage(px, ch, fontFamily) {
    const size = px * 2;
    const family = fontFamily || EXPORT_FONT_FAMILY;
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>` +
      `<text x='${size / 2}' y='${size / 2}' font-family='${family}' ` +
      `font-size='${px}' fill='black' text-anchor='middle' dominant-baseline='central' ` +
      `writing-mode='vertical-rl' style='text-orientation:mixed'>${escapeXml(ch)}</text></svg>`;
    const img = new Image();
    const ready = new Promise((res) => { img.onload = () => res(); img.onerror = () => res(); });
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return { img, size, ready };
  }

  /** 横組み字形を 90° 時計回りにした画像（約物・ラテン向け） */
  function buildSidewaysGlyphImage(px, ch, fontFamily) {
    const size = px * 2;
    const family = fontFamily || EXPORT_FONT_FAMILY;
    const cx = size / 2;
    const cy = size / 2;
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>` +
      `<g transform='translate(${cx} ${cy}) rotate(90)'>` +
      `<text x='0' y='0' font-family='${family}' font-size='${px}' fill='black' ` +
      `text-anchor='middle' dominant-baseline='central'>${escapeXml(ch)}</text>` +
      `</g></svg>`;
    const img = new Image();
    const ready = new Promise((res) => { img.onload = () => res(); img.onerror = () => res(); });
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    return { img, size, ready };
  }

  async function preloadGlyphs(pxList, chars, fontFamily, mode) {
    const build = mode === 'side' ? buildSidewaysGlyphImage : buildVerticalGlyphImage;
    const ps = [];
    for (const px of pxList) {
      for (const ch of chars) {
        const key = vGlyphKey(px, ch, mode);
        if (!vGlyphCache.has(key)) {
          const g = build(px, ch, fontFamily);
          vGlyphCache.set(key, g);
          ps.push(g.ready);
        }
      }
    }
    await Promise.all(ps);
  }

  async function preloadVerticalGlyphs(pxList, chars, fontFamily) {
    return preloadGlyphs(pxList, chars, fontFamily, 'vert');
  }

  function findCachedGlyph(px, ch, mode) {
    let g = vGlyphCache.get(vGlyphKey(px, ch, mode));
    if (g) return g;
    let best = null;
    let bestDiff = Infinity;
    const prefix = (mode || 'vert') + '|';
    for (const [key, val] of vGlyphCache) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const sep = rest.indexOf('|');
      if (sep === -1 || rest.slice(sep + 1) !== ch) continue;
      const diff = Math.abs(parseInt(rest.slice(0, sep), 10) - px);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = val;
      }
    }
    return best;
  }

  function drawCachedGlyph(ctx, x, y, ch, px, mode) {
    const g = findCachedGlyph(px, ch, mode);
    if (g && g.img.complete && g.img.naturalWidth) {
      ctx.drawImage(g.img, x - g.size / 2, y - g.size / 2, g.size, g.size);
      return true;
    }
    return false;
  }

  function drawSvgVerticalGlyph(ctx, x, y, ch, px) {
    return drawCachedGlyph(ctx, x, y, ch, px, 'vert');
  }

  function drawSvgSidewaysGlyph(ctx, x, y, ch, px) {
    return drawCachedGlyph(ctx, x, y, ch, px, 'side');
  }

  function fontPxFromCtx(ctx) {
    const m = /(\d+(?:\.\d+)?)px/.exec(ctx.font || '');
    return m ? Math.round(parseFloat(m[1])) : 0;
  }

  function fillVerticalCellText(ctx, x, y, text, cellSize, anchor) {
    const align = (anchor && anchor.align) || 'center';
    const baseline = (anchor && anchor.baseline) || 'middle';
    const chars = [...text].map(normalizeDrawChar);
    if (!chars.length) return;
    const ch = chars[0];

    ctx.textAlign = align;
    ctx.textBaseline = baseline;

    if (chars.length === 1 && needsSvgVerticalGlyph(ch)) {
      const px = fontPxFromCtx(ctx) || Math.round(cellSize * 0.9);
      if (drawSvgVerticalGlyph(ctx, x, y, verticalSvgChar(ch), px)) return;
    }
    if (chars.length === 1 && needsSidewaysDraw(ch)) {
      const px = fontPxFromCtx(ctx) || Math.round(cellSize * 0.9);
      if (drawSvgSidewaysGlyph(ctx, x, y, ch, px)) return;
      drawSidewaysGlyph(ctx, x, y, ch);
      return;
    }
    ctx.fillText(chars.map((c) => vForm(c)).join(''), x, y);
  }

  function getVerticalSlotLayout(cell, text, slot) {
    const s = cell.size;
    const ch = text ? normalizeDrawChar([...text][0]) : '';
    // Etude 文庫レイアウト向け: ぶら下げが最終行の下に落ちて揃いが崩れるのを防ぐ
    const compact = cell.compactHang;

    switch (slot) {
      case 'slot-main-raised':
        return {
          x: cell.x + s * 0.5,
          y: cell.y + s * (compact ? 0.40 : 0.36),
          align: 'center',
          baseline: 'middle',
          fontScale: compact ? 0.78 : 0.72,
        };
      case 'slot-upper':
        return { x: cell.x + s * 0.5, y: cell.y + s * 0.28, align: 'center', baseline: 'middle', fontScale: 0.82 };
      case 'slot-lower':
        return {
          x: cell.x + s * 0.55,
          y: cell.y + s * (compact ? 0.68 : 0.78),
          align: 'center',
          baseline: 'middle',
          fontScale: compact ? 0.60 : 0.68,
        };
      case 'slot-lower-both':
        return {
          x: cell.x + s * 0.55,
          y: cell.y + s * (compact ? 0.60 : 0.68),
          align: 'center',
          baseline: 'middle',
          fontScale: compact ? 0.48 : 0.52,
        };
      case 'slot-lower-deep':
        return {
          x: cell.x + s * 0.5,
          y: cell.y + s * (compact ? 0.66 : 0.72),
          align: 'center',
          baseline: 'middle',
          fontScale: compact ? 0.72 : 0.78,
        };
      case 'slot-lower-deep-both':
        return {
          x: cell.x + s * 0.55,
          y: cell.y + s * (compact ? 0.78 : 0.88),
          align: 'center',
          baseline: 'middle',
          fontScale: compact ? 0.58 : 0.68,
        };
      default:
        break;
    }

    // SVG 縦書き字形は em 内で正しい位置に来るので、マス中央に置く
    if (needsSidewaysDraw(ch)) {
      return { x: cell.x + s * 0.5, y: cell.y + s * 0.5, align: 'center', baseline: 'middle', fontScale: 0.92 };
    }
    if (/[ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ]/.test(ch)) {
      return { x: cell.x + s * 0.62, y: cell.y + s * 0.42, align: 'center', baseline: 'middle', fontScale: 0.82 };
    }
    return { x: cell.x + s * 0.5, y: cell.y + s * 0.5, align: 'center', baseline: 'middle', fontScale: 0.90 };
  }

  function drawVerticalCellGlyph(ctx, cell, text, slot, fontFamily) {
    if (!text) return;
    const raw = [...text].map(normalizeDrawChar).join('');
    if (!raw) return;
    const layout = getVerticalSlotLayout(cell, raw, slot);
    const px = Math.max(11, Math.round(cell.size * layout.fontScale));
    const ch = [...raw][0];

    ctx.save();
    ctx.fillStyle = '#1a1a1a';

    if (needsSidewaysDraw(ch)) {
      if (drawSvgSidewaysGlyph(ctx, layout.x, layout.y, ch, px)) {
        ctx.restore();
        return;
      }
      ctx.font = `${px}px ${fontFamily}`;
      drawSidewaysGlyph(ctx, layout.x, layout.y, ch);
      ctx.restore();
      return;
    }

    if (needsSvgVerticalGlyph(ch) && drawSvgVerticalGlyph(ctx, layout.x, layout.y, verticalSvgChar(ch), px)) {
      ctx.restore();
      return;
    }

    ctx.font = `${px}px ${fontFamily}`;
    fillVerticalCellText(ctx, layout.x, layout.y, raw, cell.size, layout);
    ctx.restore();
  }

  function drawCellText(ctx, cell, text, cls) {
    drawVerticalCellGlyph(ctx, cell, text, cls, EXPORT_FONT_FAMILY);
  }

  function drawCellViewOnCanvas(ctx, cellView, cell) {
    if (!cellView) return;
    if (cellView.kind === 'normal') {
      drawCellText(ctx, cell, cellView.mainChar, 'normal');
      return;
    }
    if (cellView.kind === 'yakumonoPair') {
      drawCellText(ctx, cell, markText(cellView, 'kutouten'), 'slot-upper');
      drawCellText(ctx, cell, markText(cellView, 'close'), 'slot-lower-deep');
      return;
    }
    if (cellView.kind === 'hangKutouten') {
      drawCellText(ctx, cell, cellView.mainChar, 'slot-main-raised');
      drawCellText(ctx, cell, markText(cellView, 'kutouten'), 'slot-lower');
      return;
    }
    if (cellView.kind === 'hangClose') {
      drawCellText(ctx, cell, cellView.mainChar, 'slot-main-raised');
      drawCellText(ctx, cell, markText(cellView, 'close'), 'slot-lower-deep');
      return;
    }
    if (cellView.kind === 'hangBoth') {
      drawCellText(ctx, cell, cellView.mainChar, 'slot-main-raised');
      drawCellText(ctx, cell, markText(cellView, 'kutouten'), 'slot-lower-both');
      drawCellText(ctx, cell, markText(cellView, 'close'), 'slot-lower-deep-both');
    }
  }

  function cellGeometry(colIndex, row, cellSize, originX, originY, colCount, colPitch, pageRows) {
    const pitch = colPitch || cellSize;
    const x = originX + (colCount - 1 - colIndex) * pitch;
    const y = originY + row * cellSize;
    const lastRow = pageRows != null ? pageRows - 1 : null;
    return {
      x,
      y,
      size: cellSize,
      // 最終行のぶら下げはマス内に収め、隣の列との底辺揃えを崩さない
      compactHang: lastRow != null && row >= lastRow,
    };
  }

  async function ensureVerticalFonts(fontSize) {
    if (!document.fonts || !document.fonts.load) return;
    const families = [
      '"Hiragino Mincho ProN"',
      '"Yu Mincho"',
      '"Noto Serif JP"',
      '"Noto Sans JP"',
    ];
    try {
      await Promise.all(families.map((f) => document.fonts.load(fontSize + 'px ' + f)));
      await document.fonts.ready;
    } catch (_) { /* ignore */ }
  }

  function measureWrappedLines(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const ch of text) {
      const test = line + ch;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /**
   * 文庫判の縦書き画像。
   * 禁則・ぶら下げ・約物同居は genko と同じ computeColumns を使い、
   * 明朝体でマス目なしの本文として描画する。
   * rowsPerPage = 1列の字数（ページ高さ）、colsPerPage = 1枚の行数（ページ幅）。
   */
  async function renderEtudeVerticalImage({ prompt, body, partLabel, width, padding, fontSize, rowsPerPage, colsPerPage }) {
    const pad = padding ?? 28;
    const scale = 2;
    const maxPageH = 1520;
    const fontStack = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';
    const docArr = [...String(body || '').replace(/\r\n/g, '\n')];
    vGlyphCache.clear();

    let cellSize = fontSize || 30;
    await ensureVerticalFonts(cellSize);

    let layout;
    let headerBlock;
    let headerFs;
    let pageRows = Math.max(8, (rowsPerPage || ETUDE_ROWS) | 0);
    const pageColsTarget = Math.max(1, (colsPerPage || ETUDE_COLS) | 0);

    if (rowsPerPage || colsPerPage) {
      layout = computeLayout(docArr, { rows: pageRows, cols: 9999 });
    } else {
      for (let attempt = 0; attempt < 12; attempt++) {
        const footerH = partLabel ? Math.round(cellSize * 0.9) : 0;
        headerFs = Math.round(cellSize * 0.72);
        const headerMeasure = document.createElement('canvas').getContext('2d');
        headerMeasure.font = '700 ' + headerFs + 'px "Noto Sans JP", "Hiragino Sans", sans-serif';
        const headerTextW = headerMeasure.measureText('お題：' + (prompt || '')).width;
        const headerLines = measureWrappedLines(
          headerMeasure,
          'お題：' + (prompt || ''),
          Math.max(200, headerTextW),
        );
        headerBlock = pad + headerLines.length * headerFs * 1.55 + cellSize * 0.45;

        const bodyHeight = maxPageH - headerBlock - pad - footerH;
        const rows = Math.max(12, Math.floor(bodyHeight / cellSize));
        layout = computeLayout(docArr, { rows, cols: 9999 });
        pageRows = Math.max(1, ...layout.lines.map((line) => line.cells.length));
        const neededH = headerBlock + pageRows * cellSize + pad + footerH;
        if (neededH <= maxPageH || cellSize <= 14) break;
        cellSize = Math.max(14, cellSize * (maxPageH / neededH) * 0.98);
      }
    }

    headerFs = Math.round(cellSize * 0.72);
    const contentCols = Math.max(1, layout.lines.length);
    // 行数スライダーに合わせてページ幅を固定（最終ページも同じ横幅）
    const pageCols = Math.max(contentCols, pageColsTarget);
    const colPitch = Math.round(cellSize * 1.34);
    const bodyW = Math.max(cellSize, (pageCols - 1) * colPitch + cellSize);
    const W = Math.ceil(bodyW + pad * 2);
    const headerMeasure = document.createElement('canvas').getContext('2d');
    headerMeasure.font = '700 ' + headerFs + 'px "Noto Sans JP", "Hiragino Sans", sans-serif';
    const headerLines = measureWrappedLines(headerMeasure, 'お題：' + (prompt || ''), W - pad * 2);
    headerBlock = pad + headerLines.length * headerFs * 1.55 + cellSize * 0.45;
    const footerH = partLabel ? Math.round(cellSize * 0.9) : 0;
    // 字詰め固定なのでページ高さは行数スライダーで変わらない
    const bodyRows = pageRows;
    const hangBleed = Math.ceil(cellSize * 0.28);
    const H = Math.ceil(headerBlock + bodyRows * cellSize + hangBleed + pad + footerH);
    const bodyLeft = pad;
    const bodyTop = headerBlock;

    const vChars = new Set();
    const sideChars = new Set();
    for (const ch of docArr) {
      const c = normalizeDrawChar(ch);
      if (needsSvgVerticalGlyph(c)) vChars.add(verticalSvgChar(c));
      else if (needsSidewaysDraw(c)) sideChars.add(c);
    }
    const pxList = [...new Set(ETUDE_FONT_SCALES.map((s) => Math.max(12, Math.round(cellSize * s))))];
    if (vChars.size) await preloadGlyphs(pxList, [...vChars], fontStack, 'vert');
    if (sideChars.size) await preloadGlyphs(pxList, [...sideChars], fontStack, 'side');

    const canvas = document.createElement('canvas');
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#fdfcfa';
    ctx.fillRect(0, 0, W, H);

    // header
    ctx.fillStyle = '#1a1a1a';
    ctx.font = '700 ' + headerFs + 'px "Noto Sans JP", "Hiragino Sans", sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    let hy = pad;
    for (const line of headerLines) {
      ctx.fillText(line, pad, hy);
      hy += headerFs * 1.55;
    }

    // body: 約物は SVG writing-mode で縦書き字形を描画
    function drawCellView(ctx2, cellView, cell) {
      if (!cellView) return;
      if (cellView.kind === 'normal') {
        drawVerticalCellGlyph(ctx2, cell, cellView.mainChar, 'normal', fontStack);
        return;
      }
      if (cellView.kind === 'yakumonoPair') {
        drawVerticalCellGlyph(ctx2, cell, markText(cellView, 'kutouten'), 'slot-upper', fontStack);
        drawVerticalCellGlyph(ctx2, cell, markText(cellView, 'close'), 'slot-lower-deep', fontStack);
        return;
      }
      if (cellView.kind === 'hangKutouten') {
        drawVerticalCellGlyph(ctx2, cell, cellView.mainChar, 'slot-main-raised', fontStack);
        drawVerticalCellGlyph(ctx2, cell, markText(cellView, 'kutouten'), 'slot-lower', fontStack);
        return;
      }
      if (cellView.kind === 'hangClose') {
        drawVerticalCellGlyph(ctx2, cell, cellView.mainChar, 'slot-main-raised', fontStack);
        drawVerticalCellGlyph(ctx2, cell, markText(cellView, 'close'), 'slot-lower-deep', fontStack);
        return;
      }
      if (cellView.kind === 'hangBoth') {
        drawVerticalCellGlyph(ctx2, cell, cellView.mainChar, 'slot-main-raised', fontStack);
        drawVerticalCellGlyph(ctx2, cell, markText(cellView, 'kutouten'), 'slot-lower-both', fontStack);
        drawVerticalCellGlyph(ctx2, cell, markText(cellView, 'close'), 'slot-lower-deep-both', fontStack);
      }
    }

    for (let colIndex = 0; colIndex < layout.lines.length; colIndex++) {
      const line = layout.lines[colIndex];
      for (let row = 0; row < line.cells.length; row++) {
        const geom = cellGeometry(
          colIndex,
          row,
          cellSize,
          bodyLeft,
          bodyTop,
          pageCols,
          colPitch,
          bodyRows,
        );
        drawCellView(ctx, line.cells[row], geom);
      }
    }

    if (partLabel) {
      ctx.fillStyle = '#999';
      ctx.font = '700 ' + Math.round(cellSize * 0.48) + 'px "Noto Sans JP", sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(partLabel, W - pad, H - pad * 0.55);
      ctx.textAlign = 'left';
    }

    return canvas;
  }

  function paintCellContent(cell, cellView) {
    cell.className = 'genko-cell';
    cell.textContent = '';
    if (!cellView) return;
    if (cellView.kind === 'normal') {
      cell.classList.add('cell-normal');
      const ch = vForm(cellView.mainChar);
      if (needsSidewaysDraw(ch)) cell.classList.add('cell-sideways');
      cell.textContent = ch;
      return;
    }
    if (cellView.kind === 'yakumonoPair') {
      cell.classList.add('cell-pair');
      const u = document.createElement('span'); u.className = 'cell-mark slot-upper'; u.textContent = markText(cellView, 'kutouten');
      const l = document.createElement('span'); l.className = 'cell-mark slot-lower-deep'; l.textContent = markText(cellView, 'close');
      cell.append(u, l);
      return;
    }
    if (cellView.kind === 'hangKutouten' || cellView.kind === 'hangClose' || cellView.kind === 'hangBoth') {
      cell.classList.add(cellView.kind === 'hangKutouten' ? 'cell-hang-kutouten' : cellView.kind === 'hangClose' ? 'cell-hang-close' : 'cell-hang-both');
      const main = document.createElement('span'); main.className = 'cell-main slot-main-raised'; main.textContent = vForm(cellView.mainChar);
      cell.appendChild(main);
      const kt = markText(cellView, 'kutouten');
      const cl = markText(cellView, 'close');
      if (kt) { const s = document.createElement('span'); s.className = 'cell-mark slot-lower'; s.textContent = kt; cell.appendChild(s); }
      if (cl) { const s = document.createElement('span'); s.className = 'cell-mark slot-lower-deep'; s.textContent = cl; cell.appendChild(s); }
      return;
    }
    cell.classList.add('cell-normal');
    cell.textContent = vForm(cellView.mainChar || '');
  }

  /**
   * @param {HTMLElement} host
   * @param {string} text
   * @param {{ cellPx?: number }} opts
   */
  function renderPreview(host, text, opts) {
    const cellPx = (opts && opts.cellPx) || 22;
    const docArr = [...(text || '').replace(/\r\n/g, '\n')];
    const L = computeLayout(docArr);
    host.innerHTML = '';
    host.style.setProperty('--genko-cell', cellPx + 'px');
    const info = document.createElement('div');
    info.className = 'genko-preview-info';
    info.textContent = `${L.pageCount} 枚 / ${L.lines.reduce((n, ln) => n + ln.cells.length, 0)} 字`;
    host.appendChild(info);
    const scroll = document.createElement('div');
    scroll.className = 'genko-pages-scroll';
    for (let p = 0; p < L.pageCount; p++) {
      const page = document.createElement('div');
      page.className = 'genko-page';
      page.dataset.page = String(p + 1);
      for (let ci = 0; ci < PER_PAGE; ci++) {
        const cell = document.createElement('div');
        paintCellContent(cell, L.cellViewAt.get(`${p}:${ci}`));
        page.appendChild(cell);
      }
      scroll.appendChild(page);
    }
    host.appendChild(scroll);
  }

  global.TadekuGenkoRender = {
    renderPreview,
    renderEtudeVerticalImage,
    computeLayout,
    computeColumns,
    columnsToText,
    splitVerticalText,
    PER_PAGE,
    COLS,
    ROWS,
    ETUDE_COLS,
    ETUDE_ROWS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
