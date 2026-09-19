import { test, expect } from '@playwright/test';
const code = 'ZY-' + Array(8).fill('AAAA').join('-');
test('real D1-backed invitation login, return path, logout and reuse', async ({ page }) => {
  await page.goto('/articles/welcome/');
  await expect(page).toHaveURL(/\/access\//);
  await expect(page.getByRole('button', { name: '登录并阅读' })).toBeEnabled();
  await page.getByLabel('邀请码', { exact: true }).fill('wrong-code');
  await page.getByRole('button', { name: '登录并阅读' }).click();
  await expect(page.getByRole('alert')).toHaveText('邀请码无效或已停用，请检查后重试。');
  await page.getByLabel('邀请码', { exact: true }).fill(code);
  await page.getByRole('button', { name: '登录并阅读' }).click();
  await expect(page).toHaveURL(/\/articles\/welcome\/$/);
  await expect(page.locator('body')).toContainText('先写清楚一个问题');
  await page.getByRole('button', { name: '退出' }).click();
  await expect(page).toHaveURL(/\/access\/$/);
  const protectedIndex = await page.request.get('/search-index.json', { headers: { Accept: 'application/json' } });
  expect(protectedIndex.status()).toBe(401);
  expect(await protectedIndex.json()).toEqual({ error: 'unauthenticated' });
  await page.goto('/access/');
  await page.getByLabel('邀请码', { exact: true }).fill(code);
  await page.getByLabel('邀请码', { exact: true }).press('Enter');
  await expect(page).toHaveURL('http://127.0.0.1:8788/');
});
for (const width of [320, 768, 1024, 1440]) {
  test(`login is usable without horizontal overflow at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/access/');
    await expect(page.getByRole('button', { name: '登录并阅读' })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByLabel('邀请码', { exact: true })).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: '显示邀请码' }).click();
    await expect(page.getByLabel('邀请码', { exact: true })).toHaveAttribute('type', 'text');
    await page.screenshot({ path: testInfo.outputPath(`invite-${width}.png`), fullPage: true });
  });
}
