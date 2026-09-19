---
title: 什么是 RAG：让大模型先查资料，再回答
summary: 大模型已经很聪明，为什么还需要 RAG？从一个熟悉的问题出发，理解它解决什么、怎样工作，以及适合用在哪里。
publishedAt: 2026-09-19
status: published
topics: [knowledge-management]
sample: true
---

> **读完这篇，你会理解**
> 为什么“会回答”不等于“知道答案”；RAG 如何把外部资料带进回答；以及哪些问题值得用它来解决。无需预先了解向量数据库或模型训练。

## 01 为什么需要 RAG

想象你刚加入一家公司，向大模型问：“我们公司的差旅报销，需要提前几天申请？”

它也许能写出一份条理清晰的申请流程。但如果你没有提供公司的制度，它就没有足够依据判断，这份流程是否适用于你。

**问题不在于它不会组织语言，而在于它缺少回答这个问题所需的资料。**

### 通用大模型的三个局限

首先，模型参数中的知识不会自动跟随现实更新。其次，企业内部文档、个人笔记等私有资料，通常不在它可访问的范围内。最后，流畅的回答不意味着事实可靠；仅凭模型记忆，也难以追溯每一个结论的来源。[1](https://arxiv.org/abs/2005.11401)

这里讨论的是没有获得相关外部资料的模型，而不是说所有带搜索、文件上传或知识库的 AI 产品都无法处理这些问题。

> **一个更直观的比喻**
> 闭卷回答，主要依赖已经记住的内容；开卷回答，可以先翻到相关资料，再根据材料作答。RAG 做的，就是为模型安排一次有针对性的“查资料”。这只是帮助理解的类比，不代表开卷就一定答对。

### 不是让它知道一切，而是给它所需的资料

沿用前面的假设场景：系统先从当前有效的差旅制度里找到“申请时限”这一段，再把它和问题一起交给模型。模型随后围绕这段材料组织回答，并提供出处，供你检查。

制度更新后，需要维护的是资料与检索索引，而不是为了改一个报销天数就重新训练整个模型。能否及时回答，仍取决于资料是否更新、是否有权限、以及能否检索到正确段落。[2](https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview)

## 02 什么是 RAG

RAG 是 **Retrieval-Augmented Generation**，中文通常译作**检索增强生成**。它把外部知识的检索与模型的文本生成连接起来：先找相关资料，再让模型结合资料回答。[1](https://arxiv.org/abs/2005.11401)

<div class="rag-flow" role="img" aria-label="RAG 的简化流程：检索相关资料，将资料与问题组合，再由大模型生成回答。">
  <div class="flow-step">检索<span>找到相关资料</span></div><span class="flow-arrow" aria-hidden="true">→</span>
  <div class="flow-step">增强<span>资料 + 问题</span></div><span class="flow-arrow" aria-hidden="true">→</span>
  <div class="flow-step">生成<span>基于资料回答</span></div>
</div>

### 一次回答是怎样发生的

可以把最简单的一次 RAG 请求拆成三个动作。**检索**：从可访问的知识源中找到相关内容。**增强**：把筛选后的片段作为上下文交给模型。**生成**：模型根据问题和这些片段组织回答。[2](https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview)

以下是一个人为构造的演示，不是真实公司的制度：

> **用户的问题**
> 出差前，需要提前多久提交申请？
>
> **检索到的资料**
> 《差旅管理办法》第 3 条：员工应至少提前 3 个工作日提交出差申请。
>
> **基于资料的回答示例**
> 按照这份制度，至少提前 3 个工作日提交。依据：《差旅管理办法》第 3 条。材料没有说明紧急出差的例外流程，不能据此推断。

RAG 不等于某个具体模型，也不等于“必须接入一种向量数据库”。关键词、向量或混合检索都可以作为找资料的手段；这里先理解“检索 + 生成”的关系即可。[2](https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview)

### RAG 与微调，不是一回事

可以先用目标来区分：RAG 侧重在回答时提供外部信息；微调通过训练改变模型的参数与行为。两者可以配合，原始 RAG 研究本身就探索了检索与生成模型的联合微调。因此，“RAG 永远不训练模型”并不准确。[1](https://arxiv.org/abs/2005.11401)

## 03 RAG 能用在哪里

一个实用的判断问题是：**答案是否依赖某批具体资料，而不是只依赖通用知识？** 下面是围绕这个判断设计的三个应用设想，不是已上线产品的效果承诺。

### 企业知识库：把散落的制度变成答案

新同事不用在几十份文档中反复翻找，可以直接问“出差怎么申请”“这个流程由谁审批”。系统需要检索当前有效、且这位同事有权访问的资料。查不到时应明确说明，不要补出一套看似合理的内部规定。

### 产品文档助手：让回答跟着版本走

用户问一个接口怎么使用，资料库可以提供相应版本的说明、配置示例和已知限制。例如，回答前先确认问题针对哪个版本，再定位文档；不要把旧版的参数拼到新版的示例里。

### 个人学习助手：和自己的笔记对话

当你积累了论文摘录、学习卡片和项目复盘，可以问“我之前在哪篇笔记里讨论过这个概念”。一个有价值的回答，不只是重新解释概念，还能带你回到自己读过的原文。

### 使用边界：有资料，也不一定答对

资料错误、检索遗漏或模型误读，都可能影响结果。真实系统仍需要维护资料、控制访问权限、检查检索质量，并验证结论是否被引用的原文支持。不能把“带引用”直接等同于“正确”。[2](https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview)

对于纯创意写作、无需外部资料的简单改写，不必为了使用 RAG 而增加检索步骤。若真正需要的是实时库存、执行付款等结构化查询或业务操作，应进一步设计相应的数据查询与工具调用，而不只是把文档片段交给模型。

> **记住这一句话**
> RAG 不是让模型凭空变得无所不知，而是在回答之前，帮它找到这次回答需要的资料。

<div class="article-sources">
<p><strong>参考资料</strong></p>
<p><a href="https://arxiv.org/abs/2005.11401" target="_blank" rel="noopener noreferrer">[1] Lewis 等：Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks</a><br />RAG 原始研究，首次提交于 2020 年。</p>
<p><a href="https://learn.microsoft.com/en-us/azure/search/retrieval-augmented-generation-overview" target="_blank" rel="noopener noreferrer">[2] Microsoft Learn：Retrieval-augmented generation in Azure AI Search</a><br />检索、上下文组织、资料更新与访问控制的工程说明。</p>
</div>
