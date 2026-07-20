import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = 8777 + Math.floor(Math.random() * 100);

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

  await page.goto(`http://127.0.0.1:${PORT}/iwe/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#btn-new-work-welcome', { timeout: 10000 });

  page.on('dialog', async (d) => {
    await d.accept(d.type() === 'prompt' ? 'テスト作品' : undefined);
  });

  await page.click('#btn-new-work-welcome');
  await page.waitForSelector('#workspace:not([hidden])', { timeout: 20000 });

  const addBtn = page.locator('.tree-section .tree-add').first();
  await addBtn.click();
  await sleep(1200);

  const treeFiles = await page.$$('.tree-file');
  if (!treeFiles.length) throw new Error('ファイルツリーに項目がありません');

  await treeFiles[0].click();
  await page.fill('textarea', 'テスト本文|漢字《かんじ》');
  await sleep(1500);

  const status = await page.textContent('#status-bar');
  if (!status?.includes('字')) throw new Error('ステータスバーが更新されていません: ' + status);

  console.log('IWE smoke test OK');
} catch (e) {
  failed = true;
  const html = await page.content().catch(() => '');
  console.error('IWE smoke test FAILED:', e.message);
  console.error('Page snippet:', html.slice(0, 500));
} finally {
  await browser.close();
  server.kill();
  process.exit(failed ? 1 : 0);
}
