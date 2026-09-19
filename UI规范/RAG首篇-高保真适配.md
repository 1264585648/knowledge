# RAG 首篇 · 按内容页 v2 适配

对应页面：[`高保真/rag-introduction.html`](../高保真/rag-introduction.html)。

本次重新读取 `main` 上的 `高保真/article-v2.html`、`assets/article-v2.css`、`assets/article-v2.js` 与 `UI规范/内容页-v2.md`，以提交 `a2dd89060baf1bd46e8533c8aab3ff2063384655` 的三栏原型为基准。不是上一轮的独立双栏文章设计。

## 保留的设计

沿用原型的左侧专题与文章树、中间正文、右上本篇目录、右下提问 / 批注。保留标题区、横幅、暖金色定位线、引用块、三步流程、案例和场景行组件。

直接引用原有 `assets/article-v2.css` 与 `assets/rag-reading-cover.webp`，不覆盖、不复制另一套样式 token。原 HTML、样式、横幅和 `site/` 均未修改。

资产核对：

- CSS blob：`df1db743d6ca221a3815682b975c846d23435145`。
- 横幅 blob：`c0ec8738586b4e9c70443995355e84a03482887c`，768 × 222。

横幅继续使用原型已有的参考图裁切素材，仅作设计预览；没有宣称重新生成高清图或获得新的素材授权。

## 正文按三部分组织

1. 为什么需要 RAG：时效性、内部资料、缺少依据时的错误回答。
2. 什么是 RAG：概念、检索 / 增强 / 生成、流程、备份教学案例、能力边界。
3. RAG 能用在哪些场景：企业知识、产品支持、项目文档、个人知识库，以及不必使用检索的情形。

右侧目录只保留三个主章节，工作过程与小结分别并入第二、第三部分。正文以“测试环境是否自动备份”贯穿，所有配置与理想回答明确标注为虚构教学案例，不伪装为真实项目事实或模型实测。

正文原稿：[`内容/RAG/01-什么是RAG.md`](../内容/RAG/01-什么是RAG.md)。可见正文连同参考资料约 2,900 个非空白字符。阅读时长按字符数 / 350 向上取整为 9 分钟，仅为编辑估算。

## 交互与数据边界

`assets/rag-introduction.js` 基于 v2 阅读工具适配，保持目录、搜索、收藏、主题、专注、引用、移动抽屉和本地批注的交互方式。使用独立存储前缀 `zhiye:rag-introduction:v1:`，不读取、迁移或覆盖原 v2 的测试批注。

提问仅当前页面暂存，不公开发布、不调用模型，刷新清空。批注支持引用、编辑、确认删除及 Markdown 导出，只存当前浏览器，不是私密账号空间，也不跨设备同步。已有数据损坏、配额错误和跨标签页冲突均提示暂存，不宣称保存成功。

未接入的专题文章与下一篇都显示规划中；没有伪造阅读量、用户评论、AI 回答或登录状态。没有修改关注验证，也没有接入后端或部署。

## 文件

```text
高保真/rag-introduction.html
高保真/assets/rag-introduction.js
高保真/tests/rag_introduction_test.py
内容/RAG/01-什么是RAG.md
UI规范/RAG首篇-高保真适配.md
```

页面依赖同目录已有的 `assets/article-v2.css`、`assets/rag-reading-cover.webp`。首页及全部内容链接继续指向仓库已有的 `index.html`、`topics.html`。

从仓库根目录启动静态服务后打开页面：

```bash
python -m http.server 8000
# http://localhost:8000/高保真/rag-introduction.html
```

## 验证记录与限制

Chromium 的 66 项检查通过，覆盖 320–1920px 的 17 个视口宽度、三栏宽度、图片加载、锚点、专题折叠、搜索键盘操作、目录高亮、阅读进度、收藏、主题、专注模式、问题纯文本渲染、笔记增改删 / 引用 / 导出、草稿保留、移动抽屉和跨断点恢复，以及存储损坏 / 写入失败 / 跨标签冲突。未捕获 JavaScript 异常。桌面与手机截图已目视检查。

环境阻止 `file://` 导航，因此测试用 `set_content` 注入页面，并显式模拟 Storage。批注恢复是序列化后在新文档重建，不是实际 HTTP 来源下的浏览器持久化验证。未进行正式站点构建、Safari / Firefox、真实后端、账号同步或线上部署验证。

```bash
# 需要 Python Playwright 和 Chromium
CHROMIUM_PATH=/usr/bin/chromium python 高保真/tests/rag_introduction_test.py
```
