# site · 正式应用工程

## 已有功能和边界

Astro 生成首页、六个专题的目录/详情、文章页、标题摘要搜索索引；原生 CSS 使用既有暖灰 Token。示例文章仅用于检查结构，专题计数来自实际文章关联，空专题不会伪造内容数量。

Worker 默认保护全部内容与静态产物；只放行明确列出的访问说明/隐私说明/UI 文件。D1 查询同时验证会话、用户状态、平台身份、关注目标和授权有效期。数据库异常失败关闭。所有响应保守设置 no-store，禁用共享缓存和条件请求复用。

**登录签发、真实 OAuth/公众号核验、Turnstile、限流、取关事件及私有内容自动拉取尚未实现。** `worker/providers/README.md` 定义后续接入边界，不是已可用的适配器。默认上锁的基础版本已有独立的 Cloudflare 部署入口，见 [自动部署说明](CLOUDFLARE.md)。

## 环境与命令

建议使用 Node.js 22 的最新维护版本（本轮 CI：22.23.2）。CI 固定 npm 11.6.4；下面使用 npx 临时运行同一版本，不必全局替换本机 npm。工程依赖版本见 package.json；首次本机安装后提交真实生成的 lockfile，再将安装收敛为 npm ci。

应用代码提交 `babae1c28701a7957bb30ba044c5ac57c25480c2` 已通过完整 CI：Node 核心测试、Astro/Worker 类型检查、Vitest、静态构建及真实 Wrangler/Playwright 测试。该结果不代表真实关注平台或远程 Cloudflare 部署完成。

```bash
cd site
npx --yes npm@11.6.4 install
npm run dev
```

浏览 `http://localhost:4321` 仅预览设计。Astro 开发服务器不执行 Worker，不能作为权限验收或公网托管方式。

```bash
npm run test:core
npm run check
npm test
npm run build
npm run db:migrate:local
npm run preview
```

Wrangler 默认在 `http://127.0.0.1:8787` 提供本地服务。首页导航应被送到 `/access/`，API/数据请求在未配置关注渠道时应返回 503；这不是安装故障。

复制 `.dev.vars.example` 为 `.dev.vars` 的命令：macOS/Linux 使用 `cp`；PowerShell 使用 `Copy-Item`。基础阶段保留 `AUTH_PROVIDER=disabled`。Wrangler 的零 UUID 仅是本地开发占位，不是已经创建的远程数据库。

Playwright 检查真实 Wrangler 路由和移动端访问说明页：

```bash
npm run build
npx playwright install chromium
npm run test:e2e
```

Linux CI 可使用 `npx playwright install --with-deps chromium`。核心测试直接执行生产权限模块并使用 Node 内置 SQLite，不依赖运行中的 D1；这不能替代远程 D1/Cloudflare CPU 验收。

## 内容源

默认读取 `content-example/` 的公开示例。`src/content.config.ts` 使用 `CONTENT_DIR` 切换到外部私有目录，不自动联网获取内容。

内容格式：

```yaml
---
title: 文章标题
summary: 一句话摘要
publishedAt: 2026-09-18
status: published
topics:
  - knowledge-management
sample: false
---
```

文件名使用小写英文 slug，例如 `my-notes.md`；当前不支持嵌套 slug。草稿和未来发布日期不会出现在页面或搜索中。只有标题、摘要、文章地址进入搜索索引，但该索引仍然受保护。

生产构建必须给出存在于本公开仓库以外的私有 CONTENT_DIR，并移除所有示例。示例生产命令：

```bash
# macOS / Linux；路径由你实际的私有内容位置决定
CONTENT_DIR=/absolute/private-content/articles npm run build:production
```

```powershell
# PowerShell
$env:CONTENT_DIR = 'D:\private-content\articles'
npm run build:production
```

构建脚本清理旧 dist 与 Astro 内容缓存，防止在私有/示例内容源切换时残留正文。不要将 dist、.astro、.wrangler、.dev.vars 或私有文章提交到公开仓库。依赖源及 CI 必须可信；外部 PR 不得获取私有构建凭据。

## 访问接口

| 接口 | 当前行为 |
| --- | --- |
| GET /healthz | 健康状态；不包含配置或 DB 信息 |
| GET /api/auth/status | 明确返回 loginAvailable=false |
| POST /api/auth/start | 同源检查后返回 503；不接受自报关注 |
| POST /api/auth/logout | 同源验证、撤销 D1 会话并清除 Cookie |
| GET /api/session | 有效授权时返回站内用户 ID，否则拒绝 |
| GET /search-index.json | 与正文执行相同权限检查 |

`issueSession` 只是内部服务端工具，没有公开调用入口。未来只有完成可信平台核验后才可调用。测试数据库只存于测试进程内存，测试没有向实际 D1 插入登录账号。

## Cloudflare 配置

基础版本使用 `npm run deploy:foundation` 和 `wrangler.foundation.jsonc`，不绑定 D1，只发布公开示例构建并保留全部访问限制。`npm run deploy` 的正式发布阻止仍保留；真实平台确定并通过回归后，才开放内容。

未来需要：实际 D1 ID、远程迁移、真实身份/关注渠道凭据与回调域名、私有内容构建来源、有效期/撤销策略、必要的限流与 Turnstile 配置。Secrets 用环境注入，不写进 wrangler.jsonc。

Workers Builds 的工程根目录为 `site`，跟踪 `main` 分支；完整构建和部署参数见 [Cloudflare 自动部署](CLOUDFLARE.md)。GitHub CI 继续独立检查代码。不要把此工程改用 GitHub Pages 或直接上传 dist 的 Pages 静态部署，否则会绕过 Worker。

先保留 `run_worker_first=true`，不配置 SPA fallback，不整体放行 `_astro/*` 或 `*.json`。未来节省公共 UI 请求前先做数据泄漏审计。当前请求及静态文件都会经过 Worker，免费额度与 CPU 必须在实际环境测量。

更多阶段和验收标准见 [实施方案](../技术方案/实施方案.md)。
