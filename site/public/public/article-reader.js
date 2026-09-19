/* Browser-only demo. No network calls, model SDKs, or user-content HTML injection. */
(() => {
  'use strict';
  const root = document.querySelector('[data-reader]');
  if (!root) return;
  const $ = (selector) => root.querySelector(selector);
  const $$ = (selector) => [...root.querySelectorAll(selector)];
  const content = $('#reader-content');
  const tools = $('#reader-tools');
  const tabs = $$('[data-tab]');
  const headings = [...content.querySelectorAll('h2[id],h3[id]')];
  const tocLinks = $$('.outline-nav a');
  const narrow = matchMedia('(max-width: 1100px)');
  const mobile = matchMedia('(max-width: 760px)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const details = $('.outline-details');
  const storageKey = `zhiye:reader-notes:v1:${root.dataset.articleId || location.pathname}`;
  let currentHeading = headings[0] || null;
  let selected = { text: '', section: '' };
  let quoted = { text: '', section: '' };
  let questionQuote = { text: '', section: '' };
  let editingId = '';
  let noticeTimer;
  let returnFocus = null;
  let previousOverflow = '';
  const inertStates = new Map();
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  function notify(text) {
    const notice = $('#reader-notice');
    notice.textContent = text;
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 4000);
  }
  function sectionElement(id) {
    const node = document.getElementById(id);
    return node && content.contains(node) && /^H[23]$/.test(node.tagName) ? node : null;
  }
  function sourceLink(id) {
    const heading = sectionElement(id);
    if (!heading) return null;
    const link = make('a', 'text-button', `↳ ${heading.textContent}`);
    link.href = `#${encodeURIComponent(id)}`;
    link.addEventListener('click', () => { if (narrow.matches) closeTools(); });
    return link;
  }
  function setFocused(value) {
    root.classList.toggle('is-focused', value);
    const control = $('[data-focus]');
    control.setAttribute('aria-pressed', String(value));
    control.textContent = value ? '↔ 退出专注' : '↔ 专注阅读';
  }
  function setTab(name, focus = false) {
    for (const tab of tabs) {
      const active = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
      if (active && focus) tab.focus();
    }
  }
  function openTools(name = 'ask') {
    setFocused(false);
    setTab(name);
    if (!narrow.matches) return;
    if (!root.classList.contains('tools-open')) {
      returnFocus = document.activeElement;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      const background = [...document.body.children].filter(el => !el.contains(root) && !['SCRIPT','STYLE','LINK'].includes(el.tagName));
      background.push($('.reader-breadcrumb'), $('.reader-outline'), $('.reader-article'), $('.tools-launcher'), $('.selection-actions'));
      for (const node of background.filter(Boolean)) { inertStates.set(node, node.inert); node.inert = true; }
    }
    root.classList.add('tools-open');
    tools.setAttribute('role', 'dialog');
    tools.setAttribute('aria-modal', 'true');
    $('.tools-launcher').setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => tabs.find(tab => tab.dataset.tab === name)?.focus());
  }
  function closeTools(restoreFocus = true) {
    if (!root.classList.contains('tools-open')) return;
    root.classList.remove('tools-open');
    tools.removeAttribute('role');
    tools.removeAttribute('aria-modal');
    $('.tools-launcher').setAttribute('aria-expanded', 'false');
    document.body.style.overflow = previousOverflow;
    inertStates.forEach((value, node) => { node.inert = value; });
    inertStates.clear();
    if (restoreFocus && returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus();
  }
  tabs.forEach(tab => {
    tab.addEventListener('click', () => setTab(tab.dataset.tab));
    tab.addEventListener('keydown', event => {
      const index = tabs.indexOf(tab);
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); setTab(tabs[next].dataset.tab, true); }
    });
  });
  $('[data-tools-close]').addEventListener('click', () => closeTools());
  $('.reader-shade').addEventListener('click', () => closeTools());
  $$('.tools-launcher,[data-open-notes]').forEach(button => button.addEventListener('click', () => openTools(button.hasAttribute('data-open-notes') ? 'notes' : 'ask')));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { $('.selection-actions').hidden = true; closeTools(); }
    if (event.key !== 'Tab' || !root.classList.contains('tools-open')) return;
    const focusable = [...tools.querySelectorAll('button,a[href],textarea,input,[tabindex="0"]')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (!first) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  narrow.addEventListener('change', () => closeTools(false));
  function setOutlineMode() { details.open = !mobile.matches; }
  mobile.addEventListener('change', setOutlineMode);
  setOutlineMode();
  function trackSection() {
    let active = headings[0] || null;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top <= 150) active = heading;
      else break;
    }
    currentHeading = active;
    for (const link of tocLinks) {
      let id = '';
      try { id = decodeURIComponent(link.hash.slice(1)); } catch { /* Ignore malformed external fragments. */ }
      if (active && id === active.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    }
  }
  let scrollQueued = false;
  addEventListener('scroll', () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => { trackSection(); scrollQueued = false; $('.selection-actions').hidden = true; });
  }, { passive: true });
  addEventListener('resize', trackSection);
  trackSection();
  tocLinks.forEach(link => link.addEventListener('click', () => { if (mobile.matches) details.open = false; }));
  $('[data-back-top]').addEventListener('click', () => window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' }));
  $('[data-focus]').addEventListener('click', () => setFocused(!root.classList.contains('is-focused')));
  $('[data-copy-link]').addEventListener('click', async () => {
    if (location.protocol === 'file:') { notify('这是本地预览文件，请分享 HTML 文件或部署后的页面地址。'); return; }
    try { await navigator.clipboard.writeText(location.href); notify('已复制文章链接'); }
    catch { notify('浏览器不允许自动复制，请从地址栏复制页面地址。'); }
  });
  function selectionSection(range) {
    let active = headings[0] || null;
    for (const heading of headings) {
      if (heading === range.startContainer || heading.contains(range.startContainer) || (heading.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING)) active = heading;
    }
    return active?.id || '';
  }
  function captureSelection() {
    const selection = window.getSelection();
    const toolbar = $('.selection-actions');
    if (!selection || selection.isCollapsed || !selection.rangeCount) { toolbar.hidden = true; return; }
    const range = selection.getRangeAt(0);
    if (!content.contains(range.startContainer) || !content.contains(range.endContainer)) { toolbar.hidden = true; return; }
    const text = selection.toString().trim().slice(0, 1500);
    if (!text) return;
    selected = { text, section: selectionSection(range) };
    const rect = range.getBoundingClientRect();
    toolbar.hidden = false;
    const width = toolbar.offsetWidth;
    toolbar.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, rect.left + rect.width / 2 - width / 2))}px`;
    toolbar.style.top = `${Math.max(8, Math.min(innerHeight - toolbar.offsetHeight - 8, rect.bottom + 8))}px`;
  }
  content.addEventListener('pointerup', () => setTimeout(captureSelection, 0));
  content.addEventListener('keyup', event => { if (event.key.startsWith('Arrow') || event.key === 'Shift') captureSelection(); });
  $('.selection-actions').addEventListener('mousedown', event => event.preventDefault());
  document.addEventListener('pointerdown', event => {
    if (!content.contains(event.target) && !$('.selection-actions').contains(event.target)) $('.selection-actions').hidden = true;
  });
  function renderQuote() {
    $('#note-quote').hidden = !quoted.text;
    $('#note-quote-text').textContent = quoted.text;
  }
  $('[data-selection-note]').addEventListener('click', () => {
    quoted = { ...selected };
    renderQuote();
    openTools('notes');
    $('.selection-actions').hidden = true;
    requestAnimationFrame(() => $('#note-input').focus());
  });
  $('[data-selection-ask]').addEventListener('click', () => {
    questionQuote = { ...selected };
    openTools('ask');
    $('#question-input').value = `请解释这段话：${selected.text.slice(0, 700)}`;
    $('.selection-actions').hidden = true;
    requestAnimationFrame(() => $('#question-input').focus());
  });
  $('#clear-quote').addEventListener('click', () => { quoted = { text: '', section: '' }; renderQuote(); });
  $$('[data-question]').forEach(button => button.addEventListener('click', () => {
    $('#question-input').value = button.dataset.question;
    questionQuote = { text: '', section: '' };
    $('#question-input').focus();
  }));
  function excerptFor(heading) {
    let next = heading?.nextElementSibling;
    while (next && !/^H[23]$/.test(next.tagName)) {
      if (['P', 'BLOCKQUOTE'].includes(next.tagName) && next.textContent.trim()) return next.textContent.trim().slice(0, 520);
      next = next.nextElementSibling;
    }
    return content.querySelector('p')?.textContent.trim().slice(0, 520) || '本文暂无可摘录的段落。';
  }
  $('#question-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#question-input');
    const question = input.value.trim();
    if (!question) { input.focus(); return; }
    const log = $('#question-log');
    if (log.children.length >= 40) { notify('演示对话已达 20 轮，刷新页面可重新开始。'); return; }
    let heading = sectionElement(questionQuote.section) || currentHeading;
    if (!questionQuote.text && /边界|限制/.test(question)) heading = headings.find(h => /边界|限制/.test(h.textContent)) || heading;
    const user = make('div', 'reader-entry question-user');
    user.append(make('span', 'entry-meta', '你 · 本页临时对话'), make('p', '', question));
    const reply = make('div', 'reader-entry');
    reply.append(make('span', 'entry-meta', '本地演示 · 原文摘录'), make('p', '', '尚未接入 AI，以下仅展示原文，不是针对问题生成的回答。'));
    reply.append(make('blockquote', '', questionQuote.text || excerptFor(heading)));
    const link = heading && sourceLink(heading.id);
    if (link) reply.append(link);
    log.append(user, reply);
    input.value = '';
    questionQuote = { text: '', section: '' };
    reply.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
  });
  $('#comment-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#comment-input');
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    const list = $('#comment-list');
    if (list.children.length >= 50) { notify('演示评论已达 50 条，刷新页面可清空。'); return; }
    const entry = make('div', 'reader-entry');
    entry.append(make('span', 'entry-meta', '你 · 刚刚 · 仅本页'), make('p', '', text));
    const remove = make('button', 'text-button', '删除');
    remove.type = 'button';
    remove.addEventListener('click', () => { entry.remove(); $('#comment-empty').hidden = !!list.children.length; });
    entry.append(remove); list.prepend(entry);
    $('#comment-empty').hidden = true;
    input.value = '';
    notify('已添加演示评论，没有公开发布');
  });
  let storageAvailable = true;
  let notes = [];
  function storageWarning(message) {
    storageAvailable = false;
    $('#storage-warning').hidden = false;
    $('#storage-warning').textContent = message;
    $('#note-state').textContent = '仅本页暂存';
  }
  function validNote(note) {
    return note && typeof note.id === 'string' && typeof note.text === 'string' && note.text.length <= 5000 && typeof note.quote === 'string' && note.quote.length <= 1500 && typeof note.section === 'string' && typeof note.updatedAt === 'string' && Number.isFinite(Date.parse(note.updatedAt));
  }
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || !parsed.every(validNote)) throw new Error('Invalid stored notes');
      notes = parsed.slice(0, 200);
    }
  } catch {
    storageWarning('无法读取本地笔记或数据格式异常。本次仅临时保存，不覆盖已有数据；请导出备份。');
  }
  function persistNotes() {
    if (!storageAvailable) return false;
    try { localStorage.setItem(storageKey, JSON.stringify(notes)); return true; }
    catch { storageWarning('浏览器存储不可用或空间不足。本次改动只在当前页面，请导出笔记，避免刷新丢失。'); return false; }
  }
  function resetEditor() {
    editingId = '';
    $('#note-input').value = '';
    quoted = { text: '', section: '' };
    renderQuote();
    $('#save-note').textContent = '保存笔记';
    $('#note-state').textContent = storageAvailable ? '手动保存' : '仅本页暂存';
  }
  function renderNotes() {
    const list = $('#note-list');
    list.replaceChildren();
    $('#note-empty').hidden = notes.length > 0;
    $('#note-count').textContent = `${notes.length} 条`;
    $('#export-notes').disabled = !notes.length;
    for (const note of notes) {
      const entry = make('div', 'reader-entry');
      entry.append(make('span', 'entry-meta', new Date(note.updatedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })));
      if (note.quote) entry.append(make('blockquote', '', note.quote));
      entry.append(make('p', '', note.text));
      const actions = make('div', 'entry-actions');
      const source = sourceLink(note.section);
      if (source) actions.append(source);
      const edit = make('button', 'text-button', '编辑');
      edit.type = 'button';
      edit.addEventListener('click', () => {
        if ($('#note-input').value.trim() && !window.confirm('切换到这条笔记？当前未保存的输入会被替换。')) return;
        editingId = note.id;
        $('#note-input').value = note.text;
        quoted = { text: note.quote, section: note.section };
        renderQuote(); $('#save-note').textContent = '更新笔记'; $('#note-input').focus();
      });
      const remove = make('button', 'text-button', '删除');
      remove.type = 'button';
      remove.addEventListener('click', () => {
        if (!window.confirm('删除这条笔记？此操作无法撤销。')) return;
        notes = notes.filter(item => item.id !== note.id);
        const saved = persistNotes();
        if (editingId === note.id) resetEditor();
        renderNotes(); notify(saved ? '已删除笔记' : '已从本页移除；存储不可用，请导出备份');
      });
      actions.append(edit, remove); entry.append(actions); list.append(entry);
    }
  }
  $('#note-input').addEventListener('input', () => { $('#note-state').textContent = '尚未保存'; });
  $('#note-form').addEventListener('submit', event => {
    event.preventDefault();
    const text = $('#note-input').value.trim();
    if (!text) { $('#note-input').focus(); return; }
    if (!editingId && notes.length >= 200) { notify('单篇最多保存 200 条笔记，请先导出并整理。'); return; }
    const note = { id: editingId || `${Date.now()}-${Math.random().toString(36).slice(2)}`, text, quote: quoted.text, section: quoted.section || currentHeading?.id || '', updatedAt: new Date().toISOString() };
    notes = [note, ...notes.filter(item => item.id !== note.id)];
    const saved = persistNotes();
    resetEditor(); renderNotes();
    $('#note-state').textContent = saved ? '已保存到本机' : '仅本页暂存';
    notify(saved ? '笔记已保存在当前浏览器' : '笔记仅在本页暂存，请导出备份');
  });
  $('#export-notes').addEventListener('click', () => {
    if (!notes.length) { notify('还没有可导出的笔记'); return; }
    const title = $('.reader-title').textContent.trim();
    const output = [`# ${title} · 阅读笔记`, '', '以下为个人笔记；请自行妥善保存。', '', ...notes.flatMap((note, index) => [`## 笔记 ${index + 1}`, '', note.updatedAt, '', ...(note.quote ? [note.quote.split('\n').map(line => `> ${line}`).join('\n'), ''] : []), note.text, '', `原文章节：${sectionElement(note.section)?.textContent || '正文'}`, '', '---', ''])].join('\n');
    const url = URL.createObjectURL(new Blob([output], { type: 'text/markdown;charset=utf-8' }));
    const link = make('a'); link.href = url; link.download = `${title.replace(/[\\/:*?"<>|]/g, '-').slice(0, 90)}-笔记.md`; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('已导出 Markdown 笔记');
  });
  addEventListener('beforeunload', event => { if ($('#note-input').value.trim()) { event.preventDefault(); event.returnValue = ''; } });
  renderNotes();
})();
