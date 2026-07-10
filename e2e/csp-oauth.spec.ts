import { expect, test } from '@playwright/test';

test('production CSP blocks unknown scripts while allowing mocked Google Identity and Gmail', async ({ page }) => {
  const gmailRequests: string[] = [];
  await page.route('https://accounts.google.com/gsi/client', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.google={accounts:{oauth2:{initTokenClient:(config)=>({requestAccessToken:()=>config.callback({access_token:'e2e-token',expires_in:3600})})}}};`,
  }));
  await page.route('https://gmail.googleapis.com/**', route => {
    gmailRequests.push(route.request().headers().authorization ?? '');
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ messages: [] }) });
  });
  await page.goto('./?page=settings');
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toMatch(/script-src[^;]*unsafe-(?:inline|eval)/);

  await page.getByLabel('GOOGLE CLIENT ID').fill('e2e.apps.googleusercontent.com');
  await page.getByRole('button', { name: 'AUTHORIZE_GMAIL' }).click();
  await expect(page.getByText(/gmail connected successfully/i)).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('spendwise-gmail-token'))).toContain('e2e-token');
  await page.getByRole('button', { name: /run manual sync/i }).click();
  await expect(page.getByText(/sync completed/i)).toBeVisible();
  expect(gmailRequests).toContain('Bearer e2e-token');
  await page.getByRole('button', { name: /terminate session/i }).click();
  expect(await page.evaluate(() => sessionStorage.getItem('spendwise-gmail-token'))).toBeNull();

  const blocked = await page.evaluate(() => new Promise<boolean>(resolve => {
    const timer = window.setTimeout(() => resolve(false), 2_000);
    window.addEventListener('securitypolicyviolation', event => {
      if (event.blockedURI.includes('evil.invalid')) {
        window.clearTimeout(timer);
        resolve(true);
      }
    }, { once: true });
    const script = document.createElement('script');
    script.src = 'https://evil.invalid/injected.js';
    document.head.appendChild(script);
  }));
  expect(blocked).toBe(true);
});
