/* Adapted from article-v2.js. No network requests; independent per-article local storage. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = 'zhiye:rag-introduction:v1:';
  const sections = $$('.article-section');
  const allowed = new Set(sections.map(s => s.id));
  const state = { notes: [], editing: null, selected: null, quotes: { question: null, note: null }, safe: true, moved: null, mode: 'catalog', bookmark: false };
  const node = (tag, cls = '', text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const button = (label, action, cls = '') => { const e = node('button', cls, label); e.type = 'button'; e.addEventListener('click', action); return e; };
  let timer;
  const toast = text => { $('#toast').textContent = text; $('#toast').hidden = false; clearTimeout(timer); timer = setTimeout(() => $('#toast').hidden = true, 4000); };
  const read = (key, fallback) => { try { const value = localStorage.getItem(KEY + key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(KEY + key, JSON.stringify(value)); return true; } catch { return false; } };
  const warn = text => { $('#storage-warning').hidden = false; $('#storage-warning').textContent = text; };
  function restoreDrawer() { if (state.moved) { state.moved.placeholder.replaceWith(state.moved.element); state.moved = null; } }
  function closeDrawer() { if ($('#drawer').open) $('#drawer').close(); restoreDrawer(); }
  $('#drawer').addEventListener('close', () => { if (!$('#drawer').open) restoreDrawer(); });
  function showDialog(dialog) { closeDrawer(); $$('dialog[open]').filter(d => d !== dialog).forEach(d => d.close()); if (!dialog.open) dialog.showModal(); }
  function info(title, children) { $('#info-heading').textContent = title; $('#info-body').replaceChildren(...children); showDialog($('#info-dialog')); }
  function openDrawer(kind) {
    const library = kind === 'library', el = library ? $('#library') : $('#right-rail');
    if ((library ? innerWidth > 820 : innerWidth > 1100) && !document.body.classList.contains('focus-mode')) {
      if (!library) el.scrollTop = kind === 'toc' ? 0 : $('#tools-card').offsetTop - 18; return;
    }
    closeDrawer(); const placeholder = document.createComment('reader-original-position');
    el.before(placeholder); state.moved = { element: el, placeholder }; $('#drawer-body').append(el);
    $('#drawer').dataset.side = library ? 'left' : 'right'; $('#drawer-title').textContent = library ? '专题与文章' : kind === 'toc' ? '本篇目录' : '提问 / 批注';
    $('#drawer').showModal(); if (!library) $('#drawer-body').scrollTop = kind === 'toc' ? 0 : Math.max(0, $('#tools-card').offsetTop - 62);
  }
  function tab(kind, focus = false) {
    const notes = kind === 'note'; [$('#question-tab'), $('#notes-tab')].forEach((e, i) => { const active = notes === (i === 1); e.setAttribute('aria-selected', String(active)); e.tabIndex = active ? 0 : -1; });
    $('#question-panel').hidden = notes; $('#notes-panel').hidden = !notes; if (focus) (notes ? $('#notes-tab') : $('#question-tab')).focus();
  }
  $('#question-tab').addEventListener('click', () => tab('question')); $('#notes-tab').addEventListener('click', () => tab('note'));
  $('.tabs').addEventListener('keydown', e => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return; e.preventDefault(); tab(e.key === 'Home' ? 'question' : e.key === 'End' ? 'note' : $('#notes-panel').hidden ? 'note' : 'question', true); });
  function renderQuote(kind) { const e = $('#' + kind + '-quote'), q = state.quotes[kind]; e.hidden = !q; $('span', e).textContent = q ? q.text : ''; }
  function quote(kind) { if (!state.selected) return toast('先选中正文，再引用原文。'); state.quotes[kind] = { ...state.selected }; renderQuote(kind); tab(kind); openDrawer('tools'); $('#' + kind + '-input').focus(); $('#selection-tools').hidden = true; }
  function selection() {
    const s = getSelection(); if (!s || s.isCollapsed || !s.rangeCount) { $('#selection-tools').hidden = true; return; }
    const range = s.getRangeAt(0), ancestor = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (!$('#article-body').contains(ancestor)) return;
    const origin = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement, section = origin.closest('.article-section');
    if (!section || !s.toString().trim()) return;
    state.selected = { text: s.toString().trim().slice(0, 800), section: section.id };
    const r = range.getBoundingClientRect(), bar = $('#selection-tools'); bar.hidden = false;
    bar.style.left = Math.max(10, Math.min(innerWidth - 164, r.left + r.width / 2 - 75)) + 'px'; bar.style.top = Math.max(64, Math.min(innerHeight - 54, r.top - 44)) + 'px';
  }
  $('#article-body').addEventListener('pointerup', () => setTimeout(selection, 0));
  document.addEventListener('keyup', e => { if (e.key === 'Shift' || (e.shiftKey && e.key.startsWith('Arrow'))) selection(); });
  $('#selection-tools').addEventListener('pointerdown', e => e.preventDefault());
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#selection-tools,#article-body')) $('#selection-tools').hidden = true; });
  $('#question-form').addEventListener('submit', e => {
    e.preventDefault(); const input = $('#question-input'), text = input.value.trim(); if (!text || text.length > 1000) return toast('请输入 1–1000 个字符的问题。');
    const item = node('article', 'discussion-item'), avatar = node('span', 'avatar', '我'), body = node('div'), meta = node('div', 'discussion-meta', '你'); avatar.setAttribute('aria-hidden', 'true'); meta.append(node('small', '', '· 本页暂存'));
    const q = state.quotes.question, actions = node('div', 'discussion-actions'); actions.append(node('span', '', '未公开发布'), button('删除', () => item.remove()));
    body.append(meta, node('p', 'discussion-copy', (q ? '引用：' + q.text + '\n\n' : '') + text), actions); item.append(avatar, body); $('#discussion-list').prepend(item);
    input.value = ''; state.quotes.question = null; renderQuote('question'); toast('问题仅加入本页，没有发送给服务器或 AI。');
  });
  function validNote(n) { return n && typeof n.id === 'string' && n.id.length < 100 && typeof n.text === 'string' && n.text.length > 0 && n.text.length <= 2000 && typeof n.created === 'string' && Number.isFinite(Date.parse(n.created)) && (n.quote === null || (n.quote && typeof n.quote.text === 'string' && n.quote.text.length <= 800 && allowed.has(n.quote.section))); }
  try { const raw = localStorage.getItem(KEY + 'notes'); if (raw !== null) { const list = JSON.parse(raw); if (!Array.isArray(list) || list.length > 200 || !list.every(validNote) || new Set(list.map(n => n.id)).size !== list.length) throw Error('Invalid stored notes'); state.notes = list; } }
  catch { state.safe = false; warn('无法读取已有批注，原始数据不会被覆盖。新批注只能暂存本页，请及时导出。'); }
  function persist() { if (state.safe && write('notes', state.notes)) return true; warn('保存失败：当前批注仅暂存本页，刷新可能丢失。请导出 Markdown；已有数据不会被覆盖。'); return false; }
  function dirty() { const n = state.notes.find(n => n.id === state.editing); return state.editing ? !n || $('#note-input').value !== n.text || JSON.stringify(state.quotes.note) !== JSON.stringify(n.quote) : Boolean($('#note-input').value.trim()); }
  function resetNote() { state.editing = null; state.quotes.note = null; $('#note-input').value = ''; renderQuote('note'); $('#save-note').textContent = '保存批注'; $('#cancel-edit').hidden = true; }
  function renderNotes() {
    const list = $('#notes-list'); list.replaceChildren(); $('#notes-count').textContent = state.notes.length + ' 条批注'; $('#export-notes').disabled = !state.notes.length;
    if (!state.notes.length) { const empty = node('div', 'notes-empty'); empty.append(node('p', '', '还没有批注，记下第一个想法吧。'), node('p', '', '选中正文，也可以连同原文一起保存。')); list.append(empty); }
    for (const n of state.notes) {
      const item = node('article', 'note-item'), time = node('time', '', new Date(n.created).toLocaleString('zh-CN')); time.dateTime = n.created; item.append(time);
      if (n.quote) item.append(node('blockquote', '', n.quote.text)); item.append(node('p', '', n.text)); const actions = node('div', 'note-actions');
      if (n.quote) { const a = node('a', '', '查看原文'); a.href = '#' + n.quote.section; a.addEventListener('click', closeDrawer); actions.append(a); }
      actions.append(button('编辑', () => { if (dirty() && !confirm('放弃当前未保存的草稿并编辑这条批注？')) return; state.editing = n.id; state.quotes.note = n.quote ? { ...n.quote } : null; $('#note-input').value = n.text; renderQuote('note'); $('#save-note').textContent = '保存修改'; $('#cancel-edit').hidden = false; $('#note-input').focus(); }), button('删除', () => { if (!confirm('删除这条批注？此操作不能撤销。')) return; state.notes = state.notes.filter(x => x.id !== n.id); if (state.editing === n.id) resetNote(); const saved = persist(); renderNotes(); toast(saved ? '批注已删除。' : '仅从本页删除，存储未更新。'); }));
      item.append(actions); list.append(item);
    }
  }
  $('#cancel-edit').addEventListener('click', () => { if (!dirty() || confirm('放弃未保存的批注修改？')) resetNote(); });
  $('#note-form').addEventListener('submit', e => {
    e.preventDefault(); const text = $('#note-input').value.trim(); if (!text || text.length > 2000) return toast('请输入 1–2000 个字符的批注。'); if (!state.editing && state.notes.length >= 200) return toast('最多保存 200 条批注，请先导出和整理。');
    const old = state.notes.find(n => n.id === state.editing), n = { id: old?.id || globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2), text, created: old?.created || new Date().toISOString(), quote: state.quotes.note ? { ...state.quotes.note } : null };
    state.notes = old ? state.notes.map(v => v.id === old.id ? n : v) : [n, ...state.notes]; const saved = persist(); resetNote(); renderNotes(); toast(saved ? '批注已保存到当前浏览器。' : '批注只暂存于本页，请导出。');
  });
  $('#export-notes').addEventListener('click', () => {
    if (!state.notes.length) return; const text = '# 什么是 RAG · 我的批注\n\n' + state.notes.map(n => '## ' + new Date(n.created).toLocaleString('zh-CN') + '\n\n' + (n.quote ? '> ' + n.quote.text.replace(/\n/g, '\n> ') + '\n\n原文章节：' + n.quote.section + '\n\n' : '') + n.text).join('\n\n---\n\n') + '\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' })), a = node('a'); a.href = url; a.download = '知页-RAG-阅读批注.md'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); toast('已生成 Markdown 批注文件。');
  });
  function bookmark() { $('#bookmark').setAttribute('aria-pressed', String(state.bookmark)); $('#bookmark span').textContent = state.bookmark ? '已收藏' : '收藏'; }
  state.bookmark = read('bookmark', false) === true; bookmark(); $('#bookmark').addEventListener('click', () => { state.bookmark = !state.bookmark; bookmark(); toast(write('bookmark', state.bookmark) ? state.bookmark ? '已收藏到当前浏览器。' : '已取消收藏。' : '收藏状态仅在本页有效，存储不可用。'); });
  function theme(dark, save = true) { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; $('#theme-toggle').setAttribute('aria-pressed', String(dark)); $('#theme-toggle').setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式'); if (save && !write('theme', dark ? 'dark' : 'light')) toast('已切换主题，无法保存设置。'); }
  theme(read('theme', 'light') === 'dark', false); $('#theme-toggle').addEventListener('click', () => theme(document.documentElement.dataset.theme !== 'dark'));
  function go(id) { closeDrawer(); const el = document.getElementById(id); if (!el) return; el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' }); try { history.replaceState(null, '', '#' + id); } catch { /* Opaque preview origins may block history. */ } const h = $('h2', el); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); } }
  function preview(title, topic = 'RAG 专题') { info('文章预览', [node('p', 'preview-topic', topic + ' / 规划中'), node('h3', 'preview-title', title), node('p', 'preview-description', '这篇文章的正文尚未接入当前原型。目前可以完整阅读《什么是 RAG》。'), node('p', 'preview-status', '这是目录样例，不代表已经发布，也不会跳转到不存在的文章。'), button('继续阅读当前文章', () => $('#info-dialog').close(), 'outline-button')]); }
  const catalog = $$('.topic-links button').map(e => ({ title: e.textContent.trim(), topic: $('summary span', e.closest('details')).textContent, current: e.hasAttribute('data-current-article') }));
  function search() {
    const q = $('#search-input').value.trim().toLocaleLowerCase(); let rows = [];
    if (state.mode === 'catalog') rows = catalog.filter(x => !q || (x.title + x.topic).toLocaleLowerCase().includes(q)).map(x => ({ title: x.title, detail: x.topic + (x.current ? ' · 当前文章' : ' · 正文待接入'), action: () => x.current ? go('why-rag') : preview(x.title, x.topic) }));
    if (state.mode === 'article' || q) rows.push(...sections.filter(s => !q || s.textContent.toLocaleLowerCase().includes(q)).map(s => { const t = s.textContent.replace(/\s+/g, ' ').trim(), at = Math.max(0, t.toLocaleLowerCase().indexOf(q) - 20); return { title: $('h2', s).textContent, detail: t.slice(at, at + 90), action: () => go(s.id) }; }));
    $('#search-results').replaceChildren(); if (!rows.length) $('#search-results').append(node('p', 'dialog-empty', '没有找到相关内容，试试“备份”或“检索”。'));
    rows.slice(0, 30).forEach(row => { const b = button('', () => { $('#search-dialog').close(); row.action(); }, 'search-result'); b.append(node('strong', '', row.title), node('small', '', row.detail)); $('#search-results').append(b); });
  }
  function openSearch(mode) { state.mode = mode; $('#search-input').value = ''; $('#search-input').placeholder = mode === 'article' ? '搜索本篇文章的内容…' : '搜索文章和主题…'; $('#search-info').textContent = mode === 'article' ? '仅搜索本文 · ↓ 选择 · Enter 打开 · Esc 关闭' : '仅搜索本原型目录及正文，未接入全站搜索。'; search(); showDialog($('#search-dialog')); $('#search-input').focus(); }
  $('#search-input').addEventListener('input', search); $('#search-dialog').addEventListener('keydown', e => { const rows = $$('.search-result', $('#search-results')), at = rows.indexOf(document.activeElement); if (e.key === 'ArrowDown' && rows.length) { e.preventDefault(); rows[(at + 1) % rows.length].focus(); } else if (e.key === 'ArrowUp' && rows.length) { e.preventDefault(); at <= 0 ? $('#search-input').focus() : rows[at - 1].focus(); } else if (e.key === 'Enter' && document.activeElement === $('#search-input') && rows.length) { e.preventDefault(); rows[0].click(); } });
  async function copyLink() { try { if (!navigator.clipboard?.writeText) throw Error('Unavailable'); await navigator.clipboard.writeText(location.href); toast('文章链接已复制。'); } catch { const area = node('textarea'); area.value = location.href; area.readOnly = true; area.style.width = '100%'; area.setAttribute('aria-label', '可复制的文章地址'); info('复制文章链接', [node('p', 'preview-description', '浏览器未允许直接复制，请选中下方地址后使用系统复制快捷键。'), area]); area.focus(); area.select(); } }
  document.addEventListener('click', e => {
    const el = e.target.closest('button,a'); if (!el) return;
    if (document.body.dataset.standalone && el.matches('a[href="index.html"],a[href="topics.html"]')) { e.preventDefault(); info('独立预览', [node('p', 'preview-description', '此单文件仅包含文章页。仓库版本中的首页和全部内容入口连接到现有页面。')]); return; }
    if (el.hasAttribute('data-close-dialog')) { const d = el.closest('dialog'); d === $('#drawer') ? closeDrawer() : d.close(); }
    if (el.dataset.search) openSearch(el.dataset.search); if (el.dataset.drawer) openDrawer(el.dataset.drawer === 'notes' ? 'tools' : el.dataset.drawer);
    if (el.dataset.preview) preview(el.dataset.preview, el.dataset.topic);
    if (el.hasAttribute('data-current-article')) { closeDrawer(); scrollTo({ top: 0, behavior: 'smooth' }); }
    if (el.hasAttribute('data-reveal-topic')) { openDrawer('library'); $('.topic').open = true; $('.topic').scrollIntoView({ block: 'nearest' }); }
    if (el.dataset.collection) { const saved = el.dataset.collection === 'bookmarks'; info(saved ? '我的收藏' : '最近阅读', [node('p', 'preview-topic', '仅展示当前原型在此浏览器中的记录。'), saved && !state.bookmark ? node('p', 'dialog-empty', '还没有收藏，点击标题下方的“收藏”添加。') : button('什么是 RAG：让大模型先查资料，再回答', () => { $('#info-dialog').close(); go('why-rag'); }, 'search-result')]); }
    if (el.dataset.selection) quote(el.dataset.selection); if (el.dataset.quote) quote(el.dataset.quote);
    if (el.dataset.clearQuote) { state.quotes[el.dataset.clearQuote] = null; renderQuote(el.dataset.clearQuote); }
    if (el.dataset.reply) { state.quotes.question = { text: '回复 ' + el.dataset.reply, section: 'what-is-rag' }; renderQuote('question'); $('#question-input').focus(); }
    if (el.hasAttribute('data-example-info')) info('示例提问', [node('p', 'preview-description', '预置讨论是虚构的版式样例，不代表真实用户活动。新问题也只展示在本页。')]);
    if (el.hasAttribute('data-back-top')) scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' });
    if (el.hasAttribute('data-copy-link')) { $('.more').open = false; copyLink(); }
    if (el.hasAttribute('data-print')) { $('.more').open = false; print(); }
    if (el.hasAttribute('data-focus')) { closeDrawer(); $('.more').open = false; document.body.classList.toggle('focus-mode'); document.body.classList.contains('focus-mode') ? $('.exit-focus').focus() : $('#article-title').focus({ preventScroll: true }); }
    if (el.closest('.toc') && el.hash) { e.preventDefault(); go(el.hash.slice(1)); }
  });
  $('#profile-info').addEventListener('click', () => info('当前为公开设计预览', [node('p', 'preview-description', '“知”是预览头像，没有登录账号。提问不发送给服务器或 AI；批注仅在当前浏览器保存，不是私密账号空间，也不跨设备同步。本页不替代正式站点的关注验证。')]));
  $$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target !== d) return; const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d === $('#drawer') ? closeDrawer() : d.close(); }));
  document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch('catalog'); } if (e.key === 'Escape') { $('#selection-tools').hidden = true; $('.more').open = false; const d = $$('dialog[open]').at(-1); if (d) { e.preventDefault(); d === $('#drawer') ? closeDrawer() : d.close(); } } });
  function position() { let active = sections[0]; for (const s of sections) if (s.getBoundingClientRect().top <= 140) active = s; $$('.toc a').forEach(a => { if (a.hash === '#' + active.id) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); }); const bottom = $('#article-body').getBoundingClientRect().bottom + scrollY, value = Math.round(Math.max(0, Math.min(100, scrollY / Math.max(1, bottom - innerHeight) * 100))); $('.progress-bar').style.width = value + '%'; $('.progress-track').setAttribute('aria-valuenow', String(value)); }
  let ticking = false; addEventListener('scroll', () => { $('#selection-tools').hidden = true; if (!ticking) { ticking = true; requestAnimationFrame(() => { position(); ticking = false; }); } }, { passive: true });
  addEventListener('resize', () => { if (state.moved && ((state.moved.element.id === 'library' && innerWidth > 820) || (state.moved.element.id === 'right-rail' && innerWidth > 1100))) closeDrawer(); position(); });
  addEventListener('beforeunload', e => { if (dirty() || $('#question-input').value.trim()) { e.preventDefault(); e.returnValue = ''; } });
  addEventListener('storage', e => { if (e.key === KEY + 'notes' || e.key === null) { state.safe = false; warn('其他标签页改变了存储。为避免覆盖，本页修改只暂存于内存，请导出后刷新。'); } });
  renderNotes(); position(); $('#read-time').textContent = '约 ' + Math.max(1, Math.ceil($('#article-body').textContent.replace(/\s/g, '').length / 350)) + ' 分钟阅读';
  write('recent', { title: '什么是 RAG', visited: new Date().toISOString() });
})();
