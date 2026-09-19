# 知页 · knowledge

极简、偏 Notion 气质的知识分享网站。正式内容须通过关注验证后访问，Cloudflare 免费方案优先。

## 当前状态

已开始 P0 工程基础：Astro 静态页面、Hono Worker 入口、D1 迁移、会话/关注授权读取、公开访问说明、受保护搜索与权限测试。

**尚未接入真实关注平台，不支持公开登录。** 默认 `AUTH_PROVIDER=disabled`，没有万能口令或开发解锁接口。`npm run deploy` 仍阻止正式生产发布；`npm run deploy:foundation` 可托管默认上锁的基础版本，配置见 [Cloudflare 自动部署](site/CLOUDFLARE.md)。

- [实施方案](技术方案/实施方案.md)
- [本地运行与工程说明](site/README.md)
- [首轮验证记录](技术方案/首轮验证记录.md)
- [UI 规范](UI规范/README.md)
- [已有高保真](高保真/)

应用代码提交 `babae1c28701a7957bb30ba044c5ac57c25480c2` 的 GitHub CI 已通过：43 项核心测试、完整类型检查、Vitest、Astro 构建和 7 项 Wrangler/Playwright 测试。详见验证记录。

## 目录

```text
UI规范/       已确认设计规范，保留不变
高保真/       原 HTML/CSS/JS 原型，保留不变
技术方案/     实施方案、验证记录
site/         正式应用工程（当前为基础阶段）
```

## 本地开始

建议使用 Node.js 22 的最新维护版本（本轮 CI：22.23.2）。依赖安装固定使用 npm 11.6.4，避免本轮遇到的 npm 10 安装器内部错误。首次本机安装后请将真实生成的 `site/package-lock.json` 提交；当前锁文件尚未入库。

```bash
cd site
npx --yes npm@11.6.4 install
npm run dev
```

`dev` 是仅供本机设计检查的 Astro 预览，**不包含 Worker 鉴权，禁止公开部署该服务或直接托管 dist**。

```bash
npm run test:core       # 不需要第三方包；真实 SQLite 验证权限与 SQL
npm run check          # 需要先安装依赖
npm test               # Vitest 运行同一组核心测试
npm run preview        # 构建后通过本地 Wrangler 验证默认上锁状态
```

正式内容不得提交到本公开仓库，也不得放进原高保真、公开构建日志或公开 CI 附件。基础版本可跟踪 `main` 自动部署；正式开放内容前，先确定关注平台并完成真实核验闭环。
