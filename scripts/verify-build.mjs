import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distDir = resolve('dist');
const basePath = '/spendwise/';

async function assertFile(relativePath, source) {
  const cleanPath = decodeURIComponent(relativePath)
    .replace(/^https?:\/\/[^/]+/u, '')
    .replace(basePath, '')
    .replace(/^\//u, '')
    .split(/[?#]/u, 1)[0];

  if (!cleanPath || cleanPath.startsWith('data:')) return;

  try {
    await access(resolve(distDir, cleanPath));
  } catch {
    throw new Error(`${source} references missing build asset: ${relativePath}`);
  }
}

const html = await readFile(resolve(distDir, 'index.html'), 'utf8');
const cspMatch = html.match(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"/u);
if (!cspMatch) throw new Error('index.html is missing the production Content Security Policy');
const csp = cspMatch[1]
  .replaceAll('&#39;', "'")
  .replaceAll('&quot;', '"')
  .replaceAll('&amp;', '&');
for (const directive of ["default-src 'self'", "object-src 'none'", "script-src-attr 'none'", 'https://gmail.googleapis.com']) {
  if (!csp.includes(directive)) throw new Error(`Content Security Policy is missing: ${directive}`);
}
if (/script-src[^;]*(?:'unsafe-inline'|'unsafe-eval')/u.test(csp)) {
  throw new Error('Content Security Policy weakens script-src with an unsafe source');
}
if (html.indexOf('http-equiv="Content-Security-Policy"') > html.indexOf('<script')) {
  throw new Error('Content Security Policy must precede every script');
}
const htmlAssets = [...html.matchAll(/(?:href|src)="([^"]+)"/gu)].map(match => match[1]);
for (const asset of htmlAssets) {
  if (asset.startsWith('http:') || asset.startsWith('https:') || asset.startsWith('#')) continue;
  await assertFile(asset, 'index.html');
}

const manifest = JSON.parse(await readFile(resolve(distDir, 'manifest.webmanifest'), 'utf8'));
for (const icon of manifest.icons ?? []) {
  await assertFile(icon.src, 'manifest.webmanifest');
}

console.log(`Verified ${htmlAssets.length} HTML assets and ${manifest.icons?.length ?? 0} manifest icons.`);
