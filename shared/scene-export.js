(function (global) {
  const EXPORT_W = 720;
  const EXPORT_SCALE = 2;
  const EXPORT_FONT = '"Noto Sans JP", "Hiragino Sans", sans-serif';
  const DEFAULT_MAX_CHARS = 300;

  function wrapCanvasLines(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const ch of text) {
      if (ch === '\n') {
        lines.push(line);
        line = '';
        continue;
      }
      const next = line + ch;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function sceneCardLayout(ctx, cardW, scene, maxChars) {
    const sideW = 44;
    const bodyPadX = 16;
    const bodyPadY = 14;
    const bodyW = cardW - sideW;
    const textW = bodyW - bodyPadX * 2;
    const titleText = (scene.title || '').trim();
    const bodyText = (scene.body || '').trim() || '（未記入）';
    const bodyEmpty = !(scene.body || '').trim();

    ctx.font = `700 13px ${EXPORT_FONT}`;
    const titleH = titleText ? 22 : 0;

    ctx.font = `400 15px ${EXPORT_FONT}`;
    const bodyLines = wrapCanvasLines(ctx, bodyText, textW);
    const bodyLineH = 26;
    const bodyH = bodyLines.length * bodyLineH;

    ctx.font = `700 11px ${EXPORT_FONT}`;
    const footerH = 20;

    const innerH = bodyPadY + titleH + (titleText ? 8 : 0) + bodyH + 8 + footerH + bodyPadY;
    const cardH = Math.max(88, innerH);

    return {
      sideW,
      bodyPadX,
      bodyPadY,
      bodyW,
      titleText,
      bodyText,
      bodyEmpty,
      bodyLines,
      bodyLineH,
      titleH,
      cardH,
      charCount: (scene.body || '').length,
      maxChars,
    };
  }

  function drawSceneCard(ctx, x, y, cardW, scene, index, maxChars) {
    const L = sceneCardLayout(ctx, cardW, scene, maxChars);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, cardW, L.cardH);

    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, L.sideW, L.cardH);

    ctx.fillStyle = '#fff';
    ctx.font = `900 13px ${EXPORT_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), x + L.sideW / 2, y + L.cardH / 2);

    const bodyX = x + L.sideW + L.bodyPadX;
    let cy = y + L.bodyPadY;

    if (L.titleText) {
      ctx.fillStyle = '#000';
      ctx.font = `700 13px ${EXPORT_FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(L.titleText, bodyX, cy);
      cy += L.titleH + 8;
    }

    ctx.font = `400 15px ${EXPORT_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    for (const line of L.bodyLines) {
      ctx.fillStyle = L.bodyEmpty ? '#888' : '#000';
      ctx.fillText(line, bodyX, cy);
      cy += L.bodyLineH;
    }

    ctx.fillStyle = '#000';
    ctx.font = `700 11px ${EXPORT_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${L.charCount} / ${maxChars}`, bodyX, y + L.cardH - L.bodyPadY - 14);
  }

  function measureExportHeight(ctx, cardW, scenes, maxChars) {
    const pad = 24;
    const headerH = 72;
    const statsH = 28;
    const gap = 10;
    let h = pad + headerH + statsH + gap;
    scenes.forEach((sc) => {
      h += sceneCardLayout(ctx, cardW, sc, maxChars).cardH + gap;
    });
    h += pad + 20;
    return h;
  }

  async function renderExportCanvas({ title, scenes, maxChars = DEFAULT_MAX_CHARS }) {
    await document.fonts.ready;

    const list = Array.isArray(scenes) ? scenes : [];
    const cardW = EXPORT_W - 48;
    const probe = document.createElement('canvas');
    const probeCtx = probe.getContext('2d');
    const totalH = measureExportHeight(probeCtx, cardW, list, maxChars);

    const canvas = document.createElement('canvas');
    canvas.width = EXPORT_W * EXPORT_SCALE;
    canvas.height = totalH * EXPORT_SCALE;
    const ctx = canvas.getContext('2d');
    ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, EXPORT_W, totalH);

    const pad = 24;
    const workTitle = (title || '').trim() || '無題';
    const totalChars = list.reduce((s, sc) => s + (sc.body || '').length, 0);

    ctx.fillStyle = '#000';
    ctx.font = `900 28px ${EXPORT_FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(workTitle, pad, pad);

    ctx.font = `700 12px ${EXPORT_FONT}`;
    ctx.fillText(`${list.length} シーン · ${totalChars} 字`, pad, pad + 44);

    let y = pad + 72 + 28 + 10;
    list.forEach((sc, i) => {
      const L = sceneCardLayout(ctx, cardW, sc, maxChars);
      drawSceneCard(ctx, pad, y, cardW, sc, i, maxChars);
      y += L.cardH + 10;
    });

    return canvas;
  }

  function canvasToJpgBlob(canvas) {
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.94);
    });
  }

  global.SceneExport = {
    renderExportCanvas,
    canvasToJpgBlob,
    DEFAULT_MAX_CHARS,
  };
})(typeof window !== 'undefined' ? window : globalThis);
