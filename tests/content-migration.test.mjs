import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { loadPosts } from '../scripts/posts.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const contentDir = fileURLToPath(new URL('../content/posts/', import.meta.url));
const schemaPath = fileURLToPath(new URL('../frontmatter.schema.json', import.meta.url));
const retiredSamples = [
  ['the-factory-floor-is-not-a-staging-environment', 'The factory floor is not a staging environment'],
  ['boring-software-is-a-feature', 'Boring software is a feature'],
  ['your-best-engineer-should-not-be-a-single-point-of-failure', 'Your best engineer should not be a single point of failure'],
  ['an-ai-demo-is-not-a-production-system', 'An AI demo is not a production system'],
  ['the-last-mile-between-ot-and-it', 'The last mile between OT and IT'],
];

async function exists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

test('ships no sample posts from the retired demonstration set or legacy structured content', async () => {
  const legacyPaths = [
    new URL('../content/articles.mjs', import.meta.url),
    new URL('../scripts/markdown.mjs', import.meta.url),
  ].map(fileURLToPath);

  const remaining = [];
  for (const path of legacyPaths) {
    if (await exists(path)) remaining.push(path.slice(repositoryRoot.length));
  }

  assert.deepEqual(remaining, []);
  const posts = await loadPosts({ contentDir, schemaPath });
  const retiredSlugs = new Set(retiredSamples.map(([slug]) => slug));
  const retiredTitles = new Set(retiredSamples.map(([, title]) => title));
  const samples = posts
    .filter(({ slug, title }) => retiredSlugs.has(slug) || retiredTitles.has(title))
    .map(({ slug, title }) => ({ slug, title }));

  assert.deepEqual(samples, []);
});
