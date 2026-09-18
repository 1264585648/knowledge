// Despite its source directory, this file is NOT on the public Worker allowlist.
const dialog = document.querySelector('#search-dialog');
const input = document.querySelector('#search-input');
const results = document.querySelector('#search-results');
const status = document.querySelector('#search-status');
let entries = null;
let loading = false;
let opener = null;
function render() {
  results.replaceChildren();
  const query = input.value.trim().toLocaleLowerCase();
  const matches = (entries || []).filter(item => `${item.title} ${item.summary}`.toLocaleLowerCase().includes(query));
  status.textContent = `${matches.length} 篇匹配文章`;
  matches.forEach(item => {
    const li = document.createElement('li');
    const link = document.createElement('a');
    // Only generated same-origin article paths are accepted.
    if (!/^\/articles\/[a-z0-9-]+\/$/.test(item.url)) return;
    link.href = item.url;
    const title = document.createElement('strong'); title.textContent = item.title;
    const summary = document.createElement('span'); summary.textContent = item.summary;
    link.append(title, summary); li.append(link); results.append(li);
  });
}
async function openSearch(button) {
  opener = button;
  if (!dialog.open) dialog.showModal();
  input.focus();
  if (entries) { render(); return; }
  if (loading) return;
  loading = true; status.textContent = '正在读取搜索目录…';
  try {
    const response = await fetch('/search-index.json', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) { status.textContent = '访问权限已失效或服务暂时不可用，请重新验证。'; return; }
    entries = await response.json(); render();
  } catch { status.textContent = '搜索暂时不可用，请稍后重试。'; }
  finally { loading = false; }
}
document.querySelectorAll('[data-search-open]').forEach(button => button.addEventListener('click', () => openSearch(button)));
input.addEventListener('input', () => { if (entries) render(); });
dialog.addEventListener('close', () => { entries = null; results.replaceChildren(); opener?.focus(); });
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault(); openSearch(document.activeElement);
  }
});
// Do not retain search data in a browser-back cache after leaving this page.
window.addEventListener('pagehide', () => { entries = null; results.replaceChildren(); });
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
