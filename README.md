# 知页 · knowledge

极简、偏 Notion 气质的知识分享网站。正式内容须通过关注验证后访问，Cloudflare 免费方案优先。

## 当前状态

已开始 P0 工程基础：Astro 静态页面、Hono Worker 入口、D1 迁移、会话/关注授权读取、公开访问说明、受保护搜索与权限测试。

**尚未接入真实关注平台，不支持公开登录，不是已经上线的产品。** 默认 `AUTH_PROVIDER=disabled`，没有万能口令或开发解锁接口。`npm run deploy` 明确阻止基础版本误发布。

- [实施方案](技术方案/实施方案.md)
- [本地运行与工程说明](site/README.md)
- [首轮验证记录](技术方案/首轮验证记录.md)
- [UI 规范](UI规范/README.md)
- [已有高保真](高保真/)

## 目录

```text
UI规范/       已确认设计规范，保留不变
高保真/       原 HTML/CSS/JS 原型，保留不变
技术方案/     实施方案、验证记录
site/         正式应用工程（当前为基础阶段）
```

## 本地开始

需要 Node.js 22.12.0 或更新的兼容版本。首次安装后请将真实生成的 `site/package-lock.json` 提交；本次环境无法连接 npm，未伪造依赖锁文件。

```bash
cd site
npm install
npm run dev
```

`dev` 是仅供本机设计检查的 Astro 预览，**不包含 Worker 鉴权，禁止公开部署该服务或直接托管 dist**。

```bash
npm run test:core       # 不需要第三方包；真实 SQLite 验证权限与 SQL
npm run check          # 需要先安装依赖
npm test               # Vitest 运行同一组核心测试
npm run preview        # 构建后通过本地 Wrangler 验证默认上锁状态
```

正式内容不得提交到本公开仓库，也不得放进原高保真、公开构建日志或公开 CI 附件。下一阶段先确定关注平台并完成真实核验闭环，再进行生产部署。
