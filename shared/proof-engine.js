(function (global) {
  const ERROR_LABELS = {
    OK: null,
    deletion: '文字の抜け',
    insertion_a: '余分な文字',
    insertion_b: '重複した文字列',
    'kanji-conversion_a': '漢字の誤変換（同読み）',
    'kanji-conversion_b': '漢字の誤変換（近い読み）',
    substitution: '文字の入れ替え',
    transposition: '隣接文字の転置',
    others: 'その他の入力誤り',
  };

  const ERROR_CLASS = {
    deletion: 'err-deletion',
    insertion_a: 'err-insertion',
    insertion_b: 'err-insertion',
    'kanji-conversion_a': 'err-kanji',
    'kanji-conversion_b': 'err-kanji',
    substitution: 'err-substitution',
    transposition: 'err-transposition',
    others: 'err-others',
  };

  function labelFor(entity) {
    return ERROR_LABELS[entity] || entity;
  }

  function classFor(entity) {
    return ERROR_CLASS[entity] || 'err-others';
  }

  /**
   * Map token-classification output to character-level issues.
   * @param {string} text
   * @param {Array<{entity:string, score:number, index:number}>} tokens
   * @param {{ threshold?: number }} opts
   */
  function analyzeTokens(text, tokens, opts = {}) {
    const threshold = opts.threshold ?? 0.45;
    const chars = [...text];
    const issues = [];

    for (const token of tokens) {
      if (!token || token.entity === 'OK') continue;
      if (token.score < threshold) continue;

      const charIndex = token.index - 1;
      if (charIndex < 0 || charIndex >= chars.length) continue;

      issues.push({
        charIndex,
        char: chars[charIndex],
        entity: token.entity,
        label: labelFor(token.entity),
        score: token.score,
        className: classFor(token.entity),
      });
    }

    return issues;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildHighlightedHtml(text, issues) {
    if (!issues.length) return escapeHtml(text);

    const byIndex = new Map();
    for (const issue of issues) {
      if (!byIndex.has(issue.charIndex)) byIndex.set(issue.charIndex, issue);
    }

    const chars = [...text];
    let html = '';

    for (let i = 0; i < chars.length; i += 1) {
      const ch = chars[i];
      const issue = byIndex.get(i);
      if (issue) {
        html += `<mark class="${issue.className}" title="${escapeHtml(issue.label)}（${Math.round(issue.score * 100)}%）">${escapeHtml(ch)}</mark>`;
      } else {
        html += escapeHtml(ch);
      }
    }

    return html;
  }

  function splitIntoChunks(text, maxLen = 180) {
    const chunks = [];
    const paragraphs = text.split(/\n/);
    let current = '';

    const flush = () => {
      if (current) {
        chunks.push(current);
        current = '';
      }
    };

    for (const para of paragraphs) {
      if (!para) {
        flush();
        chunks.push('\n');
        continue;
      }

      const sentences = para.split(/(?<=[。！？!?])/);
      for (const sentence of sentences) {
        if (!sentence) continue;
        if ((current + sentence).length > maxLen && current) {
          flush();
        }
        if (sentence.length > maxLen) {
          flush();
          for (let i = 0; i < sentence.length; i += maxLen) {
            chunks.push(sentence.slice(i, i + maxLen));
          }
        } else {
          current += sentence;
        }
      }
      flush();
      chunks.push('\n');
    }

    if (chunks.length && chunks[chunks.length - 1] === '\n' && !text.endsWith('\n')) {
      chunks.pop();
    }

    return chunks.filter((c) => c !== '');
  }

  global.ProofEngine = {
    ERROR_LABELS,
    labelFor,
    analyzeTokens,
    buildHighlightedHtml,
    splitIntoChunks,
  };
})(typeof window !== 'undefined' ? window : globalThis);
