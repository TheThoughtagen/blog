import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { devNull, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { bundleLicenseText } from '../scripts/bundle-licenses.mjs';
import info from '../content/cortex-scene.json' with { type: 'json' };

async function fixture(t) {
  const folder = await mkdtemp(join(tmpdir(), 'scene-import-test-'));
  t.after(() => rm(folder, { recursive: true, force: true }));
  return folder;
}

test('bundle license collection preserves license text and short upstream notices', async t => {
  const folder = await fixture(t);
  const license = await readFile(new URL('../scripts/licenses/react-three-fiber-9.7.0/LICENSE', import.meta.url), 'utf8');
  await writeFile(join(folder, 'LICENSE'), license);
  await writeFile(join(folder, 'NOTICE'), 'Additional upstream attribution.');
  const text = await bundleLicenseText({ name: 'fixture', version: '1.0.0', folder });
  assert.ok(text.includes(license));
  assert.ok(text.includes('Additional upstream attribution.'));
});

test('a known package missing its published license uses the pinned upstream text', async t => {
  const folder = await fixture(t);
  const text = await bundleLicenseText({ name: '@react-three/fiber', version: '9.7.0', folder });
  assert.match(text, /Permission is hereby granted/);
  assert.match(text, /v9\.7\.0\/LICENSE/);
});

test('license collection rejects missing or SPDX-only license files', async t => {
  const folder = await fixture(t);
  await assert.rejects(bundleLicenseText({ name: 'unknown-package', version: '1.0.0', folder }), /Missing full license text/);
  await writeFile(join(folder, 'LICENSE'), 'MIT');
  await assert.rejects(bundleLicenseText({ name: 'unknown-package', version: '1.0.0', folder }), /Incomplete license text/);
});

test('every bundled scene dependency has full applicable license text', async () => {
  const text = await readFile(new URL('../public/assets/plant3d/LICENSES.txt', import.meta.url), 'utf8');
  const blocks = text.split(/\n(?=[@\w][^\n]*@[^\s]+ \()/);
  assert.ok(info.libraries.every(name => !name.endsWith('@undefined')));
  for (const library of info.libraries) {
    const block = blocks.find(part => part.startsWith(library + ' ('));
    assert.ok(block, library);
    if (block.startsWith(library + ' (MIT)')) assert.match(block, /Permission is hereby granted/i, library);
    else if (block.startsWith(library + ' (ISC)')) assert.match(block, /Permission to use, copy/i, library);
    else assert.fail(`Add a license assertion for ${library}`);
  }
});

for (const kind of ['tracked', 'untracked']) {
  test(`scene import rejects ${kind} source edits before loading dependencies or writing artifacts`, async t => {
    const folder = await fixture(t), web = join(folder, 'web');
    await mkdir(web);
    await writeFile(join(web, 'source.ts'), 'export const fixture = true;');
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
    Object.assign(env, { GIT_CONFIG_GLOBAL: devNull, GIT_CONFIG_NOSYSTEM: '1' });
    const git = args => execFileSync('git', ['-c', 'core.hooksPath=', '-C', folder, ...args], { stdio: 'pipe', env });
    git(['init', '-q']); git(['add', 'web']);
    git(['-c', 'commit.gpgsign=false', '-c', 'user.name=Review fixture', '-c', 'user.email=review@example.invalid', 'commit', '-qm', 'fixture']);
    if (kind === 'untracked') git(['config', 'status.showUntrackedFiles', 'no']);
    await writeFile(join(web, kind === 'tracked' ? 'source.ts' : 'new-source.ts'), 'export const changed = true;');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/import-cortex-scene.mjs', import.meta.url)), web], { encoding: 'utf8', env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Commit or stash Cortex web changes/);
  });
}
