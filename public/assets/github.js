const allowedRepo = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[\w.-]+$/i;

export function githubUrl(value, fallback = '') {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'github.com' && !url.username && !url.password ? url.href : fallback;
  } catch { return fallback; }
}

export function parseActivity(events, limit = 5) {
  if (!Array.isArray(events)) return [];
  return events.flatMap((event) => {
    if (!event || typeof event !== 'object') return [];
    const repo = event.repo?.name;
    if (!allowedRepo.test(repo || '') || !Number.isFinite(Date.parse(event.created_at))) return [];
    const payload = event.payload || {};
    const base = `https://github.com/${repo}`;
    const branch = typeof payload.ref === 'string' ? payload.ref.replace(/^refs\/heads\//, '') : '';
    let title;
    let url = base;
    switch (event.type) {
      case 'PushEvent': title = branch ? `Pushed to ${branch}` : 'Pushed an update'; break;
      case 'PullRequestEvent': title = `${payload.action || 'Updated'} pull request: ${payload.pull_request?.title || 'Untitled'}`; url = githubUrl(payload.pull_request?.html_url, base); break;
      case 'IssuesEvent': title = `${payload.action || 'Updated'} issue: ${payload.issue?.title || 'Untitled'}`; url = githubUrl(payload.issue?.html_url, base); break;
      case 'ReleaseEvent': title = `Released ${payload.release?.tag_name || 'a new version'}`; url = githubUrl(payload.release?.html_url, base); break;
      case 'CreateEvent': title = `Created ${payload.ref_type || 'a reference'}${payload.ref ? `: ${payload.ref}` : ''}`; break;
      case 'WatchEvent': title = 'Starred repository'; break;
      case 'ForkEvent': title = 'Forked repository'; url = githubUrl(payload.forkee?.html_url, base); break;
      case 'IssueCommentEvent': title = `Commented on: ${payload.issue?.title || 'an issue or pull request'}`; url = githubUrl(payload.comment?.html_url, base); break;
      case 'PullRequestReviewEvent': title = `Reviewed pull request: ${payload.pull_request?.title || 'Untitled'}`; url = githubUrl(payload.review?.html_url, base); break;
      case 'PullRequestReviewCommentEvent': title = 'Commented on a pull request review'; url = githubUrl(payload.comment?.html_url, base); break;
      case 'CommitCommentEvent': title = 'Commented on a commit'; url = githubUrl(payload.comment?.html_url, base); break;
      case 'DeleteEvent': title = `Deleted ${payload.ref_type || 'a reference'}${payload.ref ? `: ${payload.ref}` : ''}`; break;
      case 'PublicEvent': title = 'Made repository public'; break;
      case 'GollumEvent': title = 'Updated the wiki'; url = `${base}/wiki`; break;
      case 'MemberEvent': title = 'Updated repository collaborators'; break;
      default: return [];
    }
    return [{ repo, title: title.charAt(0).toUpperCase() + title.slice(1), url, date: event.created_at }];
  }).slice(0, limit);
}

export function parseReleases(releases, repo) {
  if (!allowedRepo.test(repo || '') || !Array.isArray(releases)) return [];
  return releases.filter((release) => release && !release.draft && release.published_at && Number.isFinite(Date.parse(release.published_at)) && githubUrl(release.html_url)).map((release) => ({ repo, title: release.name || release.tag_name || 'Release', url: githubUrl(release.html_url), date: release.published_at }));
}

export async function requestGithub(path, fetcher = fetch) {
  const response = await fetcher(`https://api.github.com/${path}`, { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, signal: AbortSignal.timeout(8000), credentials: 'omit' });
  if (!response.ok) {
    if (response.status === 403 || response.status === 429) throw new Error('GitHub is limiting requests. Please try again later.');
    if (response.status === 404) throw new Error('This public GitHub account or repository could not be found.');
    throw new Error('GitHub is temporarily unavailable. Please try again.');
  }
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('GitHub returned an unexpected response.');
  return data;
}

export async function connectGithub(config) {
  const panels = [...document.querySelectorAll('[data-github]')];
  if (!panels.length || (!config.username && !config.repositories.length)) return;
  let eventRequest;
  let snapshotRequest;
  const snapshot = () => snapshotRequest ||= fetch('/assets/github-stats.json').then(response => {
    if (!response.ok) throw new Error('The GitHub snapshot is unavailable. Please try again later.');
    return response.json();
  });
  const events = () => eventRequest ||= requestGithub(`users/${encodeURIComponent(config.username)}/events/public?per_page=100`);
  const message = (panel, text, retry) => {
    const box = document.createElement('div'); box.className = 'github-message';
    const paragraph = document.createElement('p'); paragraph.textContent = text; box.append(paragraph);
    if (retry) { const button = document.createElement('button'); button.textContent = 'Retry connection'; button.addEventListener('click', retry); box.append(button); }
    panel.replaceChildren(box);
  };
  for (const panel of panels) {
    const type = panel.dataset.github;
    if (type === 'activity' && !config.username) continue;
    const load = async () => {
      panel.setAttribute('aria-busy', 'true');
      message(panel, 'Connecting to GitHub...');
      try {
        let items;
        let failures = 0;
        if (type === 'activity') items = parseActivity(await events(), location.pathname === '/lab/' ? 15 : 5);
        else if (type === 'commits') items = (await snapshot()).recentCommits || [];
        else if (config.repositories.length) {
          const results = await Promise.allSettled(config.repositories.map(async (repo) => parseReleases(await requestGithub(`repos/${repo}/releases?per_page=3`), repo)));
          failures = results.filter((result) => result.status === 'rejected').length;
          if (failures === results.length) throw results[0].reason;
          items = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 6);
        } else items = (await snapshot()).releases || [];
        if (!items.length) message(panel, type === 'activity' ? 'No recent public development activity in GitHub\'s available event window.' : type === 'commits' ? 'No public commits found in the latest snapshot.' : 'No published releases found in the public repositories.');
        else {
          panel.replaceChildren();
          for (const item of items) {
            const link = document.createElement('a'); link.className = 'github-event'; link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
            const repo = document.createElement('strong'); repo.textContent = item.repo;
            const title = document.createElement('span'); title.textContent = item.title;
            const date = document.createElement('time'); date.dateTime = item.date; date.textContent = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(item.date));
            link.append(repo, title, date); panel.append(link);
          }
        }
        if (failures) { const warning = document.createElement('p'); warning.className = 'github-message'; warning.textContent = `${failures} repository feed(s) could not be loaded. Other releases are shown.`; panel.append(warning); }
      } catch (error) {
        message(panel, error.name === 'TimeoutError' || error.name === 'AbortError' ? 'The GitHub connection timed out.' : error.message === 'Failed to fetch' ? 'Could not reach GitHub. Check your connection and try again.' : error.message, () => { eventRequest = null; snapshotRequest = null; load(); });
      } finally { panel.removeAttribute('aria-busy'); }
    };
    load();
  }
}
