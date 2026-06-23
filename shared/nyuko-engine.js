(function () {
  const { mmToPx } = window.NyukoData;

  function graphemes(str) {
    if (!str) return [];
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      return [...new Intl.Segmenter('ja', { granularity: 'grapheme' }).segment(str)]
        .map((s) => s.segment);
    }
    return [...str];
  }

  function formatManuscript(text) {
    return (text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/！？/g, '\u2049')
      .replace(/？！/g, '\u2049')
      .replace(/!!/g, '\u203C')
      .replace(/！！/g, '\u203C')
      .replace(/!\?/g, '\u2049')
      .replace(/\?!/g, '\u2049')
      .replace(/\?\?/g, '\u2047')
      .replace(/？？/g, '\u2047');
  }

  function parseLine(line) {
    const section = line.match(/^###\s+(.+)$/);
    if (section) return { type: 'section', text: section[1].trim() };
    const chapter = line.match(/^##\s+(.+)$/);
    if (chapter) return { type: 'chapter', text: chapter[1].trim() };
    return { type: 'body', text: line };
  }

  // --- ルビ / 縦中横 トークン化（従来ロジックを流用） ---

  function parsePixivRubyInner(inner) {
    const gt = inner.match(/^(.+?)\s*>\s*(.+)$/);
    if (gt) return { base: gt[1].trim(), ruby: gt[2].trim() };
    const space = inner.lastIndexOf(' ');
    if (space > 0) {
      return { base: inner.slice(0, space).trim(), ruby: inner.slice(space + 1).trim() };
    }
    return null;
  }

  function tokenizePlain(chunk) {
    const tokens = [];
    const chars = graphemes(chunk);
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      const next = chars[i + 1];
      // 2桁数字は縦中横で1マスに、1桁数字は縦中横（正立1文字）にする
      if (/\d/.test(ch) && next && /\d/.test(next)) {
        tokens.push({ kind: 'tcy', text: ch + next });
        i += 1;
        continue;
      }
      if (/\d/.test(ch)) {
        tokens.push({ kind: 'tcy', text: ch });
        continue;
      }
      tokens.push({ kind: 'char', text: ch });
    }
    return tokens;
  }

  function parseDendenRuby(inner) {
    const parts = inner.split('|');
    if (parts.length < 2) return [];
    const base = parts[0];
    const rubyParts = parts.slice(1);
    const baseChars = graphemes(base);
    if (rubyParts.length === 1) {
      return [{ kind: 'ruby', base, ruby: rubyParts[0] }];
    }
    if (rubyParts.length === baseChars.length) {
      return baseChars.map((ch, i) => ({ kind: 'ruby', base: ch, ruby: rubyParts[i] }));
    }
    return [{ kind: 'ruby', base, ruby: rubyParts.join('') }];
  }

  function parseHtmlRuby(inner) {
    const tokens = [];
    const stripped = inner.replace(/<\/?rb>/gi, '');
    const re = /([^<]+?)<rt>([^<]+?)<\/rt>/gi;
    let last = 0;
    let match;
    while ((match = re.exec(stripped)) !== null) {
      const before = stripped.slice(last, match.index).replace(/<[^>]+>/g, '');
      if (before) tokenizePlain(before).forEach((t) => tokens.push(t));
      tokens.push({ kind: 'ruby', base: match[1], ruby: match[2] });
      last = re.lastIndex;
    }
    const tail = stripped.slice(last).replace(/<[^>]+>/g, '');
    if (tail) tokenizePlain(tail).forEach((t) => tokens.push(t));
    return tokens;
  }

  function pushRubyTokens(tokens, parsed) {
    if (!parsed || !parsed.base) return;
    tokens.push({ kind: 'ruby', base: parsed.base, ruby: parsed.ruby });
  }

  function aozoraBaseFromBefore(before) {
    const pipeIdx = Math.max(before.lastIndexOf('｜'), before.lastIndexOf('|'));
    if (pipeIdx >= 0) {
      return { plainPrefix: before.slice(0, pipeIdx), base: before.slice(pipeIdx + 1) };
    }

    const kanjiTail = before.match(/([\u3400-\u9fff\uf900-\ufaff]+)$/);
    if (kanjiTail) {
      const base = kanjiTail[1];
      const prefix = before.slice(0, before.length - base.length);
      if (!prefix) return { plainPrefix: '', base };

      if (/(?:の|は|が|を|に|で|と|も|へ|や|から|まで|より|って)$/.test(prefix)) {
        return { plainPrefix: prefix, base };
      }

      const firstHira = prefix.search(/[\u3040-\u309f]/);
      const hasKanjiBeforeHira = firstHira > 0 && /[\u3400-\u9fff\uf900-\ufaff]/.test(prefix.slice(0, firstHira));
      if (firstHira >= 0 && hasKanjiBeforeHira) {
        return { plainPrefix: '', base: before };
      }

      if (/[\u3040-\u309f]/.test(prefix) && !/[\u3400-\u9fff\uf900-\ufaff]/.test(prefix)) {
        return { plainPrefix: prefix, base };
      }

      return { plainPrefix: prefix, base };
    }

    let start = before.length;
    while (start > 0 && before[start - 1] !== ' ' && before[start - 1] !== '\t') {
      start -= 1;
    }
    return { plainPrefix: before.slice(0, start), base: before.slice(start) };
  }

  function matchAozoraRuby(rest) {
    const openIdx = rest.indexOf('《');
    if (openIdx === -1) return null;
    const closeIdx = rest.indexOf('》', openIdx + 1);
    if (closeIdx === -1) return null;

    const before = rest.slice(0, openIdx);
    const ruby = rest.slice(openIdx + 1, closeIdx);
    const length = closeIdx + 1;
    if (!before) return { type: 'orphan', length };

    const { plainPrefix, base } = aozoraBaseFromBefore(before);
    if (!base) return { type: 'orphan', length };
    return { type: 'ruby', plainPrefix, base, ruby, length };
  }

  function nextRubyAt(rest) {
    let min = -1;
    const consider = (i) => {
      if (i >= 0 && (min === -1 || i < min)) min = i;
    };

    consider(rest.search(/\[\[rb:/i));
    consider(rest.search(/<ruby[\s>]/i));
    consider(rest.search(/\{[^{}|]+\|[^}]+\}/));

    const openIdx = rest.indexOf('《');
    if (openIdx !== -1 && rest.indexOf('》', openIdx + 1) === -1) {
      consider(openIdx === 0 ? 0 : openIdx);
    }

    return min;
  }

  // 《…》が閉じないまま長く続く行はルビ解析せずそのまま流す（未閉じ解析の無限ループ防止）
  const MAX_UNCLOSED_RUBY_CHARS = 48;

  function lineHasOverlongUnclosedRuby(line) {
    const open = line.indexOf('《');
    if (open === -1) return false;
    if (line.indexOf('》', open + 1) !== -1) return false;
    return line.length - open - 1 > MAX_UNCLOSED_RUBY_CHARS;
  }

  function tokenizeLine(line) {
    if (lineHasOverlongUnclosedRuby(line)) {
      return tokenizePlain(line);
    }

    const tokens = [];
    let rest = line;

    while (rest.length > 0) {
      const htmlRuby = rest.match(/^<ruby(?:\s[^>]*)?>([\s\S]*?)<\/ruby>/i);
      if (htmlRuby) {
        parseHtmlRuby(htmlRuby[1]).forEach((t) => tokens.push(t));
        rest = rest.slice(htmlRuby[0].length);
        continue;
      }

      const pixiv = rest.match(/^\[\[rb:([^\]]+)\]\]/);
      if (pixiv) {
        pushRubyTokens(tokens, parsePixivRubyInner(pixiv[1]));
        rest = rest.slice(pixiv[0].length);
        continue;
      }

      const denden = rest.match(/^\{([^{}|]+)\|([^}]+)\}/);
      if (denden) {
        parseDendenRuby(denden[1] + '|' + denden[2]).forEach((t) => tokens.push(t));
        rest = rest.slice(denden[0].length);
        continue;
      }

      const aozora = matchAozoraRuby(rest);
      if (aozora) {
        if (aozora.type === 'ruby') {
          if (aozora.plainPrefix) {
            tokenizePlain(aozora.plainPrefix).forEach((t) => tokens.push(t));
          }
          tokens.push({ kind: 'ruby', base: aozora.base, ruby: aozora.ruby });
          rest = rest.slice(aozora.length);
          continue;
        }
        tokenizePlain(rest.slice(0, aozora.length)).forEach((t) => tokens.push(t));
        rest = rest.slice(aozora.length);
        continue;
      }

      const nextAt = nextRubyAt(rest);
      if (nextAt === -1) {
        tokenizePlain(rest).forEach((t) => tokens.push(t));
        break;
      }

      // 未閉じ《…》の先頭で complete にマッチしないとき進まずループするのを防ぐ
      if (nextAt === 0) {
        tokenizePlain(rest.slice(0, 1)).forEach((t) => tokens.push(t));
        rest = rest.slice(1);
        continue;
      }

      tokenizePlain(rest.slice(0, nextAt)).forEach((t) => tokens.push(t));
      rest = rest.slice(nextAt);
    }

    return tokens;
  }

  // --- 原稿 → atom 列（流し込み用の線形ストリーム） ---
  //   atom.t: 'char' | 'tcy' | 'ruby' | 'indent' | 'newline' | 'pagebreak' | 'heading'

  function tokenToAtom(tok) {
    if (tok.kind === 'ruby') return { t: 'ruby', base: tok.base, ruby: tok.ruby };
    if (tok.kind === 'tcy') return { t: 'tcy', text: tok.text };
    return { t: 'char', text: tok.text };
  }

  function mergeRubyContinuationLines(lines) {
    const merged = [];
    lines.forEach((line) => {
      if (
        line &&
        merged.length &&
        merged[merged.length - 1] !== '' &&
        !/^##\s/.test(line) &&
        !/^###\s/.test(line) &&
        /^《[^》]+》/.test(line)
      ) {
        merged[merged.length - 1] += line;
        return;
      }
      merged.push(line);
    });
    return merged;
  }

  function buildAtoms(text, options) {
    const opts = options || {};
    const chapterMode = opts.chapterMode || 'break-before';
    const atoms = [];
    const normalized = formatManuscript(text);
    const segments = normalized.split('[break]');
    let columnDirty = false;

    const fresh = () => {
      if (columnDirty) {
        atoms.push({ t: 'newline' });
        columnDirty = false;
      }
    };
    const lineGap = (lines) => {
      const n = Math.max(0, lines | 0);
      for (let i = 0; i < n; i++) atoms.push({ t: 'newline' });
      columnDirty = false;
    };
    const gapBeforeHeading = (lines) => {
      if (columnDirty) {
        atoms.push({ t: 'newline' });
        lines -= 1;
        columnDirty = false;
      }
      lineGap(Math.max(0, lines));
    };
    const segmentBreak = () => {
      atoms.push({ t: 'pagebreak' });
      columnDirty = false;
    };
    const chapterBreak = () => {
      if (atoms.length && atoms[atoms.length - 1].t !== 'pagebreak') {
        atoms.push({ t: 'pagebreak' });
      }
      columnDirty = false;
    };

    segments.forEach((segment, si) => {
      if (si > 0) segmentBreak();
      const lines = mergeRubyContinuationLines(segment.split('\n'));
      let afterBlank = false;
      let hasBodyContent = false;

      lines.forEach((line) => {
        if (line === '') {
          atoms.push({ t: 'newline' });
          columnDirty = false;
          afterBlank = true;
          return;
        }

        const parsed = parseLine(line);
        if (parsed.type === 'chapter') {
          afterBlank = false;
          if (chapterMode === 'break-before' || chapterMode === 'recto') {
            chapterBreak();
          }
          gapBeforeHeading(2);
          atoms.push({ t: 'heading', level: 'chapter', text: parsed.text });
          lineGap(2);
          hasBodyContent = false;
          return;
        }
        if (parsed.type === 'section') {
          afterBlank = false;
          gapBeforeHeading(2);
          atoms.push({ t: 'heading', level: 'section', text: parsed.text });
          lineGap(2);
          hasBodyContent = false;
          return;
        }

        // 本文行：空行のあとは1列空ける。行内の単一改行は fresh() で改行。
        if (afterBlank && hasBodyContent) {
          atoms.push({ t: 'newline' });
          columnDirty = true;
          afterBlank = false;
        } else {
          fresh();
          afterBlank = false;
        }
        tokenizeLine(parsed.text).forEach((tok) => {
          atoms.push(tokenToAtom(tok));
          columnDirty = true;
        });
        hasBodyContent = true;
      });
    });

    return atoms;
  }

  function splitGroups(atoms) {
    const groups = [[]];
    atoms.forEach((a) => {
      if (a.t === 'pagebreak') {
        groups.push([]);
      } else {
        groups[groups.length - 1].push(a);
      }
    });
    return groups;
  }

  // --- atom → HTML ---

  function esc(s) {
    return (s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function inlinePlainToHtml(text, vertical) {
    const useTcy = vertical !== false;
    let html = '';
    tokenizePlain(text).forEach((tok) => {
      if (tok.kind === 'tcy' && useTcy) {
        html += '<span class="nyuko-tcy">' + esc(tok.text) + '</span>';
      } else {
        html += esc(tok.text);
      }
    });
    return html;
  }

  function atomsToHtml(atoms, vertical) {
    const useTcy = vertical !== false;
    let html = '';
    let run = '';
    const flush = () => {
      if (run) {
        html += esc(run);
        run = '';
      }
    };
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      if (a.t === 'char') { run += a.text; continue; }
      if (a.t === 'indent') { run += '\u3000'; continue; }
      flush();
      if (a.t === 'newline') {
        html += '<br>';
      } else if (a.t === 'tcy') {
        if (useTcy) html += '<span class="nyuko-tcy">' + esc(a.text) + '</span>';
        else html += esc(a.text);
      } else if (a.t === 'ruby') {
        html += '<ruby>' + esc(a.base) + '<rt>' + esc(a.ruby) + '</rt></ruby>';
      } else if (a.t === 'heading') {
        html += '<span class="nyuko-heading nyuko-heading-' + a.level + '">' + inlinePlainToHtml(a.text, vertical) + '</span>';
      }
    }
    flush();
    return html;
  }

  function countAtomChars(atoms) {
    let n = 0;
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      if (a.t === 'char') n += a.text && a.text.trim() ? 1 : 0;
      else if (a.t === 'tcy') n += a.text ? a.text.length : 0;
      else if (a.t === 'ruby') n += graphemes(a.base).length;
      else if (a.t === 'heading') n += graphemes(a.text).length;
    }
    return n;
  }

  // --- 計測ベースのページ分割 ---

  function resolveLineHeight(opts, font) {
    const h = opts.lineHeightH != null ? opts.lineHeightH : 8;
    return window.NyukoData.lineHeightFromH(h, font.size);
  }

  function isHorizontal(writingDirection) {
    return writingDirection === 'horizontal';
  }

  function resolveColumnCount(opts) {
    const writingDirection = (opts && opts.writingDirection) || 'vertical';
    if (isHorizontal(writingDirection)) return 1;
    return opts && opts.columnCount === 2 ? 2 : 1;
  }

  function applyMeasureLayout(el, bodyWidthPx, bodyHeightPx, columnCount, danGapMm, writingDirection) {
    const horizontal = isHorizontal(writingDirection);
    const gap = mmToPx(danGapMm || window.NyukoData.DEFAULT_COLUMN_GAP_MM) + 'px';
    if (horizontal) {
      el.style.width = bodyWidthPx + 'px';
      if (columnCount > 1) {
        el.style.height = bodyHeightPx + 'px';
        el.style.columnCount = String(columnCount);
        el.style.columnGap = gap;
        el.style.columnFill = 'auto';
      } else {
        el.style.height = '';
        el.style.columnCount = '';
        el.style.columnGap = '';
      }
    } else {
      el.style.height = bodyHeightPx + 'px';
      if (columnCount > 1) {
        el.style.width = bodyWidthPx + 'px';
        el.style.columnCount = String(columnCount);
        el.style.columnGap = gap;
        el.style.columnFill = 'auto';
      } else {
        el.style.width = '';
        el.style.columnCount = '';
        el.style.columnGap = '';
      }
    }
  }

  function applyPageLayout(el, bodyWidthPx, bodyHeightPx, columnCount, danGapMm, scale) {
    const s = scale || 1;
    el.style.width = bodyWidthPx + 'px';
    el.style.height = bodyHeightPx + 'px';
    el.style.overflow = 'hidden';
    if (columnCount > 1) {
      el.style.columnCount = String(columnCount);
      el.style.columnGap = mmToPx(danGapMm || window.NyukoData.DEFAULT_COLUMN_GAP_MM) * s + 'px';
      el.style.columnFill = 'auto';
      el.classList.add('cols-' + columnCount);
    }
  }

  let measureBodyEl = null;
  let measureBodyCacheKey = '';

  function measureBodyCacheKeyFrom(font, bodyWidthPx, bodyHeightPx, lineHeight, letterSpacing, columnCount, danGapMm, writingDirection) {
    return [
      font.family,
      font.size,
      bodyWidthPx,
      bodyHeightPx,
      lineHeight,
      letterSpacing,
      columnCount || 1,
      danGapMm != null ? danGapMm : window.NyukoData.DEFAULT_COLUMN_GAP_MM,
      writingDirection || 'vertical',
    ].join('|');
  }

  function createMeasureBody(font, bodyWidthPx, bodyHeightPx, lineHeight, letterSpacing, columnCount, danGapMm, writingDirection) {
    const horizontal = isHorizontal(writingDirection);
    const host = document.getElementById('nyuko-export-host') || document.body;
    const cacheKey = measureBodyCacheKeyFrom(
      font, bodyWidthPx, bodyHeightPx, lineHeight, letterSpacing, columnCount, danGapMm, writingDirection
    );

    if (!measureBodyEl) {
      measureBodyEl = document.createElement('div');
      measureBodyEl.style.cssText =
        'position:absolute;top:0;left:0;visibility:hidden;pointer-events:none;' +
        'line-break:strict;white-space:normal;box-sizing:border-box;';
      host.appendChild(measureBodyEl);
    }

    if (measureBodyCacheKey !== cacheKey) {
      measureBodyEl.className = 'nyuko-measure-body' + (horizontal ? ' writing-horizontal' : ' writing-vertical');
      measureBodyEl.style.writingMode = horizontal ? 'horizontal-tb' : 'vertical-rl';
      measureBodyEl.style.textOrientation = 'mixed';
      measureBodyEl.style.fontFamily = font.family;
      measureBodyEl.style.fontSize = font.size + 'pt';
      measureBodyEl.style.lineHeight = String(lineHeight);
      measureBodyEl.style.letterSpacing = letterSpacing + 'em';
      applyMeasureLayout(measureBodyEl, bodyWidthPx, bodyHeightPx, columnCount || 1, danGapMm, writingDirection);
      measureBodyCacheKey = cacheKey;
    }

    measureBodyEl.innerHTML = '';
    return measureBodyEl;
  }

  function paginateGroup(groupAtoms, measure, bodyWidthPx, bodyHeightPx, columnCount, estimate, writingDirection) {
    const n = groupAtoms.length;
    if (n === 0) return [[]];

    const horizontal = isHorizontal(writingDirection);
    const EPS = 0.5;
    const limitW = bodyWidthPx + EPS;
    const limitH = bodyHeightPx + EPS;
    const pages = [];
    let start = 0;

    const fits = (end) => {
      measure.innerHTML = atomsToHtml(groupAtoms.slice(start, end), !horizontal);
      if (horizontal) {
        if (columnCount > 1) return measure.scrollWidth <= limitW;
        return measure.scrollHeight <= limitH;
      }
      if (columnCount > 1) return measure.scrollHeight <= limitH;
      return measure.scrollWidth <= limitW;
    };

    while (start < n) {
      if (start >= n) break;

      // 指数的に上限を広げて溢れる位置を探す
      let probe = Math.max(8, Math.floor(estimate));
      let hi = Math.min(n, start + probe);
      while (hi < n && fits(hi)) {
        probe *= 2;
        hi = Math.min(n, start + probe);
      }

      let end;
      if (hi >= n && fits(n)) {
        end = n;
      } else {
        // (start, hi] の範囲で収まる最大 end を二分探索
        let lo = start + 1;
        let h = hi;
        let best = start + 1;
        while (lo <= h) {
          const mid = (lo + h) >> 1;
          if (fits(mid)) {
            best = mid;
            lo = mid + 1;
          } else {
            h = mid - 1;
          }
        }
        end = best;
      }
      if (end <= start) end = start + 1;

      const page = groupAtoms.slice(start, end);
      pages.push(page);
      start = end;
    }

    return pages.length ? pages : [[]];
  }

  function paginate(text, format, font, options) {
    const opts = options || {};
    const lineHeight = resolveLineHeight(opts, font);
    const letterSpacing = opts.letterSpacing || 0;

    const atoms = buildAtoms(text, opts);
    const hasBreaks = formatManuscript(text).split('[break]').length > 1;

    if (!atoms.length) {
      return { pages: [], pageCount: 0, charCount: 0, hasBreaks, chapters: [] };
    }

    const body = window.NyukoData.bodySize(format);
    const bodyWidthPx = mmToPx(body.width);
    const bodyHeightPx = mmToPx(body.height);

    const columnCount = resolveColumnCount(opts);
    const danGapMm = opts.danGapMm != null ? opts.danGapMm : window.NyukoData.DEFAULT_COLUMN_GAP_MM;
    const writingDirection = opts.writingDirection || 'vertical';
    const horizontal = isHorizontal(writingDirection);

    const fontPx = font.size * (96 / 72);
    const charAdv = fontPx * (1 + letterSpacing);
    const lineAdv = fontPx * lineHeight;
    let estimate;
    if (horizontal) {
      const charsPerLine = Math.max(1, Math.floor(bodyWidthPx / Math.max(1, charAdv)));
      const linesPerPage = Math.max(1, Math.floor(bodyHeightPx / Math.max(1, lineAdv)));
      estimate = Math.max(8, charsPerLine * linesPerPage * columnCount);
    } else {
      const charsPerCol = Math.max(1, Math.floor(bodyHeightPx / Math.max(1, charAdv)));
      const colsPerPage = Math.max(1, Math.floor(bodyWidthPx / Math.max(1, lineAdv))) * columnCount;
      estimate = Math.max(8, charsPerCol * colsPerPage);
    }

    const measure = createMeasureBody(
      font, bodyWidthPx, bodyHeightPx, lineHeight, letterSpacing, columnCount, danGapMm, writingDirection
    );

    const groups = splitGroups(atoms);
    const pages = [];
    const chapters = [];

    try {
      groups.forEach((group) => {
        const chapterAtom = group.find((a) => a.t === 'heading' && a.level === 'chapter');
        if (chapterAtom && opts.chapterMode === 'recto' && (pages.length + 1) % 2 === 0) {
          pages.push([]);
        }
        const startPage = pages.length + 1;
        if (group.length === 0) {
          pages.push([]);
        } else {
          paginateGroup(group, measure, bodyWidthPx, bodyHeightPx, columnCount, estimate, writingDirection).forEach((p) => pages.push(p));
        }
        if (chapterAtom) {
          chapters.push({ title: chapterAtom.text, page: startPage });
        }
      });
    } finally {
      measure.innerHTML = '';
    }

    if (!pages.length) {
      return { pages: [], pageCount: 0, charCount: 0, hasBreaks, chapters: [] };
    }

    return {
      pages,
      pageCount: pages.length,
      charCount: countAtomChars(atoms),
      hasBreaks,
      chapters,
    };
  }

  function detectHeadings(text) {
    const lines = (text || '').replace(/\r\n/g, '\n').split('\n');
    const headings = [];
    lines.forEach((line, index) => {
      const parsed = parseLine(line);
      if (parsed.type === 'chapter' || parsed.type === 'section') {
        headings.push({ line: index + 1, level: parsed.type, title: parsed.text });
      }
    });
    return headings;
  }

  function detectChapters(text) {
    return detectHeadings(text).filter((h) => h.level === 'chapter');
  }

  function pageDimensions(format, bleedMm, scale) {
    const bleed = bleedMm || 0;
    const width = format.width + bleed * 2;
    const height = format.height + bleed * 2;
    return {
      widthMm: width,
      heightMm: height,
      widthPx: mmToPx(width) * scale,
      heightPx: mmToPx(height) * scale,
      bleedMm: bleed,
    };
  }

  function hasColophonContent(data) {
    if (!data) return false;
    return Boolean(
      (data.title && String(data.title).trim()) ||
      (data.author && String(data.author).trim()) ||
      (data.publisher && String(data.publisher).trim()) ||
      (data.date && String(data.date).trim()) ||
      (data.printer && String(data.printer).trim()) ||
      (data.email && String(data.email).trim()) ||
      (data.website && String(data.website).trim())
    );
  }

  function buildTocHtml(entries, writingDirection) {
    const items = (entries || []).filter((e) => e && String(e.title || '').trim());
    if (!items.length) return '';

    const horizontal = isHorizontal(writingDirection);
    let html = '<div class="nyuko-extra nyuko-toc' + (horizontal ? ' nyuko-toc-horizontal' : '') + '">';
    html += '<div class="nyuko-extra-title">目次</div><div class="nyuko-toc-list">';
    items.forEach((entry) => {
      const title = String(entry.title).trim();
      const pageNum = entry.page === '' || entry.page == null ? NaN : Number(entry.page);
      const displayPage = Number.isFinite(pageNum) && pageNum > 0 ? String(pageNum) : '';
      html += '<div class="nyuko-toc-item">';
      html += '<span class="nyuko-toc-item-title">' + esc(title) + '</span>';
      if (displayPage) {
        const pageHtml = !horizontal && displayPage.length <= 2
          ? '<span class="nyuko-tcy">' + esc(displayPage) + '</span>'
          : esc(displayPage);
        html += '<span class="nyuko-toc-item-leader" aria-hidden="true"></span>';
        html += '<span class="nyuko-toc-item-page">' + pageHtml + '</span>';
      }
      html += '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function buildColophonHtml(data) {
    const d = data || {};
    const title = (d.title || '').trim();
    const author = (d.author || '').trim();
    const publisher = (d.publisher || '').trim();
    const date = (d.date || '').trim();
    const printer = (d.printer || '').trim();
    const email = (d.email || '').trim();
    const website = (d.website || '').trim();

    let html = '<div class="nyuko-extra nyuko-colophon"><div class="nyuko-colophon-inner">';
    if (title) html += '<div class="nyuko-colophon-title">' + esc(title) + '</div>';
    if (date) html += '<div class="nyuko-colophon-line">' + esc(date) + '　発行</div>';
    if (author) html += '<div class="nyuko-colophon-line">著者　' + esc(author) + '</div>';
    if (publisher) html += '<div class="nyuko-colophon-line">発行者　' + esc(publisher) + '</div>';
    if (printer) html += '<div class="nyuko-colophon-line">印刷所　' + esc(printer) + '</div>';
    if (email) html += '<div class="nyuko-colophon-line">メール　' + esc(email) + '</div>';
    if (website) html += '<div class="nyuko-colophon-line">Web　' + esc(website) + '</div>';
    html += '</div></div>';
    return html;
  }

  function pushBlankPages(pages, count) {
    const n = Math.max(0, count | 0);
    for (let i = 0; i < n; i++) {
      pages.push({ type: 'blank', html: '' });
    }
  }

  function assembleLayout(bodyLayout, tocEntries, colophonData, options) {
    const opts = options || {};
    const writingDirection = opts.writingDirection || 'vertical';
    const spacers = window.NyukoData.normalizePageSpacers(opts.pageSpacers);
    const pages = [];
    const validToc = (tocEntries || []).filter((e) => e && String(e.title || '').trim());
    const hasColophon = hasColophonContent(colophonData);

    if (validToc.length) {
      pushBlankPages(pages, spacers.beforeToc);
      pages.push({ type: 'toc', html: '' });
      pushBlankPages(pages, spacers.afterToc);
    } else {
      pushBlankPages(pages, spacers.beforeToc + spacers.afterToc);
    }

    const pageOffset = pages.length;

    if (validToc.length) {
      const tocPage = pages.find((p) => p.type === 'toc');
      if (tocPage) {
        tocPage.html = buildTocHtml(validToc, writingDirection);
      }
    }

    (bodyLayout.pages || []).forEach((atoms) => {
      pages.push({ type: 'body', atoms });
    });

    if (hasColophon) {
      pushBlankPages(pages, spacers.afterBody);
      pages.push({
        type: 'colophon',
        html: buildColophonHtml(colophonData),
      });
      pushBlankPages(pages, spacers.afterColophon);
    } else {
      pushBlankPages(pages, spacers.afterBody + spacers.afterColophon);
    }

    const tocPageCount = pageOffset;

    return {
      pages,
      pageCount: pages.length,
      bodyPageCount: bodyLayout.pageCount || 0,
      tocPageCount,
      colophonPageCount: hasColophon ? 1 : 0,
      charCount: bodyLayout.charCount || 0,
      hasBreaks: bodyLayout.hasBreaks,
      chapters: bodyLayout.chapters || [],
    };
  }

  function appendPageChrome(page, bodyEl, format, bleedMm, scale, pageNumber, options) {
    const opts = options || {};
    const nonbulePosition = opts.nonbulePosition || 'spread';
    const isPreview = Boolean(opts.preview);
    const dims = pageDimensions(format, bleedMm, scale);
    const body = window.NyukoData.bodySize(format);

    page.className = 'nyuko-page' + (isPreview ? ' nyuko-page-preview' : '');
    page.dataset.page = String(pageNumber);
    page.style.width = dims.widthPx + 'px';
    page.style.height = dims.heightPx + 'px';

    const bleed = document.createElement('div');
    bleed.className = 'nyuko-page-bleed';
    bleed.style.padding = mmToPx(bleedMm || 0) * scale + 'px';

    if (isPreview) {
      const trim = document.createElement('div');
      trim.className = 'nyuko-page-trim';
      trim.style.width = mmToPx(format.width) * scale + 'px';
      trim.style.height = mmToPx(format.height) * scale + 'px';
      bleed.appendChild(trim);
    }

    bleed.appendChild(bodyEl);
    page.appendChild(bleed);

    if (pageNumber > 0 && !opts.hidePageNumber) {
      const bleedPx = mmToPx(bleedMm || 0) * scale;
      const trimW = mmToPx(format.width) * scale;
      const trimH = mmToPx(format.height) * scale;
      const bodyW = mmToPx(body.width) * scale;
      const bodyH = mmToPx(body.height) * scale;
      const sideGap = Math.max(0, (trimW - bodyW) / 2);
      const vGap = Math.max(0, (trimH - bodyH) / 2);

      const label = document.createElement('div');
      label.className = 'nyuko-page-label';
      label.textContent = String(pageNumber);
      label.style.fontSize = (8 * scale) + 'pt';
      label.style.bottom = (bleedPx + vGap * 0.42) + 'px';
      if (nonbulePosition === 'center') {
        label.style.left = '50%';
        label.style.transform = 'translateX(-50%)';
      } else if (isHorizontal(opts.writingDirection)) {
        if (pageNumber % 2 === 1) {
          label.style.left = (bleedPx + sideGap) + 'px';
        } else {
          label.style.right = (bleedPx + sideGap) + 'px';
        }
      } else if (pageNumber % 2 === 1) {
        label.style.right = (bleedPx + sideGap) + 'px';
      } else {
        label.style.left = (bleedPx + sideGap) + 'px';
      }
      page.appendChild(label);
    }
  }

  // --- ページ要素の描画（CSS縦組み流し込み） ---

  function createPageElement(pageAtoms, format, font, bleedMm, scale, pageNumber, options) {
    const opts = options || {};
    const lineHeight = resolveLineHeight(opts, font);
    const letterSpacing = opts.letterSpacing || 0;
    const columnCount = resolveColumnCount(opts);
    const danGapMm = opts.danGapMm != null ? opts.danGapMm : window.NyukoData.DEFAULT_COLUMN_GAP_MM;
    const writingDirection = opts.writingDirection || 'vertical';
    const horizontal = isHorizontal(writingDirection);
    const body = window.NyukoData.bodySize(format);
    const bodyWidthPx = mmToPx(body.width) * scale;
    const bodyHeightPx = mmToPx(body.height) * scale;

    const page = document.createElement('div');
    const bodyEl = document.createElement('div');
    bodyEl.className = 'nyuko-page-body' + (horizontal ? ' writing-horizontal' : ' writing-vertical');
    bodyEl.style.fontFamily = font.family;
    bodyEl.style.fontSize = font.size * scale + 'pt';
    bodyEl.style.lineHeight = String(lineHeight);
    bodyEl.style.letterSpacing = letterSpacing + 'em';
    applyPageLayout(bodyEl, bodyWidthPx, bodyHeightPx, columnCount, danGapMm, scale);
    bodyEl.innerHTML = atomsToHtml(pageAtoms || [], !horizontal);

    appendPageChrome(page, bodyEl, format, bleedMm, scale, pageNumber, opts);
    return page;
  }

  function createStaticPageElement(html, kind, format, font, bleedMm, scale, pageNumber, options) {
    const opts = options || {};
    const lineHeight = resolveLineHeight(opts, font);
    const letterSpacing = opts.letterSpacing || 0;
    const writingDirection = opts.writingDirection || 'vertical';
    const horizontal = isHorizontal(writingDirection);
    const body = window.NyukoData.bodySize(format);
    const bodyWidthPx = mmToPx(body.width) * scale;
    const bodyHeightPx = mmToPx(body.height) * scale;
    const fontSizePt = kind === 'toc' && opts.tocFontSizePt != null
      ? opts.tocFontSizePt
      : font.size;

    const page = document.createElement('div');
    const bodyEl = document.createElement('div');
    bodyEl.className = 'nyuko-page-body nyuko-page-static nyuko-page-' + kind +
      (horizontal ? ' writing-horizontal' : ' writing-vertical');
    bodyEl.style.fontFamily = font.family;
    bodyEl.style.fontSize = fontSizePt * scale + 'pt';
    bodyEl.style.lineHeight = String(lineHeight);
    bodyEl.style.letterSpacing = letterSpacing + 'em';
    applyPageLayout(bodyEl, bodyWidthPx, bodyHeightPx, 1, opts.danGapMm, scale);
    bodyEl.innerHTML = html || '';

    appendPageChrome(page, bodyEl, format, bleedMm, scale, pageNumber, opts);
    return page;
  }

  function createLayoutPage(page, format, font, bleedMm, scale, pageNumber, options) {
    const opts = options || {};
    if (page && page.type === 'body') {
      return createPageElement(page.atoms, format, font, bleedMm, scale, pageNumber, opts);
    }
    // 目次・奥付・白ページにはノンブルを載せない
    const staticOpts = Object.assign({}, opts, { hidePageNumber: true });
    return createStaticPageElement(page.html, page.type || 'static', format, font, bleedMm, scale, pageNumber, staticOpts);
  }

  async function exportPdf(layout, format, font, bleedMm, title, options) {
    const opts = options || {};
    const nonbulePosition = opts.nonbulePosition || 'spread';
    const lineHeight = resolveLineHeight(opts, font);
    const letterSpacing = opts.letterSpacing || 0;
    const { jsPDF } = window.jspdf;
    const dims = pageDimensions(format, bleedMm, 1);
    const pdf = new jsPDF({
      orientation: dims.widthMm > dims.heightMm ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [dims.widthMm, dims.heightMm],
    });

    const host = document.getElementById('nyuko-export-host');
    if (!host) throw new Error('export host missing');
    host.innerHTML = '';

    for (let i = 0; i < layout.pages.length; i++) {
      const pageEl = createLayoutPage(layout.pages[i], format, font, bleedMm, 3, i + 1, {
        nonbulePosition,
        lineHeightH: opts.lineHeightH,
        letterSpacing,
        columnCount: opts.columnCount,
        danGapMm: opts.danGapMm,
        writingDirection: opts.writingDirection,
        tocFontSizePt: opts.tocFontSizePt,
      });
      pageEl.classList.add('nyuko-page-export');
      host.appendChild(pageEl);

      const canvas = await window.html2canvas(pageEl, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
      });

      if (i > 0) pdf.addPage([dims.widthMm, dims.heightMm]);
      const img = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(img, 'JPEG', 0, 0, dims.widthMm, dims.heightMm);
      host.removeChild(pageEl);
    }

    const base = (title || '無題').replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || '無題';
    pdf.save(base + '.pdf');
  }

  function exportPrint(layout, format, font, bleedMm, title, options) {
    const opts = options || {};
    const nonbulePosition = opts.nonbulePosition || 'spread';
    const dims = pageDimensions(format, bleedMm, 1);

    let root = document.getElementById('nyuko-print-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'nyuko-print-root';
      root.setAttribute('aria-hidden', 'true');
      document.body.appendChild(root);
    }
    root.innerHTML = '';

    for (let i = 0; i < layout.pages.length; i++) {
      const pageEl = createLayoutPage(layout.pages[i], format, font, bleedMm, 1, i + 1, {
        nonbulePosition,
        lineHeightH: opts.lineHeightH,
        letterSpacing: opts.letterSpacing || 0,
        columnCount: opts.columnCount,
        danGapMm: opts.danGapMm,
        writingDirection: opts.writingDirection,
        tocFontSizePt: opts.tocFontSizePt,
      });
      pageEl.classList.add('nyuko-print-page');
      // 印刷時に @page と寸法が完全一致するよう mm 指定にする（余白ページ防止）
      pageEl.style.width = dims.widthMm + 'mm';
      pageEl.style.height = dims.heightMm + 'mm';
      root.appendChild(pageEl);
    }

    let sizeStyle = document.getElementById('nyuko-print-page-size');
    if (!sizeStyle) {
      sizeStyle = document.createElement('style');
      sizeStyle.id = 'nyuko-print-page-size';
      document.head.appendChild(sizeStyle);
    }
    sizeStyle.textContent =
      '@page { size: ' + dims.widthMm + 'mm ' + dims.heightMm + 'mm; margin: 0; }';

    const base = (title || '無題').replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || '無題';
    const prevTitle = document.title;
    document.title = base;

    const cleanup = () => {
      document.title = prevTitle;
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
          resolve();
        });
      });
    });
  }

  window.NyukoEngine = {
    formatManuscript,
    paginate,
    assembleLayout,
    detectHeadings,
    detectChapters,
    createPageElement,
    createLayoutPage,
    exportPdf,
    exportPrint,
    pageDimensions,
  };
})();
