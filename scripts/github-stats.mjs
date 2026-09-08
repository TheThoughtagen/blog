import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { site } from '../site.config.mjs';
import { parseReleases, githubUrl } from '../public/assets/github.js';

export async function collectShowcase(username, request) {
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await request(`users/${encodeURIComponent(username)}/repos?type=owner&per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('Invalid repository response.');
    repos.push(...batch.filter(repo => repo.private === false));
    if (batch.length < 100) break;
  }
  const releases = [];
  for (const repo of repos) {
    for (let page = 1; ; page++) {
      const batch = await request(`repos/${repo.full_name}/releases?per_page=100&page=${page}`);
      if (!Array.isArray(batch)) throw new Error('Invalid release response.');
      releases.push(...parseReleases(batch, repo.full_name));
      if (batch.length < 100) break;
    }
  }
  const result = await request(`search/commits?q=${encodeURIComponent(`author:${username} is:public`)}&sort=committer-date&order=desc&per_page=30`);
  if (!Array.isArray(result.items) || result.incomplete_results) throw new Error('Incomplete commit search.');
  const commits = result.items.filter(item => item.repository?.private === false && githubUrl(item.html_url)).map(item => ({
    repo: item.repository.full_name, url: githubUrl(item.html_url),
    title: item.commit.message.split('\n')[0], date: item.commit.committer.date, sha: item.sha.slice(0, 7),
  }));
  return { releases: releases.sort((a, b) => Date.parse(b.date) - Date.parse(a.date)), recentCommits: commits };
}

export const query = `query($login: String!) {
  user(login: $login) {
    repositories(privacy: PUBLIC, ownerAffiliations: OWNER) { totalCount }
    followers { totalCount }
    contributionsCollection {
      startedAt endedAt restrictedContributionsCount
      totalCommitContributions totalPullRequestContributions
      totalPullRequestReviewContributions totalIssueContributions
      contributionCalendar { totalContributions weeks {
        contributionDays { date weekday contributionCount contributionLevel }
      } }
    }
  }
}`;

export function statsSnapshot(result, username, now = new Date()) {
  if (result.errors?.length || !result.data?.user?.contributionsCollection) throw new Error('GitHub contribution data unavailable.');
  const user = result.data.user;
  const c = user.contributionsCollection;
  return { username, updatedAt: now.toISOString(), from: c.startedAt, to: c.endedAt,
    repositories: user.repositories.totalCount, followers: user.followers.totalCount,
    commits: c.totalCommitContributions, pullRequests: c.totalPullRequestContributions,
    reviews: c.totalPullRequestReviewContributions, issues: c.totalIssueContributions,
    restricted: c.restrictedContributionsCount,
    total: c.contributionCalendar.totalContributions,
    days: c.contributionCalendar.weeks.flatMap(week => week.contributionDays.map(day => ({
      date: day.date, weekday: day.weekday, count: day.contributionCount,
      level: ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'].indexOf(day.contributionLevel),
    }))),
  };
}

export async function syncStats() {
  // Run with the repository's read-only Actions token, never a personal token.
  // That viewer cannot read Patrick's other private repositories.
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_TOKEN) throw new Error('Refresh stats in GitHub Actions with its repository token.');
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: site.github.username } }), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`GitHub stats request failed (${response.status}).`);
  const snapshot = statsSnapshot(await response.json(), site.github.username);
  Object.assign(snapshot, await collectShowcase(site.github.username, async path => {
    const response = await fetch(`https://api.github.com/${path}`, {
      headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`GitHub showcase request failed (${response.status}).`);
    return response.json();
  }));
  await writeFile(new URL('../dist/assets/github-stats.json', import.meta.url), JSON.stringify(snapshot));
  console.log('Updated public GitHub contribution snapshot.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await syncStats();
