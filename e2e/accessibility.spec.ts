import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const destinations = ['Dashboard', 'Transactions', 'Budgets', 'Savings', 'Reports', 'Comparison', 'Categories', 'Settings'];

test('all primary pages and the transaction dialog have no WCAG A/AA violations', async ({ page }, testInfo) => {
  await page.goto('./');
  for (const destination of destinations) {
    if (destination !== 'Dashboard') await page.getByRole('link', { name: destination, exact: true }).click();
    await expect(page.locator('main h1')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    await testInfo.attach(`axe-${destination}`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
    expect(results.violations, `${destination}: ${results.violations.map(item => item.id).join(', ')}`).toEqual([]);
  }

  await page.getByRole('link', { name: 'Dashboard' }).click();
  await page.getByRole('button', { name: 'Add transaction' }).first().click();
  const dialogResults = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(dialogResults.violations).toEqual([]);
});
