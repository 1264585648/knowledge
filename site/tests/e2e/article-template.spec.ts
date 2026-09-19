import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

// Render the REAL Astro build output. The mock HTTP origin is test-only: it does
// not change the Worker, sign in, or expose a production bypass. access.spec.ts
// continues to exercise the actual Wrangler gate independently.
const dist = resolve('dist');
const a = '/articles/what-is-rag/';
const b = '/articles/rag-template-example/';
const key = 'zhiye:article:v1:what-is-rag:notes';
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.css': 'text/css',
  '.js': 'text/javascript', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
test.use({ baseURL: 'http://reader.test', reducedMotion: 'reduce' });
let errors: string[];
test.beforeEach(async ({ context, page }) => {
  errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route('http://reader.test/**', async route => {
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const path = resolve(dist, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!path.startsWith(dist + sep)) { await route.fulfill({ status: 403 }); return; }
    try { await route.fulfill({ body: await readFile(path), contentType: mime[extname(path)] || 'application/octet-stream' }); }
    catch { await route.fulfill({ status: 404, body: 'Not found' }); }
  });
});
test.afterEach(() => { expect(errors).toEqual([]); });

test('two Markdown entries share the shell; metadata, cover and navigation vary', async ({ page }) => {
  await page.goto(a);
  await expect(page.locator('body')).toHaveAttribute('data-reader-ready', 'true');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('什么是 RAG：让大模型先查资料，再回答');
  await expect(page.locator('.article-cover img')).toBeVisible();
  expect(await page.locator('.article-cover img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(768);
  await expect(page.locator('.toc a')).toHaveCount(3);
  await expect(page.locator('.adjacent-articles a[rel=next]')).toHaveAttribute('href', b);
  await page.locator('.adjacent-articles a[rel=next]').click();
  await expect(page.locator('h1')).toHaveText('只写 Markdown：文章模板使用示例');
  await expect(page.locator('.article-cover')).toHaveCount(0);
  await expect(page.locator('.adjacent-articles a[rel=prev]')).toHaveAttribute('href', a);
  await expect(page.locator('.adjacent-articles a[rel=next]')).toHaveCount(0);
  await expect(page.locator('.toc .subheading')).toHaveCount(3);
  await expect(page.locator('.topic-links a[aria-current=page]')).toHaveAttribute('href', b);
});

test('Unicode TOC and content search work without hand-written section wrappers', async ({ page }) => {
  await page.goto(a);
  await expect(page.locator('.article-section')).toHaveCount(0);
  const last = page.locator('.toc a').last(), id = await last.getAttribute('data-section-id');
  await last.click();
  expect(decodeURIComponent(new URL(page.url()).hash.slice(1))).toBe(id);
  await expect(last).toHaveAttribute('aria-current', 'location');
  await page.locator('[data-search=article]').click();
  await page.locator('#search-input').fill('备份保留策略');
  await expect(page.locator('#search-results .search-result')).toHaveCount(1);
  await page.locator('#search-input').press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('#search-dialog')).not.toBeVisible();
});

test('notes persist on this HTTP origin and never appear on a different article', async ({ page }) => {
  await page.goto(a);
  await page.locator('#notes-tab').click();
  await page.locator('#note-input').fill('只属于首篇的理解');
  await page.locator('#save-note').click();
  await page.reload();
  await page.locator('#notes-tab').click();
  await expect(page.locator('#notes-list')).toContainText('只属于首篇的理解');
  await page.goto(b);
  await page.locator('#notes-tab').click();
  await expect(page.locator('#notes-count')).toHaveText('0 条批注');
  await page.locator('#note-input').fill('第二篇的独立批注');
  await page.locator('#save-note').click();
  await page.goto(a);
  await page.locator('#notes-tab').click();
  await expect(page.locator('#notes-list')).not.toContainText('第二篇的独立批注');
  await expect(page.locator('#notes-count')).toHaveText('1 条批注');
});

test('native Markdown selection, edit, export and confirmed delete', async ({ page }) => {
  await page.goto(a);
  await page.locator('#article-body>p').first().evaluate(el => {
    const range = document.createRange(); range.selectNodeContents(el);
    const selection = getSelection()!; selection.removeAllRanges(); selection.addRange(range);
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  });
  await expect(page.locator('#selection-tools')).toBeVisible();
  await page.locator('[data-selection=note]').click();
  await expect(page.locator('#note-quote')).toContainText('测试环境');
  await page.locator('#note-input').fill('一个摘录');
  await page.locator('#save-note').click();
  await page.getByRole('button', { name: '编辑', exact: true }).click();
  await page.locator('#note-input').fill('修改后的摘录');
  await page.locator('#save-note').click();
  await expect(page.locator('#notes-list')).toContainText('修改后的摘录');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-notes').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('what-is-rag-notes.md');
  const downloadPath = await download.path();
  expect(await readFile(downloadPath!, 'utf8')).toContain('修改后的摘录');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.locator('#notes-count')).toHaveText('0 条批注');
});

test('corrupt, concurrent and stale-heading records are preserved safely', async ({ page, context }) => {
  await page.goto(a);
  await page.evaluate(key => localStorage.setItem(key, '{broken'), key);
  await page.reload();
  await page.locator('#notes-tab').click();
  await expect(page.locator('#storage-warning')).toBeVisible();
  await page.locator('#note-input').fill('内存中的新批注');
  await page.locator('#save-note').click();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe('{broken');
  // A fresh document with a heading that no longer exists must still retain text.
  const other = await context.newPage();
  await other.goto(b);
  await other.evaluate(key => localStorage.setItem(key, JSON.stringify([{ id: 'legacy-heading', text: '章节改名也不丢失',
    created: '2026-09-19T00:00:00Z', quote: { text: '旧摘录', section: 'removed-heading' } }])), key);
  await other.goto(a);
  await other.locator('#notes-tab').click();
  await expect(other.locator('#notes-list')).toContainText('章节改名也不丢失');
  await expect(other.locator('#notes-list')).toContainText('原章节已调整');
  await expect(page.locator('#storage-warning')).toContainText('其他标签页');
  await page.locator('#note-input').fill('不能覆盖另一页');
  await page.locator('#save-note').click();
  expect(await other.evaluate(key => localStorage.getItem(key), key)).toContain('legacy-heading');
  await other.close();
});

test('questions and notes render plain text, with no fabricated AI reply', async ({ page }) => {
  await page.goto(b);
  await page.locator('#question-input').fill('<img src=x onerror=alert(1)>');
  await page.locator('#question-form button[type=submit]').click();
  await expect(page.locator('#discussion-list')).toContainText('<img src=x onerror=alert(1)>');
  await expect(page.locator('#discussion-list img')).toHaveCount(0);
  await expect(page.locator('#discussion-list article')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#discussion-list article')).toHaveCount(0);
});

test('responsive grid, drawer restore, focus mode, bookmark and global theme', async ({ page }) => {
  await page.goto(a);
  for (const width of [320, 390, 768, 820, 821, 1024, 1100, 1101, 1199, 1280, 1439, 1440, 1586, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}px`).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.floating-dock [data-drawer=library]').click();
  await expect(page.locator('#drawer #library')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.workspace>#library')).toHaveCount(1);
  await page.locator('.floating-dock [data-drawer=tools]').click();
  await page.locator('#notes-tab').click();
  await page.locator('#note-input').fill('跨断点的草稿');
  await page.setViewportSize({ width: 1586, height: 992 });
  await expect(page.locator('#drawer')).not.toBeVisible();
  await expect(page.locator('.workspace>#right-rail')).toBeVisible();
  await expect(page.locator('#note-input')).toHaveValue('跨断点的草稿');
  await page.locator('#note-input').fill('');
  await page.locator('.more>summary').click();
  await page.locator('.more [data-focus]').click();
  await expect(page.locator('.library')).not.toBeVisible();
  await page.locator('.exit-focus').click();
  await expect(page.locator('.library')).toBeVisible();
  await page.locator('#bookmark').click();
  await page.locator('#theme-toggle').click();
  await page.goto(b);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#bookmark')).toHaveAttribute('aria-pressed', 'false');
  await page.goto(a);
  await expect(page.locator('#bookmark')).toHaveAttribute('aria-pressed', 'true');
});
