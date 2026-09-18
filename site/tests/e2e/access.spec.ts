import { test, expect } from '@playwright/test';
test('real Worker redirects protected navigation without revealing article text', async ({ page }) => {
  await page.goto('/articles/welcome/');
  await expect(page).toHaveURL(/\/access\//);
  await expect(page.getByRole('heading', { name: '关注验证接入中' })).toBeVisible();
  await expect(page.getByRole('button', { name: '暂未开放访问' })).toBeDisabled();
  await expect(page.locator('body')).not.toContainText('先写清楚一个问题');
});
for (const path of ['/index.html', '/topics/index.html', '/articles/welcome/index.html', '/search-index.json', '/public/reader.js']) {
  test(`direct asset cannot bypass auth: ${path}`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(503); // Provider deliberately disabled in foundation config.
    expect(response.headers()['cache-control']).toContain('no-store');
    expect(await response.text()).not.toContain('先写清楚一个问题');
  });
}
test('mobile access page fits viewport and public CSS is available', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/access/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
