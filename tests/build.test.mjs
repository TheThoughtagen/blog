import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { escapeHtml, renderFeed, validateContent, renderEmailSignup, renderChannels, build, loadLocalStylesheetBundle } from '../scripts/build.mjs';
import { site } from '../site.config.mjs';
import { externalPosts } from '../content/links.mjs';

function fixture() {
  return {
    config: {
      name: 'Test notebook', author: 'Test Author', description: 'A test notebook.',
      siteUrl: 'https://notebook.example/',
      github: { username: 'example-user', repositories: ['example-owner/project'] },
      links: { linkedin: 'https://www.linkedin.com/in/example/', substack: 'https://example.substack.com/', patreon: '', booking: '', subscribe: '' },
      newsletter: { buttondownUsername: '' },
      membership: { enabled: false, url: '' },
      ignitionTools: [],
    },
    notes: [{
      slug: 'first-note', title: 'First note', description: 'A useful note.',
      date: '2024-02-29', category: 'Development', tags: ['Testing'],
      readingMinutes: 2, featured: true,
      sections: [{ id: 'the-boundary', title: 'The boundary', paragraphs: ['Use plain text.'] }],
    }],
    links: [{
      title: 'An external post', description: 'Published elsewhere.',
      url: 'https://example.substack.com/p/a-post', source: 'Substack',
      date: '2024-02-29', category: 'Leadership', tags: [],
    }],
  };
}

const expectedIgnitionTools = [
  ['Ignition Dev Tools', 'https://thethoughtagen.github.io/ignition-ide-plugins/', 'https://github.com/TheThoughtagen/ignition-ide-plugins'],
  ['ignition-lint', 'https://thethoughtagen.github.io/ignition-lint/', 'https://github.com/TheThoughtagen/ignition-lint'],
  ['Ignition CLI', 'https://thethoughtagen.github.io/ignition-cli/', 'https://github.com/TheThoughtagen/ignition-cli'],
  ['ignition-mcp', 'https://whiskeyhouse.github.io/ignition-mcp/', 'https://github.com/WhiskeyHouse/ignition-mcp'],
  ['Ignition Git Module', 'https://whiskeyhouse.github.io/ignition-git-module/', 'https://github.com/WhiskeyHouse/ignition-git-module'],
];

async function createBuildRoot() {
  const workspace = await mkdtemp(join(tmpdir(), 'fieldnotes-build-'));
  const rootDir = join(workspace, 'project');
  await mkdir(rootDir);
  await cp(resolve('public'), join(rootDir, 'public'), { recursive: true });
  await cp(resolve('frontmatter.schema.json'), join(rootDir, 'frontmatter.schema.json'));
  return rootDir;
}

test('validateContent accepts the checked-in configuration and an empty notebook', () => {
  assert.doesNotThrow(() => validateContent(site, [], externalPosts));
});

test('validateContent accepts configured profiles, six repositories, membership, and crossposts', () => {
  const { config, notes, links } = fixture();
  config.github.repositories = Array.from({ length: 6 }, (_, i) => `example-owner/project-${i}`);
  config.links.patreon = 'https://www.patreon.com/example';
  config.membership = { enabled: true, url: 'https://members.example/join' };
  links.push({ ...links[0], source: 'LinkedIn', url: 'https://www.linkedin.com/posts/example' });
  assert.doesNotThrow(() => validateContent(config, notes, links));
});

test('validateContent rejects unsafe URLs in every configured destination', () => {
  const unsafe = ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd',
    'ftp://example.com', '//example.com', '/relative', 'https://user:secret@example.com', 'not a URL'];
  const destinations = [['siteUrl'], ['links', 'linkedin'], ['links', 'substack'], ['links', 'patreon'], ['links', 'booking'], ['links', 'subscribe'], ['membership', 'url']];
  for (const path of destinations) {
    for (const url of unsafe) {
      const { config, notes, links } = fixture();
      if (path.length === 1) config[path[0]] = url;
      else config[path[0]][path[1]] = url;
      assert.throws(() => validateContent(config, notes, links), /http\(s\) URL without credentials/, `${path.join('.')}: ${url}`);
    }
  }
});

test('validateContent rejects invalid identity, origin, GitHub configuration, and incomplete membership', () => {
  const cases = [
    ['empty name', (config) => { config.name = ''; }, /name and description/],
    ['non-string description', (config) => { config.description = null; }, /name and description/],
    ['origin with a path', (config) => { config.siteUrl = 'https://notebook.example/blog/'; }, /site origin/],
    ['membership without a URL', (config) => { config.membership.enabled = true; }, /Membership requires/],
    ['username containing a path', (config) => { config.github.username = 'owner/repo'; }, /Invalid GitHub username/],
    ['username with a leading hyphen', (config) => { config.github.username = '-owner'; }, /Invalid GitHub username/],
    ['repository URL', (config) => { config.github.repositories = ['https://github.com/owner/repo']; }, /owner\/repo/],
    ['missing repository owner', (config) => { config.github.repositories = ['repo']; }, /owner\/repo/],
    ['repository traversal', (config) => { config.github.repositories = ['owner/repo/../../other']; }, /owner\/repo/],
    ['non-array repositories', (config) => { config.github.repositories = 'owner/repo'; }, /owner\/repo/],
    ['too many repositories', (config) => { config.github.repositories = Array(7).fill('owner/repo'); }, /up to six/],
  ];
  for (const [label, mutate, error] of cases) {
    const { config, notes, links } = fixture();
    mutate(config);
    assert.throws(() => validateContent(config, notes, links), error, label);
  }
});

test('validateContent permits an empty notebook or one featured note and requires unique URL-safe slugs', () => {
  const { config, notes, links } = fixture();
  assert.doesNotThrow(() => validateContent(config, [], links));
  assert.doesNotThrow(() => validateContent(config, [{ ...notes[0], featured: false }], links));
  assert.throws(() => validateContent(config, [...notes, { ...notes[0], slug: 'second-note' }], links), /at most one featured/);
  assert.throws(() => validateContent(config, [...notes, { ...notes[0], featured: false }], links), /slugs must be unique/);
  for (const slug of ['../escape', 'Title', 'a/b', 'note.html', 'note" onclick="alert(1)', '']) {
    assert.throws(() => validateContent(config, [{ ...notes[0], slug }], links), /URL-safe/, slug);
  }
});

test('validateContent rejects invalid article metadata', () => {
  const cases = [
    ['empty title', (note) => { note.title = ''; }, /Invalid metadata/],
    ['empty description', (note) => { note.description = ''; }, /Invalid metadata/],
    ['unknown category', (note) => { note.category = 'Unknown'; }, /Invalid metadata/],
    ['impossible date', (note) => { note.date = '2023-02-29'; }, /Invalid metadata/],
    ['non-ISO date', (note) => { note.date = 'February 29, 2024'; }, /Invalid metadata/],
    ['non-array tags', (note) => { note.tags = 'Testing'; }, /Invalid article/],
    ['zero reading time', (note) => { note.readingMinutes = 0; }, /Invalid article/],
    ['fractional reading time', (note) => { note.readingMinutes = 1.5; }, /Invalid article/],
  ];
  for (const [label, mutate, error] of cases) {
    const { config, notes, links } = fixture();
    mutate(notes[0]);
    assert.throws(() => validateContent(config, notes, links), error, label);
  }
});

test('validateContent rejects unsafe crosspost links and incomplete crosspost metadata', () => {
  const { config, notes, links } = fixture();
  for (const invalid of [
    { url: 'javascript:alert(1)' }, { url: 'https://user:secret@example.com' },
    { url: '/posts/local' }, { source: 'Other' }, { title: '' }, { description: '' },
    { category: 'Unknown' }, { date: '2024-02-30' },
  ]) {
    assert.throws(() => validateContent(config, notes, [{ ...links[0], ...invalid }]), /Invalid external post/, JSON.stringify(invalid));
  }
});

test('validateContent rejects unsafe or incomplete Ignition tool destinations', () => {
  const validTool = {
    name: 'Ignition tool',
    description: 'A useful Ignition development tool.',
    documentationUrl: 'https://docs.example.com/ignition-tool/',
    repositoryUrl: 'https://github.com/example/ignition-tool',
  };
  for (const invalid of [
    { documentationUrl: 'javascript:alert(1)' },
    { repositoryUrl: 'https://user:secret@github.com/example/ignition-tool' },
    { documentationUrl: '/relative/docs' },
    { name: '' },
    { description: '' },
  ]) {
    const { config, notes, links } = fixture();
    config.ignitionTools = [{ ...validTool, ...invalid }];
    assert.throws(() => validateContent(config, notes, links), /Invalid Ignition tool/, JSON.stringify(invalid));
  }
});

test('build publishes five safe Ignition tool cards and indexes their documentation for command search', async () => {
  const rootDir = await createBuildRoot();
  await build({ rootDir, contentDir: join(rootDir, 'missing-content'), outputDir: join(rootDir, 'site') });
  const lab = await readFile(join(rootDir, 'site/lab/index.html'), 'utf8');
  const searchIndex = JSON.parse(await readFile(join(rootDir, 'site/assets/data.json'), 'utf8'));

  assert.match(lab, /<section class="ignition-tools"[^>]+aria-labelledby="ignition-tools-title"/);
  assert.equal((lab.match(/class="ignition-project-card"/g) || []).length, 5);
  assert.deepEqual(searchIndex.ignitionTools.map(({ name, documentationUrl, repositoryUrl }) => [name, documentationUrl, repositoryUrl]), expectedIgnitionTools);

  for (const [name, documentationUrl, repositoryUrl] of expectedIgnitionTools) {
    assert.ok(lab.includes(`>${name}</h3>`), `${name} card heading`);
    assert.match(lab, new RegExp(`href="${documentationUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" target="_blank" rel="noopener noreferrer"`));
    assert.match(lab, new RegExp(`href="${repositoryUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" target="_blank" rel="noopener noreferrer"`));
  }
});

test('build publishes a complete Markdown note with renderer HTML, nested navigation, source, assets, and wraparound', async () => {
  const rootDir = await createBuildRoot();
  const contentDir = join(rootDir, 'posts');
  const outputDir = join(rootDir, 'site');
  const source = `---
title: "Escaping <systems>"
description: "A safer & useful note."
date: "2026-09-15"
category: "Development"
tags: ["Rendering", "Safety"]
featured: true
---
## First boundary

Hello **rendered** world.

### Inner detail

<script>alert('unsafe')</script>

![Local diagram](images/diagram.png)
`;
  await mkdir(join(contentDir, 'escaping-systems/images'), { recursive: true });
  await writeFile(join(contentDir, 'escaping-systems/index.md'), source);
  await writeFile(join(contentDir, 'escaping-systems/images/diagram.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  await build({ rootDir, contentDir, outputDir });

  const html = await readFile(join(outputDir, 'notes/escaping-systems/index.html'), 'utf8');
  const markdown = await readFile(join(outputDir, 'notes/escaping-systems/index.md'), 'utf8');
  const data = JSON.parse(await readFile(join(outputDir, 'assets/data.json'), 'utf8'));
  assert.equal(markdown, source);
  assert.match(html, /<h1>Escaping &lt;systems&gt;<span class="accent">\.<\/span><\/h1>/);
  assert.match(html, /<strong>rendered<\/strong>/);
  assert.doesNotMatch(html, /<script>alert\('unsafe'\)<\/script>/);
  assert.match(html, /aria-label="On this page"[\s\S]*href="#first-boundary"[\s\S]*<ol>[\s\S]*href="#inner-detail"/);
  assert.match(html, /<time datetime="2026-09-15">15 Sep 2026<\/time>/);
  assert.match(html, /rel="canonical" href="https:\/\/thoughts\.cruciblesoftware\.co\/notes\/escaping-systems\/"/);
  assert.match(html, /property="og:type" content="article"/);
  assert.match(html, /property="article:published_time" content="2026-09-15"/);
  assert.match(html, /data-copy-markdown/);
  assert.match(html, /id="article-markdown"/);
  assert.match(html, /href="\/notes\/escaping-systems\/index\.md"/);
  assert.match(html, /class="next-note note-link" href="\/notes\/escaping-systems\/"/);
  assert.equal(data.articles[0].url, '/notes/escaping-systems/');
  assert.equal(data.articles[0].title, 'Escaping <systems>');
  await access(join(outputDir, 'notes/escaping-systems/images/diagram.png'));
});

test('build publishes linked deterministic tag archives and includes their URLs in the sitemap', async () => {
  const rootDir = await createBuildRoot();
  const contentDir = join(rootDir, 'posts');
  const outputDir = join(rootDir, 'site');
  await mkdir(join(contentDir, 'older-note'), { recursive: true });
  await mkdir(join(contentDir, 'newer-note'), { recursive: true });
  await writeFile(join(contentDir, 'older-note/index.md'), `---
title: "Older note"
description: "The earlier observation."
date: "2026-09-14"
category: "Development"
tags: ["Data Quality"]
---
Older body.
`);
  await writeFile(join(contentDir, 'newer-note/index.md'), `---
title: "Newer note"
description: "The latest observation."
date: "2026-09-15"
category: "AI & ML"
tags: ["Reliability", "Data Quality"]
---
Newer body.
`);

  await build({ rootDir, contentDir, outputDir });

  const article = await readFile(join(outputDir, 'notes/newer-note/index.html'), 'utf8');
  const archive = await readFile(join(outputDir, 'tags/data-quality/index.html'), 'utf8');
  const sitemap = await readFile(join(outputDir, 'sitemap.xml'), 'utf8');
  assert.match(article, /href="\/tags\/data-quality\/"[^>]*>Data Quality<\/a>/);
  assert.match(archive, /<h1>Data Quality<span class="accent">\.<\/span><\/h1>/);
  assert.ok(archive.indexOf('Newer note') < archive.indexOf('Older note'), 'tag archive preserves publication ordering');
  assert.match(sitemap, /<loc>https:\/\/thoughts\.cruciblesoftware\.co\/tags\/data-quality\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/thoughts\.cruciblesoftware\.co\/tags\/reliability\/<\/loc>/);
});

test('build materializes Unicode tag archives at decoded static-server paths', async () => {
  const rootDir = await createBuildRoot();
  const contentDir = join(rootDir, 'posts');
  const outputDir = join(rootDir, 'site');
  await mkdir(join(contentDir, 'unicode-tag'), { recursive: true });
  await writeFile(join(contentDir, 'unicode-tag/index.md'), `---
title: "Unicode tag"
description: "A decoded route fixture."
date: "2026-09-15"
category: "Development"
tags: ["Café"]
---
Body.
`);

  await build({ rootDir, contentDir, outputDir });

  await access(join(outputDir, 'tags/café/index.html'));
  await assert.rejects(access(join(outputDir, 'tags/caf%C3%A9/index.html')), { code: 'ENOENT' });
  const article = await readFile(join(outputDir, 'notes/unicode-tag/index.html'), 'utf8');
  assert.match(article, /href="\/tags\/caf%C3%A9\/"[^>]*>Café<\/a>/);
});

test('build emits XML-safe category and tag classifications for every RSS item', async () => {
  const rootDir = await createBuildRoot();
  const contentDir = join(rootDir, 'posts');
  const outputDir = join(rootDir, 'site');
  await mkdir(join(contentDir, 'classified-note'), { recursive: true });
  await writeFile(join(contentDir, 'classified-note/index.md'), `---
title: "Classified note"
description: "Feed classifications."
date: "2026-09-15"
category: "AI & ML"
tags: ["Data & Safety", "Reliability"]
---
Body.
`);

  await build({ rootDir, contentDir, outputDir });

  const feed = await readFile(join(outputDir, 'feed.xml'), 'utf8');
  assert.match(feed, /<category>AI &amp; ML<\/category><category>Data &amp; Safety<\/category><category>Reliability<\/category>/);
});

test('build indexes renderer headings and body text in searchable Markdown documents', async () => {
  const rootDir = await createBuildRoot();
  const contentDir = join(rootDir, 'posts');
  const outputDir = join(rootDir, 'site');
  await mkdir(join(contentDir, 'searchable-note'), { recursive: true });
  await writeFile(join(contentDir, 'searchable-note/index.md'), `---
title: "Searchable note"
description: "Find the hidden details."
date: "2026-09-15"
category: "Development"
tags: ["Observability"]
---
## Observe systems

Trace the purple semaphore in production.

### Read the signals

Respond deliberately.
`);

  await build({ rootDir, contentDir, outputDir });

  const data = JSON.parse(await readFile(join(outputDir, 'assets/data.json'), 'utf8'));
  assert.deepEqual(data.articles[0].headings, ['Observe systems', 'Read the signals']);
  assert.match(data.articles[0].body, /Trace the purple semaphore in production\./);
  assert.match(data.articles[0].searchText, /Searchable note[\s\S]*Observe systems[\s\S]*purple semaphore/);
  assert.deepEqual(
    Object.fromEntries(['title', 'description', 'category', 'tags', 'url'].map(key => [key, data.articles[0][key]])),
    {
      title: 'Searchable note',
      description: 'Find the hidden details.',
      category: 'Development',
      tags: ['Observability'],
      url: '/notes/searchable-note/',
    },
  );
});

test('build excludes drafts and their assets from every public artifact', async () => {
  const rootDir = await createBuildRoot();
  const contentDir = join(rootDir, 'posts');
  const outputDir = join(rootDir, 'site');
  await mkdir(join(contentDir, 'visible-note'), { recursive: true });
  await mkdir(join(contentDir, 'secret-draft/images'), { recursive: true });
  await writeFile(join(contentDir, 'visible-note/index.md'), `---
title: "Visible note"
description: "Public writing."
date: "2026-09-15"
category: "Development"
tags: ["Visible"]
---
Published body.
`);
  await writeFile(join(contentDir, 'secret-draft/index.md'), `---
title: "Secret draft"
description: "Private writing."
date: "2026-09-16"
category: "Development"
tags: ["Secret"]
draft: true
---
Unpublished phrase.

![Private image](images/private.txt)
`);
  await writeFile(join(contentDir, 'secret-draft/images/private.txt'), 'private asset bytes');

  await build({ rootDir, contentDir, outputDir });

  for (const path of [
    'notes/secret-draft/index.html',
    'notes/secret-draft/index.md',
    'notes/secret-draft/images/private.txt',
    'tags/secret/index.html',
  ]) await assert.rejects(access(join(outputDir, path)), { code: 'ENOENT' }, path);
  for (const path of ['index.html', 'feed.xml', 'sitemap.xml', 'assets/data.json']) {
    const artifact = await readFile(join(outputDir, path), 'utf8');
    assert.doesNotMatch(artifact, /Secret draft|secret-draft|Unpublished phrase|private asset bytes/, path);
  }
});

test('build copies verified local asset bytes and rejects missing or traversing assets before clearing output', async () => {
  const rootDir = await createBuildRoot();
  const contentDir = join(rootDir, 'posts');
  const outputDir = join(rootDir, 'site');
  const bytes = Buffer.from([0x00, 0xff, 0x41, 0x42, 0x80]);
  await mkdir(join(contentDir, 'asset-note/images'), { recursive: true });
  await writeFile(join(contentDir, 'asset-note/index.md'), `---
title: "Asset note"
description: "Local binary asset."
date: "2026-09-15"
category: "Development"
---
![Binary](images/binary.dat)
`);
  await writeFile(join(contentDir, 'asset-note/images/binary.dat'), bytes);
  await build({ rootDir, contentDir, outputDir });
  assert.deepEqual(await readFile(join(outputDir, 'notes/asset-note/images/binary.dat')), bytes);

  await writeFile(join(contentDir, 'asset-note/index.md'), `---
title: "Asset note"
description: "Missing local asset."
date: "2026-09-15"
category: "Development"
---
![Missing](images/missing.png)
`);
  await writeFile(join(outputDir, 'sentinel.txt'), 'keep');
  await assert.rejects(build({ rootDir, contentDir, outputDir }), /asset-missing|Missing local asset/);
  assert.equal(await readFile(join(outputDir, 'sentinel.txt'), 'utf8'), 'keep');

  await writeFile(join(contentDir, 'asset-note/index.md'), `---
title: "Asset note"
description: "Traversing local asset."
date: "2026-09-15"
category: "Development"
---
![Traversal](../escape.png)
`);
  await assert.rejects(build({ rootDir, contentDir, outputDir }), /asset-traversal|escapes the post directory/);
  assert.equal(await readFile(join(outputDir, 'sentinel.txt'), 'utf8'), 'keep');
});

test('build installs the self-contained renderer browser export beside the module application', async () => {
  const rootDir = await createBuildRoot();
  const outputDir = join(rootDir, 'site');
  await build({ rootDir, contentDir: join(rootDir, 'missing'), outputDir });

  const app = await readFile(join(outputDir, 'assets/app.js'), 'utf8');
  const renderer = await readFile(join(outputDir, 'assets/fieldnotes-renderer-browser.js'), 'utf8');
  const home = await readFile(join(outputDir, 'index.html'), 'utf8');
  assert.match(app, /import\s*\{\s*hydrateMermaid\s*,\s*normalizeRenderedDom\s*\}\s*from\s*['"]\.\/fieldnotes-renderer-browser\.js\?v=[a-f0-9]{12}['"]/);
  assert.match(renderer, /export\s*\{[\s\S]*hydrateMermaid,[\s\S]*normalizeRenderedDom/);
  const imports = [...renderer.matchAll(/^\s*import(?:\s+[^;\n]+?\s+from\s+|\s*)['"]([^'"]+)['"]/gmu)].map((match) => match[1]);
  assert.deepEqual(imports, []);
  assert.match(home, /<script type="module" src="\/assets\/app\.js\?v=[a-f0-9]{12}"><\/script>/);
});

test('build publishes versioned local KaTeX styles and every referenced font', async () => {
  const rootDir = await createBuildRoot();
  const outputDir = join(rootDir, 'site');
  await build({ rootDir, contentDir: join(rootDir, 'missing'), outputDir });

  const home = await readFile(join(outputDir, 'index.html'), 'utf8');
  const katex = await readFile(join(outputDir, 'assets/katex.min.css'), 'utf8');
  const stylesheetVersion = home.match(/\/assets\/katex\.min\.css\?v=([a-f0-9]{12})/)?.[1];
  assert.ok(stylesheetVersion, 'KaTeX stylesheet is linked with the publication asset version');
  assert.match(katex, /\.katex \.katex-mathml\{[^}]*clip-path:inset\(50%\)[^}]*position:absolute[^}]*width:1px/);
  assert.match(katex, /\.katex \.katex-html>/);

  const fontReferences = [...katex.matchAll(/url\(fonts\/([A-Za-z0-9_.-]+)\?v=([a-f0-9]{12})\)/g)]
    .map(([, name, version]) => ({ name, version }));
  assert.ok(fontReferences.length >= 20, 'KaTeX CSS retains its complete local font set');
  assert.ok(fontReferences.every(({ version }) => version === stylesheetVersion));
  for (const { name } of fontReferences) {
    assert.ok((await readFile(join(outputDir, 'assets/fonts', name))).byteLength > 0, name);
  }
});

test('stylesheet asset collection fails closed on missing and escaping font references', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'fieldnotes-stylesheet-'));
  await mkdir(join(workspace, 'fonts'));
  const stylesheet = join(workspace, 'styles.css');
  await writeFile(stylesheet, '@font-face{src:url(fonts/missing.woff2)}');
  await assert.rejects(loadLocalStylesheetBundle(stylesheet), /ENOENT|missing\.woff2/);
  await writeFile(stylesheet, '@font-face{src:url(..\/escape.woff2)}');
  await assert.rejects(loadLocalStylesheetBundle(stylesheet), /local font path|escape/i);
});

test('build versions the search index from publication content and links the application request to it', async () => {
  const rootDir = await createBuildRoot();
  const contentDir = join(rootDir, 'posts');
  const outputDir = join(rootDir, 'site');
  await mkdir(join(contentDir, 'versioned-search'), { recursive: true });
  const post = (body) => `---
title: "Versioned search"
description: "Cache-safe search data."
date: "2026-09-15"
category: "Development"
---
${body}
`;
  await writeFile(join(contentDir, 'versioned-search/index.md'), post('First searchable body.'));
  await build({ rootDir, contentDir, outputDir });
  const firstApp = await readFile(join(outputDir, 'assets/app.js'), 'utf8');
  const firstHome = await readFile(join(outputDir, 'index.html'), 'utf8');
  const firstVersion = firstApp.match(/fetch\('\/assets\/data\.json\?v=([a-f0-9]{12})'/)?.[1];
  assert.ok(firstVersion, 'application fetches an explicitly versioned search index');
  assert.match(firstHome, new RegExp(`/assets/app\\.js\\?v=${firstVersion}`));

  await writeFile(join(contentDir, 'versioned-search/index.md'), post('Second independently searchable body.'));
  await build({ rootDir, contentDir, outputDir });
  const secondApp = await readFile(join(outputDir, 'assets/app.js'), 'utf8');
  const secondHome = await readFile(join(outputDir, 'index.html'), 'utf8');
  const secondVersion = secondApp.match(/fetch\('\/assets\/data\.json\?v=([a-f0-9]{12})'/)?.[1];
  assert.ok(secondVersion);
  assert.notEqual(secondVersion, firstVersion, 'search-content changes invalidate the asset version');
  assert.match(secondHome, new RegExp(`/assets/app\\.js\\?v=${secondVersion}`));
});

test('build strips XML 1.0-forbidden controls from every RSS metadata field', async () => {
  const rootDir = await createBuildRoot();
  const contentDir = join(rootDir, 'posts');
  const outputDir = join(rootDir, 'site');
  await mkdir(join(contentDir, 'xml-controls'), { recursive: true });
  await writeFile(join(contentDir, 'xml-controls/index.md'), `---
title: "Control\\u0001title"
description: "Description\\u000bvalue."
date: "2026-09-15"
category: "Development"
tags: ["Reliability\\u0000tag"]
---
Body.
`);

  await build({ rootDir, contentDir, outputDir });

  const feed = await readFile(join(outputDir, 'feed.xml'), 'utf8');
  assert.doesNotMatch(feed, /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u);
  assert.match(feed, /<title>Controltitle<\/title>/);
  assert.match(feed, /<description>Descriptionvalue\.<\/description>/);
  assert.match(feed, /<category>Reliabilitytag<\/category>/);
  const parsed = spawnSync('xmllint', ['--noout', '-'], { input: feed, encoding: 'utf8' });
  if (parsed.error?.code !== 'ENOENT') assert.equal(parsed.status, 0, parsed.stderr);
});

test('build supports an empty notebook without note URLs, feed items, or heading navigation', async () => {
  const rootDir = await createBuildRoot();
  const outputDir = join(rootDir, 'site');
  await build({ rootDir, contentDir: join(rootDir, 'missing'), outputDir });

  const home = await readFile(join(outputDir, 'index.html'), 'utf8');
  const lab = await readFile(join(outputDir, 'lab/index.html'), 'utf8');
  const about = await readFile(join(outputDir, 'about/index.html'), 'utf8');
  const connect = await readFile(join(outputDir, 'connect/index.html'), 'utf8');
  const card = await readFile(join(outputDir, 'card/index.html'), 'utf8');
  const cardQr = await readFile(join(outputDir, 'card/qr/index.html'), 'utf8');
  const siteManifest = JSON.parse(await readFile(join(outputDir, 'site.webmanifest'), 'utf8'));
  const cardManifest = JSON.parse(await readFile(join(outputDir, 'card.webmanifest'), 'utf8'));
  const vcard = await readFile(join(outputDir, 'patrick-mannion.vcf'), 'utf8');
  const feed = await readFile(join(outputDir, 'feed.xml'), 'utf8');
  const sitemap = await readFile(join(outputDir, 'sitemap.xml'), 'utf8');
  const data = JSON.parse(await readFile(join(outputDir, 'assets/data.json'), 'utf8'));
  assert.match(home, /no published field notes yet/i);
  assert.match(home, /class="author-portrait card-portrait"/);
  assert.match(home, /<img class="card-headshot" src="\/assets\/patrick-mannion-headshot\.png"/);
  assert.match(about, /class="about-portrait card-portrait"/);
  assert.deepEqual(data.articles, []);
  assert.doesNotMatch(sitemap, /\/notes\//);
  assert.doesNotMatch(feed, /<item>/);
  assert.match(feed, /<rss version="2\.0"><channel>/);
  assert.match(sitemap, /<loc>https:\/\/thoughts\.cruciblesoftware\.co\/card\/<\/loc>/);
  assert.match(sitemap, /<loc>https:\/\/thoughts\.cruciblesoftware\.co\/card\/qr\/<\/loc>/);
  assert.match(lab, /Ignition tools/);
  assert.match(about, /About Patrick/);
  assert.match(connect, /Say hello/);
  assert.match(card, /GitHub @TheThoughtagen/);
  assert.match(card, /href="\/card\.webmanifest"/);
  assert.match(card, /data-card-hook/);
  assert.match(card, /src="\/assets\/patrick-mannion-headshot\.png"/);
  assert.match(card, /data-card-repos/);
  assert.match(card, /ignition-mcp[\s\S]*36 stars/);
  assert.ok(card.indexOf('ignition-mcp') < card.indexOf('ignition-ide-plugins'), 'ignition-mcp is the first highlighted repo');
  assert.match(card, /href="https:\/\/github\.com\/WhiskeyHouse\/ignition-mcp"/);
  assert.match(card, /ignition-ide-plugins[\s\S]*14 stars/);
  assert.match(card, /ignition-lint[\s\S]*11 stars/);
  assert.match(card, /patrick@cruciblesoftware\.co/);
  assert.match(cardQr, /Scan to save contact/);
  assert.match(cardQr, /https:\/\/thoughts\.cruciblesoftware\.co\/card\//);
  assert.match(cardQr, /class="card-qr-code"/);
  assert.match(cardQr, /href="\/card\/"/);
  assert.match(cardQr, /href="\/card\.webmanifest"/);
  assert.match(cardQr, /:qr/);
  assert.equal(siteManifest.start_url, '/');
  assert.equal(cardManifest.start_url, '/card/');
  assert.ok(cardManifest.icons.some((icon) => icon.src === '/assets/icons/fieldnotes-green-512.png'));
  assert.ok(cardManifest.icons.some((icon) => icon.src === '/assets/icons/fieldnotes-amber-180.png'));
  for (const theme of ['green', 'amber']) {
    for (const size of [180, 192, 512]) await access(join(outputDir, 'assets/icons', `fieldnotes-${theme}-${size}.png`));
    await access(join(outputDir, 'assets/icons', `fieldnotes-${theme}.svg`));
  }
  assert.match(vcard, /FN:Patrick Mannion/);
  assert.match(vcard, /PHOTO;MEDIATYPE=image\/png:https:\/\/thoughts\.cruciblesoftware\.co\/assets\/patrick-mannion-headshot\.png/);
});

test('a Markdown note without H2 or H3 headings omits the on-page navigation', async () => {
  const rootDir = await createBuildRoot();
  const contentDir = join(rootDir, 'posts');
  const outputDir = join(rootDir, 'site');
  await mkdir(join(contentDir, 'plain-note'), { recursive: true });
  await writeFile(join(contentDir, 'plain-note/index.md'), `---
title: "Plain note"
description: "A note without headings."
date: "2026-09-15"
category: "Development"
---
Just the body.
`);
  await build({ rootDir, contentDir, outputDir });
  const html = await readFile(join(outputDir, 'notes/plain-note/index.html'), 'utf8');
  assert.doesNotMatch(html, /aria-label="On this page"/);
});

test('build clears only its injected output directory', async () => {
  const rootDir = await createBuildRoot();
  const outputDir = join(rootDir, 'site');
  const sibling = join(rootDir, 'keep.txt');
  await mkdir(outputDir);
  await writeFile(join(outputDir, 'stale.txt'), 'stale');
  await writeFile(sibling, 'keep');

  await build({ rootDir, contentDir: join(rootDir, 'missing'), outputDir });

  await assert.rejects(access(join(outputDir, 'stale.txt')), { code: 'ENOENT' });
  assert.equal(await readFile(sibling, 'utf8'), 'keep');
});

test('build rejects note assets that collide with generated files before clearing output', async () => {
  for (const assetName of ['index.html', 'Index.HTML', 'index.md']) {
    const rootDir = await createBuildRoot();
    const contentDir = join(rootDir, 'posts');
    const outputDir = join(rootDir, 'site');
    await mkdir(join(contentDir, 'reserved-asset'), { recursive: true });
    await writeFile(join(contentDir, 'reserved-asset/index.md'), `---
title: "Reserved asset"
description: "A note with an unsafe asset name."
date: "2026-09-15"
category: "Development"
---
![Collision](${assetName})
`);
    if (assetName !== 'index.md') await writeFile(join(contentDir, 'reserved-asset', assetName), 'asset payload');
    await mkdir(outputDir);
    await writeFile(join(outputDir, 'sentinel.txt'), 'keep');

    await assert.rejects(
      build({ rootDir, contentDir, outputDir }),
      /asset.*reserved|generated.*file|index\.(?:html|md)/i,
      assetName,
    );
    assert.equal(await readFile(join(outputDir, 'sentinel.txt'), 'utf8'), 'keep', assetName);
  }
});

test('build rejects output directories outside its canonical project boundary before clearing them', async () => {
  for (const location of ['root', 'ancestor', 'sibling', 'public']) {
    const rootDir = await createBuildRoot();
    const workspace = resolve(rootDir, '..');
    const outputDir = {
      root: rootDir,
      ancestor: workspace,
      sibling: join(workspace, 'sibling'),
      public: join(rootDir, 'public'),
    }[location];
    await mkdir(outputDir, { recursive: true });
    const sentinel = join(outputDir, `keep-${location}.txt`);
    await writeFile(sentinel, 'keep');

    await assert.rejects(
      build({ rootDir, contentDir: join(rootDir, 'missing'), outputDir }),
      /outputDir.*dedicated|strict descendant|project boundary/i,
      location,
    );
    assert.equal(await readFile(sentinel, 'utf8'), 'keep', location);
  }
});

test('build rejects a symlinked output directory that canonically escapes the project', async () => {
  const rootDir = await createBuildRoot();
  const escaped = join(resolve(rootDir, '..'), 'escaped-output');
  const outputDir = join(rootDir, 'linked-output');
  await mkdir(escaped);
  await writeFile(join(escaped, 'sentinel.txt'), 'keep');
  await symlink(escaped, outputDir, 'dir');

  await assert.rejects(
    build({ rootDir, contentDir: join(rootDir, 'missing'), outputDir }),
    /outputDir.*strict descendant|project boundary/i,
  );
  assert.equal(await readFile(join(escaped, 'sentinel.txt'), 'utf8'), 'keep');
});

test('build rejects a public fonts symlink before generated fonts escape the output', async () => {
  const rootDir = await createBuildRoot();
  const outputDir = join(rootDir, 'site');
  const external = join(resolve(rootDir, '..'), 'external-fonts');
  await mkdir(external);
  const externalFont = join(external, 'KaTeX_Main-Regular.woff2');
  await writeFile(externalFont, 'external sentinel');
  await symlink(external, join(rootDir, 'public/assets/fonts'));
  await mkdir(outputDir);
  await writeFile(join(outputDir, 'sentinel.txt'), 'output sentinel');

  await assert.rejects(
    build({ rootDir, contentDir: join(rootDir, 'missing'), outputDir }),
    /public.*(?:symlink|symbolic)|generated.*collision/i,
  );
  assert.equal(await readFile(externalFont, 'utf8'), 'external sentinel');
  assert.equal(await readFile(join(outputDir, 'sentinel.txt'), 'utf8'), 'output sentinel');
});

test('build rejects public symlinks at generated asset files before external writes', async (t) => {
  for (const name of ['katex.min.css', 'fieldnotes-renderer-browser.js', 'data.json']) {
    await t.test(name, async () => {
      const rootDir = await createBuildRoot();
      const outputDir = join(rootDir, 'site');
      const external = join(resolve(rootDir, '..'), `external-${name.replaceAll('.', '-')}`);
      await writeFile(external, 'external sentinel');
      await symlink(external, join(rootDir, 'public/assets', name));
      await mkdir(outputDir);
      await writeFile(join(outputDir, 'sentinel.txt'), 'output sentinel');

      await assert.rejects(
        build({ rootDir, contentDir: join(rootDir, 'missing'), outputDir }),
        /public.*(?:symlink|symbolic)|generated.*collision/i,
      );
      assert.equal(await readFile(external, 'utf8'), 'external sentinel');
      assert.equal(await readFile(join(outputDir, 'sentinel.txt'), 'utf8'), 'output sentinel');
    });
  }
});

test('build rejects a non-directory public collision at the generated fonts namespace before clearing output', async () => {
  const rootDir = await createBuildRoot();
  const outputDir = join(rootDir, 'site');
  await writeFile(join(rootDir, 'public/assets/fonts'), 'not a directory');
  await mkdir(outputDir);
  await writeFile(join(outputDir, 'sentinel.txt'), 'output sentinel');

  await assert.rejects(
    build({ rootDir, contentDir: join(rootDir, 'missing'), outputDir }),
    /collid.*generated|generated.*collis|public.*directory/i,
  );
  assert.equal(await readFile(join(outputDir, 'sentinel.txt'), 'utf8'), 'output sentinel');
});

test('escapeHtml escapes markup, ampersands, both quote types, and stringifies values', () => {
  assert.equal(escapeHtml(`<script title="a&b">'x'</script>`), '&lt;script title=&quot;a&amp;b&quot;&gt;&#39;x&#39;&lt;/script&gt;');
  assert.equal(escapeHtml('&lt;'), '&amp;lt;');
  assert.equal(escapeHtml(42), '42');
  assert.equal(escapeHtml('Plain text'), 'Plain text');
});

test('renderFeed emits absolute permalinks and escaped Markdown-note metadata', () => {
  const { config, notes } = fixture();
  config.name = 'Notes & <systems>';
  config.description = '"People" & systems';
  notes[0].title = '<Demo> & "example"';
  notes[0].description = "Don't <guess> & ship.";
  notes[0].category = 'AI & ML';
  notes.push({ ...notes[0], slug: 'real-note', title: 'Original note', description: 'Actual writing.', featured: false });
  const feed = renderFeed(config, notes);
  assert.match(feed, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.ok(feed.includes('<title>Notes &amp; &lt;systems&gt;</title>'));
  assert.ok(feed.includes('<description>&quot;People&quot; &amp; systems</description>'));
  assert.ok(feed.includes('<title>&lt;Demo&gt; &amp; &quot;example&quot;</title>'));
  assert.ok(feed.includes('<description>Don&#39;t &lt;guess&gt; &amp; ship.</description>'));
  assert.ok(feed.includes('<category>AI &amp; ML</category>'));
  assert.ok(feed.includes('<pubDate>Thu, 29 Feb 2024 12:00:00 GMT</pubDate>'));
  assert.ok(feed.includes('<title>Original note</title>'));
  assert.ok(feed.includes('<description>Actual writing.</description>'));
  assert.doesNotMatch(feed, /Sample article|\[Sample\]/);
  for (const note of notes) {
    const url = `https://notebook.example/notes/${note.slug}/`;
    assert.ok(feed.includes(`<link>${url}</link>`));
    assert.ok(feed.includes(`<guid isPermaLink="true">${url}</guid>`));
  }
  assert.doesNotMatch(feed, /<link>\//);
});

test('renderFeed uses relative non-permalink identifiers when the preview origin is unset', () => {
  const { config, notes } = fixture();
  config.siteUrl = '';
  const feed = renderFeed(config, notes);
  assert.ok(feed.includes('<link>/</link>'));
  assert.ok(feed.includes('<link>/notes/first-note/</link>'));
  assert.ok(feed.includes('<guid isPermaLink="false">/notes/first-note/</guid>'));
  assert.doesNotMatch(feed, /https?:\/\//);
});

test('unconfigured booking and email never collect information or claim success', () => {
  const { config } = fixture();
  const markup = renderChannels(config);
  assert.match(markup, /Scheduling opens soon/);
  assert.match(markup, /Email subscriptions are not open yet/);
  assert.match(markup, /type="email" disabled/);
  assert.doesNotMatch(markup, /<form|action=|mailto:/);
  assert.match(markup, /href="\/feed.xml"/);
});

test('Buttondown uses its supported native POST form, not fake JavaScript submission', () => {
  const { config } = fixture(); config.newsletter.buttondownUsername = 'fieldnotes-test';
  const markup = renderEmailSignup(config);
  assert.match(markup, /action="https:\/\/buttondown.com\/api\/emails\/embed-subscribe\/fieldnotes-test" method="post"/);
  assert.match(markup, /type="email" name="email" required autocomplete="email"/);
  assert.match(markup, /name="embed" value="1"/);
  assert.match(markup, /By subscribing, you agree/);
  assert.match(markup, /target="_blank" rel="noopener noreferrer"/);
  assert.doesNotMatch(markup, /disabled/);
});

test('hosted booking and newsletter URLs are rendered safely', () => {
  const { config, notes, links } = fixture();
  config.links.booking = 'https://cal.com/example/intro?one=1&two=2';
  config.links.subscribe = 'https://example.substack.com/subscribe?one=1&two=2';
  assert.doesNotThrow(() => validateContent(config, notes, links));
  const markup = renderChannels(config);
  assert.match(markup, /href="https:\/\/cal.com\/example\/intro\?one=1&amp;two=2"/);
  assert.match(markup, /href="https:\/\/example.substack.com\/subscribe\?one=1&amp;two=2"/);
  assert.doesNotMatch(markup, /<form|disabled/);
});

test('Buttondown usernames reject URL paths, email addresses, and injected markup', () => {
  for (const username of ['../other', 'me@example.com', 'https://buttondown.com/me', 'a" onsubmit="bad', null, '']) {
    const { config, notes, links } = fixture(); config.newsletter.buttondownUsername = username;
    if (username === '') assert.doesNotThrow(() => validateContent(config, notes, links));
    else assert.throws(() => validateContent(config, notes, links), /Buttondown username/);
  }
});
