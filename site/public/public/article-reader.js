/* Shared reader. No network/model calls; all dynamic user text uses textContent.
   Article-local notes/bookmarks, global theme/recent IDs. Legacy prototype keys are untouched. */
(() => {
  'use strict';
  const root = document.querySelector('[data-reader]');
  if (!root || root.dataset.readerReady) return;
  root.dataset.readerReady = 'true';
  const $ = (s, parent = root) => parent.querySelector(s);
  const $$ = (s, parent = root) => [...parent.querySelectorAll(s)];
  const articleId = root.dataset.articleId;
  if (!articleId || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(articleId)) return;
  const title = root.dataset.articleTitle || document.title;
  const prefix = `zhiye:article:v1:${articleId}:`;
  const noteKey = prefix + 'notes';
  const content = $('#article-body');
  const headings = $$('h2[id],h3[id]', content).filter(h => !h.closest('.footnotes'));
  const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  const state = { notes: [], raw: null, safe: true, unsaved: false, editing: null, selected: null,
    quotes: { note: null, question: null }, moved: null, mode: 'catalog', opener: null };
  const node = (tag, cls = '', text) => {
    const el = document.createElement(tag); if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text; return el;
  };
  const button = (text, fn, cls = '') => {
    const el = node('button', cls, text); el.type = 'button'; el.addEventListener('click', fn); return el;
  };
  let timer;
  function toast(text) {
    $('#toast').textContent = text; $('#toast').hidden = false;
    clearTimeout(timer); timer = setTimeout(() => { $('#toast').hidden = true; }, 4500);
  }
  const read = (key, fallback) => { try { const value = localStorage.getItem(key); return value === null ? fallback : JSON.parse(value); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  function warning(text) { $('#storage-warning').hidden = false; $('#storage-warning').textContent = text; }
  function validNote(n) {
    return n && typeof n.id === 'string' && n.id.length > 0 && n.id.length <= 100 &&
      typeof n.text === 'string' && n.text.trim().length > 0 && n.text.length <= 2000 &&
      typeof n.created === 'string' && Number.isFinite(Date.parse(n.created)) &&
      (n.quote === null || (n.quote && typeof n.quote.text === 'string' && n.quote.text.length <= 800 &&
        typeof n.quote.section === 'string' && n.quote.section.length <= 500));
  }
  function loadNotes() {
    try {
      state.raw = localStorage.getItem(noteKey);
      if (state.raw === null) return;
      const value = JSON.parse(state.raw);
      if (!Array.isArray(value) || value.length > 200 || !value.every(validNote) || new Set(value.map(n => n.id)).size !== value.length) throw new Error('Invalid notes');
      state.notes = value;
    } catch { state.safe = false; warning('已有批注无法读取，原存储不会被覆盖。新批注仅暂存本页，请及时导出。'); }
  }
  function persistNotes() {
    try {
      if (!state.safe || localStorage.getItem(noteKey) !== state.raw) throw new Error('Storage changed');
      const raw = JSON.stringify(state.notes); localStorage.setItem(noteKey, raw);
      state.raw = raw; state.unsaved = false; return true;
    } catch {
      state.safe = false; state.unsaved = true;
      warning('存储不可用或已被其他标签页修改。本次更改仅暂存本页，原数据未覆盖，请导出后刷新。'); return false;
    }
  }
  function restoreDrawer() {
    if (state.moved) { state.moved.placeholder.replaceWith(state.moved.element); state.moved = null; }
  }
  function closeDrawer(restoreFocus = true) {
    if ($('#drawer').open) $('#drawer').close(); restoreDrawer();
    if (restoreFocus && state.opener?.isConnected && state.opener.getClientRects().length) state.opener.focus({ preventScroll: true });
  }
  $('#drawer').addEventListener('close', () => { if (!$('#drawer').open) restoreDrawer(); });
  function showDialog(dialog) {
    closeDrawer(false); $$('dialog[open]').filter(d => d !== dialog).forEach(d => d.close());
    if (!dialog.open) dialog.showModal();
  }
  function info(label, children) { $('#info-heading').textContent = label; $('#info-body').replaceChildren(...children); showDialog($('#info-dialog')); }
  function openDrawer(kind) {
    document.body.classList.remove('focus-mode');
    const library = kind === 'library', el = library ? $('#library') : $('#right-rail');
    if (library ? innerWidth > 820 : innerWidth > 1100) {
      if (!library) el.scrollTop = kind === 'toc' ? 0 : $('#tools-card').offsetTop - 18;
      return;
    }
    closeDrawer(false); $$('dialog[open]').forEach(d => d.close()); state.opener = document.activeElement;
    const placeholder = document.createComment('reader-original-position'); el.before(placeholder);
    state.moved = { element: el, placeholder }; $('#drawer-body').append(el);
    $('#drawer').dataset.side = library ? 'left' : 'right';
    $('#drawer-title').textContent = library ? '专题与文章' : kind === 'toc' ? '本篇目录' : '提问 / 批注';
    $('#drawer').showModal();
    $('#drawer-body').scrollTop = library || kind === 'toc' ? 0 : Math.max(0, $('#tools-card').offsetTop - 60);
  }
  function setTab(kind, focus = false) {
    const notes = kind === 'note';
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
    e.preventDefault(); setTab(e.key === 'Home' ? 'question' : e.key === 'End' ? 'note' : $('#notes-panel').hidden ? 'note' : 'question', true);
  });
  function sectionElement(id) {
    const el = document.getElementById(id);
    return el && (content.contains(el) || el.id === 'article-title') ? el : null;
  }
  function goTo(id) {
    const el = sectionElement(id); if (!el) return;
    closeDrawer(false); el.scrollIntoView({ block: 'start', behavior: motion() });
    try { history.replaceState(null, '', '#' + encodeURIComponent(id)); } catch { /* Opaque preview origin. */ }
    el.tabIndex = -1; el.focus({ preventScroll: true });
  }
  function renderQuote(kind) {
    const el = $('#' + kind + '-quote'), quote = state.quotes[kind]; el.hidden = !quote;
    $('span', el).textContent = quote?.text || '';
  }
  function useQuote(kind) {
    if (!state.selected) { toast('先选中正文中的一段文字。'); return; }
    state.quotes[kind] = { ...state.selected }; renderQuote(kind); setTab(kind); openDrawer('tools');
    $('#' + kind + '-input').focus(); $('#selection-tools').hidden = true;
  }
  function captureSelection() {
    const selection = window.getSelection(); $('#selection-tools').hidden = true;
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!content.contains(range.commonAncestorContainer)) return;
    const text = selection.toString().trim(); if (!text) return;
    let section = 'article-title';
    for (const h of headings) {
      if (h.contains(range.startContainer) || (h.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING)) section = h.id;
      else break;
    }
    state.selected = { text: text.slice(0, 800), section };
    const r = range.getBoundingClientRect(), bar = $('#selection-tools'); bar.hidden = false;
    bar.style.left = Math.max(10, Math.min(innerWidth - 170, r.left + r.width / 2 - 80)) + 'px';
    bar.style.top = Math.max(62, Math.min(innerHeight - 54, r.top - 44)) + 'px';
  }
  content.addEventListener('pointerup', () => setTimeout(captureSelection, 0));
  document.addEventListener('keyup', e => { if (e.key === 'Shift' || (e.shiftKey && e.key.startsWith('Arrow'))) captureSelection(); });
  $('#selection-tools').addEventListener('pointerdown', e => e.preventDefault());
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#selection-tools,#article-body')) $('#selection-tools').hidden = true; });
  function dirty() {
    const original = state.notes.find(n => n.id === state.editing);
    return state.editing ? !original || $('#note-input').value !== original.text || JSON.stringify(state.quotes.note) !== JSON.stringify(original.quote)
      : Boolean($('#note-input').value.trim() || state.quotes.note);
  }
  function resetNote() {
    state.editing = null; $('#note-input').value = ''; state.quotes.note = null; renderQuote('note');
    $('#save-note').textContent = '保存批注'; $('#cancel-edit').hidden = true;
  }
  function renderNotes() {
    const list = $('#notes-list'); list.replaceChildren(); $('#notes-count').textContent = state.notes.length + ' 条批注';
    $('#export-notes').disabled = state.notes.length === 0;
    if (!state.notes.length) { list.append(node('p', 'notes-empty', '还没有批注，记下第一个想法吧。')); return; }
    state.notes.forEach(n => {
      const item = node('article', 'note-item'); const time = node('time', '', new Date(n.created).toLocaleString('zh-CN')); time.dateTime = n.created;
      item.append(time); if (n.quote) item.append(node('blockquote', '', n.quote.text)); item.append(node('p', '', n.text));
      const actions = node('div', 'note-actions');
      if (n.quote && sectionElement(n.quote.section)) {
        const link = node('a', '', '查看原文'); link.href = '#' + encodeURIComponent(n.quote.section);
        link.addEventListener('click', e => { e.preventDefault(); goTo(n.quote.section); }); actions.append(link);
      } else if (n.quote) actions.append(node('span', '', '原章节已调整，摘录仍保留'));
      actions.append(button('编辑', () => {
        if (dirty() && !confirm('放弃当前草稿并编辑这条批注？')) return;
        state.editing = n.id; $('#note-input').value = n.text; state.quotes.note = n.quote ? { ...n.quote } : null; renderQuote('note');
        $('#save-note').textContent = '保存修改'; $('#cancel-edit').hidden = false; $('#note-input').focus();
      }), button('删除', () => {
        if (!confirm('删除这条批注？此操作不能撤销。')) return;
        state.notes = state.notes.filter(v => v.id !== n.id); if (state.editing === n.id) resetNote();
        const saved = persistNotes(); renderNotes(); toast(saved ? '批注已删除。' : '仅在本页删除，请导出当前记录。');
      })); item.append(actions); list.append(item);
    });
  }
  $('#cancel-edit').addEventListener('click', () => { if (!dirty() || confirm('放弃未保存的修改？')) resetNote(); });
  $('#note-form').addEventListener('submit', e => {
    e.preventDefault(); const text = $('#note-input').value.trim();
    if (!text || text.length > 2000) { toast('请输入 1–2000 个字符。'); return; }
    if (!state.editing && state.notes.length >= 200) { toast('每篇最多 200 条批注，请先导出整理。'); return; }
    const old = state.notes.find(n => n.id === state.editing);
    const n = { id: old?.id || (globalThis.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2)),
      text, created: old?.created || new Date().toISOString(), quote: state.quotes.note ? { ...state.quotes.note } : null };
    state.notes = old ? state.notes.map(v => v.id === n.id ? n : v) : [n, ...state.notes];
    const saved = persistNotes(); resetNote(); renderNotes(); toast(saved ? '批注已保存在当前浏览器。' : '批注仅暂存本页，请导出后再离开。');
  });
  $('#question-form').addEventListener('submit', e => {
    e.preventDefault(); const input = $('#question-input'), text = input.value.trim();
    if (!text || text.length > 1000) { toast('请输入 1–1000 个字符。'); return; }
    if ($('#discussion-list').childElementCount >= 100) { toast('本页最多暂存 100 个问题。'); return; }
    const item = node('article', 'note-item'); item.append(node('small', '', '我的问题 · 仅本页'));
    if (state.quotes.question) item.append(node('blockquote', '', state.quotes.question.text));
    item.append(node('p', '', text), button('删除', () => { item.remove(); $('#questions-empty').hidden = Boolean($('#discussion-list').childElementCount); }));
    $('#discussion-list').prepend(item); $('#questions-empty').hidden = true; input.value = ''; state.quotes.question = null; renderQuote('question');
    toast('已暂存到本页，没有发送给服务器或 AI。');
  });
  $('#export-notes').addEventListener('click', () => {
    if (!state.notes.length) return;
    const body = '# ' + title + ' · 阅读批注\n\n' + state.notes.map(n => '## ' + new Date(n.created).toLocaleString('zh-CN') + '\n\n' +
      (n.quote ? '> ' + n.quote.text.replace(/\n/g, '\n> ') + '\n\n原章节：' + n.quote.section + '\n\n' : '') + n.text).join('\n\n---\n\n') + '\n';
    const url = URL.createObjectURL(new Blob([body], { type: 'text/markdown;charset=utf-8' }));
    const a = node('a'); a.href = url; a.download = articleId + '-notes.md'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
  let bookmarked = read(prefix + 'bookmark', false) === true;
  function renderBookmark() { $('#bookmark').setAttribute('aria-pressed', String(bookmarked)); $('#bookmark span').textContent = bookmarked ? '已收藏' : '收藏'; }
  $('#bookmark').addEventListener('click', () => {
    bookmarked = !bookmarked; const saved = write(prefix + 'bookmark', bookmarked); renderBookmark();
    toast(saved ? bookmarked ? '已收藏到当前浏览器。' : '已取消收藏。' : '存储不可用，收藏状态仅本页有效。');
  });
  const catalog = [...new Map($$('[data-catalog-link]').map(a => [a.dataset.id, {
    id: a.dataset.id, title: a.textContent.trim(), summary: a.dataset.summary || '', topic: a.dataset.topic, href: a.getAttribute('href'),
  }])).values()];
  const recentKey = 'zhiye:reader:recent:v1';
  const storedRecent = read(recentKey, []);
  const recent = [articleId, ...(Array.isArray(storedRecent) ? storedRecent : []).filter(id => typeof id === 'string' && id !== articleId)].slice(0, 50);
  write(recentKey, recent);
  function collection(kind) {
    const rows = kind === 'bookmarks' ? catalog.filter(c => c.id === articleId ? bookmarked : read(`zhiye:article:v1:${c.id}:bookmark`, false) === true)
      : recent.map(id => catalog.find(c => c.id === id)).filter(Boolean);
    const items = rows.map(c => { const a = node('a', 'search-result', c.title); a.href = c.href; return a; });
    info(kind === 'bookmarks' ? '我的收藏' : '最近阅读', [node('p', 'form-hint', '仅当前浏览器，隐藏已下线或不在本次目录中的文章。'),
      ...(items.length ? items : [node('p', 'dialog-empty', '暂时没有记录。')])]);
  }
  function setTheme(dark, persist = true) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'; $('#theme-toggle').setAttribute('aria-pressed', String(dark));
    $('#theme-toggle').setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
    if (persist && !write('zhiye:reader:theme', dark ? 'dark' : 'light')) toast('主题已切换，但无法保存偏好。');
  }
  $('#theme-toggle').addEventListener('click', () => setTheme(document.documentElement.dataset.theme !== 'dark'));
  const chapterRows = headings.length ? headings.map((heading, i) => {
    const range = document.createRange(); range.setStartBefore(heading);
    if (headings[i + 1]) range.setEndBefore(headings[i + 1]); else range.setEnd(content, content.childNodes.length);
    return { title: heading.textContent, text: range.toString(), id: heading.id };
  }) : [{ title, text: content.textContent, id: 'article-title' }];
  function renderSearch() {
    const q = $('#search-input').value.trim().toLocaleLowerCase(), results = $('#search-results'); results.replaceChildren(); let count = 0;
    if (state.mode === 'catalog') catalog.filter(c => (c.title + c.summary + c.topic).toLocaleLowerCase().includes(q)).slice(0, 30).forEach(c => {
      const a = node('a', 'search-result'); a.href = c.href; a.append(node('strong', '', c.title), node('small', '', c.topic)); results.append(a); count++;
    });
    if (state.mode === 'article' || q) chapterRows.filter(c => (c.title + c.text).toLocaleLowerCase().includes(q)).slice(0, 30 - count).forEach(c => {
      const at = Math.max(0, c.text.toLocaleLowerCase().indexOf(q) - 20);
      const el = button('', () => { $('#search-dialog').close(); goTo(c.id); }, 'search-result');
      el.append(node('strong', '', c.title), node('small', '', '本篇 · ' + c.text.slice(at, at + 100))); results.append(el); count++;
    });
    if (!count) results.append(node('p', 'dialog-empty', '没有找到相关内容，请更换关键词。'));
  }
  function openSearch(mode) {
    state.mode = mode; $('#search-input').value = ''; $('#search-input').placeholder = mode === 'article' ? '搜索本篇正文…' : '搜索已发布文章、专题…';
    $('#search-info').textContent = mode === 'article' ? '仅搜索本篇正文 · 方向键选择 · Enter 打开 · Esc 关闭' : '搜索已发布文章的标题、摘要、专题，以及本篇正文。';
    renderSearch(); showDialog($('#search-dialog')); $('#search-input').focus();
  }
  $('#search-input').addEventListener('input', renderSearch);
  $('#search-dialog').addEventListener('keydown', e => {
    const rows = $$('.search-result', $('#search-results')), at = rows.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && rows.length) { e.preventDefault(); rows[(at + 1) % rows.length].focus(); }
    else if (e.key === 'ArrowUp' && rows.length) { e.preventDefault(); at <= 0 ? $('#search-input').focus() : rows[at - 1].focus(); }
    else if (e.key === 'Enter' && document.activeElement === $('#search-input') && rows.length) { e.preventDefault(); rows[0].click(); }
  });
  async function copyLink() {
    try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(location.href); toast('文章链接已复制。'); }
    catch { const input = node('textarea'); input.value = location.href; input.readOnly = true; input.setAttribute('aria-label', '可复制的文章地址'); input.style.width = '100%'; info('复制文章链接', [node('p', 'form-hint', '请选择地址并使用系统复制快捷键。'), input]); input.focus(); input.select(); }
  }
  document.addEventListener('click', e => {
    const el = e.target.closest('button,a'); if (!el || !root.contains(el)) return;
    if (el.hasAttribute('data-close-dialog')) { const d = el.closest('dialog'); d === $('#drawer') ? closeDrawer() : d.close(); }
    if (el.dataset.drawer) openDrawer(el.dataset.drawer);
    if (el.dataset.search) openSearch(el.dataset.search);
    if (el.dataset.collection) collection(el.dataset.collection);
    if (el.dataset.selection) useQuote(el.dataset.selection);
    if (el.dataset.quote) useQuote(el.dataset.quote);
    if (el.dataset.clearQuote) { state.quotes[el.dataset.clearQuote] = null; renderQuote(el.dataset.clearQuote); }
    if (el.dataset.sectionId) { e.preventDefault(); goTo(el.dataset.sectionId); }
    if (el.hasAttribute('data-back-top')) window.scrollTo({ top: 0, behavior: motion() });
    if (el.hasAttribute('data-copy-link')) { $('.more').open = false; copyLink(); }
    if (el.hasAttribute('data-print')) { $('.more').open = false; window.print(); }
    if (el.hasAttribute('data-focus')) {
      closeDrawer(false); $('.more').open = false; document.body.classList.toggle('focus-mode');
      document.body.classList.contains('focus-mode') ? $('.exit-focus').focus() : $('#article-title').focus({ preventScroll: true });
    }
  });
  $$('dialog').forEach(d => d.addEventListener('click', e => {
    if (e.target !== d) return; const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d === $('#drawer') ? closeDrawer() : d.close();
  }));
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch('catalog'); }
    if (e.key === 'Escape') {
      $('#selection-tools').hidden = true; $('.more').open = false; const d = $$('dialog[open]').at(-1);
      if (d) { e.preventDefault(); d === $('#drawer') ? closeDrawer() : d.close(); }
    }
  });
  let ticking = false;
  function readingPosition() {
    const links = $$('.toc a'); let active = links[0];
    for (const link of links) { const h = sectionElement(link.dataset.sectionId); if (h && h.getBoundingClientRect().top <= 150) active = link; }
    links.forEach(a => { if (a === active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
    const r = content.getBoundingClientRect(), start = r.top + scrollY, end = r.bottom + scrollY - innerHeight;
    const value = end <= start ? (r.bottom <= innerHeight ? 100 : 0) : Math.round(Math.max(0, Math.min(100, (scrollY - start) / (end - start) * 100)));
    $('.progress-bar').style.width = value + '%'; $('.progress-track').setAttribute('aria-valuenow', String(value)); ticking = false;
  }
  addEventListener('scroll', () => { $('#selection-tools').hidden = true; if (!ticking) { ticking = true; requestAnimationFrame(readingPosition); } }, { passive: true });
  addEventListener('resize', () => {
    if (state.moved && (state.moved.element.id === 'library' ? innerWidth > 820 : innerWidth > 1100)) closeDrawer(false);
    readingPosition();
  });
  addEventListener('storage', e => {
    if (e.key === noteKey || e.key === null) { state.safe = false; warning('其他标签页更改了批注存储。为避免覆盖，请先导出本页记录再刷新。'); }
  });
  addEventListener('beforeunload', e => { if (dirty() || $('#question-input').value.trim() || state.quotes.question || state.unsaved) { e.preventDefault(); e.returnValue = ''; } });
  loadNotes(); renderNotes(); renderBookmark(); setTheme(read('zhiye:reader:theme', 'light') === 'dark', false); readingPosition();
})();
