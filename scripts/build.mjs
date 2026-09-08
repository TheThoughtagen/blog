import { mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { site as sourceSite } from '../site.config.mjs';
import { articles } from '../content/articles.mjs';
import { externalPosts } from '../content/links.mjs';
import { renderMascot } from './mascot.mjs';
import { renderMarkdown } from './markdown.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const categories = ['Industrial software', 'Development', 'Leadership', 'AI & ML'];
export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const e = escapeHtml;
const notePath = (article) => `/notes/${article.slug}/`;
const dateLabel = (date) => new Intl.DateTimeFormat('en', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
export function validWebUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function validateContent(site, notes, links) {
  if (!site.name || typeof site.name !== 'string' || typeof site.description !== 'string') throw new Error('Site name and description are required.');
  for (const url of [site.siteUrl, ...Object.values(site.links), site.membership.url]) {
    if (url && !validWebUrl(url)) throw new Error(`Use an http(s) URL without credentials: ${url}`);
  }
  if (site.siteUrl && new URL(site.siteUrl).pathname !== '/') throw new Error('siteUrl must be a site origin, without a path.');
  if (site.membership.enabled && !site.membership.url) throw new Error('Membership requires an external destination URL.');
  if (typeof site.newsletter.buttondownUsername !== 'string' || (site.newsletter.buttondownUsername && !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(site.newsletter.buttondownUsername))) throw new Error('Use a URL-safe Buttondown username, not an email address or URL.');
  if (site.github.username && !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(site.github.username)) throw new Error('Invalid GitHub username.');
  if (!Array.isArray(site.github.repositories) || site.github.repositories.length > 6 || site.github.repositories.some((repo) => !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[\w.-]+$/i.test(repo))) throw new Error('Use up to six GitHub repositories in owner/repo form.');
  const slugs = new Set();
  const dateIsValid = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
  if (!notes.length || notes.filter((note) => note.featured).length !== 1) throw new Error('Provide notes and exactly one featured note.');
  for (const note of notes) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(note.slug) || slugs.has(note.slug)) throw new Error('Article slugs must be unique, lowercase, and URL-safe.');
    slugs.add(note.slug);
    if (!note.title || !note.description || !categories.includes(note.category) || !dateIsValid(note.date)) throw new Error(`Invalid metadata: ${note.slug}`);
    if (!Array.isArray(note.tags) || !Number.isInteger(note.readingMinutes) || note.readingMinutes < 1 || !note.sections?.length) throw new Error(`Invalid article: ${note.slug}`);
    const ids = new Set();
    for (const section of note.sections) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(section.id) || ids.has(section.id) || !section.title || !Array.isArray(section.paragraphs)) throw new Error(`Invalid section: ${note.slug}`);
      ids.add(section.id);
    }
  }
  for (const link of links) {
    if (!validWebUrl(link.url) || !link.title || !link.description || !['LinkedIn', 'Substack', 'X'].includes(link.source) || !categories.includes(link.category) || !dateIsValid(link.date)) throw new Error('Invalid external post.');
  }
}

function profileLinks(site) {
  return [['LinkedIn', site.links.linkedin], ['X', site.links.x], ['GitHub', site.github.username ? `https://github.com/${site.github.username}` : ''], ['Substack', site.links.substack]].filter(([, url]) => url);
}

function connectionLinks(site) {
  return profileLinks(site).map(([label, url]) => `<a class="connection" href="${e(url)}" target="_blank" rel="noopener noreferrer"><span>${label}</span><span aria-hidden="true">&#8599;</span></a>`).join('');
}

function authorLinks(site) {
  return `<nav class="author-links" aria-label="About the author and social profiles"><a href="/about/">Read my bio <span aria-hidden="true">&#8594;</span></a>${profileLinks(site).map(([label, url]) => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${label} <span aria-hidden="true">&#8599;</span></a>`).join('')}</nav>`;
}

function authorCard(site) {
  return `<section class="author-card" aria-label="Meet the person behind FIELDNOTES"><a class="author-monogram" href="/about/" aria-label="About ${e(site.author)}">PM<span aria-hidden="true">_</span></a><div><div class="overline">THE PERSON BEHIND THE NOTES</div><h2>Hi, I’m ${e(site.author.split(' ')[0])}.</h2><p>${e(site.bio?.short || site.description)} Have a question or a different take? I’d like to hear it.</p>${authorLinks(site)}</div></section>`;
}

export function renderEmailSignup(site, id = 'newsletter-email') {
  const username = site.newsletter.buttondownUsername;
  if (username) return `<form class="email-signup" action="https://buttondown.com/api/emails/embed-subscribe/${e(username)}" method="post" target="_blank" rel="noopener noreferrer"><label for="${e(id)}">Email address</label><div class="email-input-row"><input id="${e(id)}" type="email" name="email" required autocomplete="email" maxlength="254" placeholder="you@your-inbox.com" aria-describedby="${e(id)}-notice"><button class="button primary" type="submit">Subscribe <span>&#8594;</span></button></div><input type="hidden" name="embed" value="1"><p class="signup-notice" id="${e(id)}-notice">By subscribing, you agree to receive new field notes by email. Unsubscribe anytime. Continue to Buttondown in a new tab to complete signup and any confirmation.</p></form>`;
  if (site.links.subscribe) return `<a class="button primary" href="${e(site.links.subscribe)}" target="_blank" rel="noopener noreferrer">Subscribe by email <span>&#8599;</span></a><p class="signup-notice">Continue to the newsletter provider to sign up and manage your subscription.</p>`;
  return `<div class="email-signup signup-pending"><label for="${e(id)}">Email address</label><div class="email-input-row"><input id="${e(id)}" type="email" disabled placeholder="you@your-inbox.com" aria-describedby="${e(id)}-notice"><button class="button" disabled>Subscribe <span>&#8594;</span></button></div><p class="signup-notice" id="${e(id)}-notice">Email subscriptions are not open yet. No addresses are collected here until the newsletter is connected.</p></div>`;
}

export function renderChannels(site) {
  return `<div class="channel-strip"><section class="channel-card" id="book" aria-labelledby="booking-title"><div class="overline"><span aria-hidden="true">[ &gt;_ ]</span> LET’S TALK</div><h2 id="booking-title">What are you working on?</h2><p>A production-data problem, an integration that keeps breaking, or a team decision you’re weighing up. I’m interested in the details.</p>${site.links.booking ? `<a class="button" href="${e(site.links.booking)}" target="_blank" rel="noopener noreferrer">Book a call <span>&#8599;</span></a><span class="channel-caption">Choose an available time on the booking page.</span>` : '<button class="button" disabled>Book a call <span>&#8599;</span></button><span class="channel-caption">Scheduling opens soon. The calendar is not connected yet.</span>'}</section><section class="channel-card" id="subscribe" aria-labelledby="email-title"><div class="overline"><span aria-hidden="true">[ @ ]</span> FOLLOW THE NOTEBOOK</div><h2 id="email-title">Field notes. In your inbox.</h2><p>Get new notes on industrial software, development, and leading teams when they’re published.</p>${renderEmailSignup(site)}<a class="rss-alternative" href="/feed.xml">Prefer RSS? Subscribe to the feed &#8599;</a></section></div>`;
}

function connectPage(site) {
  return shell(site, { title: 'Connect', path: '/connect/', active: 'connect', body: `<div class="wrap secondary-page"><div class="overline">04 / HUMAN CONNECTIONS</div><header class="secondary-header"><div><h1>Say hello.<br><span class="accent">I’m Patrick.</span></h1><p>Working on a similar problem? Send me the note you’re responding to, a little context, and what you’re trying to figure out.</p></div><div class="lab-glyph" aria-hidden="true">[ <span>hello_</span> ]<small>THERE IS A HUMAN ON THIS END.</small></div></header><div class="connect-profiles">${connectionLinks(site)}</div>${renderChannels(site)}<p class="connection-privacy">Booking is handled by the connected calendar provider. Email signup is handled by the connected newsletter provider. This site does not store your email address or calendar details.</p></div>` });
}

function shell(site, { title, description = site.description, path = '/', active = 'articles', body, article }) {
  const absolute = site.siteUrl ? new URL(path, site.siteUrl).href : '';
  const pageTitle = title ? `${title} | ${site.name}` : `${site.name} | ${site.author} on industrial software`;
  return `<!doctype html>
<html lang="en" data-theme="green">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="theme-color" content="#111510"><title>${e(pageTitle)}</title><meta name="description" content="${e(description)}">
<meta property="og:title" content="${e(pageTitle)}"><meta property="og:description" content="${e(description)}"><meta property="og:type" content="${article ? 'article' : 'website'}">${absolute ? `<link rel="canonical" href="${e(absolute)}"><meta property="og:url" content="${e(absolute)}">` : ''}${article ? `<meta property="article:published_time" content="${e(article.date)}">` : ''}
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="alternate" type="application/rss+xml" title="${e(site.name)} RSS" href="/feed.xml"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/mascot.css"><link rel="stylesheet" href="/assets/boot.css"><script src="/assets/theme.js"></script><script defer src="/assets/boot.js"></script><script type="module" src="/assets/app.js"></script></head>
<body data-page="${article ? 'article' : active}"><template id="mascot-template">${renderMascot()}</template><a class="skip-link" href="#main">Skip to content</a><div class="read-progress" aria-hidden="true"></div>
<header class="site-header wrap"><a class="brand" href="/" aria-label="${e(site.name)} home"><span class="brand-symbol" aria-hidden="true">f<span>_</span></span><span>${e(site.name)}<span class="brand-cursor">_</span></span></a><nav aria-label="Main navigation"><a href="/#notebook" ${active === 'articles' ? 'aria-current="page"' : ''}>Articles</a><a href="/lab/" ${active === 'lab' ? 'aria-current="page"' : ''}>The lab</a><a href="/about/" ${active === 'about' ? 'aria-current="page"' : ''}>About Patrick</a><a class="nav-call" href="/connect/" ${active === 'connect' ? 'aria-current="page"' : ''}>Say hello &#8599;</a></nav><div class="header-tools"><button class="search-trigger" data-search aria-label="Search notes and commands"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"></circle><path d="m15 15 5 5"></path></svg><span>Search</span><kbd>/</kbd></button><button class="theme-toggle" data-theme-toggle aria-label="Change color theme"><span aria-hidden="true">&#9680;</span><span class="theme-name">Green</span></button></div></header>
<main id="main" tabindex="-1">${body}${article ? `<div class="wrap">${renderChannels(site)}</div>` : ''}</main>
<footer class="site-footer wrap"><div><a class="footer-brand" href="/">${e(site.name)}<span>_</span></a><p>Notes by <a href="/about/">${e(site.author)}</a> on software and technical teams.</p><button class="reboot-link" data-reboot>Replay terminal boot <span aria-hidden="true">[ &gt;_ ]</span></button></div><div class="footer-right"><a href="/connect/#subscribe">Subscribe by email &#8599;</a><a href="/connect/#book">Book a call &#8599;</a><a href="/feed.xml">RSS feed &#8599;</a>${profileLinks(site).map(([label, url]) => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${label} &#8599;</a>`).join('')}<a href="/about/">About ${e(site.author)} &#8599;</a><span>Thanks for reading.</span></div></footer>
<div class="statusbar"><div><button data-vim-toggle aria-pressed="true" aria-label="Toggle Vim navigation" title="Turn keyboard navigation on or off">VIM: ON</button><a class="status-file" href="${article ? notePath(article) + 'index.md' : active === 'articles' ? '/#notebook' : '#main'}" title="${article ? 'Open this article as Markdown' : active === 'articles' ? 'Go to the notebook' : 'Back to page content'}">${article ? e(article.slug) + '.md' : active + '.md'}</a></div><div class="key-hints"><span><kbd>j</kbd><kbd>k</kbd> navigate</span><button data-search><kbd>/</kbd> search</button><button data-help><kbd>?</kbd> keys</button></div><span class="status-position" data-scroll-position>TOP</span></div>
<dialog id="command-dialog" aria-labelledby="command-title"><div class="dialog-heading"><span id="command-title">COMMAND LINE</span><button data-close aria-label="Close search">esc</button></div><div class="command-field"><span aria-hidden="true">&gt;</span><input id="command-input" type="search" autocomplete="off" spellcheck="false" placeholder="Find a note, or type :help" aria-label="Search notes and commands" aria-controls="command-results"></div><div id="command-results" class="command-results" aria-live="polite"></div><div class="dialog-footer"><span><kbd>&#8593;</kbd><kbd>&#8595;</kbd> select <kbd>enter</kbd> open</span><span>Start with <kbd>:</kbd> for commands</span></div></dialog>
<dialog id="help-dialog" aria-labelledby="help-title"><div class="dialog-heading"><span id="help-title">A LITTLE LESS MOUSE</span><button data-close aria-label="Close keyboard help">esc</button></div><p class="help-intro">A familiar way to move around. All controls also work with a mouse or touch.</p><dl class="shortcut-list"><div><dt><kbd>h</kbd> / <kbd>l</kbd></dt><dd>Back / forward in browser history</dd></div><div><dt><kbd>j</kbd> / <kbd>k</kbd></dt><dd>Next / previous visible note</dd></div><div><dt><kbd>enter</kbd></dt><dd>Open the focused note</dd></div><div><dt><kbd>g</kbd><kbd>g</kbd> / <kbd>G</kbd></dt><dd>Top / bottom of page</dd></div><div><dt><kbd>/</kbd> or <kbd>Ctrl/Cmd K</kbd></dt><dd>Search the notebook</dd></div><div><dt><kbd>:</kbd></dt><dd>Open the command line</dd></div><div><dt><kbd>?</kbd> / <kbd>esc</kbd></dt><dd>Help / close a dialog</dd></div></dl><p class="help-intro">Commands: <code>:home</code>, <code>:lab</code>, <code>:about</code>, <code>:theme green</code>, <code>:theme amber</code>, <code>:theme paper</code>, <code>:reboot</code>. Turn off Vim navigation in the bottom-left status bar to disable single-key shortcuts. Ctrl/Cmd K always opens search.</p></dialog>
<div class="toast" role="status" aria-live="polite"></div>
</body></html>`;
}

function metadata(article) {
  return `<span class="category-label">${e(article.category)}</span><span class="note-type">${article.sample ? 'SAMPLE NOTE' : 'FIELD NOTE'}</span>`;
}

function noteCard(article, index) {
  return `<article class="note-card" data-note data-category="${e(article.category)}" data-search-text="${e([article.title, article.description, article.category, ...article.tags].join(' ').toLowerCase())}"><div class="note-meta">${metadata(article)}</div><a class="note-link" href="${notePath(article)}"><span class="note-number">${String(index + 1).padStart(2, '0')}</span><h3>${e(article.title)}</h3><span class="note-arrow" aria-hidden="true">&#8599;</span></a><p>${e(article.description)}</p><div class="note-bottom"><time datetime="${article.date}">${dateLabel(article.date)}</time><span>${article.readingMinutes} min read</span></div></article>`;
}

function githubPanel(site, type) {
  const configured = type === 'activity' ? site.github.username : site.github.repositories.length || site.github.username;
  return `<section class="uplink-panel" aria-labelledby="${type}-title"><div class="panel-title"><h2 id="${type}-title">${type === 'activity' ? 'PUBLIC ACTIVITY' : type === 'commits' ? 'RECENT COMMITS' : 'RELEASES'}</h2><span aria-hidden="true">${type === 'activity' ? 'events' : type === 'commits' ? 'git log' : 'git tag'}</span></div><div data-github="${type}" aria-live="polite">${configured ? '<p class="muted">Connecting to the public GitHub API...</p>' : `<div class="empty-uplink"><span class="uplink-symbol" aria-hidden="true">${type === 'activity' ? '>_' : '[+]'}</span><h3>No projects linked yet.</h3><p>${type === 'activity' ? 'Public commits and pull requests will appear here when I add my GitHub profile.' : 'I’ll link repositories here so you can read their release notes and try the projects.'}</p><span class="offline-label"><i></i> NOT CONFIGURED</span></div>`}</div></section>`;
}

export function socialPosts(site) {
  const linkedinPosts = externalPosts.filter(post => post.source === 'LinkedIn');
  return `<section class="elsewhere-posts" id="elsewhere"><div class="overline">ELSEWHERE</div><h2>Notes between notes.</h2><p>Shorter thoughts, conversations, and things I’m working on.</p><div class="external-grid social-grid">${site.links.x ? `<section class="uplink-panel"><div class="panel-title"><h3>ON X</h3><a href="${e(site.links.x)}" target="_blank" rel="noopener noreferrer">Open X &#8599;</a></div><div data-x-timeline="${e(site.links.x)}"></div><p class="social-fallback">If the timeline doesn’t load, <a href="${e(site.links.x)}" target="_blank" rel="noopener noreferrer">read my posts on X &#8599;</a></p></section>` : ''}${site.links.linkedin ? `<section class="uplink-panel"><div class="panel-title"><h3>ON LINKEDIN</h3></div><div class="social-copy">${linkedinPosts.length ? linkedinPosts.map(post => `<a class="github-event" href="${e(post.url)}" target="_blank" rel="noopener noreferrer"><strong>${e(post.title)}</strong><span>${e(post.description)}</span><time datetime="${post.date}">${dateLabel(post.date)}</time></a>`).join('') : '<p>I also write about software and technical teams on LinkedIn. Join the conversation there.</p>'}<a class="connection" href="${e(site.links.linkedin.replace(/\/$/, '') + '/recent-activity/all/')}" target="_blank" rel="noopener noreferrer">Read my LinkedIn posts &#8599;</a></div></section>` : ''}</div></section>`;
}

export function githubStats(site) {
  if (!site.github.username) return '';
  return `<section class="contribution-section" id="github-work" aria-labelledby="contribution-title"><div class="overline">THE PAST YEAR ON GITHUB</div><h2 id="contribution-title">Building, bit by bit.</h2><div data-github-stats><p>Contribution calendar and work totals are loading.</p></div><a href="https://github.com/${e(site.github.username)}?tab=overview" target="_blank" rel="noopener noreferrer">View my GitHub profile &#8599;</a></section>`;
}

function home(site) {
  const featured = articles.find((article) => article.featured);
  const rest = articles.filter((article) => article !== featured);
  const sampleCount = articles.filter((article) => article.sample).length;
  const body = `<div class="wrap"><div class="eyebrow-line"><span><i class="tiny-square"></i> PERSONAL ENGINEERING LOG</span><span>PATRICK MANNION / FIELDNOTES</span></div>
    <section class="hero"><div class="hero-copy"><div class="overline">// NOTES BY PATRICK MANNION</div><h1>Software for<br><span>the factory floor.<br>Notes from Patrick.</span></h1><p>Production data, unreliable integrations, AI experiments, and the work of leading a technical team. A notebook for working through the details.</p><div class="hero-actions"><a class="button primary" href="#notebook">Explore the notes <span>&#8595;</span></a><a class="text-link" href="/about/">Meet Patrick <span>&#8599;</span></a></div><span class="hero-footnote"><span class="signal-dot"></span> INDUSTRIAL SOFTWARE / DEVELOPMENT / TEAM LEADERSHIP</span></div><div class="hero-artwork" data-welcome><div class="welcome-media">${renderMascot()}<video data-src="/assets/patrick-welcome.mp4" muted playsinline preload="none" aria-label="Patrick walks to the terminal, types, and gives a thumbs-up."></video></div><button class="welcome-replay" type="button" hidden>Play animation</button></div></section>
    ${authorCard(site)}
    <script type="module" src="/assets/welcome.js"></script>
    <div class="topic-ticker" aria-label="Topics"><span>INDUSTRIAL SOFTWARE</span><i>+</i><span>SOFTWARE DEVELOPMENT</span><i>+</i><span>LEADING TEAMS</span><i>+</i><span>AI &amp; ML</span><i class="ticker-last">+</i><span class="ticker-last">THINKING OUT LOUD</span></div>
    <section class="notebook" id="notebook" aria-labelledby="notebook-title"><div class="section-heading"><div><div class="overline">01 / THE NOTEBOOK</div><h2 id="notebook-title">Latest notes<span class="accent">.</span></h2></div><span class="section-aside">PROBLEMS, DECISIONS &amp; EXAMPLES</span></div>
    <div class="filterbar" data-enhanced hidden><div class="filter-buttons" role="group" aria-label="Filter notes by topic"><button class="filter active" data-filter="all" aria-pressed="true">All notes <span>${articles.length}</span></button>${categories.map((category) => `<button class="filter" data-filter="${e(category)}" aria-pressed="false">${e(category)}</button>`).join('')}</div><button class="filter-search" data-search aria-label="Search the notebook">Find a note <kbd>/</kbd></button></div>
    ${sampleCount ? `<p class="sample-edition">PREVIEW EDITION <span>/</span> ${sampleCount} sample notes demonstrate the reading experience. Demonstration content is labeled throughout.</p>` : ''}
    <div class="archive-layout"><div class="notes-column"><article class="featured-note" data-note data-category="${e(featured.category)}" data-search-text="${e([featured.title, featured.description, featured.category, ...featured.tags].join(' ').toLowerCase())}"><div class="featured-copy"><div class="note-meta"><span class="featured-label"><span aria-hidden="true">*</span> FEATURED NOTE</span><span class="note-type">${featured.sample ? 'SAMPLE NOTE' : 'FIELD NOTE'}</span></div><span class="category-label">${e(featured.category)}</span><a class="note-link" href="${notePath(featured)}"><h3>${e(featured.title)}</h3><span class="note-arrow" aria-hidden="true">&#8599;</span></a><p>${e(featured.description)}</p><div class="note-bottom"><time datetime="${featured.date}">${dateLabel(featured.date)}</time><span>${featured.readingMinutes} min read</span></div></div><div class="featured-art" aria-hidden="true"><span>FIG. 01 / KNOW YOUR BOUNDARIES</span><div class="boundary-diagram"><div>[ DEVELOPMENT ]</div><i>:<br>:<br>v</i><div>[ SIMULATION ]</div><i>:<br>:<br>v</i><div class="boundary-production">[ PRODUCTION ]</div></div><span class="boundary-caption">TEST HERE. NOT OUT THERE.</span></div></article><div class="note-grid">${rest.map((article) => noteCard(article, articles.indexOf(article))).join('')}</div><div class="empty-search" hidden><span aria-hidden="true">[ 0 RESULTS ]</span><h3>No matching notes.</h3><p>Try another topic or a different search.</p><button class="button" data-reset>Show all notes</button></div><p class="archive-count" aria-live="polite"><span data-note-count>${articles.length}</span> notes in the notebook <span>// END OF LOG</span></p></div>
    <aside class="notebook-sidebar"><div class="sidebar-heading"><span class="signal-dot"></span> FROM THE WORKBENCH</div>${githubPanel(site, 'activity')}<a class="sidebar-lab-link" href="/lab/#github-work">Commits, graph &amp; releases <span>&#8599;</span></a><div class="sidebar-note"><span class="overline">A QUESTION TO START WITH</span><p>Can the next person <em>diagnose it?</em></p><span>Name the symptom. Explain the next step.</span></div></aside></div>
    </section>
    ${externalPosts.length ? `<section class="elsewhere-posts"><div class="overline">02 / CROSS-POSTED</div><h2>More of my writing.</h2><div class="external-grid">${externalPosts.map((post) => `<a href="${e(post.url)}" target="_blank" rel="noopener noreferrer"><span>${e(post.source)} / ${dateLabel(post.date)}</span><h3>${e(post.title)} &#8599;</h3><p>${e(post.description)}</p></a>`).join('')}</div></section>` : ''}
    ${githubStats(site)}
    ${socialPosts(site)}
    ${renderChannels(site)}
  </div>`;
  return shell(site, { body });
}

function articlePage(site, article, index) {
  const sections = article.sections.map((section) => `<section id="${e(section.id)}"><h2>${e(section.title)}</h2>${section.paragraphs.map((paragraph) => `<p>${e(paragraph)}</p>`).join('')}${section.code ? `<div class="code-block"><div><span>${e(section.code.language)}</span><button data-copy-code aria-label="Copy code example">Copy</button></div><pre><code>${e(section.code.text)}</code></pre></div>` : ''}${section.list ? `<ul>${section.list.map((item) => `<li>${e(item)}</li>`).join('')}</ul>` : ''}${section.quote ? `<blockquote>${e(section.quote)}</blockquote>` : ''}</section>`).join('');
  const next = articles[(index + 1) % articles.length];
  const body = `<div class="wrap article-wrap"><a class="back-link" href="/#notebook">&#8592; Back to the notebook</a><header class="article-header"><div class="note-meta">${metadata(article)}</div><h1>${e(article.title)}<span class="accent">.</span></h1><p class="article-deck">${e(article.description)}</p><div class="article-byline">${article.sample ? '<span>FIELDNOTES / SAMPLE</span>' : `<a href="/about/">${e(site.author)}</a>`}<time datetime="${article.date}">${dateLabel(article.date)}</time><span>${article.readingMinutes} min read</span></div></header><div class="reading-layout"><article class="article-body">${article.sample ? '<div class="sample-notice"><strong>A sample note.</strong> This is demonstration content for the site preview, not a published article by the site owner.</div>' : ''}${sections}<div class="article-end"><span>// END OF NOTE</span><div>${article.tags.map((tag) => `<span class="tag">${e(tag)}</span>`).join('')}</div><div class="article-share"><button class="button" data-copy-markdown data-enhanced hidden>Copy Markdown</button><button class="button" data-copy-link>Copy article link &#8599;</button><a class="text-link" href="${notePath(article)}index.md" download="${e(article.slug)}.md">Download .md</a></div></div></article><aside class="reading-aside"><nav aria-label="On this page"><span class="overline">IN THIS NOTE</span>${article.sections.map((section, i) => `<a href="#${e(section.id)}"><span>${String(i + 1).padStart(2, '0')}</span>${e(section.title)}</a>`).join('')}</nav><div class="reading-aside-tip"><kbd>gg</kbd> back to top<br><kbd>?</kbd> keyboard shortcuts</div></aside></div>${authorCard(site)}<a class="next-note note-link" href="${notePath(next)}"><span class="overline">NEXT NOTE</span><h2>${e(next.title)} <span>&#8594;</span></h2><span>${e(next.category)} / ${next.readingMinutes} min read</span></a></div>`;
  const markdownData = `<script type="application/json" id="article-markdown">${JSON.stringify(renderMarkdown(site, article)).replace(/</g, '\\u003c')}</script>`;
  return shell(site, { title: article.title, description: article.description, path: notePath(article), body: body + markdownData, article });
}

function labPage(site) {
  const connected = site.github.username || site.github.repositories.length;
  const body = `<div class="wrap secondary-page"><div class="overline">02 / THE WORKBENCH</div><header class="secondary-header"><div><h1>Projects &amp;<br><span class="accent">experiments.</span></h1><p>My work across public repositories, open-source contributions, and conversations elsewhere.</p></div><div class="lab-glyph" aria-hidden="true">{<span> git </span>}<br><small>BUILD. LEARN. REPEAT.</small></div></header><div class="lab-status"><span class="signal-dot ${connected ? '' : 'dim'}"></span>${connected ? 'GITHUB UPLINK CONFIGURED' : 'GITHUB UPLINK AWAITING CONFIGURATION'}<span>PUBLIC API / READ ONLY</span></div>${githubStats(site)}<div class="lab-grid">${githubPanel(site, 'commits')}${githubPanel(site, 'releases')}</div>${githubPanel(site, 'activity')}${socialPosts(site)}<section class="lab-principles"><div><div class="overline">WHAT YOU WILL FIND HERE</div><h2>Working in the open.</h2></div><div><h3>01 / Release notes</h3><p>Version numbers, changelogs, and links to the source repositories.</p></div><div><h3>02 / The little steps</h3><p>Follow a change through its issue, pull request, and commits.</p></div></section></div>`;
  return shell(site, { title: 'The lab', path: '/lab/', active: 'lab', body });
}

function aboutPage(site) {
  const body = `<div class="wrap secondary-page"><div class="overline">03 / ABOUT PATRICK</div><header class="secondary-header"><div><h1>Hi, I’m Patrick<span class="accent">.</span></h1><p>${e(site.bio?.short || site.description)}</p></div><div class="about-mark" aria-hidden="true">[<span>pm_</span>]<small>THE PERSON BEHIND FIELDNOTES</small></div></header><div class="about-grid"><section id="bio"><h2>A little about this notebook</h2>${(site.bio?.paragraphs || []).map((paragraph) => `<p>${e(paragraph)}</p>`).join('')}<h2>What I’m writing about</h2><div class="about-topics">${categories.map((category, index) => `<div><span>0${index + 1}</span>${e(category)}</div>`).join('')}</div>${articles.some((article) => article.sample) ? '<div class="sample-notice">The notebook is taking shape. Notes marked “sample” are demonstration pieces, not accounts of my work or published articles.</div>' : ''}</section><aside id="connections"><div class="overline">KEEP IN TOUCH</div><h2>Find me here.</h2><p>If something here overlaps with your work, I’d enjoy comparing notes.</p>${connectionLinks(site)}<a class="connection" href="/feed.xml"><span>Follow the notebook via RSS</span><span aria-hidden="true">&#8599;</span></a>${site.links.booking ? `<a class="connection" href="${e(site.links.booking)}" target="_blank" rel="noopener noreferrer"><span>Book a conversation</span><span aria-hidden="true">&#8599;</span></a>` : ''}${site.links.patreon ? `<a class="connection" href="${e(site.links.patreon)}" target="_blank" rel="noopener noreferrer">Support on Patreon &#8599;</a>` : ''}${site.membership.enabled ? `<a class="connection" href="${e(site.membership.url)}" target="_blank" rel="noopener noreferrer">Membership &#8599;</a>` : ''}</aside></div><section class="colophon"><div class="overline">ABOUT THE SITE</div><h2>A notebook with a terminal habit.</h2><p>The interface borrows from old terminals: phosphor green, a command line, and keyboard navigation. You can switch to amber or paper, skip the opening animation, or turn off the single-key shortcuts.</p><button class="button" data-help>Keyboard shortcuts <kbd>?</kbd></button></section></div>`;
  return shell(site, { title: `About ${site.author}`, path: '/about/', active: 'about', body });
}

export function renderFeed(site, notes) {
  const origin = site.siteUrl;
  // A preview without a known origin deliberately has no misleading absolute links.
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${e(site.name)}</title><link>${e(origin || '/')}</link><description>${e(site.description)}</description><language>en</language>${notes.map((note) => { const url = origin ? new URL(notePath(note), origin).href : notePath(note); return `<item><title>${e(note.title)}${note.sample ? ' [Sample]' : ''}</title><link>${e(url)}</link><guid isPermaLink="${Boolean(origin)}">${e(url)}</guid><description>${e(`${note.sample ? 'Sample article for the site preview. ' : ''}${note.description}`)}</description><pubDate>${new Date(`${note.date}T12:00:00Z`).toUTCString()}</pubDate><category>${e(note.category)}</category></item>`; }).join('')}</channel></rss>`;
}

export async function build() {
  const site = structuredClone(sourceSite);
  if (process.env.SITE_URL) site.siteUrl = process.env.SITE_URL;
  validateContent(site, articles, externalPosts);
  if (site.siteUrl) site.siteUrl = new URL(site.siteUrl).origin + '/';
  const dist = join(root, 'dist');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await cp(join(root, 'public'), dist, { recursive: true });
  const pages = [['index.html', home(site)], ['lab/index.html', labPage(site)], ['about/index.html', aboutPage(site)], ['connect/index.html', connectPage(site)], ['404.html', shell(site, { title: 'Signal lost', active: '404', body: '<div class="wrap lost-page"><div class="overline">ERROR 404 / SIGNAL LOST</div><h1>Nothing on<br>this frequency<span class="accent">.</span></h1><p>This note may have moved, or the address might be mistyped.</p><a class="button primary" href="/">Return to the notebook &#8594;</a></div>' })], ...articles.map((article, index) => [`notes/${article.slug}/index.html`, articlePage(site, article, index)])];
  for (const [path, html] of pages) { await mkdir(resolve(dist, path, '..'), { recursive: true }); await writeFile(join(dist, path), html); }
  for (const article of articles) await writeFile(join(dist, `notes/${article.slug}/index.md`), renderMarkdown(site, article));
  await writeFile(join(dist, 'assets/data.json'), JSON.stringify({ site, articles: articles.map(({ sections, ...article }) => ({ ...article, url: notePath(article) })), externalPosts }));
  await writeFile(join(dist, 'feed.xml'), renderFeed(site, articles));
  await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\n${site.siteUrl ? `Sitemap: ${site.siteUrl}sitemap.xml\n` : ''}`);
  if (site.siteUrl) await writeFile(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/lab/', '/about/', '/connect/', ...articles.map(notePath)].map((path) => `<url><loc>${e(new URL(path, site.siteUrl).href)}</loc></url>`).join('')}</urlset>`);
  console.log(`Built ${pages.length} pages and ${articles.length} notes in dist/. ${site.siteUrl ? `Site: ${site.siteUrl}` : 'Set SITE_URL when publishing to finalize feed and canonical URLs.'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
