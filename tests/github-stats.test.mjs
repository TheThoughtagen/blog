import test from 'node:test';
import assert from 'node:assert/strict';
import { statsSnapshot } from '../scripts/github-stats.mjs';

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
