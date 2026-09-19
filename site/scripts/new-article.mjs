import { mkdir, writeFile, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { topics } from '../src/data/topics.ts';
// Run with the package script: Node 22's --experimental-strip-types is required.
const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const help = 'npm run new:article -- <slug> --topic rag [--title "标题"] [--order 3]';
try {
  if (!args.length || args.includes('--help')) { console.log(help); process.exit(0); }
  const slug = args.shift();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || '')) throw new Error('文件名须为小写英文、数字与连字符，不含路径。');
  const options = new Map();
  while (args.length) {
    const key = args.shift(), value = args.shift();
    if (!['--topic', '--title', '--order'].includes(key) || !value || options.has(key)) throw new Error(help);
    options.set(key, value);
  }
  const topic = options.get('--topic');
  if (!topics.some(t => t.id === topic)) throw new Error('请指定已有专题：' + topics.map(t => t.id).join(', '));
  const order = options.get('--order');
  if (order && (!/^[1-9]\d*$/.test(order) || !Number.isSafeInteger(Number(order)))) throw new Error('--order 须为正整数。');
  const directory = process.env.CONTENT_DIR ? resolve(process.cwd(), process.env.CONTENT_DIR) : resolve(site, 'content-example');
  const sample = directory === resolve(site, 'content-example');
  const insideRepo = path => { const rel = relative(resolve(site, '..'), path); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + sep); };
  if (!sample && insideRepo(directory)) throw new Error('自定义 CONTENT_DIR 须位于公开仓库以外。');
  if (process.env.CONTENT_MODE === 'private' && sample) throw new Error('私有模式须设置公开仓库以外的 CONTENT_DIR。');
  const article = `---\ntitle: ${JSON.stringify(options.get('--title') || slug)}\nsummary: "请填写文章摘要。"\npublishedAt: ${new Date().toISOString().slice(0, 10)}\nstatus: draft\ntopics: [${topic}]\n${order ? `order: ${order}\n` : ''}sample: ${sample}\ntocDepth: 2\n---\n\n## 从一个问题开始\n\n在这里编写正文。\n\n## 关键概念\n\n在这里展开说明。\n\n## 小结\n\n在这里回顾与引用来源。\n`;
  await mkdir(directory, { recursive: true });
  if (!sample && insideRepo(await realpath(directory))) throw new Error('CONTENT_DIR 不能通过符号链接指向公开仓库。');
  const destination = resolve(directory, slug + '.md');
  await writeFile(destination, article, { encoding: 'utf8', flag: 'wx' });
  console.log('已创建草稿：' + destination);
  console.log('填写正文后将 status 改为 published；构建时才会生成页面。');
} catch (error) {
  console.error(error?.code === 'EEXIST' ? '同名文章已存在，没有覆盖。' : error.message); process.exitCode = 1;
}
