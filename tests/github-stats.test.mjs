import test from 'node:test';
import assert from 'node:assert/strict';
import { statsSnapshot, collectShowcase } from '../scripts/github-stats.mjs';

test('showcase discovers public repositories and releases beyond the event window', async () => {
  const paths = [];
  const showcase = await collectShowcase('example', async path => {
    paths.push(path);
    if (path.startsWith('users/')) return [{ full_name: 'example/old-project', private: false }, { full_name: 'example/private', private: true }];
    if (path.startsWith('repos/')) return [{ name: 'Older release', published_at: '2023-01-01T00:00:00Z', html_url: 'https://github.com/example/old-project/releases/tag/v1' }];
    return { items: [{ repository: { full_name: 'other/project', private: false }, html_url: 'https://github.com/other/project/commit/abcdef123', commit: { message: 'Fix the parser\nDetails', committer: { date: '2026-09-08T00:00:00Z' } }, sha: 'abcdef123' }], incomplete_results: false };
  });
  assert.equal(showcase.releases[0].title, 'Older release');
  assert.equal(showcase.recentCommits[0].title, 'Fix the parser');
  assert.equal(showcase.recentCommits[0].repo, 'other/project');
  assert.equal(paths.some(path => path.includes('example/private')), false);
  assert.match(decodeURIComponent(paths.at(-1)), /author:example is:public/);
});

test('showcase follows repository and release pagination', async () => {
  const paths = [];
  const repos = Array.from({ length: 100 }, (_, i) => ({ full_name: `example/repo${i}`, private: i > 0 }));
  const release = { name: 'v1', published_at: '2020-01-01T00:00:00Z', html_url: 'https://github.com/example/repo0/releases/tag/v1' };
  await collectShowcase('example', async path => {
    paths.push(path);
    if (path.startsWith('users/')) return path.endsWith('page=1') ? repos : [];
    if (path.startsWith('repos/')) return path.endsWith('page=1') ? Array(100).fill(release) : [];
    return { items: [], incomplete_results: false };
  });
  assert.ok(paths.includes('users/example/repos?type=owner&per_page=100&page=2'));
  assert.ok(paths.includes('repos/example/repo0/releases?per_page=100&page=2'));
});

test('contribution snapshot projects only aggregate data and preserves calendar alignment', () => {
  const result = { data: { user: {
    repositories: { totalCount: 7 }, followers: { totalCount: 12 }, secret: 'not-for-output',
    contributionsCollection: {
      startedAt: '2025-09-08T00:00:00Z', endedAt: '2026-09-08T00:00:00Z',
      restrictedContributionsCount: 3, totalCommitContributions: 10,
      totalPullRequestContributions: 2, totalPullRequestReviewContributions: 4, totalIssueContributions: 1,
      contributionCalendar: { totalContributions: 20, weeks: [{ contributionDays: [
        { date: '2025-09-08', weekday: 1, contributionCount: 2, contributionLevel: 'FIRST_QUARTILE', other: 'ignore' },
        { date: '2025-09-09', weekday: 2, contributionCount: 0, contributionLevel: 'NONE' },
      ] }] },
    },
  } } };
  const snapshot = statsSnapshot(result, 'example', new Date('2026-09-08T00:00:00Z'));
  assert.equal(snapshot.commits, 10);
  assert.equal(snapshot.total, 20);
  assert.equal(snapshot.restricted, 3);
  assert.deepEqual(snapshot.days, [
    { date: '2025-09-08', weekday: 1, count: 2, level: 1 },
    { date: '2025-09-09', weekday: 2, count: 0, level: 0 },
  ]);
  assert.equal(JSON.stringify(snapshot).includes('not-for-output'), false);
});

test('missing or partially failed GraphQL data never becomes fake zero totals', () => {
  for (const result of [{}, { data: { user: null } }, { errors: [{ message: 'Unavailable' }], data: { user: {} } }]) {
    assert.throws(() => statsSnapshot(result, 'example'), /unavailable/);
  }
});
