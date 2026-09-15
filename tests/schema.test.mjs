import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const schema = JSON.parse(
  await readFile(new URL('../frontmatter.schema.json', import.meta.url), 'utf8'),
);
const { extractFrontmatter, renderDocument, validateFrontmatter } = await import(
  '@cruciblesoftware/fieldnotes-renderer'
);
const { conformanceCases } = await import(
  '@cruciblesoftware/fieldnotes-renderer/conformance'
);

const requiredFrontmatter = {
  title: 'A post title',
  description: 'A useful summary.',
  date: '2026-09-15',
  category: 'Development',
};

const expectedConformance = {
  'kitchen-sink': {
    normalizedHtml: `<h1 id="excluded-title">Excluded title</h1>
<h2 id="observe">Observe</h2>
<p>Visible prose with <strong>strong text</strong>, <a href="https://example.com/docs">linked words</a>, and <code>ignored code</code>.</p>
<h3 id="compare">Compare</h3>
<ul class="contains-task-list">
<li class="task-list-item"><input checked disabled type="checkbox"> Finished task</li>
<li>Plain list item</li>
</ul>
<blockquote>
<p>Quoted evidence.</p>
</blockquote>













<table><thead><tr><th>Signal</th><th>Meaning</th></tr></thead><tbody><tr><td>Fresh</td><td><del>Not stale</del></td></tr></tbody></table>
<p>Footnote claim.<sup><a aria-describedby="footnote-label" data-footnote-ref="" href="#user-content-fn-source" id="user-content-fnref-source">1</a></sup></p>
<pre><code class="hljs language-javascript"><span class="code-line" data-highlighted-line="true"><span class="hljs-keyword">const</span> one = <span class="hljs-number">1</span>;</span>
<span class="code-line"><span class="hljs-keyword">const</span> two = <span class="hljs-number">2</span>;</span>
<span class="code-line" data-highlighted-line="true"><span class="hljs-keyword">const</span> three = <span class="hljs-number">3</span>;</span></code></pre>
<p>Inline math <span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mrow><mi>x</mi></mrow><annotation encoding="application/x-tex">x</annotation></semantics></math></span><span aria-hidden="true" class="katex-html"><span class="base"><span class="strut" style="height:0.4306em;"></span><span class="mord mathnormal">x</span></span></span></span>.</p>
<figure><img alt="Local chart" src="images/chart.svg" title="Gateway status"><figcaption>Gateway status</figcaption></figure>
<figure><img alt="Remote chart" src="https://cdn.example.com/chart.png" title="Remote status"><figcaption>Remote status</figcaption></figure>
<p><a id="stable-boundary"></a></p>
<h2 id="stable-boundary">Observe</h2>
<p>Stable section.</p>
<section class="footnotes" data-footnotes=""><h2 class="sr-only" id="footnote-label">Footnotes</h2>
<ol>
<li id="user-content-fn-source">
<p>Supporting evidence. <a aria-label="Back to reference 1" class="data-footnote-backref" data-footnote-backref="" href="#user-content-fnref-source">↩</a></p>
</li>
</ol>
</section>`,
    toc: [
      {
        depth: 2,
        id: 'observe',
        text: 'Observe',
        children: [{ depth: 3, id: 'compare', text: 'Compare', children: [] }],
      },
      { depth: 2, id: 'stable-boundary', text: 'Observe', children: [] },
    ],
  },
  'unsafe-html': {
    normalizedHtml: `<h2 id="safe-heading">Safe heading</h2>

<img alt="Unsafe" src="images/unsafe.png">
<p><a>Unsafe link</a></p>
<p></p>

<iframe allowfullscreen height="315" sandbox="allow-scripts allow-same-origin allow-presentation" src="https://www.youtube-nocookie.com/embed/abc-123?start=10" title="Allowed video" width="560"></iframe>`,
    toc: [{ depth: 2, id: 'safe-heading', text: 'Safe heading', children: [] }],
  },
  malformed: {
    normalizedHtml: `<h2 id="still-rendered">Still rendered</h2>
<p>An **unclosed emphasis marker and [unfinished link]( remain ordinary Markdown input.</p>`,
    toc: [{ depth: 2, id: 'still-rendered', text: 'Still rendered', children: [] }],
  },
  mermaid: {
    normalizedHtml: `<h2 id="diagrams">Diagrams</h2>
<pre class="fieldnotes-mermaid" data-fieldnotes-mermaid="sha256:be6e5b8b1c618acd6c44fe4bd3a64c08c5cab4513858b256e5f3db2e73cfcdb5">flowchart LR
  A[Observe] --> B[Act]</pre>
<pre class="fieldnotes-mermaid" data-fieldnotes-mermaid="sha256:e7eed9ac64e8639b0ad8dc66181f0e8b045a82bca75dd68d80571be0eefb2ed9">not a valid mermaid diagram</pre>`,
    toc: [{ depth: 2, id: 'diagrams', text: 'Diagrams', children: [] }],
  },
};

function errorsFor(value) {
  return validateFrontmatter(value, schema).filter(({ severity }) => severity === 'error');
}

function normalizeDefaults(value) {
  return Object.fromEntries(
    Object.entries(schema.properties).flatMap(([key, definition]) => {
      if (Object.hasOwn(value, key)) return [[key, value[key]]];
      return Object.hasOwn(definition, 'default') ? [[key, definition.default]] : [];
    }),
  );
}

test('blog schema accepts the supported post frontmatter contract', () => {
  assert.deepEqual(errorsFor(requiredFrontmatter), []);
  assert.deepEqual(
    errorsFor({
      ...requiredFrontmatter,
      category: 'AI & ML',
      tags: ['rendering', 'swift'],
      draft: true,
      featured: true,
    }),
    [],
  );
});

test('blog schema rejects retired and unknown frontmatter fields', () => {
  for (const extra of [
    { sample: true },
    { readingMinutes: 4 },
    { sections: [] },
    { slug: 'derived-from-directory' },
    { body: 'derived-from-Markdown' },
    { arbitrary: true },
  ]) {
    const diagnostics = errorsFor({ ...requiredFrontmatter, ...extra });
    assert.ok(
      diagnostics.some(({ code }) => code === 'schema.additionalProperties'),
      `expected additionalProperties diagnostic for ${Object.keys(extra)[0]}`,
    );
  }
});

test('blog schema accepts quoted and unquoted ISO dates as the same string value', () => {
  for (const dateSource of ['2026-09-15', '"2026-09-15"']) {
    const source = `---
title: A post title
description: A useful summary.
date: ${dateSource}
category: Development
---

# Body
`;
    const extracted = extractFrontmatter(source);

    assert.deepEqual(extracted.diagnostics, []);
    assert.equal(extracted.data.date, '2026-09-15');
    assert.deepEqual(errorsFor(extracted.data), []);
  }
});

test('blog schema normalizes absent optional defaults in memory', () => {
  const normalized = normalizeDefaults(requiredFrontmatter);

  assert.deepEqual(normalized, {
    ...requiredFrontmatter,
    tags: [],
    draft: false,
    featured: false,
  });
  assert.equal(Object.hasOwn(requiredFrontmatter, 'tags'), false);
});

test('matches every published renderer conformance fixture', async () => {
  assert.deepEqual(
    conformanceCases.map(({ name }) => name).sort(),
    Object.keys(expectedConformance).sort(),
  );

  for (const fixture of conformanceCases) {
    const rendered = await renderDocument(fixture.source, fixture.options);
    assert.equal(
      rendered.normalizedHtml,
      expectedConformance[fixture.name].normalizedHtml,
      `${fixture.name}: normalizedHtml`,
    );
    assert.deepEqual(rendered.toc, expectedConformance[fixture.name].toc, `${fixture.name}: toc`);
  }
});
