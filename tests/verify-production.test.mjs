import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyProduction } from '../scripts/verify-production.mjs';

const revision = 'a'.repeat(40);
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'production-check-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const pages = `<html><head><meta name="deployment-revision" content="${revision}"></head><body>Current release</body></html>`;
  const files = new Map([['/', pages], ['/work/', pages], ['/assets/styles.css', 'body { color: green; }'], ['/assets/app.js', 'export const app = true;'], ['/assets/cortex-graph.js', 'export const graph = true;'], ['/assets/plant3d/app.js', 'export const scene = true;'], ['/assets/plant3d/vendor.js', 'export const vendor = true;']]);
  for (const [path, bytes] of files) {
    const file = join(directory, path === '/' ? 'index.html' : path === '/work/' ? 'work/index.html' : path.slice(1));
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, bytes);
  }
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    const path = new URL(url).pathname;
    return new Response(files.get(path), { headers: { 'Content-Type': path.endsWith('/') ? 'text/html' : path.endsWith('.css') ? 'text/css' : 'application/javascript' } });
  };
  return { directory, revision, files, requests, fetchImpl, attempts: 1, delayMs: 0 };
}

test('production verification accepts the release on the custom domain despite unrelated HTML transformations', async t => {
  const options = await fixture(t);
  options.files.set('/work/', options.files.get('/work/').replace('</body>', '<script src="/cdn-cgi/email.js"></script></body>'));
  const result = await verifyProduction(options);
  assert.deepEqual(result, { origin: 'https://patrickmannion.dev', revision, checks: 7 });
  assert.ok(options.requests.every(({ url, options }) => new URL(url).origin === 'https://patrickmannion.dev' && !new URL(url).search && options.redirect === 'error'));
});

for (const path of ['/', '/work/']) {
  test(`production verification rejects a stale revision at ${path}`, async t => {
    const options = await fixture(t);
    options.files.set(path, options.files.get(path).replace(revision, 'b'.repeat(40)));
    await assert.rejects(verifyProduction(options), error => error.message.includes(`${path}: Expected revision ${revision}`));
  });
}

test('production verification rejects stale 3D assets even when the pages are current', async t => {
  const options = await fixture(t);
  options.files.set('/assets/plant3d/vendor.js', 'export const previousRelease = true;');
  await assert.rejects(verifyProduction(options), /\/assets\/plant3d\/vendor\.js: Content differs/);
});

test('production verification waits for propagation and rechecks pages and assets', async t => {
  const options = await fixture(t);
  const current = options.files.get('/work/');
  options.files.set('/work/', 'Previous release');
  let retries = 0;
  const result = await verifyProduction({ ...options, attempts: 2, onRetry: () => { retries++; options.files.set('/work/', current); } });
  assert.equal(retries, 1);
  assert.equal(result.checks, 7);
  assert.equal(options.requests.length, 14);
});

for (const [label, response, message] of [
  ['missing page', () => new Response('Missing', { status: 404 }), /HTTP 404/],
  ['redirected domain', () => new Response(null, { status: 302, headers: { Location: 'https://preview.pages.dev/' } }), /HTTP 302/],
  ['HTML served as JavaScript', () => new Response('<html>Error</html>', { headers: { 'Content-Type': 'text/html' } }), /Unexpected content type/],
  ['network failure', () => { throw new Error('Connection failed'); }, /Connection failed/],
]) {
  test(`production verification fails for a ${label}`, async t => {
    const options = await fixture(t);
    await assert.rejects(verifyProduction({ ...options, fetchImpl: response }), message);
  });
}

test('production verification refuses an unstamped build or invalid revision before contacting production', async t => {
  const options = await fixture(t);
  await assert.rejects(verifyProduction({ ...options, revision: 'main' }), /full Git commit SHA/);
  await writeFile(join(options.directory, 'index.html'), 'Unstamped local build');
  await assert.rejects(verifyProduction(options), /Build index.html with DEPLOY_REVISION/);
  assert.equal(options.requests.length, 0);
});
