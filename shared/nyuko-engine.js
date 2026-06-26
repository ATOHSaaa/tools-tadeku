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

  function isDigitChar(ch) {
    return /[0-9０-９]/.test(ch);
  }

  function normalizeAsciiDigits(str) {
    return str.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 0x30));
  }

  function toFullwidthDigits(str) {
    return str.replace(/[0-9]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x30 + 0xFF10));
  }

  function tokenizePlain(chunk) {
    const tokens = [];
    const chars = graphemes(chunk);
    let i = 0;
    while (i < chars.length) {
      if (isDigitChar(chars[i])) {
        let digits = '';
        while (i < chars.length && isDigitChar(chars[i])) {
          digits += chars[i];
          i += 1;
        }
        tokens.push({ kind: 'tcy', text: normalizeAsciiDigits(digits) });
        if (i < chars.length && /[a-zA-Z]/.test(chars[i])) {
          let unit = '';
          while (i < chars.length && /[a-zA-Z]/.test(chars[i]) && unit.length < 3) {
            unit += chars[i];
            i += 1;
          }
          if (unit) tokens.push({ kind: 'tcy', text: unit });
        }
        continue;
      }
      if (/[a-zA-Z]/.test(chars[i])) {
        let latin = '';
        while (i < chars.length) {
          const c = chars[i];
          if (/[a-zA-Z]/.test(c)) {
            latin += c;
            i += 1;
          } else if (c === ' ' && latin.length > 0 && i + 1 < chars.length && /[a-zA-Z]/.test(chars[i + 1])) {
            latin += c;
            i += 1;
          } else {
            break;
          }
        }
        if (latin) {
          tokens.push({ kind: 'latin', text: latin });
          continue;
        }
      }
      tokens.push({ kind: 'char', text: chars[i] });
      i += 1;
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
  //   atom.t: 'char' | 'tcy' | 'latin' | 'ruby' | 'indent' | 'newline' | 'pagebreak' | 'heading'

  function tokenToAtom(tok) {
    if (tok.kind === 'ruby') return { t: 'ruby', base: tok.base, ruby: tok.ruby };
    if (tok.kind === 'tcy') return { t: 'tcy', text: tok.text };
    if (tok.kind === 'latin') return { t: 'latin', text: tok.text };
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
          gapBeforeHeading(1);
          atoms.push({ t: 'heading', level: 'chapter', text: parsed.text });
          atoms.push({ t: 'newline' });
          columnDirty = false;
          hasBodyContent = false;
          return;
        }
        if (parsed.type === 'section') {
          afterBlank = false;
          gapBeforeHeading(1);
          atoms.push({ t: 'heading', level: 'section', text: parsed.text });
          atoms.push({ t: 'newline' });
          columnDirty = false;
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

  function uprightLatinCharsHtml(text) {
    let html = '';
    graphemes(text).forEach((ch) => {
      if (/[a-zA-Z]/.test(ch)) {
        html += '<span class="nyuko-digit nyuko-latin-char">' + esc(ch) + '</span>';
      } else {
        html += esc(ch);
      }
    });
    return html;
  }

  function tcySpanHtml(text, useTcy) {
    if (!useTcy) return esc(text);
    if (/^[a-zA-Z]+$/.test(text) && text.length <= 3) {
      return uprightLatinCharsHtml(text);
    }
    if (/^\d+$/.test(text)) {
      const digitLenClass = text.length === 2
        ? ' nyuko-tcy-digits-2'
        : text.length === 3
          ? ' nyuko-tcy-digits-3'
          : '';
      return '<span class="nyuko-tcy nyuko-tcy-digits' + digitLenClass + '">' + esc(text) + '</span>';
    }
    if (text.length === 1) {
      return '<span class="nyuko-digit">' + esc(text) + '</span>';
    }
    return '<span class="nyuko-tcy">' + esc(text) + '</span>';
  }

  function latinSpanHtml(text, vertical) {
    if (vertical === false) return esc(text);
    const letterCount = (text.match(/[a-zA-Z]/g) || []).length;
    if (letterCount <= 3 && /^[a-zA-Z\s]+$/.test(text)) {
      return uprightLatinCharsHtml(text);
    }
    return '<span class="nyuko-latin">' + esc(text) + '</span>';
  }

  function bodyDigitHtml(text, useTcy) {
    if (!useTcy) return esc(text);
    if (!/^\d+$/.test(text)) return tcySpanHtml(text, true);
    let inner;
    if (text.length === 1) {
      inner = esc(toFullwidthDigits(text));
    } else {
      const digitLenClass = text.length === 2
        ? ' nyuko-tcy-digits-2'
        : text.length === 3
          ? ' nyuko-tcy-digits-3'
          : '';
      inner = '<span class="nyuko-tcy nyuko-tcy-digits' + digitLenClass + '">' + esc(text) + '</span>';
    }
    return '<span class="nyuko-body-digit">' + inner + '</span>';
  }

  function inlinePlainToHtml(text, vertical) {
    const useTcy = vertical !== false;
    let html = '';
    tokenizePlain(text).forEach((tok) => {
      if (tok.kind === 'tcy' && useTcy) {
        html += bodyDigitHtml(tok.text, true);
      } else if (tok.kind === 'latin') {
        html += latinSpanHtml(tok.text, vertical);
      } else {
        html += esc(tok.text);
      }
    });
    return html;
  }

  function headingDigitSpanHtml(text) {
    let inner;
    if (text.length === 1) {
      inner = esc(toFullwidthDigits(text));
    } else {
      const digitLenClass = text.length === 2
        ? ' nyuko-tcy-digits-2'
        : text.length === 3
          ? ' nyuko-tcy-digits-3'
          : '';
      inner = '<span class="nyuko-tcy nyuko-tcy-digits' + digitLenClass + '">' + esc(text) + '</span>';
    }
    return '<span class="nyuko-heading-digit">' + inner + '</span>';
  }

  // 題字の数字: 1桁は全角そのまま、2桁以上は縦中横（同一枠で包む）
  function inlinePlainToHtmlHeading(text, vertical) {
    if (vertical === false) return inlinePlainToHtml(text, false);
    let html = '';
    tokenizePlain(text).forEach((tok) => {
      if (tok.kind === 'tcy' && /^\d+$/.test(tok.text)) {
        html += headingDigitSpanHtml(tok.text);
      } else if (tok.kind === 'tcy') {
        html += tcySpanHtml(tok.text, true);
      } else if (tok.kind === 'latin') {
        html += latinSpanHtml(tok.text, vertical);
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
        html += bodyDigitHtml(a.text, useTcy);
      } else if (a.t === 'latin') {
        html += latinSpanHtml(a.text, vertical);
      } else if (a.t === 'ruby') {
        html += '<ruby>' + esc(a.base) + '<rt>' + esc(a.ruby) + '</rt></ruby>';
      } else if (a.t === 'heading') {
        html += '<span class="nyuko-heading nyuko-heading-' + a.level + '">' + inlinePlainToHtmlHeading(a.text, vertical) + '</span>';
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
      else if (a.t === 'latin') n += graphemes(a.text).length;
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
      measureBodyEl.style.textAlign = 'justify';
      measureBodyEl.style.textJustify = 'inter-character';
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
        const pageHtml = !horizontal
          ? tcySpanHtml(displayPage, true)
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

  function resolvePageInsets(format, pageNumber, writingDirection, scale) {
    const s = scale || 1;
    const top = mmToPx(format.marginTop) * s;
    const bottom = mmToPx(format.marginBottom) * s;
    const inner = mmToPx(format.marginInner) * s;
    const outer = mmToPx(format.marginOuter) * s;
    const odd = pageNumber % 2 === 1;

    if (isHorizontal(writingDirection)) {
      return {
        top,
        bottom,
        left: odd ? inner : outer,
        right: odd ? outer : inner,
      };
    }

    return {
      top,
      bottom,
      left: odd ? outer : inner,
      right: odd ? inner : outer,
    };
  }

  function appendPageChrome(page, bodyEl, format, bleedMm, scale, pageNumber, options) {
    const opts = options || {};
    const nonbulePosition = opts.nonbulePosition || 'spread';
    const isPreview = Boolean(opts.preview);
    const dims = pageDimensions(format, bleedMm, scale);
    const bleedPx = mmToPx(bleedMm || 0) * scale;
    const inset = resolvePageInsets(format, pageNumber, opts.writingDirection, scale);

    page.className = 'nyuko-page' + (isPreview ? ' nyuko-page-preview' : '');
    page.dataset.page = String(pageNumber);
    page.style.width = dims.widthPx + 'px';
    page.style.height = dims.heightPx + 'px';

    const bleed = document.createElement('div');
    bleed.className = 'nyuko-page-bleed';
    bleed.style.position = 'relative';
    bleed.style.boxSizing = 'border-box';
    bleed.style.paddingTop = (bleedPx + inset.top) + 'px';
    bleed.style.paddingRight = (bleedPx + inset.right) + 'px';
    bleed.style.paddingBottom = (bleedPx + inset.bottom) + 'px';
    bleed.style.paddingLeft = (bleedPx + inset.left) + 'px';

    if (isPreview) {
      const trim = document.createElement('div');
      trim.className = 'nyuko-page-trim';
      trim.style.left = bleedPx + 'px';
      trim.style.top = bleedPx + 'px';
      trim.style.width = mmToPx(format.width) * scale + 'px';
      trim.style.height = mmToPx(format.height) * scale + 'px';
      trim.style.transform = 'none';
      bleed.appendChild(trim);
    }

    bleed.appendChild(bodyEl);
    page.appendChild(bleed);

    if (pageNumber > 0 && !opts.hidePageNumber) {
      const label = document.createElement('div');
      label.className = 'nyuko-page-label';
      label.textContent = String(pageNumber);
      label.style.fontSize = (8 * scale) + 'pt';
      const gapPx = mmToPx(
        (window.NyukoData && window.NyukoData.nonbuleBodyGapMm)
          ? window.NyukoData.nonbuleBodyGapMm(format)
          : format.marginBottom * 0.58
      ) * scale;
      const offsetFromTrim = Math.max(0, inset.bottom - gapPx);
      label.style.bottom = (bleedPx + offsetFromTrim) + 'px';
      if (nonbulePosition === 'center') {
        label.style.left = '50%';
        label.style.transform = 'translateX(-50%)';
      } else if (isHorizontal(opts.writingDirection)) {
        if (pageNumber % 2 === 1) {
          label.style.left = (bleedPx + inset.left * 0.55) + 'px';
        } else {
          label.style.right = (bleedPx + inset.right * 0.55) + 'px';
        }
      } else if (pageNumber % 2 === 1) {
        label.style.right = (bleedPx + inset.right * 0.55) + 'px';
      } else {
        label.style.left = (bleedPx + inset.left * 0.55) + 'px';
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

  function buildExportRenderOptions(opts) {
    return {
      nonbulePosition: opts.nonbulePosition || 'spread',
      lineHeightH: opts.lineHeightH,
      letterSpacing: opts.letterSpacing || 0,
      columnCount: opts.columnCount,
      danGapMm: opts.danGapMm,
      writingDirection: opts.writingDirection,
      tocFontSizePt: opts.tocFontSizePt,
    };
  }

  async function waitForExportReady() {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function prepareExportHost(host, dims) {
    host.innerHTML = '';
    host.classList.add('is-exporting');
    host.removeAttribute('style');
    if (dims) {
      host.style.width = dims.widthPx + 'px';
      host.style.height = dims.heightPx + 'px';
    }
  }

  function clearExportHost(host) {
    if (!host) return;
    host.innerHTML = '';
    host.classList.remove('is-exporting');
    host.removeAttribute('style');
  }

  function mountExportPage(host, pageEl) {
    pageEl.style.position = 'absolute';
    pageEl.style.left = '0';
    pageEl.style.top = '0';
    pageEl.style.margin = '0';
    host.appendChild(pageEl);
  }

  let htmlToImageModule = null;

  async function loadHtmlToImage() {
    if (htmlToImageModule) return htmlToImageModule;
    if (window.htmlToImage) {
      htmlToImageModule = window.htmlToImage;
      return htmlToImageModule;
    }
    htmlToImageModule = await import('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/+esm');
    return htmlToImageModule;
  }

  function applyExportPageSize(pageEl, dims) {
    pageEl.style.width = dims.widthPx + 'px';
    pageEl.style.height = dims.heightPx + 'px';
    pageEl.style.boxSizing = 'border-box';
    pageEl.style.flexShrink = '0';
  }

  let fontEmbedCSSCache;
  async function getFontEmbedCSS() {
    if (fontEmbedCSSCache !== undefined) return fontEmbedCSSCache;
    let css = '';
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    for (const link of links) {
      const href = link.href;
      if (!href || !/fonts\.(googleapis|gstatic)\.com/.test(href)) continue;
      try {
        const res = await fetch(href);
        if (res.ok) css += await res.text() + '\n';
      } catch (_) {}
    }
    fontEmbedCSSCache = css || null;
    return fontEmbedCSSCache;
  }

  async function capturePageElement(pageEl) {
    await waitForExportReady();
    const rect = pageEl.getBoundingClientRect();
    const width = Math.ceil(rect.width);
    const height = Math.ceil(rect.height);
    if (!width || !height) {
      throw new Error('page has zero size');
    }

    const htmlToImage = await loadHtmlToImage();
    const fontEmbedCSS = await getFontEmbedCSS();
    const captureOpts = {
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      cacheBust: true,
    };
    if (fontEmbedCSS) captureOpts.fontEmbedCSS = fontEmbedCSS;

    return htmlToImage.toCanvas(pageEl, captureOpts);
  }

  function canvasToJpgBlob(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.94);
    });
  }

  let pdfLibModule = null;
  let googleFontUrlCache = {};

  async function loadPdfLib() {
    if (pdfLibModule) return pdfLibModule;
    const [pdfLib, fontkitMod] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm'),
      import('https://cdn.jsdelivr.net/npm/@pdf-lib/fontkit@1.1.1/+esm'),
    ]);
    pdfLibModule = {
      PDFDocument: pdfLib.PDFDocument,
      fontkit: fontkitMod.default || fontkitMod,
    };
    return pdfLibModule;
  }

  function parseGoogleFontFaceUrls(css) {
    const map = {};
    const re = /@font-face\s*\{([^}]+)\}/g;
    let match;
    while ((match = re.exec(css))) {
      const block = match[1];
      const weightMatch = block.match(/font-weight:\s*(\d+)/);
      const urlMatch = block.match(/url\((https:\/\/[^)]+\.(?:woff2|woff|ttf|otf))\)/);
      if (!urlMatch) continue;
      const weight = weightMatch ? Number(weightMatch[1]) : 400;
      map[weight] = urlMatch[1];
    }
    return map;
  }

  async function fetchGoogleFontFileMap(googleCssFamily) {
    if (googleFontUrlCache[googleCssFamily]) return googleFontUrlCache[googleCssFamily];
    const cssUrl = 'https://fonts.googleapis.com/css2?family=' + googleCssFamily + '&display=swap';
    const css = await fetch(cssUrl).then((res) => {
      if (!res.ok) throw new Error('font css fetch failed');
      return res.text();
    });
    const map = parseGoogleFontFaceUrls(css);
    googleFontUrlCache[googleCssFamily] = map;
    return map;
  }

  async function preloadExportFonts(pdfDoc, fontId) {
    const fonts = window.NyukoData && window.NyukoData.FONTS;
    const meta = (fonts && fonts[fontId]) || (fonts && fonts.standard);
    if (!meta || !meta.googleCssFamily) throw new Error('font metadata missing');
    const urlMap = await fetchGoogleFontFileMap(meta.googleCssFamily);
    const registry = {};
    for (const weight of [400, 700]) {
      const url = urlMap[weight] || urlMap[400];
      if (!url) continue;
      const bytes = await fetch(url).then((res) => {
        if (!res.ok) throw new Error('font file fetch failed');
        return res.arrayBuffer();
      });
      registry[weight] = await pdfDoc.embedFont(bytes, { subset: true });
    }
    if (!registry[400]) throw new Error('font embed failed');
    return registry;
  }

  function isVisibleTextNode(node) {
    const parent = node.parentElement;
    if (!parent) return false;
    const style = window.getComputedStyle(parent);
    return style.visibility !== 'hidden' && style.display !== 'none';
  }

  function pushTextRangeItem(range, segment, style, pageRect, items) {
    if (!segment) return;
    if (!/\S/.test(segment) && segment !== '\u3000') return;
    const rects = range.getClientRects();
    if (!rects.length) return;
    const rect = rects[0];
    if (!rect.width && !rect.height) return;
    const fontSizePx = parseFloat(style.fontSize);
    if (!fontSizePx) return;
    const weight = parseInt(style.fontWeight, 10);
    items.push({
      text: segment,
      x: rect.left - pageRect.left,
      y: rect.top - pageRect.top,
      width: rect.width,
      height: rect.height,
      fontSizePx,
      weight: Number.isFinite(weight) && weight >= 700 ? 700 : 400,
    });
  }

  function appendTextNodeGlyphs(node, text, pageRect, items) {
    const style = window.getComputedStyle(node.parentElement);
    const range = document.createRange();
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
      let cursor = 0;
      for (const part of segmenter.segment(text)) {
        const segment = part.segment;
        const start = text.indexOf(segment, cursor);
        if (start < 0) {
          cursor += segment.length;
          continue;
        }
        range.setStart(node, start);
        range.setEnd(node, start + segment.length);
        cursor = start + segment.length;
        pushTextRangeItem(range, segment, style, pageRect, items);
      }
      return;
    }
    for (let i = 0; i < text.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      pushTextRangeItem(range, text[i], style, pageRect, items);
    }
  }

  function collectPageTextItems(pageEl) {
    const pageRect = pageEl.getBoundingClientRect();
    const items = [];
    pageEl.querySelectorAll('.nyuko-page-body, .nyuko-page-label').forEach((target) => {
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!isVisibleTextNode(node)) continue;
        const text = node.textContent;
        if (!text) continue;
        appendTextNodeGlyphs(node, text, pageRect, items);
      }
    });
    return items;
  }

  function drawPageTextToPdf(page, items, pageRect, fontRegistry) {
    const pageWidthPt = page.getWidth();
    const pageHeightPt = page.getHeight();
    const scaleX = pageWidthPt / pageRect.width;
    const scaleY = pageHeightPt / pageRect.height;
    const pxToPt = 72 / 96;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const font = item.weight >= 700 && fontRegistry[700] ? fontRegistry[700] : fontRegistry[400];
      const sizePt = item.fontSizePx * pxToPt;
      const xPt = item.x * scaleX;
      const yFromTopPt = (item.y + item.height * 0.86) * scaleY;
      const yPt = pageHeightPt - yFromTopPt;
      page.drawText(item.text, {
        x: xPt,
        y: yPt,
        size: sizePt,
        font,
      });
    }
  }

  async function exportPdf(layout, format, font, bleedMm, title, options) {
    const opts = options || {};
    const pageOpts = buildExportRenderOptions(opts);
    const dims = pageDimensions(format, bleedMm, 1);
    const widthPt = dims.widthMm * 72 / 25.4;
    const heightPt = dims.heightMm * 72 / 25.4;

    const { PDFDocument } = await loadPdfLib();
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(pdfLibModule.fontkit);
    const fontRegistry = await preloadExportFonts(pdfDoc, font.id || 'standard');

    const host = document.getElementById('nyuko-export-host');
    if (!host) throw new Error('export host missing');
    prepareExportHost(host, dims);

    try {
      for (let i = 0; i < layout.pages.length; i++) {
        const pageEl = createLayoutPage(layout.pages[i], format, font, bleedMm, 1, i + 1, pageOpts);
        pageEl.classList.add('nyuko-page-export');
        applyExportPageSize(pageEl, dims);
        mountExportPage(host, pageEl);
        await waitForExportReady();
        void pageEl.offsetHeight;

        const pageRect = pageEl.getBoundingClientRect();
        const pdfPage = pdfDoc.addPage([widthPt, heightPt]);
        const items = collectPageTextItems(pageEl);
        drawPageTextToPdf(pdfPage, items, pageRect, fontRegistry);
        host.removeChild(pageEl);
      }

      const base = (title || '無題').replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || '無題';
      const pdfBytes = await pdfDoc.save();
      const download = window.ExportUtils && window.ExportUtils.downloadBlob;
      if (!download) throw new Error('ExportUtils missing');
      download(new Blob([pdfBytes], { type: 'application/pdf' }), base + '.pdf');
    } finally {
      clearExportHost(host);
    }
  }

  async function exportImages(layout, format, font, bleedMm, title, options) {
    const opts = options || {};
    const pageOpts = buildExportRenderOptions(opts);
    const host = document.getElementById('nyuko-export-host');
    if (!host) throw new Error('export host missing');

    prepareExportHost(host, dims);
    const dims = pageDimensions(format, bleedMm, 1);
    const blobs = [];

    try {
      for (let i = 0; i < layout.pages.length; i++) {
        const pageEl = createLayoutPage(layout.pages[i], format, font, bleedMm, 1, i + 1, pageOpts);
        pageEl.classList.add('nyuko-page-export');
        applyExportPageSize(pageEl, dims);
        mountExportPage(host, pageEl);

        const canvas = await capturePageElement(pageEl);
        const blob = await canvasToJpgBlob(canvas);
        if (blob) blobs.push(blob);
        host.removeChild(pageEl);
      }

      if (!blobs.length) throw new Error('no images');

      const base = (title || '無題').replace(/[\\/:*?"<>|]/g, '').slice(0, 40) || '無題';
      const download = window.ExportUtils && window.ExportUtils.downloadBlob;
      if (!download) throw new Error('ExportUtils missing');

      if (blobs.length === 1) {
        download(blobs[0], base + '.jpg');
        return;
      }

      if (!window.JSZip) throw new Error('JSZip missing');
      const zip = new JSZip();
      const folder = zip.folder(base);
      blobs.forEach((blob, i) => {
        folder.file(String(i + 1).padStart(3, '0') + '.jpg', blob);
      });
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      download(zipBlob, base + '.zip');
    } finally {
      clearExportHost(host);
    }
  }

  function ensurePrintStyles() {
    let style = document.getElementById('nyuko-print-hide-style');
    if (style) return;
    style = document.createElement('style');
    style.id = 'nyuko-print-hide-style';
    style.textContent =
      '@media print {' +
      'html, body { background: #fff !important; height: auto !important; overflow: visible !important; padding: 0 !important; margin: 0 !important; }' +
      'body > .app { display: none !important; }' +
      '#nyuko-export-host { display: none !important; }' +
      '#nyuko-print-root { display: block !important; visibility: visible !important; position: static !important; left: auto !important; top: auto !important; overflow: visible !important; width: auto !important; height: auto !important; }' +
      '#nyuko-print-root .nyuko-page { margin: 0 !important; box-shadow: none !important; break-inside: avoid; page-break-inside: avoid; break-after: page; page-break-after: always; }' +
      '#nyuko-print-root .nyuko-page:last-child { break-after: auto; page-break-after: auto; }' +
      '#nyuko-print-root .nyuko-page, #nyuko-print-root .nyuko-page-bleed, #nyuko-print-root .nyuko-page-body, #nyuko-print-root .nyuko-page-label { -webkit-print-color-adjust: exact; print-color-adjust: exact; }' +
      '}';
    document.head.appendChild(style);
  }

  async function exportPrint(layout, format, font, bleedMm, title, options) {
    const opts = options || {};
    const pageOpts = buildExportRenderOptions(opts);
    const dims = pageDimensions(format, bleedMm, 1);

    ensurePrintStyles();

    let root = document.getElementById('nyuko-print-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'nyuko-print-root';
      root.setAttribute('aria-hidden', 'true');
      document.body.appendChild(root);
    }
    root.innerHTML = '';

    for (let i = 0; i < layout.pages.length; i++) {
      const pageEl = createLayoutPage(layout.pages[i], format, font, bleedMm, 1, i + 1, pageOpts);
      pageEl.classList.add('nyuko-print-page');
      applyExportPageSize(pageEl, dims);
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

    await waitForExportReady();
    void root.offsetHeight;

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
    exportImages,
    exportPrint,
    clearExportHost,
    pageDimensions,
  };
})();
