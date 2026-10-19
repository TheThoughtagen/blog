import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { portfolio, demos, workbenchVideos, portalFilm, portfolioSearchEntries } from '../content/work.mjs';
import evidence from '../content/work-evidence.json' with { type: 'json' };
import { validatePortfolio, renderWorkPage } from '../scripts/portfolio.mjs';

test('each featured recording is byte-identical to its imported project artifact', async () => {
  assert.equal(evidence.length, demos.length + workbenchVideos.length + 1);
  for (const item of evidence) {
    const bytes = await readFile(new URL(`../public${item.path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.path);
    if (item.path.endsWith('.cast')) {
      const [header, ...events] = bytes.toString().trim().split('\n').map(line => JSON.parse(line));
      assert.equal(header.version, 2);
      assert.ok(events.some(event => event[1] === 'o' && event[2].length > 0), item.path);
    } else assert.equal(bytes.subarray(4, 8).toString(), 'ftyp', item.path);
  }
});

test('portfolio uses real media and removes the substitute demo destinations', () => {
  assert.doesNotThrow(validatePortfolio);
  const markup = renderWorkPage();
  assert.equal((markup.match(/<video /g) || []).length, workbenchVideos.length + 1);
  assert.match(markup, /customer-portal\.mp4\?v=/);
  assert.match(markup, /DEMONSTRATION DATA/);
  assert.match(markup, /data-terminal-player/);
  assert.match(markup, /Whiskey House sign-in required/);
  assert.doesNotMatch(markup, /\/demos\/traceability|\/demos\/data-contracts|Illustrative demo|Try a live demo/);
  assert.ok(portfolioSearchEntries().every(entry => entry.url.startsWith('/work/')));
});

test('every video poster is an available extracted frame', async () => {
  for (const video of [...workbenchVideos, portalFilm]) {
    const bytes = await readFile(new URL(`../public/assets/work/${video.poster}.jpg`, import.meta.url));
    assert.equal(bytes.readUInt16BE(0), 0xffd8, video.poster);
  }
});

test('portfolio validation rejects unsafe URLs and recordings without source evidence', () => {
  const project = portfolio.openSource[0];
  const original = project.source;
  try { project.source = 'javascript:alert(1)'; assert.throws(validatePortfolio, /Invalid portfolio URL/); }
  finally { project.source = original; }
  const recording = demos[0];
  const cast = recording.cast;
  try { recording.cast = '/assets/recordings/invented.cast'; assert.throws(validatePortfolio, /Missing recording evidence/); }
  finally { recording.cast = cast; }
});
