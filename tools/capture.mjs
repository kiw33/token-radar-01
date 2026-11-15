// Captures the radar dashboard's three screenshots in headless Chromium: the board, a protocol's
// detail drawer, and a filtered view. One fresh page per shot (a hash-only navigation does not
// reload the document). Fails loudly on console errors or page errors, checks the detail drawer's
// recompute line agrees with board.json, and sizes each JPEG into the 300-350 KB band the dossier
// wants. Writes into the repository's screenshots/ (replacing placeholders).
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..');
const outDir = join(repo, 'out');
const shotDir = join(repo, 'screenshots');
const board = JSON.parse(readFileSync(join(outDir, 'board.json'), 'utf8'));
const rank1 = board.rows[0];

mkdirSync(shotDir, { recursive: true });
for (const f of readdirSync(shotDir)) rmSync(join(shotDir, f));

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const errors = [];
const base = 'file://' + join(outDir, 'dashboard', 'index.html');

async function ready(page) {
  await page.waitForFunction(
    () => document.getElementById('board')?.getAttribute('aria-busy') === 'false',
    null, { timeout: 30000 },
  );
  await page.waitForTimeout(400);
}

async function shoot(name, url, checkDetail = false) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(String(err)));
  console.log(`capture ${name} <- ${url}`);
  await page.goto(url, { waitUntil: 'load', timeout: 30000 });
  await ready(page);
  if (checkDetail) {
    await page.waitForFunction(() => document.querySelector('dialog.detail')?.open === true, null, { timeout: 10000 });
    const detailCheck = await page.evaluate(() => {
      const dialog = document.querySelector('dialog.detail');
      const text = dialog ? dialog.textContent : '';
      const steps = [...dialog.querySelectorAll('ol.steps li b')].map((b) => b.textContent);
      return { recomputeAgrees: text.includes('the same number board.json carries'), steps };
    });
    console.log('detail recompute agrees with board.json:', detailCheck.recomputeAgrees);
    const boardSteps = rank1.farm_steps.map((s) => s.split(' Cost: ')[0]);
    const stepsMatch = detailCheck.steps.length === boardSteps.length &&
      detailCheck.steps.every((s, i) => s === boardSteps[i]);
    console.log('detail farm steps match board.json:', stepsMatch, `(${detailCheck.steps.length} steps)`);
    if (!detailCheck.recomputeAgrees || !stepsMatch) throw new Error('detail drawer disagrees with board.json');
  }
  let quality = 88;
  let buffer;
  for (;;) {
    buffer = await page.screenshot({ type: 'jpeg', quality });
    if (buffer.length <= 350 * 1024 || quality <= 55) break;
    quality -= 7;
  }
  writeFileSync(join(shotDir, name), buffer);
  console.log(`wrote ${name} (${buffer.length} bytes, quality ${quality})`);
  await page.close();
}

await shoot('1-board.jpg', base);
await shoot('2-detail.jpg', `${base}#p=${encodeURIComponent(rank1.slug)}`, true);
await shoot('3-filtered.jpg', `${base}#category=Lending`);

if (errors.length > 0) throw new Error(`console/page errors: ${errors.join(' | ')}`);
await browser.close();
console.log('done, no console errors');
