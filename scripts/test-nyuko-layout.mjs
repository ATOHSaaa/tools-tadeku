import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const PORT = 8765;
const ROOT = new URL('..', import.meta.url).pathname;

const SAMPLE = `私には高校生になるまでの記憶がまるで無い。
思い出す機会が無いので記憶も無いと勘違いしているのかもしれない、
そう考えて海馬《かいば》を縦横無尽に駆け巡ってみても、ちっとも記憶にぶち当たりやしない。
感覚《かんかく》が蘇ることはない。鉛筆を持った感触《かんしょく》も思い出せない。
転校生《てんこうせい》の新しい級友も、いったい、どういう事だっけと思いだし、それに包まれるだけなのだ。`;

function startServer() {
  return spawn('python3', ['-m', 'http.server', String(PORT)], {
    cwd: ROOT,
    stdio: 'ignore',
  });
}

async function run() {
  const server = startServer();
  await sleep(800);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await page.goto(`http://127.0.0.1:${PORT}/gS6Qp20/index.html`, { waitUntil: 'networkidle' });

    const result = await page.evaluate((text) => {
      const format = window.NyukoData.FORMATS.b5;
      const font = window.NyukoData.FONTS.shippori;
      const opts = { writingDirection: 'vertical', lineHeightH: 8, letterSpacing: 0 };
      const layout = window.NyukoEngine.paginate(text, format, font, opts);
      const quality = window.NyukoEngine.evaluateLayoutQuality(layout.pages, format);
      const typo = layout.typography || {};
      return {
        pageCount: layout.pageCount,
        quality,
        typography: {
          colsPerLine: typo.colsPerLine,
          linesPerPage: typo.linesPerPage,
          letterSpacing: typo.letterSpacing,
          columnWidthMm: typo.columnWidthMm,
        },
        firstPageCols: layout.pages[0] && layout.pages[0].columns
          ? layout.pages[0].columns.length
          : 0,
        gridMode: layout.pages[0] && layout.pages[0].type === 'grid',
      };
    }, SAMPLE);

    console.log('=== Nyuko グリッド組版テスト ===');
    console.log(JSON.stringify(result, null, 2));

    const failures = [];
    if (!result.gridMode) failures.push('グリッドモードになっていない');
    if (result.quality.kinsokuViolations.length > 0) {
      failures.push(`禁則違反 ${result.quality.kinsokuViolations.length} 件`);
    }
    if (result.quality.overflowCols > 0) {
      failures.push(`列あふれ ${result.quality.overflowCols} 列`);
    }
    if (result.typography.letterSpacing < 0.3) {
      failures.push(`字送りが不足 (letter-spacing=${result.typography.letterSpacing})`);
    }
    if (result.quality.maxColsPerPage < result.typography.linesPerPage * 0.6 && result.pageCount > 1) {
      failures.push(`列密度が低い (max=${result.quality.maxColsPerPage}, 期待≈${result.typography.linesPerPage})`);
    }
    if (result.quality.avgColFill < 0.55 && result.quality.colCount >= result.typography.linesPerPage) {
      failures.push(`列充填率が低い (${(result.quality.avgColFill * 100).toFixed(0)}%)`);
    }

    await page.setViewportSize({ width: 1400, height: 900 });
    await page.evaluate((text) => {
      const editor = document.getElementById('editor');
      if (editor) {
        editor.value = text;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, SAMPLE);
    await sleep(1500);

    const domCheck = await page.evaluate(() => {
      const grid = document.querySelector('.nyuko-v-grid');
      const cols = document.querySelectorAll('.nyuko-col');
      const body = document.querySelector('.nyuko-page-body');
      const rect = body ? body.getBoundingClientRect() : null;
      const xs = [...cols].map((c) => Math.round(c.getBoundingClientRect().left));
      const widths = [...cols].map((c) => Math.round(c.getBoundingClientRect().width));
      const uniqueX = new Set(xs);
      const minGap = xs.length > 1
        ? Math.min(...xs.slice(0, -1).map((x, i) => Math.abs(x - xs[i + 1]) - widths[i + 1]))
        : 0;
      let punctAtColStart = 0;
      cols.forEach((col) => {
        const t = (col.textContent || '').trim();
        if (/^[、。，．？！）」』]/.test(t)) punctAtColStart += 1;
      });
      return {
        hasGrid: Boolean(grid),
        colCount: cols.length,
        bodyWidth: rect ? rect.width : 0,
        colSpread: uniqueX.size,
        colXs: xs.slice(0, 8),
        minColGap: minGap,
        kinSpans: document.querySelectorAll('.nyuko-kin').length,
        punctAtColStart,
      };
    }, SAMPLE);

    console.log('=== DOM プレビュー ===');
    console.log(JSON.stringify(domCheck, null, 2));

    if (!domCheck.hasGrid) failures.push('プレビューに .nyuko-v-grid が無い');
    if (domCheck.colCount < 3) failures.push(`列数が少なすぎる (${domCheck.colCount})`);
    if (domCheck.kinSpans > 0) failures.push(`グリッド列に nowrap 禁則 span が残っている (${domCheck.kinSpans})`);
    if (domCheck.minColGap < 1) failures.push(`列間が狭すぎる (gap=${domCheck.minColGap}px)`);
    if (domCheck.punctAtColStart > 0) {
      failures.push(`DOM上の行頭句読点 ${domCheck.punctAtColStart} 列`);
    }

    if (failures.length) {
      console.error('\n❌ FAIL');
      failures.forEach((f) => console.error(' -', f));
      process.exitCode = 1;
    } else {
      console.log('\n✅ PASS');
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
