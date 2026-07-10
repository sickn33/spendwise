import { expect, test } from '@playwright/test';

const pages = [
  ['Dashboard', 'CONTROL PANEL', ''],
  ['Transactions', 'TRANSACTIONS LOG', '?page=transactions'],
  ['Budgets', 'BUDGET MANAGER', '?page=budgets'],
  ['Savings', 'SAVINGS GOALS', '?page=savings'],
  ['Reports', 'MONTHLY REPORT', '?page=reports'],
  ['Comparison', 'Monthly Comparison', '?page=comparison'],
  ['Categories', 'CATEGORY MANAGEMENT', '?page=categories'],
  ['Settings', 'SYSTEM SETTINGS', '?page=settings'],
] as const;

test('loads, exposes URL-addressable navigation, and follows browser history', async ({ page }) => {
  const runtimeErrors: string[] = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'CONTROL PANEL' })).toBeVisible();

  for (const [label, heading, query] of pages.slice(1)) {
    await page.getByRole('link', { name: label, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${query.replace('?', '\\?')}$`));
    await expect(page.getByRole('link', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
  }

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'CATEGORY MANAGEMENT' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'CATEGORY MANAGEMENT' })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test('deep links, theme persistence, and transaction dialog keyboard behavior work', async ({ page }) => {
  await page.goto('./?page=settings');
  await expect(page.getByRole('heading', { name: 'SYSTEM SETTINGS' })).toBeVisible();
  await page.getByRole('link', { name: 'Dashboard' }).click();

  const theme = page.getByRole('button', { name: /dark mode/i });
  await theme.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  const trigger = page.locator('button.fab');
  await trigger.focus();
  await page.keyboard.press('n');
  const dialog = page.getByRole('dialog', { name: 'NEW TRANSACTION' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Amount' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
