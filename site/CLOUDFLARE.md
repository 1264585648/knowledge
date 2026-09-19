# Cloudflare Workers 自动部署

仓库：`1264585648/knowledge`，生产分支：`main`。

当前只发布默认上锁的基础版本。真实登录和关注验证尚未实现；首页及正文会转到访问说明，受保护 API/静态文件返回 503。不要直接发布 `dist` 到 Pages，否则会绕过 Worker。

## Workers Builds 设置

在 Cloudflare 的 Workers & Pages 中连接 GitHub 仓库，使用以下设置：

| 设置 | 值 |
| --- | --- |
| Worker 名称 | `zhiye-knowledge` |
| 生产分支 | `main` |
| 工程根目录 | `site` |
| 构建命令 | `npx --yes npm@11.6.4 install && npm run check && npm run test:core` |
| 部署命令 | `npm run deploy:foundation` |
| 非生产分支自动构建 | 关闭 |
| 构建环境变量 | `SKIP_DEPENDENCY_INSTALL=1` |

`.node-version` 固定 Node.js 22.23.2。构建命令使用 npm 11.6.4 安装依赖并执行检查，跳过 Cloudflare 默认安装器；部署命令重新构建 Astro 页面，然后用 `wrangler.foundation.jsonc` 发布 Worker 和静态资源。推送到 `main` 会自动触发这条流程，无需把 Cloudflare 凭据写入仓库或 GitHub Actions。

基础配置不绑定 D1，且固定 `AUTH_PROVIDER=disabled`、`run_worker_first=true`。本地开发用的 `wrangler.jsonc` 仍保留 D1 占位符。基础部署拒绝设置 `CONTENT_DIR`，并重建产物，防止误上传旧的私有内容。原 `npm run deploy` 仍阻止正式生产发布。

## 本地验证

```bash
cd site
npm run check
npm run test:core
npm run deploy:foundation -- --dry-run
npm run test:e2e
```

端到端测试运行与线上相同的基础配置。部署完成后还应核对线上行为：

- `/healthz` 返回 200，内容为 `{"status":"ok","phase":"foundation"}`。
- `/access/` 返回访问说明，登录按钮不可用。
- 浏览器访问 `/` 或文章页跳转到 `/access/`。
- `/search-index.json`、`/articles/welcome/index.html` 返回 503，且不包含正文。

正式开放内容前，需另行完成真实身份/关注核验、远程 D1 及迁移、私有内容源和权限回归。
