import { expect, test } from '@playwright/test';

test('mobile bottom navigation and dialog reflow without covering content', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'CONTROL PANEL' })).toBeVisible();
  const metrics = await page.evaluate(() => {
    const nav = document.querySelector('.sidebar-v2')?.getBoundingClientRect();
    const main = document.querySelector('main')?.getBoundingClientRect();
    const fab = document.querySelector('.fab')?.getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      navHeight: nav?.height ?? 0,
      navTop: nav?.top ?? 0,
      mainTop: main?.top ?? 0,
      fabBottom: fab?.bottom ?? 0,
    };
  });
  expect(metrics.overflow).toBe(false);
  expect(metrics.navHeight).toBeLessThan(90);
  expect(metrics.navTop).toBeGreaterThan(500);
  expect(metrics.mainTop).toBe(0);
  expect(metrics.fabBottom).toBeLessThan(metrics.navTop);

  for (const label of ['Transactions', 'Budgets', 'Savings', 'Reports', 'Comparison', 'Categories', 'Settings', 'Dashboard']) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page.locator('main h1')).toBeVisible();
  }

  await page.getByRole('button', { name: 'Add transaction' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'NEW TRANSACTION' });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(393);
  expect(box?.height).toBeLessThanOrEqual(851);
});
