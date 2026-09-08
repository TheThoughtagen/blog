import test from 'node:test';
import assert from 'node:assert/strict';
import { parseActivity, parseReleases, requestGithub } from '../public/assets/github.js';

const repo = 'example-owner/project';
const base = `https://github.com/${repo}`;
const date = '2024-02-29T12:00:00Z';
const event = (type, payload = {}) => ({ type, repo: { name: repo }, created_at: date, payload });
const release = (overrides = {}) => ({ name: 'Version 1', tag_name: 'v1', html_url: `${base}/releases/tag/v1`, published_at: date, draft: false, ...overrides });
const unsafeUrls = ['javascript:alert(1)', 'http://github.com/owner/repo', 'https://github.com.evil.example/owner/repo',
  'https://evil.example/owner/repo', 'https://github.com@evil.example/owner/repo',
  'https://user:secret@github.com/owner/repo', '//github.com/owner/repo', '/owner/repo', 'not a URL'];

test('parseActivity maps supported events and limits output after filtering', () => {
  const supported = [
    event('PushEvent', { ref: 'refs/heads/main' }),
    event('PullRequestEvent', { action: 'opened', pull_request: { title: 'Add tests', html_url: `${base}/pull/1` } }),
    event('IssuesEvent', { action: 'closed', issue: { title: 'A bug', html_url: `${base}/issues/2` } }),
    event('ReleaseEvent', { release: { tag_name: 'v1', html_url: `${base}/releases/tag/v1` } }),
    event('CreateEvent', { ref_type: 'branch', ref: 'experiment' }),
  ];
  const expected = [
    ['Pushed to main', base], ['Opened pull request: Add tests', `${base}/pull/1`],
    ['Closed issue: A bug', `${base}/issues/2`], ['Released v1', `${base}/releases/tag/v1`],
    ['Created branch: experiment', base],
  ].map(([title, url]) => ({ repo, title, url, date }));
  assert.deepEqual(parseActivity([event('WatchEvent'), ...supported, event('PushEvent')]), expected);
});

test('parseActivity tolerates unknown and malformed data without losing valid events', () => {
  for (const input of [undefined, null, {}, 'not an array', 42]) assert.deepEqual(parseActivity(input), []);
  const malformed = [null, undefined, {}, 42, 'invalid',
    event('UnknownEvent'), { ...event('PushEvent'), repo: null },
    { ...event('PushEvent'), repo: { name: '../unsafe/repo' } },
    { ...event('PushEvent'), created_at: 'not a date' },
    event('UnknownEvent', { ref: {} }),
  ];
  const valid = { repo, title: 'Pushed an update', url: base, date };
  assert.deepEqual(parseActivity([...malformed, event('PushEvent', null)]), [valid]);
  assert.deepEqual(parseActivity([event('PushEvent', { ref: 42 })]), [valid]);
  assert.deepEqual(parseActivity([event('PullRequestEvent'), event('IssuesEvent'), event('ReleaseEvent')]).map((item) => item.title), [
    'Updated pull request: Untitled', 'Updated issue: Untitled', 'Released a new version',
  ]);
});

test('parseActivity falls back to the repository for unsafe issue, pull request, and release URLs', () => {
  for (const [type, key] of [['PullRequestEvent', 'pull_request'], ['IssuesEvent', 'issue'], ['ReleaseEvent', 'release']]) {
    for (const html_url of [...unsafeUrls, null, undefined]) {
      const result = parseActivity([event(type, { [key]: { html_url } })]);
      assert.equal(result.length, 1);
      assert.equal(result[0].url, base, `${type}: ${html_url}`);
    }
  }
});

test('parseReleases keeps public releases with safe GitHub links and uses title fallbacks', () => {
  const named = release();
  const tagged = release({ name: '', tag_name: 'v2', prerelease: true, html_url: `${base}/releases/tag/v2` });
  const untitled = release({ name: '', tag_name: '', html_url: `${base}/releases/tag/v3` });
  const invalid = [release({ draft: true }), release({ published_at: null }), release({ published_at: 'invalid' }),
    ...unsafeUrls.map((html_url) => release({ html_url }))];
  assert.deepEqual(parseReleases([named, ...invalid, tagged, untitled], repo), [
    { repo, title: 'Version 1', url: named.html_url, date },
    { repo, title: 'v2', url: tagged.html_url, date },
    { repo, title: 'Release', url: untitled.html_url, date },
  ]);
});

test('parseReleases tolerates malformed collections and entries and rejects invalid repository names', () => {
  for (const input of [undefined, null, {}, 'invalid', 42]) assert.deepEqual(parseReleases(input, repo), []);
  for (const invalidRepo of ['', undefined, '../unsafe', 'owner', 'owner/repo/extra', 'https://github.com/owner/repo']) {
    assert.deepEqual(parseReleases([release()], invalidRepo), []);
  }
  assert.deepEqual(parseReleases([null, undefined, {}, 42, 'invalid', release()], repo), [
    { repo, title: 'Version 1', url: `${base}/releases/tag/v1`, date },
  ]);
});

test('requestGithub returns valid array data using the injected fetch and public API request options', async (t) => {
  for (const data of [[], [event('PushEvent')]]) {
    const fetcher = t.mock.fn(async () => Response.json(data));
    assert.deepEqual(await requestGithub('users/example/events/public?per_page=30', fetcher), data);
    assert.equal(fetcher.mock.callCount(), 1);
    const [url, options] = fetcher.mock.calls[0].arguments;
    assert.equal(url, 'https://api.github.com/users/example/events/public?per_page=30');
    assert.deepEqual(options.headers, { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
    assert.equal(options.credentials, 'omit');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.signal.aborted, false);
  }
});

test('requestGithub reports both rate-limit statuses without parsing their bodies', async (t) => {
  for (const status of [403, 429]) {
    const json = t.mock.fn();
    await assert.rejects(requestGithub('users/example/events/public', async () => ({ ok: false, status, json })), {
      message: 'GitHub is limiting requests. Please try again later.',
    });
    assert.equal(json.mock.callCount(), 0);
  }
});

test('requestGithub distinguishes missing public resources from other HTTP errors', async (t) => {
  for (const [status, message] of [
    [404, 'This public GitHub account or repository could not be found.'],
    [500, 'GitHub is temporarily unavailable. Please try again.'],
    [401, 'GitHub is temporarily unavailable. Please try again.'],
  ]) {
    const json = t.mock.fn();
    await assert.rejects(requestGithub('repos/example/project/releases', async () => ({ ok: false, status, json })), { message });
    assert.equal(json.mock.callCount(), 0);
  }
});

test('requestGithub rejects non-array data and propagates JSON and network failures', async () => {
  for (const data of [null, {}, { message: 'Unexpected' }, 'not an array', 42]) {
    await assert.rejects(requestGithub('users/example/events/public', async () => Response.json(data)), {
      message: 'GitHub returned an unexpected response.',
    });
  }
  await assert.rejects(requestGithub('users/example/events/public', async () => new Response('{broken JSON')), SyntaxError);
  const networkError = new TypeError('Failed to fetch');
  await assert.rejects(requestGithub('users/example/events/public', async () => { throw networkError; }), (error) => error === networkError);
});

test('requestGithub supplies an eight-second timeout and propagates signal-driven rejection', { timeout: 1000 }, async (t) => {
  const controller = new AbortController();
  // Substitute the clock, not the fetch rejection: the request must pass its timeout signal through.
  const timeout = t.mock.method(AbortSignal, 'timeout', () => controller.signal);
  const fetcher = t.mock.fn((_url, { signal }) => {
    assert.equal(signal, controller.signal);
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    });
  });
  const pending = requestGithub('users/example/events/public', fetcher);
  const reason = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
  const rejected = assert.rejects(pending, (error) => error === reason && error.name === 'TimeoutError');
  controller.abort(reason);
  await rejected;
  assert.equal(timeout.mock.callCount(), 1);
  assert.deepEqual(timeout.mock.calls[0].arguments, [8000]);
  assert.equal(fetcher.mock.callCount(), 1);
});
