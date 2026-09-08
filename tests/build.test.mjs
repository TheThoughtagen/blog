import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, renderFeed, validateContent, renderEmailSignup, renderChannels } from '../scripts/build.mjs';
import { site } from '../site.config.mjs';
import { articles } from '../content/articles.mjs';
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
    },
    notes: [{
      slug: 'first-note', title: 'First note', description: 'A useful note.',
      date: '2024-02-29', category: 'Development', tags: ['Testing'],
      readingMinutes: 2, featured: true, sample: true,
      sections: [{ id: 'the-boundary', title: 'The boundary', paragraphs: ['Use plain text.'] }],
    }],
    links: [{
      title: 'An external post', description: 'Published elsewhere.',
      url: 'https://example.substack.com/p/a-post', source: 'Substack',
      date: '2024-02-29', category: 'Leadership', tags: [],
    }],
  };
}

test('validateContent accepts the checked-in configuration and content', () => {
  assert.doesNotThrow(() => validateContent(site, articles, externalPosts));
});

test('validateContent accepts configured profiles, six repositories, membership, and crossposts', () => {
  const { config, notes, links } = fixture();
  config.github.repositories = Array.from({ length: 6 }, (_, i) => `example-owner/project-${i}`);
  config.links.patreon = 'https://www.patreon.com/example';
  config.membership = { enabled: true, url: 'https://members.example/join' };
  links.push({ ...links[0], source: 'LinkedIn', url: 'https://www.linkedin.com/posts/example' });
  notes[0].sample = false;
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

test('validateContent requires one featured note and unique URL-safe slugs', () => {
  const { config, notes, links } = fixture();
  assert.throws(() => validateContent(config, [], links), /exactly one featured/);
  assert.throws(() => validateContent(config, [{ ...notes[0], featured: false }], links), /exactly one featured/);
  assert.throws(() => validateContent(config, [...notes, { ...notes[0], slug: 'second-note' }], links), /exactly one featured/);
  assert.throws(() => validateContent(config, [...notes, { ...notes[0], featured: false }], links), /slugs must be unique/);
  for (const slug of ['../escape', 'Title', 'a/b', 'note.html', 'note" onclick="alert(1)', '']) {
    assert.throws(() => validateContent(config, [{ ...notes[0], slug }], links), /URL-safe/, slug);
  }
});

test('validateContent rejects invalid article metadata and unsafe or duplicate section IDs', () => {
  const cases = [
    ['empty title', (note) => { note.title = ''; }, /Invalid metadata/],
    ['empty description', (note) => { note.description = ''; }, /Invalid metadata/],
    ['unknown category', (note) => { note.category = 'Unknown'; }, /Invalid metadata/],
    ['impossible date', (note) => { note.date = '2023-02-29'; }, /Invalid metadata/],
    ['non-ISO date', (note) => { note.date = 'February 29, 2024'; }, /Invalid metadata/],
    ['non-array tags', (note) => { note.tags = 'Testing'; }, /Invalid article/],
    ['zero reading time', (note) => { note.readingMinutes = 0; }, /Invalid article/],
    ['fractional reading time', (note) => { note.readingMinutes = 1.5; }, /Invalid article/],
    ['no sections', (note) => { note.sections = []; }, /Invalid article/],
    ['unsafe section ID', (note) => { note.sections[0].id = 'x" onclick="alert(1)'; }, /Invalid section/],
    ['duplicate section ID', (note) => { note.sections.push({ ...note.sections[0] }); }, /Invalid section/],
    ['missing section title', (note) => { note.sections[0].title = ''; }, /Invalid section/],
    ['non-array paragraphs', (note) => { note.sections[0].paragraphs = 'A paragraph'; }, /Invalid section/],
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

test('escapeHtml escapes markup, ampersands, both quote types, and stringifies values', () => {
  assert.equal(escapeHtml(`<script title="a&b">'x'</script>`), '&lt;script title=&quot;a&amp;b&quot;&gt;&#39;x&#39;&lt;/script&gt;');
  assert.equal(escapeHtml('&lt;'), '&amp;lt;');
  assert.equal(escapeHtml(42), '42');
  assert.equal(escapeHtml('Plain text'), 'Plain text');
});

test('renderFeed emits absolute permalinks, escaped XML, and labels only sample notes', () => {
  const { config, notes } = fixture();
  config.name = 'Notes & <systems>';
  config.description = '"People" & systems';
  notes[0].title = '<Demo> & "example"';
  notes[0].description = "Don't <guess> & ship.";
  notes[0].category = 'AI & ML';
  notes.push({ ...notes[0], slug: 'real-note', title: 'Original note', description: 'Actual writing.', sample: false, featured: false });
  const feed = renderFeed(config, notes);
  assert.match(feed, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.ok(feed.includes('<title>Notes &amp; &lt;systems&gt;</title>'));
  assert.ok(feed.includes('<description>&quot;People&quot; &amp; systems</description>'));
  assert.ok(feed.includes('<title>&lt;Demo&gt; &amp; &quot;example&quot; [Sample]</title>'));
  assert.ok(feed.includes('<description>Sample article for the site preview. Don&#39;t &lt;guess&gt; &amp; ship.</description>'));
  assert.ok(feed.includes('<category>AI &amp; ML</category>'));
  assert.ok(feed.includes('<pubDate>Thu, 29 Feb 2024 12:00:00 GMT</pubDate>'));
  assert.ok(feed.includes('<title>Original note</title>'));
  assert.ok(feed.includes('<description>Actual writing.</description>'));
  assert.equal((feed.match(/\[Sample\]/g) || []).length, 1);
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
