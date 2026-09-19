# Cloudflare Workers 自动部署

仓库 `1264585648/knowledge`，生产分支 `main`。访问地址：[知页](https://zhiye-knowledge.zx-ai.workers.dev/)。生产 URL 已启用，预览 URL 和非生产分支构建均关闭。

当前使用独立的邀请码登录模块。未登录的页面导航转到 `/access/`，数据请求返回 401；邀请码或账号停用后已有会话不能继续阅读。内容仍为公开示例，私有内容源需另行接入。不能把 `dist` 直接发布到 Pages，否则会绕过 Worker。

## Workers Builds 设置

| 设置 | 值 |
| --- | --- |
| Worker 名称 | `zhiye-knowledge` |
| 生产分支 | `main` |
| 工程根目录 | `site` |
| 构建命令 | `npx --yes npm@11.6.4 install && npm run check && npm run test:core` |
| 部署命令 | `npm run deploy:invite` |
| 非生产分支自动构建 | 关闭 |
| 构建环境变量 | `SKIP_DEPENDENCY_INSTALL=1` |

`.node-version` 固定 Node.js 22.23.2。构建命令安装依赖并运行检查；部署命令重新构建 Astro 示例、应用尚未执行的 D1 迁移，再用 `wrangler.invite.jsonc` 发布 Worker 和静态资源。构建令牌需具有当前账号的 Worker 发布和 D1 迁移权限。失败的迁移会中止发布。

D1 数据库为 `zhiye-knowledge-auth`，绑定名 `DB`，数据库 ID 记录在邀请码配置文件中。生产变量为 `AUTH_PROVIDERS=invite`、`ACCESS_POLICY=invite`、`SESSION_TTL_SECONDS=604800`。数据库 ID 不是凭据，邀请码明文和会话值不得入库或进入日志。

推送 `main` 自动触发构建；不会重建账号、重置邀请码或导入本地私密文件。首次的两条迁移已通过 D1 控制台执行，并登记在 `d1_migrations`。以后由发布脚本检查和执行增量迁移。

原 `npm run deploy:foundation` 保留为关闭登录的回退方式，配置不绑定 D1，原数据库数据保留。两种方式都固定 `run_worker_first=true`、无 SPA fallback，且拒绝私有 `CONTENT_DIR`，避免误传残留产物。

## 验证

```bash
cd site
npm run check
npm run test:core
npm test
npm run deploy:invite -- --dry-run
npm run test:e2e
```

端到端测试分别运行基础配置及独立的本地 D1 邀请码配置。测试种子不会上传生产。线上验收应核对：

- `/healthz` 返回 200，内容为 `{"status":"ok"}`。
- `/api/auth/providers` 返回邀请码渠道可用。
- 未登录浏览器访问文章转到 `/access/`；直接数据请求返回 401。
- 有效码登录后可读文章和搜索，Cookie 为 Secure/HttpOnly，响应禁止缓存。
- 退出后旧会话无法读取内容，原邀请码仍可再次登录。

邀请码生成、导入、停用与扩展方式见 [登录模块说明](AUTH.md)。
