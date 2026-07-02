(function (global) {
  const RESOLUTIONS = {
    '720p': { width: 1280, height: 720, bodySize: 28, titleSize: 42, lineHeight: 2 },
    '1080p': { width: 1920, height: 1080, bodySize: 42, titleSize: 63, lineHeight: 2 },
  };

  const FFMPEG_UTIL_VERSION = '0.12.1';
  const FFMPEG_CORE_VERSION = '0.12.6';
  const MIN_VIDEO_DURATION = 3;
  const LAST_FRAME_DURATION = 0.5;

  let ffmpegInstance = null;
  let ffmpegLoading = null;

  function getFfmpegModuleUrl() {
    const scripts = document.querySelectorAll('script[src*="timelapse-engine"]');
    const src = scripts[scripts.length - 1]?.src;
    if (src) return new URL('./ffmpeg-dist/index.js', src).href;
    return '../shared/ffmpeg-dist/index.js';
  }

  function createRecorder() {
    let snapshots = [];
    let recording = false;
    let startTime = 0;
    let lastKey = '';

    return {
      get isRecording() {
        return recording;
      },
      get snapshots() {
        return snapshots;
      },
      start(initial) {
        snapshots = [];
        recording = true;
        startTime = performance.now();
        lastKey = '';
        if (initial) {
          this.capture(initial);
        }
      },
      capture({ text, cursor, title }) {
        if (!recording) return;
        const key = `${text}\0${cursor}\0${title || ''}`;
        if (key === lastKey) return;
        lastKey = key;
        snapshots.push({
          t: performance.now() - startTime,
          text: text || '',
          cursor: typeof cursor === 'number' ? cursor : (text || '').length,
          title: title || '',
        });
      },
      stop() {
        recording = false;
        return snapshots;
      },
    };
  }

  function wrapLine(ctx, line, maxWidth) {
    if (!line) return [''];
    const lines = [];
    let current = '';
    for (const ch of line) {
      const test = current + ch;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = ch;
      } else {
        current = test;
      }
    }
    lines.push(current);
    return lines;
  }

  function buildTextLayout(ctx, text, maxWidth) {
    const layout = [];
    const parts = (text || '').split('\n');
    let offset = 0;

    for (let i = 0; i < parts.length; i++) {
      const wrapped = wrapLine(ctx, parts[i], maxWidth);
      if (wrapped.length === 0 || (wrapped.length === 1 && wrapped[0] === '' && parts[i] === '')) {
        layout.push({ text: '', start: offset, end: offset });
      } else {
        for (const lineText of wrapped) {
          layout.push({ text: lineText, start: offset, end: offset + lineText.length });
          offset += lineText.length;
        }
      }
      if (i < parts.length - 1) offset += 1;
    }

    return layout;
  }

  function findCursorLine(layout, cursor) {
    if (!layout.length) return { lineIndex: 0, colOffset: 0 };
    for (let i = 0; i < layout.length; i++) {
      const line = layout[i];
      if (cursor <= line.end) {
        return { lineIndex: i, colOffset: Math.max(0, cursor - line.start) };
      }
    }
    const last = layout[layout.length - 1];
    return { lineIndex: layout.length - 1, colOffset: last.text.length };
  }

  function computeScrollY(cursorLine, lineHeightPx, bodyTop, bodyHeight) {
    const cursorY = bodyTop + cursorLine * lineHeightPx;
    const margin = lineHeightPx * 2;
    if (cursorY + lineHeightPx > bodyTop + bodyHeight - margin) {
      return Math.max(0, cursorY - bodyTop - bodyHeight + lineHeightPx + margin);
    }
    return 0;
  }

  function renderFrame(ctx, snapshot, dims) {
    const { width, height, bodySize, titleSize, lineHeight } = dims;
    const paddingX = Math.round(width * 0.08);
    const paddingY = Math.round(height * 0.08);
    const titleGap = Math.round(bodySize * 0.8);
    const title = (snapshot.title || '').trim();

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    let bodyTop = paddingY;
    if (title) {
      ctx.font = `900 ${titleSize}px "Noto Sans JP", "Hiragino Sans", sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.textBaseline = 'top';
      const titleLines = wrapLine(ctx, title, width - paddingX * 2);
      for (const tl of titleLines) {
        ctx.fillText(tl, paddingX, bodyTop);
        bodyTop += titleSize * 1.3;
      }
      bodyTop += titleGap;
    }

    const bodyHeight = height - bodyTop - paddingY;
    const maxWidth = width - paddingX * 2;
    const lineHeightPx = bodySize * lineHeight;

    ctx.font = `400 ${bodySize}px "Noto Sans JP", "Hiragino Sans", sans-serif`;
    const layout = buildTextLayout(ctx, snapshot.text, maxWidth);
    const { lineIndex, colOffset } = findCursorLine(layout, snapshot.cursor);
    const scrollY = computeScrollY(lineIndex, lineHeightPx, bodyTop, bodyHeight);

    ctx.save();
    ctx.beginPath();
    ctx.rect(paddingX, bodyTop, maxWidth, bodyHeight);
    ctx.clip();

    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';

    let caretX = paddingX;
    let caretY = bodyTop;

    for (let i = 0; i < layout.length; i++) {
      const line = layout[i];
      const y = bodyTop + i * lineHeightPx - scrollY;
      if (y + lineHeightPx < bodyTop || y > bodyTop + bodyHeight) continue;
      ctx.fillText(line.text, paddingX, y);
      if (i === lineIndex) {
        caretX = paddingX + ctx.measureText(line.text.slice(0, colOffset)).width;
        caretY = y;
      }
    }

    const caretVisible = caretY >= bodyTop - lineHeightPx && caretY <= bodyTop + bodyHeight;
    if (caretVisible) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(caretX, caretY, Math.max(2, bodySize * 0.06), bodySize * 0.95);
    }

    ctx.restore();
  }

  function computeDurations(snapshots, speed) {
    if (!snapshots.length) return [];
    const durations = [];
    for (let i = 0; i < snapshots.length; i++) {
      if (i < snapshots.length - 1) {
        const delta = snapshots[i + 1].t - snapshots[i].t;
        durations.push(Math.max(0.016, delta / 1000 / speed));
      } else {
        durations.push(LAST_FRAME_DURATION);
      }
    }

    const total = durations.reduce((a, b) => a + b, 0);
    if (total < MIN_VIDEO_DURATION) {
      const scale = MIN_VIDEO_DURATION / total;
      return durations.map((d) => d * scale);
    }
    return durations;
  }

  function buildConcatContent(frameCount, durations) {
    let content = '';
    for (let i = 0; i < frameCount; i++) {
      const name = `frame${String(i).padStart(4, '0')}.jpg`;
      content += `file '${name}'\n`;
      if (i < frameCount - 1) {
        content += `duration ${durations[i].toFixed(4)}\n`;
      }
    }
    const last = `frame${String(frameCount - 1).padStart(4, '0')}.jpg`;
    content += `file '${last}'\n`;
    return content;
  }

  async function canvasToJpegBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('canvas toBlob failed'))),
        'image/jpeg',
        quality ?? 0.92,
      );
    });
  }

  async function loadFFmpeg(onProgress) {
    if (ffmpegInstance) return ffmpegInstance;
    if (ffmpegLoading) return ffmpegLoading;

    ffmpegLoading = (async () => {
      onProgress?.({ phase: 'loading', percent: 0, message: '動画ライブラリを読み込み中…' });

      const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
        import(getFfmpegModuleUrl()),
        import(`https://cdn.jsdelivr.net/npm/@ffmpeg/util@${FFMPEG_UTIL_VERSION}/+esm`),
      ]);

      const baseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;
      const ffmpeg = new FFmpeg();

      ffmpeg.on('progress', ({ progress }) => {
        const raw = Number(progress);
        const pct = Number.isFinite(raw)
          ? Math.min(99, Math.max(0, Math.round(raw * 100)))
          : 0;
        onProgress?.({ phase: 'encode', percent: pct, message: `エンコード中 ${pct}%` });
      });

      ffmpeg.on('log', ({ message }) => {
        if (typeof console !== 'undefined') console.debug('[ffmpeg]', message);
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      ffmpegInstance = { ffmpeg, fetchFile };
      onProgress?.({ phase: 'loading', percent: 100, message: '読み込み完了' });
      return ffmpegInstance;
    })();

    try {
      return await ffmpegLoading;
    } finally {
      ffmpegLoading = null;
    }
  }

  async function encodeFormat(ffmpeg, fetchFile, frameCount, format) {
    const concatName = 'frames.txt';
    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', concatName,
      '-vsync', 'vfr',
      '-pix_fmt', 'yuv420p',
      ...(format === 'mp4'
        ? ['-c:v', 'libx264', '-movflags', '+faststart', 'output.mp4']
        : ['-c:v', 'libvpx', 'output.webm']),
    ]);

    const outName = format === 'mp4' ? 'output.mp4' : 'output.webm';
    const data = await ffmpeg.readFile(outName);
    const mime = format === 'mp4' ? 'video/mp4' : 'video/webm';
    return new Blob([data.buffer], { type: mime });
  }

  async function cleanupFFmpegFiles(ffmpeg, frameCount) {
    const names = ['frames.txt', 'output.mp4', 'output.webm'];
    for (let i = 0; i < frameCount; i++) {
      names.push(`frame${String(i).padStart(4, '0')}.jpg`);
    }
    for (const name of names) {
      try {
        await ffmpeg.deleteFile(name);
      } catch (_) {}
    }
  }

  function validateSnapshots(snapshots) {
    if (!snapshots || snapshots.length === 0) {
      throw new Error('録画データがありません。');
    }
    const hasText = snapshots.some((s) => (s.text || '').length > 0);
    if (!hasText) {
      throw new Error('本文が空のため動画を生成できません。');
    }
    if (snapshots.length < 2) {
      throw new Error('入力の変化が少なすぎます。もう少し執筆してから停止してください。');
    }
  }

  async function exportVideo(snapshots, options, onProgress) {
    validateSnapshots(snapshots);

    const resolution = options.resolution === '1080p' ? '1080p' : '720p';
    const speed = Math.max(1, Number(options.speed) || 8);
    const formats = Array.isArray(options.formats) ? options.formats : ['mp4'];
    const dims = RESOLUTIONS[resolution];
    const durations = computeDurations(snapshots, speed);
    const frameCount = snapshots.length;

    const canvas = document.createElement('canvas');
    canvas.width = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext('2d');

    onProgress?.({ phase: 'render', percent: 0, message: 'フレームを描画中…' });

    const jpegBlobs = [];
    for (let i = 0; i < frameCount; i++) {
      renderFrame(ctx, snapshots[i], dims);
      jpegBlobs.push(await canvasToJpegBlob(canvas));
      const pct = Math.round(((i + 1) / frameCount) * 100);
      onProgress?.({ phase: 'render', percent: pct, message: `フレームを描画中 ${pct}%` });
    }

    const { ffmpeg, fetchFile } = await loadFFmpeg(onProgress);

    for (let i = 0; i < frameCount; i++) {
      const name = `frame${String(i).padStart(4, '0')}.jpg`;
      await ffmpeg.writeFile(name, await fetchFile(jpegBlobs[i]));
    }

    const concatContent = buildConcatContent(frameCount, durations);
    await ffmpeg.writeFile('frames.txt', new TextEncoder().encode(concatContent));

    const result = {};
    for (let fi = 0; fi < formats.length; fi++) {
      const format = formats[fi] === 'webm' ? 'webm' : 'mp4';
      onProgress?.({
        phase: 'encode',
        percent: 0,
        message: format === 'mp4' ? 'MP4 を生成中…' : 'WebM を生成中…',
      });
      result[format] = await encodeFormat(ffmpeg, fetchFile, frameCount, format);
      await cleanupFFmpegFiles(ffmpeg, frameCount);
      if (fi < formats.length - 1) {
        for (let i = 0; i < frameCount; i++) {
          const name = `frame${String(i).padStart(4, '0')}.jpg`;
          await ffmpeg.writeFile(name, await fetchFile(jpegBlobs[i]));
        }
        await ffmpeg.writeFile('frames.txt', new TextEncoder().encode(concatContent));
      }
    }

    onProgress?.({ phase: 'encode', percent: 100, message: '完了' });
    return result;
  }

  function estimateVideoDuration(snapshots, speed) {
    if (!snapshots.length) return 0;
    const durations = computeDurations(snapshots, speed);
    return durations.reduce((a, b) => a + b, 0);
  }

  global.TadekuTimelapse = {
    RESOLUTIONS,
    createRecorder,
    renderFrame,
    exportVideo,
    estimateVideoDuration,
    computeDurations,
  };
})(typeof window !== 'undefined' ? window : globalThis);
