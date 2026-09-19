# 独立登录模块：邀请码

首个登录渠道为 `invite`：每个随机邀请码对应一个预先创建的独立账号，可重复登录，不需要设置密码。持有码即可操作对应账号；不要多人共享同一个码。当前不开放自行注册、OAuth 或手机号登录。

## 模块边界

- `worker/modules/auth/`：登录渠道注册、凭证核验、统一身份、会话及 HTTP 接口。外部只通过 `index.ts` 使用它。
- `worker/modules/auth/providers/invite.ts`：邀请码适配器，只验证凭证并返回 `VerifiedIdentity`，不负责 Cookie、重定向或文章访问。
- `worker/modules/auth/sessions.ts`：统一 `Principal` 和随机会话，后续渠道可复用。
- `worker/modules/access/`：阅读权限策略。`invite` 策略要求当前身份的邀请码仍有效；旧 `follow` 策略仍按同一身份、目标和有效期验证。
- `src/components/auth/InviteLogin.astro`：登录表单；`public/public/access.js` 处理可用、加载、错误、重试和完成状态。

新增凭证渠道时实现 `CredentialProvider` 并加入注册表；新增 OAuth 渠道时在认证模块增加 start/callback 适配器，完成 state/PKCE/nonce 等协议校验后才能使用会话服务。业务页面和阅读模块不参与各平台的凭证校验，也不按相同邮箱自动合并账号。

## 接口

| 接口 | 行为 |
| --- | --- |
| GET `/api/auth/providers`、`/api/auth/status` | 返回可用渠道；无 DB 或未启用时登录不可用 |
| POST `/api/auth/invite/login` | 同源 JSON `{code,next?}`，成功设置 Cookie，返回站内跳转地址 |
| GET `/api/auth/session`、`/api/session` | 登录状态、站内用户 ID、渠道、会话有效期；不代表阅读授权 |
| GET `/api/access/status` | 独立阅读授权结果 |
| POST `/api/auth/logout` | 撤销当前会话、清理 Cookie、返回登录页 |

## 生成和管理

```bash
cd site
npm run invites:generate -- 10
```

命令以密码学随机源生成 160 位邀请码，避免易混淆字符。输出在仓库根目录已被 Git 忽略的 `.local-secrets/invites-日期-批次/`：`邀请码.txt` 用于单独交付，`invites.json` 保存账号对应关系，`seed.sql` 仅含哈希，`停用说明.txt` 包含逐个停用的 SQL。明文无法从数据库恢复，需妥善备份本地交付文件。

生成后需由管理员导入数据库才会生效。已登录 Wrangler 可执行：

```bash
npx wrangler d1 migrations apply DB --remote --config wrangler.invite.jsonc
npx wrangler d1 execute DB --remote --config wrangler.invite.jsonc --file ../.local-secrets/实际批次/seed.sql
```

也可在 Cloudflare D1 控制台执行 `seed.sql`。重复导入同一批次不会生成重复账号或重新启用已停用的邀请码。生成脚本不在构建过程中执行，推送主干不会重置账号或生成新码。

停用使用 `UPDATE auth_invites SET status='revoked' WHERE id='目标邀请码ID';`。邀请码默认不设置到期时间；可设置 `expires_at` 为晚于创建时间的 Unix 秒。每次读取受限资源都会检查邀请码状态，停用后已有会话也不能读取内容。删除或禁用用户同样拒绝访问。

## 安全与测试

邀请码和会话分别使用 SHA-256 保存哈希；邀请码带独立用途前缀。随机会话为 256 位，Cookie 为 `__Host-`、Secure、HttpOnly、SameSite=Lax，默认最长 7 天。登录会轮换当前会话。登录接口限制 JSON 大小为 2 KiB，并按 Cloudflare 提供的 IP 时间窗口每 10 分钟最多尝试 10 次；窗口边界可能允许连续两个窗口的额度。它是基础防滥用措施，不替代需要时的 WAF/Turnstile。

测试覆盖随机码与账号唯一性、同码重登、停用后已有会话失权、过期、限流、跨域提交、直接访问资源、禁用配置、数据库错误和回跳地址。Playwright 的邀请码测试启动独立本地 D1，公开测试码只写入该测试数据库；禁止将测试种子导入生产。

```bash
npm run check
npm run test:core
npm test
npm run build
npm run test:e2e
```

当前线上内容仍是公开仓库中的示例文章。访问控制只保护部署入口，无法让公开 GitHub 中的原文变为私有；正式私有文章须从独立的私有内容源构建。
