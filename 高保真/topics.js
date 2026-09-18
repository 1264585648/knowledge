/* 知页 · 专题高保真。全部为本地演示数据；不包含文章正文或服务端功能。
 * 修改专题：TOPICS。修改文章：ARTICLES。一篇文章可归入多个专题。
 * 数量从实际关联数据计算；专题内按 date 降序，不使用伪造的统计值。
 */
(() => {
  'use strict';
  const TOPICS = [
    { id:'agent', name:'Agent 入门', icon:'robot', description:'从基本概念到实际应用，逐步理解 Agent 的工作方式。' },
    { id:'knowledge-management', name:'知识管理', icon:'document', description:'把零散的记录整理成体系，让知识在实践中持续复用。' },
    { id:'development', name:'开发实践', icon:'code', description:'记录项目中的实现思路、调试过程，以及值得留下的经验。' },
    { id:'tools', name:'工具与效率', icon:'tool', description:'分享真正用得上的工具，以及让日常工作更顺手的方法。' },
    { id:'design', name:'产品与设计', icon:'layout', description:'从用户的真实需求出发，打磨清楚、克制、好用的产品。' },
    { id:'writing', name:'写作与表达', icon:'pen', description:'把模糊的想法写清楚，让每一次记录都成为思考的延伸。' }
  ];
  const ARTICLES = [
    {id:'agent-workflow',title:'从零理解一个 Agent 的工作流程',summary:'先理清模型、工具与执行循环，再开始动手。',date:'2026-09-18',minutes:8,topics:['agent']},
    {id:'agent-tool-calling',title:'工具调用：让模型连接外部能力',summary:'理解一次工具调用中的输入、执行与返回。',date:'2026-09-16',minutes:6,topics:['agent','development']},
    {id:'knowledge-workflow',title:'我的知识整理流程：从记录到输出',summary:'让收藏的内容，真正变成可以复用的知识。',date:'2026-09-15',minutes:6,topics:['knowledge-management','writing']},
    {id:'agent-boundaries',title:'为 Agent 设计清晰的任务边界',summary:'先确定要解决什么，再决定需要哪些能力。',date:'2026-09-14',minutes:7,topics:['agent','design']},
    {id:'design-spacing',title:'用留白与对齐建立页面秩序',summary:'不增加装饰，也能让信息层级更清楚。',date:'2026-09-13',minutes:5,topics:['design']},
    {id:'toolkit',title:'一份常用工具清单，以及我的选择理由',summary:'不只是列出工具，也说明什么时候值得使用。',date:'2026-09-12',minutes:5,topics:['tools']},
    {id:'agent-context',title:'上下文管理：哪些信息值得留下',summary:'区分即时输入、任务状态与长期记忆。',date:'2026-09-11',minutes:9,topics:['agent','knowledge-management']},
    {id:'notes-to-articles',title:'如何把学习笔记整理成公开文章',summary:'从草稿、结构到发布，形成稳定的输出习惯。',date:'2026-09-10',minutes:7,topics:['knowledge-management','writing']},
    {id:'local-debug',title:'建立一个顺手的本地调试流程',summary:'从复现问题开始，再让每一步变化都可以验证。',date:'2026-09-09',minutes:6,topics:['development','tools']},
    {id:'information-sources',title:'我常用的高质量信息来源',summary:'建立自己的输入系统，比盲目收藏更重要。',date:'2026-09-08',minutes:4,topics:['knowledge-management','tools']},
    {id:'agent-failure',title:'失败之后：重试、回退与人工确认',summary:'让异常有明确的出口，而不是不断重复执行。',date:'2026-09-07',minutes:8,topics:['agent','development']},
    {id:'design-navigation',title:'一个清楚的导航，需要多少个入口',summary:'从访问路径出发，减少不必要的选择与绕行。',date:'2026-09-06',minutes:5,topics:['design']},
    {id:'agent-evaluation',title:'给 Agent 建立一份最小评估集',summary:'用具体任务检验效果，而不只看一次成功的演示。',date:'2026-09-05',minutes:10,topics:['agent']},
    {id:'knowledge-review',title:'每周回顾：让笔记重新参与思考',summary:'重新连接散落的记录，找到下一步值得深入的问题。',date:'2026-09-04',minutes:5,topics:['knowledge-management']},
    {id:'agent-prototype',title:'从原型到可用：做一个小型 Agent',summary:'用一个范围明确的任务，串起前面的基础能力。',date:'2026-09-03',minutes:12,topics:['agent','development']},
    {id:'tool-shortcuts',title:'把常用操作整理成自己的快捷入口',summary:'减少重复寻找，让工具跟随你的实际工作流程。',date:'2026-09-02',minutes:4,topics:['tools']},
    {id:'agent-checklist',title:'上线之前，检查这份 Agent 清单',summary:'逐项确认权限、日志、成本限制与人工接管入口。',date:'2026-09-01',minutes:7,topics:['agent']},
    {id:'notes-links',title:'用双向链接连接笔记，而不是堆叠标签',summary:'围绕具体问题，把相关记录组织成可阅读的路径。',date:'2026-08-30',minutes:6,topics:['knowledge-management']},
    {id:'tool-selection',title:'选择工具之前，先写下你的工作场景',summary:'从真实需求开始，避免为了功能表反复迁移。',date:'2026-08-28',minutes:5,topics:['tools']},
    {id:'design-details',title:'把界面细节写成可复用的规范',summary:'统一颜色、间距与状态，让后续页面保持一致。',date:'2026-08-26',minutes:6,topics:['design']},
    {id:'writing-outline',title:'先写提纲，再开始一篇文章',summary:'用问题和结构帮助表达，而不是等待一个完美开头。',date:'2026-08-24',minutes:4,topics:['writing']}
  ];
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const isCatalog = document.body.dataset.page === 'catalog';
  const parameters = new URLSearchParams(location.search);
  const topicId = parameters.get('topic') || 'agent';
  const topic = TOPICS.find(item => item.id === topicId);
  const articlesFor = id => ARTICLES.filter(item => item.topics.includes(id)).sort((a,b) => b.date.localeCompare(a.date));
  const currentArticles = topic ? articlesFor(topic.id) : [];
  const topicURL = id => `topic.html?topic=${encodeURIComponent(id)}`;
  const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
  const icon = (name, extra = '') => `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${escapeHTML(name)}"/></svg>`;
  const safe = escapeHTML;

  if (isCatalog) {
    $('#catalog-count').textContent = `${TOPICS.length} 个专题`;
    $('#catalog-grid').innerHTML = TOPICS.map(item => `
      <li><a class="catalog-card" href="${topicURL(item.id)}" aria-labelledby="name-${item.id}">
        <div class="catalog-head"><span class="topic-icon-wrap">${icon(item.icon)}</span><h3 class="catalog-title" id="name-${item.id}">${safe(item.name)}</h3></div>
        <p class="catalog-description">${safe(item.description)}</p>
        <div class="catalog-bottom"><span>${articlesFor(item.id).length} 篇文章</span>${icon('right')}</div>
      </a></li>`).join('');
    // 浏览器后退交给原生历史恢复；显式“全部专题”入口恢复上次总览位置。
    if (parameters.has('return')) {
      try {
        const y = Number(sessionStorage.getItem('zhiye:catalog-scroll')) || 0;
        requestAnimationFrame(() => window.scrollTo(0, y));
      } catch { /* file:// 或隐私模式禁用存储时，仍可正常浏览。 */ }
    }
    window.addEventListener('pagehide', () => {
      try { sessionStorage.setItem('zhiye:catalog-scroll', String(window.scrollY)); } catch { /* optional */ }
    });
  } else {
    const navHTML = TOPICS.map(item => `<a class="topic-nav-link" href="${topicURL(item.id)}"${item.id === topicId ? ' aria-current="page"' : ''}><span>${safe(item.name)}</span>${icon('check','topic-indicator')}</a>`).join('');
    $('#topic-nav').innerHTML = navHTML;
    $('#mobile-topic-nav').innerHTML = navHTML;
    if (!topic) {
      document.title = '未找到专题 · 知页';
      $('#topic-content').innerHTML = `<div class="empty-state"><span class="topic-icon-wrap">${icon('folder')}</span><h1 id="page-title">未找到这个专题</h1><p>这个地址没有对应的专题，请回到目录重新选择。</p><a href="topics.html">浏览全部专题</a></div>`;
    } else {
      document.title = `${topic.name} · 专题 · 知页`;
      $('#page-title').textContent = topic.name;
      $('#topic-icon').innerHTML = icon(topic.icon);
      $('#topic-description').textContent = topic.description;
      $('#article-count').textContent = `${currentArticles.length} 篇文章`;
      $('#entry-list').innerHTML = currentArticles.map(article => `
        <li id="${safe(article.id)}"><button class="entry-row" type="button" data-article="${safe(article.id)}">
          <span class="entry-copy"><span class="entry-title">${safe(article.title)}</span><span class="entry-summary">${safe(article.summary)}</span><span class="entry-meta"><time datetime="${article.date}">${article.date}</time><span class="meta-dot" aria-hidden="true">·</span><span>${article.minutes} 分钟阅读</span></span></span>${icon('chevron')}
        </button></li>`).join('');
      if (!currentArticles.length) {
        $('#entry-list').innerHTML = '<li class="empty-state"><h2>内容整理中</h2><p>这个专题还没有公开文章，先看看其他专题吧。</p><a href="topics.html">浏览全部专题</a></li>';
        $('#topic-endnote').hidden = true;
      }
    }
  }

  let noticeTimer;
  function showNotice(message) {
    clearTimeout(noticeTimer);
    $('#preview-notice').textContent = message;
    $('#preview-notice').hidden = false;
    noticeTimer = window.setTimeout(() => { $('#preview-notice').hidden = true; }, 4000);
  }
  document.addEventListener('click', event => {
    if (event.target.closest('[data-article]')) showNotice('当前为专题页高保真预览，文章正文暂未接入。');
    const preview = event.target.closest('[data-preview]');
    if (preview) {
      event.preventDefault();
      showNotice(`当前为高保真预览，${preview.dataset.preview}暂未接入。`);
    }
  });

  const mobileNav = $('#mobile-nav');
  const menuTrigger = $('#menu-trigger');
  const switcher = $('#topic-switcher');
  function closeMenu(restore = false) {
    mobileNav.hidden = true;
    menuTrigger.setAttribute('aria-expanded','false');
    menuTrigger.setAttribute('aria-label','打开导航菜单');
    if (restore) menuTrigger.focus();
  }
  menuTrigger.addEventListener('click', () => {
    const open = mobileNav.hidden;
    mobileNav.hidden = !open;
    menuTrigger.setAttribute('aria-expanded', String(open));
    menuTrigger.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    if (open && switcher) switcher.open = false;
  });
  document.addEventListener('click', event => {
    if (!mobileNav.contains(event.target) && !menuTrigger.contains(event.target)) closeMenu();
    if (switcher && !switcher.contains(event.target)) switcher.open = false;
  });
  if (switcher) switcher.addEventListener('toggle', () => { if (switcher.open) closeMenu(); });
  matchMedia('(max-width:640px)').addEventListener('change', () => closeMenu());
  matchMedia('(max-width:800px)').addEventListener('change', () => { if (switcher) switcher.open = false; });

  const dialog = $('#search-dialog');
  const input = $('#search-input');
  const results = $('#search-results');
  let searchOpener = null;
  const searchArticles = !isCatalog && Boolean(topic);
  const scopeName = searchArticles ? `${topic.name} · 专题内文章` : '全部专题';
  $('#search-dialog-title').textContent = searchArticles ? '搜索专题内文章' : '搜索专题';
  $('#open-search').setAttribute('aria-label', searchArticles ? `搜索${topic.name}的文章` : '搜索专题');
  input.placeholder = searchArticles ? '搜索当前专题内的文章…' : '搜索专题…';
  function renderSearch() {
    const query = input.value.trim().toLocaleLowerCase();
    const source = searchArticles ? currentArticles : TOPICS;
    const matches = source.filter(item => `${item.title || item.name} ${item.summary || item.description}`.toLocaleLowerCase().includes(query));
    results.replaceChildren();
    $('#search-hint').textContent = `${scopeName} · ${matches.length} ${searchArticles ? '篇' : '个'}${query ? '匹配结果' : ''}`;
    if (!matches.length) {
      const empty = document.createElement('li');
      empty.className = 'search-empty';
      empty.textContent = '没有找到相关内容，换个关键词试试。';
      results.append(empty);
      return;
    }
    matches.forEach(item => {
      const li = document.createElement('li');
      const control = document.createElement(searchArticles ? 'button' : 'a');
      control.className = 'search-result';
      if (searchArticles) control.type = 'button';
      else control.href = topicURL(item.id);
      const title = document.createElement('span');
      title.className = 'search-result-title';
      title.textContent = item.title || item.name;
      const meta = document.createElement('span');
      meta.className = 'search-result-meta';
      meta.textContent = searchArticles ? `${item.date} · ${item.minutes} 分钟阅读` : `${articlesFor(item.id).length} 篇文章 · ${item.description}`;
      control.append(title, meta);
      if (searchArticles) control.addEventListener('click', () => {
        const target = document.getElementById(item.id);
        searchOpener = target.querySelector('button');
        dialog.close();
        target.scrollIntoView({ block:'center', behavior:'auto' });
        searchOpener.focus({preventScroll:true});
      });
      li.append(control);
      results.append(li);
    });
  }
  function openSearch() {
    if (dialog.open) return;
    searchOpener = document.activeElement;
    closeMenu();
    if (switcher) switcher.open = false;
    input.value = '';
    renderSearch();
    dialog.showModal();
    input.focus();
  }
  $('#open-search').addEventListener('click',openSearch);
  $('#close-search').addEventListener('click',() => dialog.close());
  input.addEventListener('input',renderSearch);
  input.addEventListener('keydown',event => {
    if (event.isComposing) return;
    const first = $('.search-result',results);
    if (event.key === 'ArrowDown' && first) { event.preventDefault(); first.focus(); }
    if (event.key === 'Enter' && first) { event.preventDefault(); first.click(); }
  });
  results.addEventListener('keydown',event => {
    if (!['ArrowDown','ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const controls = $$('.search-result',results);
    const index = controls.indexOf(document.activeElement);
    const next = index + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0) input.focus();
    else controls[Math.min(next,controls.length - 1)]?.focus();
  });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => searchOpener?.focus({preventScroll:true}));
  document.addEventListener('keydown',event => {
    if (event.isComposing) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    if (event.key === 'Escape') {
      if (dialog.open) { event.preventDefault(); dialog.close(); }
      else if (switcher?.open) { switcher.open = false; $('summary',switcher).focus(); }
      else if (!mobileNav.hidden) closeMenu(true);
    }
  });
  if (/Mac|iPhone|iPad/.test(navigator.platform)) $('#search-shortcut').textContent = '⌘ K';
})();
