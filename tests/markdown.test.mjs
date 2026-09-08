import test from 'node:test';
import assert from 'node:assert/strict';
import { renderMarkdown } from '../scripts/markdown.mjs';
import { site } from '../site.config.mjs';
import { articles } from '../content/articles.mjs';
test('Markdown keeps sample status, all sections, tags, and canonical source', () => {
  const note = articles[0];
  const md = renderMarkdown(site, note);
  assert.ok(md.startsWith(`# ${note.title}\n`));
  assert.match(md, /> Sample note: demonstration content/);
  assert.ok(md.includes(new URL(`/notes/${note.slug}/`, site.siteUrl).href));
  for (const section of note.sections) assert.ok(md.includes(`## ${section.title}`));
  assert.ok(md.includes(note.sections[1].code.text));
  assert.match(md, /Tags: Testing, Change control, Reliability/);
  assert.ok(!md.includes(`By ${site.author}`));
});
test('Markdown fences nested backticks and preserves lists, quotes, and literal text', () => {
  const note = { ...articles[0], sample: false, title: 'Literal *stars*', sections: [{
    title: 'A section', paragraphs: ['[link](https://example.com)', '<script>'],
    code: { language: 'markdown', text: '```js\nexample\n```' },
    list: ['One', 'Two\ncontinued'], quote: 'First\nSecond',
  }] };
  const md = renderMarkdown(site, note);
  assert.ok(md.includes('By Patrick Mannion'));
  assert.ok(md.includes('Literal \\*stars\\*'));
  assert.ok(md.includes('\\[link\\]'));
  assert.ok(md.includes('\\<script\\>'));
  assert.ok(md.includes('````markdown\n```js\nexample\n```\n````'));
  assert.ok(md.includes('- One\n- Two\n  continued'));
  assert.ok(md.includes('> First\n> Second'));
});
