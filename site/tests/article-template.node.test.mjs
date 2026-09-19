import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { isPublished, topicArticles, adjacentArticles, readingMinutes, articleURL } from '../src/data/article-utils.ts';
const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const article = (id, order, overrides = {}) => ({ id, data: { title: id, summary: id,
  publishedAt: new Date('2026-01-01'), status: 'published', topics: ['rag'], order, ...overrides } });
test('draft and future articles are excluded at build time', () => {
  const now = Date.parse('2026-09-19T12:00:00Z');
  assert.equal(isPublished(article('a', 1), now), true);
  assert.equal(isPublished(article('draft', 1, { status: 'draft' }), now), false);
  assert.equal(isPublished(article('future', 1, { publishedAt: new Date('2099-01-01') }), now), false);
  assert.equal(isPublished(article('invalid', 1, { publishedAt: new Date('invalid') }), now), false);
});
test('topic order, ascending date and slug break ties without mutating input', () => {
  const input = [article('z', undefined), article('b', 2), article('a', 1), article('other', 1, { topics: ['agent'] })];
  assert.deepEqual(topicArticles(input, 'rag').map(a => a.id), ['a', 'b', 'z']);
  assert.equal(input[0].id, 'z');
  assert.deepEqual(topicArticles([article('b', 1), article('a', 1)], 'rag').map(a => a.id), ['a', 'b']);
});
test('adjacent articles use the primary topic and hide missing ends', () => {
  const a = article('a', 1), b = article('b', 2), c = article('c', 3);
  assert.deepEqual(adjacentArticles([a, b, c], b), { previous: a, next: c });
  assert.equal(adjacentArticles([a, b], a).previous, undefined);
  assert.equal(adjacentArticles([a], a).next, undefined);
  assert.equal(adjacentArticles([b], a).next, undefined);
});
test('multi-topic articles participate in each tree but keep one primary sequence', () => {
  const a = article('a', 1, { topics: ['rag', 'agent'] }), b = article('b', 2, { topics: ['agent'] });
  assert.equal(topicArticles([a, b], 'agent').length, 2);
  assert.equal(adjacentArticles([a, b], a).next, undefined);
});
test('reading time has a minimum and ignores code/images/link destinations', () => {
  assert.equal(readingMinutes(''), 1);
  assert.equal(readingMinutes('中'.repeat(701)), 3);
  assert.equal(readingMinutes('```js\n' + 'x'.repeat(2000) + '\n```'), 1);
  assert.equal(readingMinutes('[标题](https://example.org/' + 'x'.repeat(2000) + ')'), 1);
  assert.equal(articleURL('what-is-rag'), '/articles/what-is-rag/');
});
test('reader is content-agnostic and does not call a model or render user HTML', async () => {
  const script = await readFile(resolve(site, 'public/public/article-reader.js'), 'utf8');
  assert.ok(script.includes('root.dataset.articleId'));
  assert.ok(script.includes('root.dataset.articleTitle'));
  assert.ok(!/what-is-rag|rag-introduction|innerHTML|fetch\(/.test(script));
  assert.ok(script.includes('localStorage.getItem(noteKey) !== state.raw'));
});
test('sample bodies and starter do not require page HTML', async () => {
  for (const path of ['content-example/what-is-rag.md', 'content-example/rag-template-example.md', 'templates/article.md']) {
    const body = (await readFile(resolve(site, path), 'utf8')).replace(/^---[\s\S]*?---\s*/, '');
    assert.ok(!/<(?:div|section|style|script|html)\b/.test(body), path);
    assert.ok(!/^# /m.test(body), path);
    assert.ok(/^## /m.test(body), path);
  }
});
test('starter stays out of the content loader and remains a draft', async () => {
  const template = await readFile(resolve(site, 'templates/article.md'), 'utf8');
  assert.match(template, /status: draft/);
  const sample = await readFile(resolve(site, 'content-example/rag-template-example.md'), 'utf8');
  assert.ok(!/^cover:/m.test(sample));
});
test('new-article command creates content only and never overwrites', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'zhiye-author-'));
  const run = (...args) => spawnSync(process.execPath, ['--experimental-strip-types', resolve(site, 'scripts/new-article.mjs'), ...args], {
    cwd: site, env: { ...process.env, CONTENT_DIR: directory, CONTENT_MODE: 'private' }, encoding: 'utf8', timeout: 10000,
  });
  try {
    assert.equal(run('new-lesson', '--topic', 'rag', '--title', '带有 "引号" 的标题', '--order', '3').status, 0);
    const path = resolve(directory, 'new-lesson.md'), before = await readFile(path, 'utf8');
    assert.match(before, /status: draft/); assert.match(before, /sample: false/); assert.match(before, /order: 3/);
    assert.equal(run('new-lesson', '--topic', 'rag').status, 1);
    assert.equal(await readFile(path, 'utf8'), before);
    assert.equal(run('../escape', '--topic', 'rag').status, 1);
    assert.equal(run('bad-topic', '--topic', 'missing').status, 1);
    assert.equal(run('bad-order', '--topic', 'rag', '--order', '-1').status, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
