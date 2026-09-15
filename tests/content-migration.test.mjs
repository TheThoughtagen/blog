import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

test('legacy structured sample content and its Markdown adapter stay removed', async () => {
  const legacyPaths = [
    new URL('../content/articles.mjs', import.meta.url),
    new URL('../scripts/markdown.mjs', import.meta.url),
  ].map(fileURLToPath);

  const remaining = [];
  for (const path of legacyPaths) {
    if (await exists(path)) remaining.push(path.slice(repositoryRoot.length));
  }

  assert.deepEqual(remaining, []);
});
