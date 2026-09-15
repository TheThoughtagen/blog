import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

import {
  loadPosts,
  publishedPosts,
  selectFeatured,
  tagSlug,
} from '../scripts/posts.mjs';

const schemaPath = resolve('frontmatter.schema.json');

async function postTree() {
  const contentDir = await mkdtemp(join(tmpdir(), 'fieldnotes-posts-'));
  return contentDir;
}

function source({
  title = 'A useful note',
  description = 'A useful description.',
  date = '2026-09-15',
  category = 'Development',
  tags,
  draft,
  featured,
  extra = '',
  body = '## First section\n\nUseful words live here.\n',
} = {}) {
  const fields = [
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(description)}`,
    `date: ${JSON.stringify(date)}`,
    `category: ${JSON.stringify(category)}`,
    ...(tags === undefined ? [] : [`tags: ${JSON.stringify(tags)}`]),
    ...(draft === undefined ? [] : [`draft: ${draft}`]),
    ...(featured === undefined ? [] : [`featured: ${featured}`]),
    ...(extra === '' ? [] : [extra]),
  ];
  return `---\n${fields.join('\n')}\n---\n${body}`;
}

async function addPost(contentDir, slug, markdown, assets = {}) {
  const directory = join(contentDir, slug);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'index.md'), markdown);
  for (const [relativePath, bytes] of Object.entries(assets)) {
    const assetPath = join(directory, relativePath);
    await mkdir(resolve(assetPath, '..'), { recursive: true });
    await writeFile(assetPath, bytes);
  }
}

test('loadPosts returns an empty list when the content directory is missing or empty', async () => {
  const empty = await postTree();
  assert.deepEqual(await loadPosts({ contentDir: join(empty, 'missing'), schemaPath }), []);
  assert.deepEqual(await loadPosts({ contentDir: empty, schemaPath }), []);
});

test('loadPosts retains drafts with diagnostics while publication helpers exclude them', async () => {
  const contentDir = await postTree();
  await addPost(contentDir, 'published-note', source({ tags: [' JavaScript '] }));
  await addPost(contentDir, 'rough-draft', source({
    draft: true,
    title: '',
    description: '',
  }));

  const posts = await loadPosts({ contentDir, schemaPath });
  assert.equal(posts.length, 2);
  const draft = posts.find(post => post.slug === 'rough-draft');
  assert.equal(draft.draft, true);
  assert.ok(draft.rendered.diagnostics.some(diagnostic => diagnostic.code === 'schema.minLength'));
  assert.deepEqual(publishedPosts(posts).map(post => post.slug), ['published-note']);
  assert.deepEqual(posts.find(post => post.slug === 'published-note').tags, ['JavaScript']);
});

test('loadPosts rejects malformed YAML because draft status cannot be known', async () => {
  const contentDir = await postTree();
  await addPost(contentDir, 'broken-yaml', '---\ntitle: [unterminated\n---\nText\n');
  await assert.rejects(
    loadPosts({ contentDir, schemaPath }),
    /broken-yaml.*frontmatter|frontmatter.*broken-yaml/i,
  );
});

test('loadPosts rejects schema-invalid published posts but defaults optional fields in memory', async () => {
  const validDir = await postTree();
  await addPost(validDir, 'defaults', source());
  const [post] = await loadPosts({ contentDir: validDir, schemaPath });
  assert.deepEqual({ tags: post.tags, draft: post.draft, featured: post.featured }, {
    tags: [], draft: false, featured: false,
  });

  const invalidDir = await postTree();
  await addPost(invalidDir, 'invalid', source({ category: 'Not a section' }));
  await assert.rejects(loadPosts({ contentDir: invalidDir, schemaPath }), /invalid.*schema|schema.*invalid/i);
});

test('loadPosts reads only direct slug/index.md children and sorts date-desc then slug-asc', async () => {
  const contentDir = await postTree();
  await writeFile(join(contentDir, 'loose.md'), source());
  await addPost(contentDir, 'zulu', source({ date: '2026-09-14' }));
  await addPost(contentDir, 'bravo', source({ date: '2026-09-15' }));
  await addPost(contentDir, 'alpha', source({ date: '2026-09-15' }));
  await mkdir(join(contentDir, 'nested', 'too-deep'), { recursive: true });
  await writeFile(join(contentDir, 'nested', 'too-deep', 'index.md'), source());

  const posts = await loadPosts({ contentDir, schemaPath });
  assert.deepEqual(posts.map(post => post.slug), ['alpha', 'bravo', 'zulu']);
});

test('selectFeatured chooses the explicit published post, otherwise newest, otherwise null', async () => {
  const contentDir = await postTree();
  await addPost(contentDir, 'older-feature', source({ date: '2026-09-14', featured: true }));
  await addPost(contentDir, 'newest', source({ date: '2026-09-15' }));
  await addPost(contentDir, 'draft-feature', source({ date: '2026-09-16', featured: true, draft: true }));
  const posts = await loadPosts({ contentDir, schemaPath });
  assert.equal(selectFeatured(posts).slug, 'older-feature');
  assert.equal(selectFeatured(posts.map(post => ({ ...post, featured: false }))).slug, 'newest');
  assert.equal(selectFeatured(posts.map(post => ({ ...post, draft: true }))), null);
});

test('loadPosts rejects multiple featured published posts', async () => {
  const contentDir = await postTree();
  await addPost(contentDir, 'one', source({ featured: true }));
  await addPost(contentDir, 'two', source({ featured: true, date: '2026-09-14' }));
  await assert.rejects(loadPosts({ contentDir, schemaPath }), /multiple.*featured|featured.*multiple/i);
});

test('tagSlug normalizes Unicode and punctuation and rejects empty results', () => {
  assert.equal(tagSlug('  CAFÉ & Crème  '), 'caf%C3%A9-cr%C3%A8me');
  assert.equal(tagSlug('ＡＩ／ＭＬ'), 'ai-ml');
  assert.equal(tagSlug('日本語'), '%E6%97%A5%E6%9C%AC%E8%AA%9E');
  assert.throws(() => tagSlug('---'), /empty|tag/i);
});

test('loadPosts rejects duplicate tags within a post and distinct labels with colliding slugs', async () => {
  const duplicateDir = await postTree();
  await addPost(duplicateDir, 'duplicate', source({ tags: ['Node', ' node '] }));
  await assert.rejects(loadPosts({ contentDir: duplicateDir, schemaPath }), /duplicate.*tag|tag.*duplicate/i);

  const collisionDir = await postTree();
  await addPost(collisionDir, 'cpp', source({ tags: ['C++'] }));
  await addPost(collisionDir, 'csharp', source({ tags: ['C#'], date: '2026-09-14' }));
  await assert.rejects(loadPosts({ contentDir: collisionDir, schemaPath }), /tag.*collision|collision.*tag/i);
});

test('loadPosts exposes renderer headings and derives reading time from visible prose', async () => {
  const contentDir = await postTree();
  const words = Array.from({ length: 221 }, (_, index) => `word${index}`).join(' ');
  await addPost(contentDir, 'metrics', source({
    body: `## Alpha\n\n${words}\n\n### Beta\n\n\`\`\`text\n${'ignored '.repeat(500)}\n\`\`\`\n`,
  }));
  const [post] = await loadPosts({ contentDir, schemaPath });
  assert.deepEqual(post.rendered.toc.map(heading => heading.text), ['Alpha']);
  assert.equal(post.readingMinutes, Math.max(1, Math.ceil(post.rendered.wordCount / 220)));
  assert.equal(post.readingMinutes, 2);
});

test('loadPosts resolves existing local images and rejects missing or traversing assets', async () => {
  const validDir = await postTree();
  await addPost(validDir, 'images', source({ body: '## Image\n\n![Diagram](images/diagram.png)\n' }), {
    'images/diagram.png': Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  });
  const [post] = await loadPosts({ contentDir: validDir, schemaPath });
  assert.equal(post.localAssets.length, 1);
  assert.equal(post.localAssets[0].resolvedPath, join(validDir, 'images', 'images', 'diagram.png'));

  const missingDir = await postTree();
  await addPost(missingDir, 'missing', source({ body: '![Missing](nope.png)\n' }));
  await assert.rejects(loadPosts({ contentDir: missingDir, schemaPath }), /missing.*asset|asset.*missing/i);

  const traversalDir = await postTree();
  await writeFile(join(traversalDir, 'outside.png'), 'not allowed');
  await addPost(traversalDir, 'escape', source({ body: '![Escape](../outside.png)\n' }));
  await assert.rejects(loadPosts({ contentDir: traversalDir, schemaPath }), /escape|travers/i);
});

test('loadPosts rejects unsafe post directory names', async () => {
  for (const slug of ['Has Spaces', '.hidden', 'two--hyphens']) {
    const contentDir = await postTree();
    await addPost(contentDir, slug, source());
    await assert.rejects(loadPosts({ contentDir, schemaPath }), /unsafe.*slug|slug.*unsafe/i);
  }
});

test('loadPosts preserves exact source bytes and sourcePath', async () => {
  const contentDir = await postTree();
  const exact = Buffer.from('\uFEFF---\r\ntitle: "Exact"\r\ndescription: "Bytes"\r\ndate: "2026-09-15"\r\ncategory: "Development"\r\n---\r\n## Body\r\n\r\nText.\r\n');
  await addPost(contentDir, 'exact', exact);
  const [post] = await loadPosts({ contentDir, schemaPath });
  assert.equal(post.source, exact.toString('utf8'));
  assert.equal(post.sourcePath, join(contentDir, 'exact', 'index.md'));
});

test('loadPosts rejects duplicate explicit anchor IDs and a repeated title H1', async () => {
  const anchorsDir = await postTree();
  await addPost(anchorsDir, 'anchors', source({
    body: '<a id="stable"></a>\n## One\n\n<a id="stable"></a>\n## Two\n',
  }));
  await assert.rejects(loadPosts({ contentDir: anchorsDir, schemaPath }), /anchors.*duplicate|duplicate.*anchors/i);

  const titleDir = await postTree();
  await addPost(titleDir, 'title-repeat', source({ title: 'Same title', body: '# Same title\n\nText.\n' }));
  await assert.rejects(loadPosts({ contentDir: titleDir, schemaPath }), /title.*h1|h1.*title/i);
});
