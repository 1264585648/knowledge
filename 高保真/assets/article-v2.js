/* No network requests. Questions are session-only; notes are browser-local, not account-private. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = 'zhiye:article-v2:what-is-rag:';
  const sections = $$('.article-section');
  const allowedSections = new Set(sections.map(s => s.id));
  const state = { notes: [], bookmark: false, editing: null, selected: null,
    quotes: { question: null, note: null }, searchMode: 'catalog', moved: null, noteStoreSafe: true };
  const node = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };
  const button = (label, action, className = '') => {
    const el = node('button', className, label); el.type = 'button';
    el.addEventListener('click', action); return el;
  };
  let toastTimer;
  function toast(message) {
    const el = $('#toast'); el.textContent = message; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }
  function read(key, fallback) {
    try { const value = localStorage.getItem(KEY + key); return value === null ? fallback : JSON.parse(value); }
    catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(KEY + key, JSON.stringify(value)); return true; }
    catch { return false; }
  }
  function storageWarning(text) {
    const el = $('#storage-warning'); el.textContent = text; el.hidden = false;
  }
  function validNote(n) {
    return n && typeof n.id === 'string' && n.id.length < 100 &&
      typeof n.text === 'string' && n.text.length > 0 && n.text.length <= 2000 &&
      typeof n.created === 'string' && Number.isFinite(Date.parse(n.created)) &&
      (n.quote === null || (n.quote && typeof n.quote.text === 'string' && n.quote.text.length <= 800 && allowedSections.has(n.quote.section)));
  }
  function loadNotes() {
    try {
      const raw = localStorage.getItem(KEY + 'notes');
      if (raw === null) return;
      const value = JSON.parse(raw);
      if (!Array.isArray(value) || value.length > 200 || !value.every(validNote) || new Set(value.map(n => n.id)).size !== value.length) throw new Error('Invalid notes');
      state.notes = value;
    } catch {
      state.noteStoreSafe = false;
      storageWarning('无法读取已有批注，原始存储不会被覆盖。新批注只能暂存本页，请及时导出。');
    }
  }
  function persistNotes() {
    if (!state.noteStoreSafe || !write('notes', state.notes)) {
      storageWarning('本次批注只暂存于当前页面，刷新可能丢失。请导出 Markdown；已有损坏数据不会被覆盖。');
      return false;
    }
    return true;
  }
  function showDialog(dialog) {
    if ($('#drawer').open) closeDrawer();
    $$('dialog[open]').filter(d => d !== dialog).forEach(d => d.close());
    if (!dialog.open) dialog.showModal();
  }
  function info(title, contents) {
    $('#info-heading').textContent = title; $('#info-body').replaceChildren(...contents);
    showDialog($('#info-dialog'));
  }
  function restoreDrawer() {
    if (!state.moved) return;
    state.moved.placeholder.replaceWith(state.moved.element); state.moved = null;
  }
  function closeDrawer() { if ($('#drawer').open) $('#drawer').close(); restoreDrawer(); }
  $('#drawer').addEventListener('close', restoreDrawer);
  function openDrawer(kind) {
    const library = kind === 'library';
    const el = library ? $('#library') : $('#right-rail');
    const visible = library ? innerWidth > 820 : innerWidth > 1100;
    if (visible && !document.body.classList.contains('focus-mode')) {
      if (!library) el.scrollTop = kind === 'toc' ? 0 : $('#tools-card').offsetTop - 18;
      return;
    }
    closeDrawer();
    const placeholder = document.createComment('drawer-original-position');
    el.before(placeholder); state.moved = { element: el, placeholder };
    $('#drawer-body').append(el); $('#drawer').dataset.side = library ? 'left' : 'right';
    $('#drawer-title').textContent = library ? '专题与文章' : kind === 'toc' ? '本篇目录' : '提问 / 批注';
    $('#drawer').showModal();
    if (!library) $('#drawer-body').scrollTop = kind === 'toc' ? 0 : $('#tools-card').offsetTop - 62;
  }
  function setTab(tab, focus = false) {
    const notes = tab === 'note';
    [$('#question-tab'), $('#notes-tab')].forEach((el, i) => {
      const active = notes === (i === 1); el.setAttribute('aria-selected', String(active)); el.tabIndex = active ? 0 : -1;
    });
    $('#question-panel').hidden = notes; $('#notes-panel').hidden = !notes;
    if (focus) (notes ? $('#notes-tab') : $('#question-tab')).focus();
  }
  $('#question-tab').addEventListener('click', () => setTab('question'));
  $('#notes-tab').addEventListener('click', () => setTab('note'));
  $('.tabs').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 'question' : e.key === 'End' ? 'note' : $('#notes-tab').getAttribute('aria-selected') === 'true' ? 'question' : 'note';
    setTab(next, true);
  });
  function renderQuote(kind) {
    const el = $('#' + (kind === 'question' ? 'question' : 'note') + '-quote');
    const quote = state.quotes[kind]; el.hidden = !quote;
    $('span', el).textContent = quote ? quote.text : '';
  }
  function useQuote(kind) {
    if (!state.selected) { toast('先选中正文中的一段文字，再添加引用。'); return; }
    state.quotes[kind] = { ...state.selected }; renderQuote(kind);
    setTab(kind); openDrawer('tools');
    $('#' + (kind === 'question' ? 'question' : 'note') + '-input').focus();
    $('#selection-tools').hidden = true;
  }
  function captureSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) { $('#selection-tools').hidden = true; return; }
    const range = selection.getRangeAt(0);
    const parent = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (!$('#article-body').contains(parent)) return;
    const text = selection.toString().trim(); if (!text) return;
    const origin = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    const section = origin.closest('.article-section');
    if (!section) return;
    state.selected = { text: text.slice(0, 800), section: section.id };
    const rect = range.getBoundingClientRect(); const bar = $('#selection-tools');
    bar.hidden = false;
    bar.style.left = Math.max(10, Math.min(innerWidth - 164, rect.left + rect.width / 2 - 75)) + 'px';
    bar.style.top = Math.max(64, Math.min(innerHeight - 54, rect.top - 44)) + 'px';
  }
  $('#article-body').addEventListener('pointerup', () => setTimeout(captureSelection, 0));
  document.addEventListener('keyup', e => { if (e.key === 'Shift' || (e.shiftKey && e.key.startsWith('Arrow'))) captureSelection(); });
  $('#selection-tools').addEventListener('pointerdown', e => e.preventDefault());
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#selection-tools,#article-body')) $('#selection-tools').hidden = true; });
  $('#question-form').addEventListener('submit', e => {
    e.preventDefault(); const input = $('#question-input'); const text = input.value.trim();
    if (!text || text.length > 1000) { toast('请输入 1–1000 个字符的问题。'); return; }
    const item = node('article', 'discussion-item');
    const avatar = node('span', 'avatar', '我'); avatar.setAttribute('aria-hidden', 'true');
    const body = node('div'); const meta = node('div', 'discussion-meta', '你'); meta.append(node('small', '', '· 刚刚 · 本地'));
    const quote = state.quotes.question;
    const copy = node('p', 'discussion-copy', (quote ? '引用：' + quote.text + '\n\n' : '') + text);
    const actions = node('div', 'discussion-actions'); actions.append(node('span', '', '未公开发布'), button('删除', () => item.remove()));
    body.append(meta, copy, actions); item.append(avatar, body); $('#discussion-list').prepend(item);
    input.value = ''; state.quotes.question = null; renderQuote('question'); toast('问题已加入本页演示，没有发送到服务器。');
  });
  function noteDirty() {
    if (!state.editing) return Boolean($('#note-input').value.trim());
    const original = state.notes.find(n => n.id === state.editing);
    return !original || $('#note-input').value !== original.text || JSON.stringify(state.quotes.note) !== JSON.stringify(original.quote);
  }
  function resetNote() {
    state.editing = null; $('#note-input').value = ''; state.quotes.note = null; renderQuote('note');
    $('#save-note').textContent = '保存批注'; $('#cancel-edit').hidden = true;
  }
  function renderNotes() {
    const list = $('#notes-list'); list.replaceChildren();
    $('#notes-count').textContent = state.notes.length + ' 条批注';
    $('#export-notes').disabled = state.notes.length === 0;
    if (!state.notes.length) {
      const empty = node('div', 'notes-empty'); empty.append(node('p', '', '还没有批注，记下第一个想法吧。'), node('p', '', '选中正文，也可以连同原文一起保存。'));
      list.append(empty); return;
    }
    state.notes.forEach(n => {
      const item = node('article', 'note-item'); const time = node('time', '', new Date(n.created).toLocaleString('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
      time.dateTime = n.created; item.append(time);
      if (n.quote) item.append(node('blockquote', '', n.quote.text));
      item.append(node('p', '', n.text)); const actions = node('div', 'note-actions');
      if (n.quote) {
        const anchor = node('a', '', '查看原文'); anchor.href = '#' + n.quote.section;
        anchor.addEventListener('click', () => closeDrawer()); actions.append(anchor);
      }
      actions.append(button('编辑', () => {
        if (noteDirty() && !confirm('当前有未保存的批注，放弃草稿并编辑这条批注吗？')) return;
        state.editing = n.id; $('#note-input').value = n.text; state.quotes.note = n.quote ? { ...n.quote } : null; renderQuote('note');
        $('#save-note').textContent = '保存修改'; $('#cancel-edit').hidden = false; $('#note-input').focus();
      }), button('删除', () => {
        if (!confirm('删除这条批注？此操作不能撤销。')) return;
        state.notes = state.notes.filter(other => other.id !== n.id);
        if (state.editing === n.id) resetNote();
        const saved = persistNotes(); renderNotes(); toast(saved ? '批注已删除。' : '只在本页删除，存储未更新，请导出当前批注。');
      }));
      item.append(actions); list.append(item);
    });
  }
  $('#cancel-edit').addEventListener('click', () => {
    if (!noteDirty() || confirm('放弃未保存的批注修改？')) resetNote();
  });
  $('#note-form').addEventListener('submit', e => {
    e.preventDefault(); const text = $('#note-input').value.trim();
    if (!text || text.length > 2000) { toast('请输入 1–2000 个字符的批注。'); return; }
    if (!state.editing && state.notes.length >= 200) { toast('单篇最多保存 200 条批注，请先导出和整理。'); return; }
    const previous = state.notes.find(n => n.id === state.editing);
    const n = { id: previous?.id || (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2)),
      text, created: previous?.created || new Date().toISOString(), quote: state.quotes.note ? { ...state.quotes.note } : null };
    state.notes = previous ? state.notes.map(v => v.id === previous.id ? n : v) : [n, ...state.notes];
    const saved = persistNotes(); resetNote(); renderNotes(); toast(saved ? '批注已保存到当前浏览器。' : '批注仅暂存本页，请导出后再离开。');
  });
  $('#export-notes').addEventListener('click', () => {
    if (!state.notes.length) return;
    const content = '# 什么是 RAG · 我的批注\n\n' + state.notes.map(n => '## ' + new Date(n.created).toLocaleString('zh-CN') + '\n\n' +
      (n.quote ? '> ' + n.quote.text.replace(/\n/g, '\n> ') + '\n\n原文章节：' + n.quote.section + '\n\n' : '') + n.text).join('\n\n---\n\n') + '\n';
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    const a = node('a'); a.href = url; a.download = '知页-RAG-阅读批注.md'; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000); toast('已生成 Markdown 导出文件。');
  });
  function updateBookmark() {
    $('#bookmark').setAttribute('aria-pressed', String(state.bookmark)); $('#bookmark span').textContent = state.bookmark ? '已收藏' : '收藏';
  }
  state.bookmark = read('bookmark', false) === true; updateBookmark();
  $('#bookmark').addEventListener('click', () => {
    state.bookmark = !state.bookmark; const saved = write('bookmark', state.bookmark); updateBookmark();
    toast(saved ? state.bookmark ? '已收藏，保存在当前浏览器。' : '已取消收藏。' : '收藏状态仅在当前页面有效，浏览器存储不可用。');
  });
  function setTheme(dark, persist = true) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('#theme-toggle').setAttribute('aria-pressed', String(dark)); $('#theme-toggle').setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
    if (persist && !write('theme', dark ? 'dark' : 'light')) toast('主题已切换，但无法保存到浏览器。');
  }
  setTheme(read('theme', 'light') === 'dark', false);
  $('#theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme !== 'dark'));
  function goSection(id) {
    closeDrawer(); const el = document.getElementById(id); if (!el) return;
    el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    history.replaceState(null, '', '#' + id);
    const heading = $('h2', el); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  }
  function showPreview(title, topic) {
    const label = node('p', 'preview-topic', topic + ' / 目录样例'); const heading = node('h3', 'preview-title', title);
    const description = node('p', 'preview-description', '这篇文章出现在专题目录中，正文尚未接入当前原型。');
    const status = node('p', 'preview-status', '当前可完整阅读《什么是 RAG》。这里不会伪装成已发布内容，也不会跳转到不存在的页面。');
    info('文章预览', [label, heading, description, status, button('继续阅读当前文章', () => { $('#info-dialog').close(); $('#article-title').focus({ preventScroll: true }); }, 'outline-button')]);
  }
  const catalog = $$('.topic-links button').map(el => ({ title: el.textContent.trim(), topic: el.closest('details').querySelector('summary span').textContent, current: el.hasAttribute('data-current-article') }));
  function searchRows(query) {
    const q = query.trim().toLocaleLowerCase(); let rows = [];
    if (state.searchMode === 'catalog') rows = catalog.filter(item => !q || (item.title + item.topic).toLocaleLowerCase().includes(q)).map(item => ({ title: item.title, detail: item.topic + (item.current ? ' · 当前文章' : ' · 目录样例，正文待接入'), action: () => item.current ? goSection('why-rag') : showPreview(item.title, item.topic) }));
    const chapterRows = sections.filter(s => !q || s.textContent.toLocaleLowerCase().includes(q)).map(s => {
      const text = s.textContent.replace(/\s+/g, ' ').trim(); const at = Math.max(0, text.toLocaleLowerCase().indexOf(q) - 20);
      return { title: $('h2', s).textContent, detail: '本篇章节 · ' + text.slice(at, at + 90), action: () => goSection(s.id) };
    });
    if (state.searchMode === 'article' || q) rows = rows.concat(chapterRows);
    return rows.slice(0, 30);
  }
  function renderSearch() {
    const rows = searchRows($('#search-input').value); const list = $('#search-results'); list.replaceChildren();
    if (!rows.length) { list.append(node('p', 'dialog-empty', '没有找到相关内容，试试“检索”或“微调”。')); return; }
    rows.forEach(row => {
      const el = button('', () => { $('#search-dialog').close(); row.action(); }, 'search-result');
      el.append(node('strong', '', row.title), node('small', '', row.detail)); list.append(el);
    });
  }
  function openSearch(mode) {
    state.searchMode = mode; $('#search-input').value = '';
    $('#search-input').placeholder = mode === 'article' ? '搜索本篇文章的内容…' : '搜索文章和主题…';
    $('#search-info').textContent = mode === 'article' ? '仅搜索本篇正文 · ↓ 选择结果 · Enter 打开 · Esc 关闭' : '仅搜索本原型的目录和正文，尚未接入全站搜索。';
    renderSearch(); showDialog($('#search-dialog')); $('#search-input').focus();
  }
  $('#search-input').addEventListener('input', renderSearch);
  $('#search-dialog').addEventListener('keydown', e => {
    const results = $$('.search-result', $('#search-results')); const at = results.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); results[(at + 1) % results.length].focus(); }
    else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); if (at <= 0) $('#search-input').focus(); else results[at - 1].focus(); }
    else if (e.key === 'Enter' && document.activeElement === $('#search-input') && results.length) { e.preventDefault(); results[0].click(); }
  });
  async function copyLink() {
    const url = location.href;
    try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(url); toast('文章链接已复制。'); }
    catch {
      const text = node('p', 'preview-description', '浏览器未允许直接复制。选中下方地址后，使用系统复制快捷键。');
      const input = node('textarea'); input.value = url; input.readOnly = true; input.style.width = '100%'; input.setAttribute('aria-label', '可复制的文章地址');
      info('复制文章链接', [text, input]); input.focus(); input.select();
    }
  }
  function collection(kind) {
    const title = kind === 'bookmarks' ? '我的收藏' : '最近阅读';
    const hint = node('p', 'preview-topic', '仅展示当前原型、当前浏览器的记录。');
    const result = kind === 'bookmarks' && !state.bookmark ? node('p', 'dialog-empty', '还没有收藏。点击文章标题下方的“收藏”按钮添加。') : button('什么是 RAG：让大模型先查资料，再回答', () => { $('#info-dialog').close(); goSection('why-rag'); }, 'search-result');
    info(title, [hint, result]);
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('button,a'); if (!el) return;
    if (el.hasAttribute('data-close-dialog')) { const dialog = el.closest('dialog'); if (dialog === $('#drawer')) closeDrawer(); else dialog.close(); }
    if (el.dataset.search) openSearch(el.dataset.search);
    if (el.dataset.drawer) openDrawer(el.dataset.drawer === 'notes' ? 'tools' : el.dataset.drawer);
    if (el.dataset.preview) showPreview(el.dataset.preview, el.dataset.topic || 'RAG 专题');
    if (el.hasAttribute('data-current-article')) { closeDrawer(); window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); }
    if (el.hasAttribute('data-reveal-topic')) { openDrawer('library'); const topic = $('.topic'); topic.open = true; topic.scrollIntoView({ block: 'nearest' }); }
    if (el.dataset.collection) collection(el.dataset.collection);
    if (el.dataset.selection) useQuote(el.dataset.selection);
    if (el.dataset.quote) useQuote(el.dataset.quote);
    if (el.dataset.clearQuote) { state.quotes[el.dataset.clearQuote] = null; renderQuote(el.dataset.clearQuote); }
    if (el.dataset.reply) { state.quotes.question = { text: '回复 ' + el.dataset.reply, section: 'what-is-rag' }; renderQuote('question'); $('#question-input').focus(); }
    if (el.hasAttribute('data-example-info')) info('示例提问', [node('p', 'preview-description', '这条内容是用于检查版式的虚构样例，不代表真实用户活动。你的新问题也只在当前页面展示。')]);
    if (el.hasAttribute('data-back-top')) window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    if (el.hasAttribute('data-copy-link')) { $('.more').open = false; copyLink(); }
    if (el.hasAttribute('data-print')) { $('.more').open = false; window.print(); }
    if (el.hasAttribute('data-focus')) { closeDrawer(); $('.more').open = false; document.body.classList.toggle('focus-mode'); document.body.classList.contains('focus-mode') ? $('.exit-focus').focus() : $('#article-title').focus({ preventScroll: true }); }
    if (el.closest('.toc')) { e.preventDefault(); goSection(el.getAttribute('href').slice(1)); }
  });
  $('#profile-info').addEventListener('click', () => info('当前为公开设计预览', [node('p', 'preview-description', '这里的“知”是预览头像，没有登录账号。收藏和批注保存在当前浏览器，提问不会公开发布。正式站点的关注验证和权限逻辑没有被这个原型替代。')]));
  $$('dialog').forEach(dialog => dialog.addEventListener('click', e => {
    if (e.target !== dialog) return; const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { if (dialog === $('#drawer')) closeDrawer(); else dialog.close(); }
  }));
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch('catalog'); }
    if (e.key === 'Escape') {
      $('#selection-tools').hidden = true; $('.more').open = false;
      const dialog = $$('dialog[open]').at(-1);
      if (dialog) { e.preventDefault(); dialog === $('#drawer') ? closeDrawer() : dialog.close(); }
    }
  });
  let ticking = false;
  function readingPosition() {
    let active = sections[0];
    for (const section of sections) if (section.getBoundingClientRect().top <= 140) active = section;
    $$('.toc a').forEach(a => { if (a.hash === '#' + active.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    const bottom = $('#article-body').getBoundingClientRect().bottom + scrollY;
    const value = Math.round(Math.max(0, Math.min(100, scrollY / Math.max(1, bottom - innerHeight) * 100)));
    $('.progress-bar').style.width = value + '%'; $('.progress-track').setAttribute('aria-valuenow', String(value)); ticking = false;
  }
  addEventListener('scroll', () => { $('#selection-tools').hidden = true; if (!ticking) { ticking = true; requestAnimationFrame(readingPosition); } }, { passive: true });
  addEventListener('resize', () => {
    if (state.moved && ((state.moved.element.id === 'library' && innerWidth > 820) || (state.moved.element.id === 'right-rail' && innerWidth > 1100))) closeDrawer();
    readingPosition();
  });
  addEventListener('beforeunload', e => { if (noteDirty() || $('#question-input').value.trim()) { e.preventDefault(); e.returnValue = ''; } });
  // Concurrent tabs are deliberately not merged; warn instead of silently overwriting edits.
  addEventListener('storage', e => {
    if (e.key === KEY + 'notes') { state.noteStoreSafe = false; storageWarning('其他标签页更改了批注。为避免覆盖，本页新修改只暂存于内存；请导出后刷新。'); }
  });
  loadNotes(); renderNotes(); readingPosition();
  const minutes = Math.max(1, Math.ceil($('#article-body').textContent.replace(/\s/g, '').length / 350));
  $('#read-time').textContent = '约 ' + minutes + ' 分钟阅读';
  write('recent', { title: '什么是 RAG', visited: new Date().toISOString() });
})();
