import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:9876/wanlapse/';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', (msg) => {
  console.log(`[${msg.type()}]`, msg.text());
});

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.TadekuTimelapse, { timeout: 10000 });

const recorder = await page.evaluate(() => {
  const r = TadekuTimelapse.createRecorder();
  r.start({ text: '', cursor: 0, title: 'Test' });
  r.capture({ text: 'あ', cursor: 1, title: 'Test' });
  r.capture({ text: 'あい', cursor: 2, title: 'Test' });
  r.capture({ text: 'あいう', cursor: 3, title: 'Test' });
  return r.stop();
});

console.log('snapshots:', recorder.length);

const blobSize = await page.evaluate(async (snapshots) => {
  const result = await TadekuTimelapse.exportVideo(
    snapshots,
    { speed: 8, resolution: '720p', formats: ['webm'] },
    (p) => console.log('progress', JSON.stringify(p)),
  );
  return result.webm.size;
}, recorder);

console.log('webm bytes:', blobSize);
if (!blobSize || blobSize < 1000) throw new Error('export failed');

await browser.close();
console.log('OK');
