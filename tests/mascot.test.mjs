import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { renderMascot } from '../scripts/mascot.mjs';

test('artwork renderer uses the original image with dimensions and descriptive alt text', () => {
  const markup = renderMascot();
  assert.match(markup, /src="\/assets\/patrick-terminal.jpg"/);
  assert.match(markup, /width="1024" height="572"/);
  assert.match(markup, /alt="A bearded character in a baseball cap giving a thumbs-up/);
  assert.match(markup, /fetchpriority="high"/);
});

test('artwork is an unmodified static image, not reconstructed SVG or pretend poses', () => {
  const markup = renderMascot();
  assert.doesNotMatch(markup, /<svg|<script|data-action|walking|winking|backwards|\bid=/i);
  assert.equal((markup.match(/<img /g) || []).length, 1);
});

test('published artwork is byte-identical to the supplied original JPEG', async () => {
  const bytes = await readFile(new URL('../public/assets/patrick-terminal.jpg', import.meta.url));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
  assert.equal(bytes.length, 118475);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '6c396868eef2492340d48f365ef60a97a4467af0830e39c42daaf8a32688a252');
});
