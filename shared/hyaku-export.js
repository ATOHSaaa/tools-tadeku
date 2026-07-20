(function (global) {
  'use strict';

  const FONT = '"Noto Sans JP", "Hiragino Sans", sans-serif';
  const W = 720;
  const SCALE = 2;
  const PAD = 36;
  const INK = '#1a1814';
  const MUTED = '#5c564c';
  const BG = '#f4f0e6';
  const SURFACE = '#ffffff';
  const ACCENT = '#6b4c2a';
  const LINE = '#ccc4b8';

  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const ch of String(text)) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawLines(ctx, lines, x, y, lineHeight) {
    lines.forEach((ln) => {
      ctx.fillText(ln, x, y);
      y += lineHeight;
    });
    return y;
  }

  function measureResultBlock(ctx, cardW, data) {
    let h = PAD;
    ctx.font = `700 12px ${FONT}`;
    h += 18;
    ctx.font = `900 48px ${FONT}`;
    h += 56;
    ctx.font = `700 18px ${FONT}`;
    h += 28;
    h += data.axisResults.length * 18;
    ctx.font = `400 13px ${FONT}`;
    h += wrapText(ctx, data.type.blurb, cardW).length * 20 + 16;
    h += data.axisResults.length * 52;
    h += PAD;
    return h;
  }

  function measureAnswersBlock(ctx, cardW, rows) {
    let h = PAD + 28;
    ctx.font = `400 11px ${FONT}`;
    rows.forEach((row) => {
      const qLines = wrapText(ctx, row.q, cardW - 8);
      h += qLines.length * 16 + 4;
      h += 18;
      h += 10;
    });
    h += PAD;
    return h;
  }

  function drawResultBlock(ctx, x, y, cardW, data) {
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = ACCENT;
    ctx.fillText('物書きへの100の質問 — 診断結果', x, y);
    y += 22;

    ctx.fillStyle = INK;
    ctx.font = `900 48px ${FONT}`;
    ctx.fillText(data.code, x, y);
    y += 56;

    ctx.font = `700 18px ${FONT}`;
    ctx.fillStyle = ACCENT;
    ctx.fillText(data.type.name, x, y);
    y += 28;

    ctx.font = `700 11px ${FONT}`;
    ctx.fillStyle = MUTED;
    data.axisResults.forEach((axis) => {
      ctx.fillText(
        axis.letter + ' = ' + axis.letterEn + '（' + (axis.isLeft ? axis.leftLabel : axis.rightLabel) + '） ' + axis.dominantPct + '%',
        x,
        y,
      );
      y += 18;
    });
    y += 4;

    ctx.fillStyle = INK;
    ctx.font = `400 13px ${FONT}`;
    y = drawLines(ctx, wrapText(ctx, data.type.blurb, cardW), x, y, 20);
    y += 12;

    data.axisResults.forEach((axis) => {
      ctx.font = `700 11px ${FONT}`;
      ctx.fillStyle = MUTED;
      ctx.fillText(
        axis.leftLetter + ' ' + axis.leftEn + ' ←→ ' + axis.rightLetter + ' ' + axis.rightEn,
        x,
        y,
      );
      y += 16;

      const barX = x;
      const barY = y;
      const barW = cardW;
      const barH = 10;
      ctx.fillStyle = '#e8ddd0';
      ctx.fillRect(barX, barY, barW, barH);
      const split = barW * (axis.leftPct / 100);
      ctx.fillStyle = axis.isLeft ? ACCENT : '#8a7f72';
      if (axis.isLeft) {
        ctx.fillRect(barX, barY, split, barH);
      } else {
        ctx.fillRect(barX + split, barY, barW - split, barH);
      }

      ctx.font = `700 10px ${FONT}`;
      ctx.fillStyle = INK;
      ctx.fillText(axis.leftLetter + ' ' + axis.leftPct + '%', barX, barY + 14);
      const rightText = axis.rightLetter + ' ' + axis.rightPct + '%';
      ctx.textAlign = 'right';
      ctx.fillText(rightText, barX + barW, barY + 14);
      ctx.textAlign = 'left';
      y += 36;
    });

    return y;
  }

  function drawAnswersBlock(ctx, x, y, cardW, rows) {
    ctx.fillStyle = INK;
    ctx.font = `900 16px ${FONT}`;
    ctx.fillText('回答一覧', x, y);
    y += 28;

    rows.forEach((row) => {
      ctx.font = `700 10px ${FONT}`;
      ctx.fillStyle = ACCENT;
      ctx.fillText('Q' + row.num, x, y);
      y += 14;

      ctx.font = `400 11px ${FONT}`;
      ctx.fillStyle = MUTED;
      y = drawLines(ctx, wrapText(ctx, row.q, cardW - 8), x, y, 16);
      y += 2;

      ctx.font = `700 11px ${FONT}`;
      ctx.fillStyle = INK;
      y = drawLines(ctx, wrapText(ctx, '→ ' + row.level + '：' + row.a, cardW - 8), x, y, 17);
      y += 10;
    });

    return y;
  }

  async function renderResultImage(payload) {
    await document.fonts.ready;

    const cardW = W - PAD * 2;
    const probe = document.createElement('canvas');
    const probeCtx = probe.getContext('2d');

    const answerRows = payload.answers.map((item, i) => ({
      num: item.num || i + 1,
      q: item.text,
      left: item.leftText,
      right: item.rightText,
      a: item.choiceText,
      level: item.level,
    }));

    const resultH = measureResultBlock(probeCtx, cardW, payload) + 24;
    probeCtx.font = `400 11px ${FONT}`;
    const answersH = measureAnswersBlock(probeCtx, cardW, answerRows);
    const totalH = PAD + resultH + answersH + PAD;

    const canvas = document.createElement('canvas');
    canvas.width = W * SCALE;
    canvas.height = totalH * SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, totalH);

    ctx.fillStyle = SURFACE;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.fillRect(PAD / 2, PAD / 2, W - PAD, resultH);
    ctx.strokeRect(PAD / 2, PAD / 2, W - PAD, resultH);

    let y = PAD;
    y = drawResultBlock(ctx, PAD, y, cardW, payload);

    y += 24;
    ctx.fillStyle = SURFACE;
    ctx.fillRect(PAD / 2, y - PAD / 4, W - PAD, totalH - y);
    ctx.strokeRect(PAD / 2, y - PAD / 4, W - PAD, totalH - y + PAD / 2);

    drawAnswersBlock(ctx, PAD, y, cardW, answerRows);

    ctx.font = `700 10px ${FONT}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'right';
    ctx.fillText('tools.tadeku.net/hyaku/', W - PAD, totalH - PAD / 2);
    ctx.textAlign = 'left';

    return canvas;
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
    });
  }

  async function downloadResultImage(payload) {
    const canvas = await renderResultImage(payload);
    const blob = await canvasToPngBlob(canvas);
    const filename = '物書き100の質問_' + payload.code + '.png';
    if (global.ExportUtils && global.ExportUtils.downloadBlob) {
      global.ExportUtils.downloadBlob(blob, filename);
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  global.HyakuExport = {
    renderResultImage,
    downloadResultImage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
