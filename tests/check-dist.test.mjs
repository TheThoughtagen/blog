import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectFiles, verifyDist } from '../scripts/check-dist.mjs';
async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'blog-deploy-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, 'index.html'), '<h1>Hello</h1>');
  return directory;
}
test('the deploy check requires a built index.html and reports the file count', async t => {
  const directory = await fixture(t);
  assert.deepEqual(await verifyDist(directory), { files: 1 });
  await rm(join(directory, 'index.html'));
  await writeFile(join(directory, 'other.html'), '<p>no index</p>');
  await assert.rejects(verifyDist(directory), /dist\/index\.html/);
});
test('hidden files and symlinks cannot enter the deployment manifest', async t => {
  const directory = await fixture(t);
  await writeFile(join(directory, '.env'), 'TEST_ONLY=value');
  await assert.rejects(collectFiles(directory), /hidden file/);
  await rm(join(directory, '.env'));
  await symlink(join(directory, 'index.html'), join(directory, 'linked.html'));
  await assert.rejects(collectFiles(directory), /symlink/);
});

test('deployment manifest accepts built webfonts with their browser MIME types', async t => {
  const directory = await fixture(t);
  const fonts = join(directory, 'assets', 'fonts');
  await mkdir(fonts, { recursive: true });
  await Promise.all([
    writeFile(join(fonts, 'KaTeX_Main-Regular.ttf'), 'ttf'),
    writeFile(join(fonts, 'KaTeX_Main-Regular.woff'), 'woff'),
    writeFile(join(fonts, 'KaTeX_Main-Regular.woff2'), 'woff2'),
  ]);

  const files = await collectFiles(directory);
  assert.deepEqual(
    files
      .filter(file => file.path.startsWith('assets/fonts/'))
      .map(({ path, contentType }) => ({ path, contentType })),
    [
      { path: 'assets/fonts/KaTeX_Main-Regular.ttf', contentType: 'font/ttf' },
      { path: 'assets/fonts/KaTeX_Main-Regular.woff', contentType: 'font/woff' },
      { path: 'assets/fonts/KaTeX_Main-Regular.woff2', contentType: 'font/woff2' },
    ],
  );
});

test('deployment manifest accepts downloadable vCards', async t => {
  const directory = await fixture(t);
  await writeFile(join(directory, 'patrick-mannion.vcf'), 'BEGIN:VCARD\nVERSION:4.0\nFN:Patrick Mannion\nEND:VCARD\n');

  const files = await collectFiles(directory);
  assert.equal(files.find(file => file.path === 'patrick-mannion.vcf')?.contentType, 'text/vcard; charset=utf-8');
});

test('deployment manifest accepts web app manifests', async t => {
  const directory = await fixture(t);
  await writeFile(join(directory, 'card.webmanifest'), JSON.stringify({ name: 'Contact card', start_url: '/card/' }));

  const files = await collectFiles(directory);
  assert.equal(files.find(file => file.path === 'card.webmanifest')?.contentType, 'application/manifest+json');
});

test('deployment manifest accepts PNG images', async t => {
  const directory = await fixture(t);
  await writeFile(join(directory, 'headshot.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  const files = await collectFiles(directory);
  assert.equal(files.find(file => file.path === 'headshot.png')?.contentType, 'image/png');
});

test('deployment manifest continues to reject unsupported asset types', async t => {
  const directory = await fixture(t);
  await writeFile(join(directory, 'payload.exe'), 'not-public');
  await assert.rejects(collectFiles(directory), /Unsupported public asset: payload\.exe/);
});
