// Public UI only. The Worker verifies every credential, session and protected request.
const form = document.querySelector('#invite-form');
const code = document.querySelector('#invite-code');
const submit = document.querySelector('#invite-submit');
const status = document.querySelector('#access-status');
const error = document.querySelector('#invite-error');
const retry = document.querySelector('#auth-retry');
const reveal = document.querySelector('#invite-reveal');
async function connect() {
  retry.hidden = true;
  status.textContent = '正在连接登录服务…';
  try {
    const response = await fetch('/api/auth/providers', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('unavailable');
    const state = await response.json();
    const ready = state.loginAvailable && state.providers.some(provider => provider.id === 'invite');
    code.disabled = submit.disabled = !ready;
    status.textContent = ready ? '欢迎回来，输入邀请码即可开始阅读。' : '登录暂未开放，请稍后再来。';
    retry.hidden = ready;
  } catch {
    code.disabled = submit.disabled = true;
    status.textContent = '暂时无法连接登录服务，请稍后重试。';
    retry.hidden = false;
  }
}
retry.addEventListener('click', connect);
reveal.addEventListener('click', () => {
  const visible = code.type === 'password';
  code.type = visible ? 'text' : 'password';
  reveal.textContent = visible ? '隐藏' : '显示';
  reveal.setAttribute('aria-label', visible ? '隐藏邀请码' : '显示邀请码');
  reveal.setAttribute('aria-pressed', String(visible));
});
code.addEventListener('input', () => { error.textContent = ''; code.removeAttribute('aria-invalid'); });
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (submit.disabled) return;
  error.textContent = '';
  submit.disabled = true;
  submit.textContent = '正在登录…';
  form.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/api/auth/invite/login', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.value, next: new URLSearchParams(location.search).get('next') }),
      signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (!response.ok) {
      error.textContent = result.message || '登录服务暂时不可用，请稍后重试。';
      if (response.status === 401) { code.setAttribute('aria-invalid', 'true'); code.focus(); }
      return;
    }
    code.value = '';
    const destination = new URL(result.redirect, location.origin);
    location.assign(destination.origin === location.origin ? destination.href : '/');
  } catch { error.textContent = '网络连接中断，请检查网络后重新登录。'; }
  finally {
    submit.disabled = false;
    submit.textContent = '登录并阅读 →';
    form.removeAttribute('aria-busy');
  }
});
connect();
