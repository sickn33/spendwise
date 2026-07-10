import { expect, test } from '@playwright/test';

test('PWA manifest, icons, base paths, service worker, and offline shell are valid', async ({ page, request, context }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'CONTROL PANEL' })).toBeVisible();
  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBe('/spendwise/manifest.webmanifest');
  const manifestResponse = await request.get(manifestHref!);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({ scope: '/spendwise/', start_url: '/spendwise/' });
  for (const icon of manifest.icons) {
    const iconResponse = await request.get(`/spendwise/${icon.src}`);
    expect(iconResponse.ok()).toBe(true);
    const dimensions = await page.evaluate(src => new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error(`Unable to decode ${src}`));
      image.src = src;
    }), `/spendwise/${icon.src}`);
    const expectedSize = Number.parseInt(icon.sizes, 10);
    expect(dimensions).toEqual({ width: expectedSize, height: expectedSize });
  }
  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    return { scope: ready.scope, script: ready.active?.scriptURL };
  });
  expect(registration.scope).toContain('/spendwise/');
  expect(registration.script).toContain('/spendwise/sw.js');

  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'CONTROL PANEL' })).toBeVisible();
  } finally {
    await context.setOffline(false);
  }
});
