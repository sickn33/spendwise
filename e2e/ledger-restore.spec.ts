import { expect, test } from '@playwright/test';

test('creates, persists, backs up, clears, and atomically restores a transaction', async ({ page }, testInfo) => {
  const description = `E2E restore ${Date.now()}`;
  await page.goto('./');
  await page.locator('button.fab').click();
  await page.getByRole('textbox', { name: 'Amount' }).fill('12.34');
  await page.getByRole('textbox', { name: 'Description' }).fill(description);
  await page.getByRole('button', { name: 'SAVE' }).click();
  await expect(page.getByText(description)).toBeVisible();
  await page.reload();
  await expect(page.getByText(description)).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /system backup json/i }).click();
  const download = await downloadPromise;
  const backupPath = testInfo.outputPath('spendwise-backup.json');
  await download.saveAs(backupPath);

  await page.getByRole('button', { name: /clear all transactions/i }).click();
  await page.getByRole('button', { name: /confirm destruction/i }).click();
  await expect(page.getByText(/all transactions have been removed/i)).toBeVisible();

  await page.getByLabel('Restore backup JSON file').setInputFiles(backupPath);
  await expect(page.getByRole('dialog', { name: 'Replace all SpendWise data?' })).toBeVisible();
  await page.getByRole('button', { name: 'Restore backup', exact: true }).click();
  await expect(page.getByText(/backup restored/i)).toBeVisible();
  await page.getByRole('link', { name: 'Transactions' }).click();
  await expect(page.getByText(description)).toBeVisible();
});

test('rejects a corrupted restore without changing existing data', async ({ page }, testInfo) => {
  await page.goto('./?page=settings');
  const invalidPath = testInfo.outputPath('invalid-backup.json');
  await import('node:fs/promises').then(fs => fs.writeFile(invalidPath, '{broken'));
  await page.getByLabel('Restore backup JSON file').setInputFiles(invalidPath);
  await expect(page.getByText(/backup is not valid json/i)).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Replace all SpendWise data?' })).toHaveCount(0);
});
