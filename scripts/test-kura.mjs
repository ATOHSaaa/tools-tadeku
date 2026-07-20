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

  await page.goto(`http://127.0.0.1:${PORT}/kura/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#fragment-input', { timeout: 10000 });

  // 2. 断片を書いて投函
  await page.fill('#fragment-input', 'テスト断片。窓の外で自転車のベルが二度鳴った。');
  await page.click('#post-btn');
  await page.waitForSelector('#write-done:not([hidden])', { timeout: 5000 });

  // 3. 「もう1枚書く」で再び書ける
  await page.click('#write-more-btn');
  await page.waitForSelector('#write-form:not([hidden])', { timeout: 5000 });

  // 4. 蔵: サンプル10枚を仕込む(熟成済みになる)
  await page.click('.tab[data-view="kura"]');
  await page.click('#seed-btn');
  const fragCount = await page.$$eval('#frag-list li', (lis) => lis.length);
  if (fragCount < 11) throw new Error(`断片リストが少なすぎます: ${fragCount}`);

  // 中身が封印されている(本文テキストが出ていない)
  const listText = await page.textContent('#frag-list');
  if (listText.includes('自転車のベル')) throw new Error('断片の本文が封印されていません');

  // 5. 配牌: 3枚配られる
  await page.click('.tab[data-view="deal"]');
  await page.waitForSelector('#deal-btn:not([hidden])', { timeout: 5000 });
  await page.click('#deal-btn');
  await page.waitForSelector('#deal-area:not([hidden])', { timeout: 5000 });
  const cards = await page.$$('.deal-card');
  if (cards.length !== 3) throw new Error(`配牌が3枚ではありません: ${cards.length}`);

  // 6. 引き直しは1回だけ
  await page.click('#redraw-btn');
  const redrawHidden = await page.$eval('#redraw-btn', (el) => el.hidden);
  if (!redrawHidden) throw new Error('引き直しボタンが1回で消えていません');

  // 7. 掌編を書いて保存 → 作品ビューへ
  await page.fill('#work-title', 'テスト掌編');
  await page.fill('#work-body', '配られた三枚をつないで書いた掌編のテスト本文。');
  await page.click('#save-work-btn');
  await page.waitForSelector('#view-works:not([hidden])', { timeout: 5000 });
  const workTitle = await page.textContent('.work-item .work-title');
  if (workTitle !== 'テスト掌編') throw new Error('作品が保存されていません: ' + workTitle);
  const sourceCount = await page.$$eval('.work-item .source-frag', (els) => els.length);
  if (sourceCount !== 3) throw new Error(`作品の元断片が3枚ではありません: ${sourceCount}`);

  // 8. リロードしても残っている
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.click('.tab[data-view="works"]');
  const workTitle2 = await page.textContent('.work-item .work-title');
  if (workTitle2 !== 'テスト掌編') throw new Error('リロード後に作品が消えています');

  // 9. 蔵で使用回数が記録されている
  await page.click('.tab[data-view="kura"]');
  const kuraText = await page.textContent('#frag-list');
  if (!kuraText.includes('使用 1回')) throw new Error('断片の使用回数が記録されていません');

  console.log('Kura smoke test OK');
} catch (e) {
  failed = true;
  const html = await page.content().catch(() => '');
  console.error('Kura smoke test FAILED:', e.message);
  console.error('Page snippet:', html.slice(0, 500));
} finally {
  await browser.close();
  server.kill();
  process.exit(failed ? 1 : 0);
}
