import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8877 + Math.floor(Math.random() * 100);

const server = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: ROOT, stdio: 'pipe' });
await sleep(800);

let failed = false;
const browser = await chromium.launch();
const page = await browser.newPage();

try {
  page.on('pageerror', (e) => console.error('PAGE ERROR:', e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('CONSOLE:', msg.text());
  });

  async function writeAndFinish(text, expect) {
    await page.fill('#editor', text);
    await page.locator('#editor').dispatchEvent('input');
    await page.waitForFunction(() => !document.getElementById('finish-step-btn').disabled, { timeout: 5000 });
    await page.evaluate(() => document.getElementById('finish-step-btn').click());
    if (expect === 'complete') {
      await page.waitForSelector('#complete-view:not([hidden])', { timeout: 5000 });
      return;
    }
    await page.waitForFunction((label) => {
      const badge = document.getElementById('step-badge');
      return badge && badge.textContent.includes(label);
    }, expect, { timeout: 5000 });
  }

  await page.goto(`http://127.0.0.1:${PORT}/suiko/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#start-btn', { timeout: 10000 });

  await page.click('#start-btn');
  await page.waitForSelector('#editor-view:not([hidden])', { timeout: 5000 });
  await page.fill('#work-title', 'テスト短編');
  await page.fill('#editor', '初稿の本文です。');
  await page.locator('#editor').dispatchEvent('input');

  const refHiddenBefore = await page.$eval('#ref-panel', (el) => el.hidden);
  if (!refHiddenBefore) throw new Error('初稿で前の版パネルが表示されています');

  await writeAndFinish('初稿の本文です。', '第二稿');

  const refText = await page.textContent('#ref-body');
  if (!refText.includes('初稿の本文')) throw new Error('前の版が表示されていません: ' + refText);

  const tabCount = await page.$$eval('.ref-tab', (els) => els.length);
  if (tabCount !== 1) throw new Error('第二稿時の参照タブ数が不正: ' + tabCount);

  await writeAndFinish('第二稿の本文。', '第三稿');

  const tabCount2 = await page.$$eval('.ref-tab', (els) => els.length);
  if (tabCount2 !== 2) throw new Error('第三稿時の参照タブ数が不正: ' + tabCount2);

  await page.click('.ref-tab[data-step="0"]');
  const ref初稿 = await page.textContent('#ref-body');
  if (!ref初稿.includes('初稿の本文')) throw new Error('初稿タブの参照が開けません: ' + ref初稿);

  const draftLabels = ['第三稿', '第四稿', '第五稿', '第六稿'];
  for (let i = 0; i < draftLabels.length; i++) {
    const expect = i < draftLabels.length - 1 ? draftLabels[i + 1] : 'complete';
    await writeAndFinish(draftLabels[i] + 'の本文。', expect);
  }
  const cards = await page.$$('.version-card');
  if (cards.length !== 6) throw new Error('完成版が6つではありません: ' + cards.length);

  await page.click('#complete-home-btn');
  await page.waitForSelector('#home-view:not([hidden])', { timeout: 5000 });
  const historyText = await page.textContent('#history-list');
  if (!historyText.includes('テスト短編')) throw new Error('履歴に作品がありません');

  const projectId = await page.evaluate(() => sessionStorage.getItem('tadeku-suiko-active'));
  if (!projectId) throw new Error('作品IDが保存されていません');

  await page.reload({ waitUntil: 'domcontentloaded' });
  const onHomeAfterReload = await page.$eval('#home-view', (el) => !el.hidden);
  if (!onHomeAfterReload) throw new Error('パラメータなしのリロードで一覧が表示されません');

  await page.goto(`http://127.0.0.1:${PORT}/suiko/index.html?id=${encodeURIComponent(projectId)}`, { waitUntil: 'domcontentloaded' });
  const onEditor = await page.$eval('#editor-view', (el) => !el.hidden).catch(() => false);
  const onComplete = await page.$eval('#complete-view', (el) => !el.hidden).catch(() => false);
  if (!onEditor && !onComplete) throw new Error('?id= 指定で作品が開きません');

  await page.goto(`http://127.0.0.1:${PORT}/suiko/index.html?id=missing-project`, { waitUntil: 'domcontentloaded' });
  const onHomeAfterMissing = await page.$eval('#home-view', (el) => !el.hidden);
  if (!onHomeAfterMissing) throw new Error('存在しない id では一覧に戻りません');

  console.log('Suiko smoke test OK');
} catch (e) {
  failed = true;
  const html = await page.content().catch(() => '');
  console.error('Suiko smoke test FAILED:', e.message);
  console.error('Page snippet:', html.slice(0, 500));
} finally {
  await browser.close();
  server.kill();
  process.exit(failed ? 1 : 0);
}
