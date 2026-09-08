const timelines = [...document.querySelectorAll('[data-x-timeline]')];
let widgetPromise;
function widgets() {
  return widgetPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js'; script.async = true;
    script.onload = () => window.twttr?.ready(resolve);
    script.onerror = reject;
    document.head.append(script);
  });
}
for (const host of timelines) {
  let active = false;
  let generation = 0;
  async function render() {
    const version = ++generation;
    const target = document.createElement('div');
    host.replaceChildren(target);
    try {
      const api = await widgets();
      if (version !== generation) return;
      await api.widgets.createTimeline({ sourceType: 'url', url: host.dataset.xTimeline }, target, {
        height: 460, theme: document.documentElement.dataset.theme === 'paper' ? 'light' : 'dark',
        chrome: 'noheader nofooter noborders transparent', dnt: true,
      });
    } catch { /* The permanent profile link remains available. */ }
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { active = true; observer.disconnect(); render(); }
  }, { rootMargin: '150px' });
  observer.observe(host);
  window.addEventListener('fieldnotes:theme-change', () => { if (active) render(); });
}

for (const host of document.querySelectorAll('[data-github-stats]')) {
  fetch('/assets/github-stats.json').then(response => {
    if (!response.ok) throw new Error('Unavailable');
    return response.json();
  }).then(stats => {
    const metrics = document.createElement('dl'); metrics.className = 'work-metrics';
    for (const [label, count] of [['Commits', stats.commits], ['Pull requests', stats.pullRequests], ['Reviews', stats.reviews], ['Issues opened', stats.issues], ['Public repos · now', stats.repositories], ['Followers · now', stats.followers]]) {
      const item = document.createElement('div');
      const term = document.createElement('dt'); term.textContent = label;
      const value = document.createElement('dd'); value.textContent = count.toLocaleString();
      item.append(value, term); metrics.append(item);
    }
    const scroll = document.createElement('div'); scroll.className = 'calendar-scroll';
    scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Daily GitHub contribution calendar; scroll horizontally on small screens');
    const calendar = document.createElement('div'); calendar.className = 'contribution-calendar';
    for (const [index, day] of stats.days.entries()) {
      const cell = document.createElement('span'); cell.className = `contribution-day level-${day.level}`;
      if (!index) cell.style.gridRowStart = day.weekday + 1;
      cell.title = `${day.date}: ${day.count} contribution${day.count === 1 ? '' : 's'}`;
      cell.setAttribute('aria-label', cell.title); calendar.append(cell);
    }
    scroll.append(calendar);
    const caption = document.createElement('p'); caption.className = 'contribution-caption';
    caption.textContent = `${stats.total.toLocaleString()} contributions · ${stats.from.slice(0, 10)} to ${stats.to.slice(0, 10)} · Updated ${stats.updatedAt.slice(0, 10)}. Darker to brighter squares show more activity.`;
    const scope = document.createElement('p'); scope.className = 'contribution-caption';
    scope.textContent = 'Commits, pull requests, reviews, and issues use GitHub’s contribution rules for the past year. Calendar includes anonymous private counts only when shared on the public profile. Updated on each site deployment.';
    host.replaceChildren(metrics, scroll, caption, scope);
  }).catch(() => { host.textContent = 'The contribution snapshot is unavailable. You can still see my activity on GitHub below.'; });
}
