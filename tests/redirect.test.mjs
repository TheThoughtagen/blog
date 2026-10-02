import test from 'node:test';
import assert from 'node:assert/strict';
import { legacyRedirect, onRequest } from '../functions/_middleware.js';

test('legacy Crucible URLs redirect permanently to the same path and query on patrickmannion.dev', () => {
  assert.equal(legacyRedirect('https://thoughts.cruciblesoftware.co/notes/icc-2026-recap-review/?utm_source=linkedin'), 'https://patrickmannion.dev/notes/icc-2026-recap-review/?utm_source=linkedin');
  assert.equal(legacyRedirect('https://thoughts.cruciblesoftware.co/'), 'https://patrickmannion.dev/');
  assert.equal(legacyRedirect('http://THOUGHTS.cruciblesoftware.co/feed.xml'), 'https://patrickmannion.dev/feed.xml');
});

test('the canonical domain and preview hosts are served without a redirect', () => {
  assert.equal(legacyRedirect('https://patrickmannion.dev/notes/'), null);
  assert.equal(legacyRedirect('https://fieldnotes.pages.dev/'), null);
  assert.equal(legacyRedirect('https://cruciblesoftware.co/'), null);
});

test('middleware answers legacy hosts with a 301 and passes everything else to static assets', async () => {
  const redirected = await onRequest({ request: new Request('https://thoughts.cruciblesoftware.co/about/'), next: () => assert.fail('legacy host must not reach assets') });
  assert.equal(redirected.status, 301);
  assert.equal(redirected.headers.get('Location'), 'https://patrickmannion.dev/about/');
  const asset = new Response('ok');
  assert.equal(await onRequest({ request: new Request('https://patrickmannion.dev/about/'), next: () => asset }), asset);
});
