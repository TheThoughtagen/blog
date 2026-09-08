import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectFiles, deploy } from '../scripts/deploy.mjs';
const endpoint = 'https://here.now/api/v1/publish/awake-iris-z6ww';
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'blog-deploy-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'index.html'), '<h1>Hello</h1>');
  return directory;
}
function server(failUpload = false) {
  const calls = [];
  return { calls, fetcher: async (url, options) => {
    calls.push({ url, ...options });
    if (options.method === 'GET') return Response.json({ currentVersionId: 'previous' });
    if (url === endpoint) return Response.json({ upload: { versionId: 'next', finalizeUrl: `${endpoint}/finalize`, uploads: [{ path: 'index.html', method: 'PUT', url: 'https://example.r2.cloudflarestorage.com/file?signed=test' }] } });
    if (url.endsWith('/finalize')) return Response.json({ success: true, siteUrl: 'https://awake-iris-z6ww.here.now/', currentVersionId: 'next' });
    return new Response(null, { status: failUpload ? 500 : 200 });
  } };
}
test('deployment sends hashes and base version, uploads without API key, then finalizes', async t => {
  const directory = await fixture(t);
  const mock = server();
  const result = await deploy({ directory, key: 'test-only-key', fetcher: mock.fetcher });
  assert.equal(result.versionId, 'next');
  const manifest = JSON.parse(mock.calls[1].body);
  assert.equal(manifest.baseVersionId, 'previous');
  assert.match(manifest.files[0].hash, /^[a-f0-9]{64}$/);
  assert.equal(manifest.files[0].size, 14);
  assert.equal(manifest.files[0].bytes, undefined);
  assert.equal(mock.calls[2].headers.Authorization, undefined);
  assert.equal(mock.calls[2].headers['Content-Type'], 'text/html; charset=utf-8');
  assert.equal(mock.calls[3].url, `${endpoint}/finalize`);
});
test('failed file upload never finalizes the site', async t => {
  const mock = server(true);
  await assert.rejects(deploy({ directory: await fixture(t), key: 'test', fetcher: mock.fetcher }), /Upload failed/);
  assert.equal(mock.calls.length, 3);
});
test('missing credentials and version conflicts stop publishing', async t => {
  const directory = await fixture(t);
  let calls = 0;
  await assert.rejects(deploy({ directory, key: '', fetcher: () => { calls++; } }), /HERENOW_API_KEY/);
  assert.equal(calls, 0);
  await assert.rejects(deploy({ directory, key: 'test', fetcher: async () => {
    calls++;
    return calls === 1 ? Response.json({ currentVersionId: 'base' }) : new Response(null, { status: 409 });
  } }), /live version changed/);
  assert.equal(calls, 2);
});
test('hidden files and symlinks cannot enter the deployment manifest', async t => {
  const directory = await fixture(t);
  await writeFile(join(directory, '.env'), 'TEST_ONLY=value');
  await assert.rejects(collectFiles(directory), /hidden file/);
  await rm(join(directory, '.env'));
  await symlink(join(directory, 'index.html'), join(directory, 'linked.html'));
  await assert.rejects(collectFiles(directory), /symlink/);
});
