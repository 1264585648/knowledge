# 关注渠道接入边界

本目录暂不含可用的 OAuth 或公众号适配器。`AUTH_PROVIDER=disabled` 是默认状态。

后续适配器必须验证平台身份、回调来源、一次性 state/浏览器绑定和重放，再由服务器查询关注关系。验证成功后才写入 `follow_status` 并调用内部 `issueSession`。不得新增接收客户端 `followed=true` 的授权接口。

`checkAccess` 能核验 D1 已有授权，但基础版本没有公开签发这些授权的入口。测试数据只存在测试进程内的 SQLite，不是生产后门。

待选：GitHub OAuth / 微信公众号。接入后补充目标平台错误映射、限流、按需 Turnstile 服务端核验、取消关注及过期复核测试。不得仅把环境变量改成 github/wechat 就宣布登录可用。
