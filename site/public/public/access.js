// This public script contains no article data and cannot grant access.
fetch('/api/auth/status', { credentials: 'same-origin', cache: 'no-store' })
  .then(response => response.ok ? response.json() : Promise.reject())
  .then(state => { if (typeof state.message === 'string') document.querySelector('#access-status').textContent = state.message; })
  .catch(() => { document.querySelector('#access-status').textContent = '暂时无法读取服务状态。当前不会开放受限内容。'; });
