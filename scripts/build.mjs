import { mkdir, writeFile, cp, rm, readFile, readdir, realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, join, relative, isAbsolute, dirname, basename, sep } from 'node:path';
import QRCode from 'qrcode';
import { site as sourceSite } from '../site.config.mjs';
import { externalPosts } from '../content/links.mjs';
import { renderMascot } from './mascot.mjs';
import { loadPosts, publishedPosts, selectFeatured, tagSlug } from './posts.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const categories = ['Industrial software', 'Development', 'Leadership', 'AI & ML'];
const contact = Object.freeze({
  email: 'patrick@cruciblesoftware.co',
  companyUrl: 'https://cruciblesoftware.co/',
  vcardPath: '/patrick-mannion.vcf',
  headshotPath: '/assets/patrick-mannion-headshot.png',
});
const iconSizes = Object.freeze([180, 192, 512]);
const iconThemes = Object.freeze({
  green: { bg: '#0b1109', panel: '#10180d', line: '#6ea651', accent: '#b6e889', dim: '#334527' },
  amber: { bg: '#160f08', panel: '#1f160c', line: '#9f7440', accent: '#efbf70', dim: '#47321b' },
});
const featuredGithubRepos = Object.freeze([
  {
    name: 'ignition-mcp',
    fullName: 'WhiskeyHouse/ignition-mcp',
    url: 'https://github.com/WhiskeyHouse/ignition-mcp',
    description: 'Ignition (8.3 and above) MCP server work with the new REST API',
    stars: 36,
    language: 'Python',
  },
  {
    name: 'ignition-ide-plugins',
    fullName: 'TheThoughtagen/ignition-ide-plugins',
    url: 'https://github.com/TheThoughtagen/ignition-ide-plugins',
    description: 'Neovim Terminal IDE Lazy-Vim plugin for Ignition by Inductive Automation',
    stars: 14,
    language: 'Python',
  },
  {
    name: 'ignition-lint',
    fullName: 'TheThoughtagen/ignition-lint',
    url: 'https://github.com/TheThoughtagen/ignition-lint',
    description: "Ignition Linter for Jython Scripting, Perspective JSON's and more!",
    stars: 11,
    language: 'Python',
  },
  {
    name: 'ignition-cli',
    fullName: 'TheThoughtagen/ignition-cli',
    url: 'https://github.com/TheThoughtagen/ignition-cli',
    description: 'Rust CLI for Ignition v8.3+ by Inductive Automation',
    stars: 1,
    language: 'Rust',
  },
  {
    name: 'agentic-ignition-tooling',
    fullName: 'TheThoughtagen/agentic-ignition-tooling',
    url: 'https://github.com/TheThoughtagen/agentic-ignition-tooling',
    description: 'Agentic Ignition tooling for API references, auto-linting, test scaffolding, Jython gateway tests, and Playwright E2E',
    stars: 1,
    language: 'Shell',
  },
]);
export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const e = escapeHtml;
const notePath = (article) => `/notes/${article.slug}/`;
const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateLabel = (date) => {
  const instant = new Date(`${date}T12:00:00Z`);
  return `${String(instant.getUTCDate()).padStart(2, '0')} ${shortMonths[instant.getUTCMonth()]} ${instant.getUTCFullYear()}`;
};
export function validWebUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

export function validateContent(site, notes, links) {
  if (!site.name || typeof site.name !== 'string' || typeof site.description !== 'string') throw new Error('Site name and description are required.');
  if (site.email && (typeof site.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.email))) throw new Error('Use a valid contact email address.');
  for (const url of [site.siteUrl, ...Object.values(site.links), site.membership.url]) {
    if (url && !validWebUrl(url)) throw new Error(`Use an http(s) URL without credentials: ${url}`);
  }
  if (site.siteUrl && new URL(site.siteUrl).pathname !== '/') throw new Error('siteUrl must be a site origin, without a path.');
  if (site.membership.enabled && !site.membership.url) throw new Error('Membership requires an external destination URL.');
  if (typeof site.newsletter.buttondownUsername !== 'string' || (site.newsletter.buttondownUsername && !/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(site.newsletter.buttondownUsername))) throw new Error('Use a URL-safe Buttondown username, not an email address or URL.');
  if (site.github.username && !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(site.github.username)) throw new Error('Invalid GitHub username.');
  if (!Array.isArray(site.github.repositories) || site.github.repositories.length > 6 || site.github.repositories.some((repo) => !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?\/[\w.-]+$/i.test(repo))) throw new Error('Use up to six GitHub repositories in owner/repo form.');
  if (!Array.isArray(site.ignitionTools)) throw new Error('Invalid Ignition tool configuration.');
  for (const tool of site.ignitionTools) {
    if (!tool?.name || !tool.description || !validWebUrl(tool.documentationUrl) || !validWebUrl(tool.repositoryUrl)) throw new Error('Invalid Ignition tool.');
  }
  const slugs = new Set();
  const dateIsValid = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
  if (notes.filter((note) => note.featured).length > 1) throw new Error('Provide at most one featured note.');
  for (const note of notes) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(note.slug) || slugs.has(note.slug)) throw new Error('Article slugs must be unique, lowercase, and URL-safe.');
    slugs.add(note.slug);
    if (!note.title || !note.description || !categories.includes(note.category) || !dateIsValid(note.date)) throw new Error(`Invalid metadata: ${note.slug}`);
    if (!Array.isArray(note.tags) || !Number.isInteger(note.readingMinutes) || note.readingMinutes < 1) throw new Error(`Invalid article: ${note.slug}`);
  }
  for (const link of links) {
    if (!validWebUrl(link.url) || !link.title || !link.description || !['LinkedIn', 'Substack', 'X'].includes(link.source) || !categories.includes(link.category) || !dateIsValid(link.date)) throw new Error('Invalid external post.');
  }
}

function profileLinks(site) {
  return [['LinkedIn', site.links.linkedin], ['X', site.links.x], ['GitHub', site.github.username ? `https://github.com/${site.github.username}` : ''], ['Substack', site.links.substack]].filter(([, url]) => url);
}

function connectionLinks(site) {
  return [
    ...profileLinks(site).map(([label, url]) => `<a class="connection" href="${e(url)}" target="_blank" rel="noopener noreferrer"><span>${label}</span><span aria-hidden="true">&#8599;</span></a>`),
    `<a class="connection" href="/card/"><span>Digital contact card</span><span aria-hidden="true">&#8599;</span></a>`,
  ].join('');
}

function emailLink(site) {
  return site.email ? `<a class="connection" href="mailto:${e(site.email)}"><span>Email Patrick</span><span aria-hidden="true">&#8594;</span></a>` : '';
}

function authorLinks(site) {
  return `<nav class="author-links" aria-label="About the author and social profiles"><a href="/about/">Read my bio <span aria-hidden="true">&#8594;</span></a>${profileLinks(site).map(([label, url]) => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${label} <span aria-hidden="true">&#8599;</span></a>`).join('')}</nav>`;
}

function authorCard(site) {
  return `<section class="author-card" aria-label="Meet the person behind FIELDNOTES"><a class="author-portrait card-portrait" href="/about/" aria-label="About ${e(site.author)}"><div class="card-photo-frame"><img class="card-headshot" src="${e(contact.headshotPath)}" width="1145" height="1374" alt="Headshot of ${e(site.author)}" decoding="async"></div></a><div class="author-card-copy"><div class="overline">THE PERSON BEHIND THE NOTES</div><h2>Hi, I’m ${e(site.author.split(' ')[0])}.</h2><p>${e(site.bio?.short || site.description)} Have a question or a different take? I’d like to hear it.</p>${authorLinks(site)}</div></section>`;
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
  return shell(site, { title: 'Connect', path: '/connect/', active: 'connect', body: `<div class="wrap secondary-page"><div class="overline">04 / HUMAN CONNECTIONS</div><header class="secondary-header"><div><h1>Say hello.<br><span class="accent">I’m Patrick.</span></h1><p>Working on a similar problem? Send me the note you’re responding to, a little context, and what you’re trying to figure out.</p></div><div class="lab-glyph" aria-hidden="true">[ <span>hello_</span> ]<small>THERE IS A HUMAN ON THIS END.</small></div></header><div class="connect-profiles">${emailLink(site)}${connectionLinks(site)}</div>${renderChannels(site)}<p class="connection-privacy">Booking is handled by the connected calendar provider. Email messages and newsletter signup are handled by the linked providers. This site does not store your email address or calendar details.</p></div>` });
}

function githubProfile(site) {
  return site.github.username ? `https://github.com/${site.github.username}` : 'https://github.com/TheThoughtagen';
}

function starLabel(stars) {
  return `${stars} ${stars === 1 ? 'star' : 'stars'}`;
}

function cardRepoHighlights(site) {
  return `<section class="card-repos" aria-labelledby="card-repos-title" data-card-repos><div class="card-section-heading"><div><div class="overline">PUBLIC WORK / GITHUB</div><h2 id="card-repos-title">Repos worth opening.</h2></div><p data-card-repos-status>Static public snapshot. The page refreshes from GitHub when the public API is available.</p></div><div class="card-repo-grid">${featuredGithubRepos.map((repo) => `<a class="card-repo" href="${e(repo.url)}" target="_blank" rel="noopener noreferrer" data-repo-name="${e(repo.name)}" data-repo-full-name="${e(repo.fullName)}"><span class="card-repo-top"><strong>${e(repo.name)}</strong><span data-repo-stars>${e(starLabel(repo.stars))}</span></span><p data-repo-description>${e(repo.description)}</p><span class="card-repo-meta"><span data-repo-language>${e(repo.language)}</span><span>GitHub &#8599;</span></span></a>`).join('')}</div></section>`;
}

function cardPage(site) {
  const github = githubProfile(site);
  const links = [
    ['Email', `mailto:${contact.email}`, contact.email],
    ['LinkedIn', site.links.linkedin, 'linkedin.com/in/mannionpatrick'],
    ['Blog home', '/', site.siteUrl ? new URL('/', site.siteUrl).hostname : 'thoughts.cruciblesoftware.co'],
    ['Company', contact.companyUrl, 'cruciblesoftware.co'],
  ];
  const body = `<div class="wrap secondary-page contact-card-page"><div class="overline">05 / DIGITAL CONTACT</div><header class="secondary-header card-header"><div><h1>Patrick Mannion<span class="accent">.</span></h1><p>A small contact card for conversations about industrial software, Ignition systems, production data, and the work of making systems easier to diagnose.</p><div class="card-primary-actions"><a class="button primary" href="${e(contact.vcardPath)}" download>Download vCard <span>&#8595;</span></a><a class="button card-github-cta" href="${e(github)}" target="_blank" rel="noopener noreferrer">GitHub @${e(site.github.username || 'TheThoughtagen')} <span>&#8599;</span></a><a class="button" href="mailto:${e(contact.email)}">Email Patrick <span>&#8594;</span></a></div></div><section class="card-portrait" data-card-hook aria-label="Patrick Mannion headshot"><div class="card-photo-frame"><img class="card-headshot" src="${e(contact.headshotPath)}" width="1145" height="1374" alt="Headshot of Patrick Mannion" decoding="async"></div><div class="card-hook-caption"><span class="signal-dot"></span><span data-card-hook-status>CRT headshot online.</span></div></section></header><div class="card-shell"><section class="contact-card-panel" aria-labelledby="contact-card-title"><div class="card-panel-top"><a class="author-monogram" href="/about/" aria-label="About ${e(site.author)}">PM<span aria-hidden="true">_</span></a><div><div class="overline">FIELDNOTES CONTACT</div><h2 id="contact-card-title">${e(site.author)}</h2><p>${e(site.bio?.short || site.description)}</p></div></div><div class="card-actions"><a class="button primary" href="${e(contact.vcardPath)}" download>Download vCard <span>&#8595;</span></a></div><div class="card-link-stack"><a class="connection card-feature-link" href="${e(github)}" target="_blank" rel="noopener noreferrer"><span>GitHub</span><span>github.com/${e(site.github.username || 'TheThoughtagen')}</span></a>${links.map(([label, url, detail]) => `<a class="connection" href="${e(url)}"${url.startsWith('http') ? ' target="_blank" rel="noopener noreferrer"' : ''}><span>${e(label)}</span><span>${e(detail)}</span></a>`).join('')}</div></section><aside class="card-terminal" aria-label="Contact details"><div class="overline">OPEN CHANNELS</div><pre>github.com/${e(site.github.username || 'TheThoughtagen')}
 patrick@cruciblesoftware.co
 linkedin.com/in/mannionpatrick
 thoughts.cruciblesoftware.co
 cruciblesoftware.co</pre><p>If we met at ICC, send the specific problem or note you want to compare. Details beat pitches.</p></aside></div>${cardRepoHighlights(site)}</div>`;
  return shell(site, { title: 'Patrick Mannion contact card', description: 'Patrick Mannion digital contact card for FIELDNOTES and Crucible Software.', path: '/card/', active: 'card', body });
}

async function cardQrPage(site) {
  const cardUrl = site.siteUrl ? new URL('/card/', site.siteUrl).href : '/card/';
  const qrSvg = await QRCode.toString(cardUrl, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 4,
    color: { dark: '#050805', light: '#ffffff' },
  });
  const accessibleQr = qrSvg
    .replace('<svg ', '<svg class="card-qr-code" role="img" aria-label="QR code for Patrick Mannion contact card" ')
    .replace(/fill="#ffffff"/g, 'class="card-qr-light"')
    .replace(/fill="#050805"/g, 'class="card-qr-dark"')
    .replace(/stroke="#050805"/g, 'class="card-qr-dark"');
  const body = `<div class="wrap secondary-page card-qr-page"><div class="overline">06 / CONTACT QR</div><header class="card-qr-header"><div><h1>Scan to save contact<span class="accent">.</span></h1><p>Open this screen when someone needs Patrick Mannion’s card. The code points to the digital contact card, where the vCard download lives.</p></div><nav class="card-qr-actions" aria-label="QR page links"><a class="button primary" href="/card/">Open card <span>&#8594;</span></a><a class="button" href="/">Home <span>&#8594;</span></a></nav></header><section class="card-qr-stage" aria-labelledby="card-qr-title"><div class="qr-terminal-strip" aria-hidden="true"><span>FIELDNOTES://CONTACT/QR</span><span>ECC H</span></div><h2 id="card-qr-title">Scan to save contact</h2><div class="card-qr-frame">${accessibleQr}</div><p class="card-qr-target">${e(cardUrl)}</p></section></div>`;
  return shell(site, { title: 'Scan Patrick Mannion contact card', description: 'Phone-first QR code for Patrick Mannion’s digital contact card.', path: '/card/qr/', active: 'card-qr', body });
}

function shell(site, { title, description = site.description, path = '/', active = 'articles', body, article }) {
  const absolute = site.siteUrl ? new URL(path, site.siteUrl).href : '';
  const pageTitle = title ? `${title} | ${site.name}` : `${site.name} | ${site.author} on industrial software`;
  const cardManifest = active === 'card' || active === 'card-qr';
  const manifestPath = cardManifest ? '/card.webmanifest' : '/site.webmanifest';
  const appTitle = cardManifest ? 'Patrick Card' : site.name;
  return `<!doctype html>
<html lang="en" data-theme="green">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="theme-color" content="#111510"><title>${e(pageTitle)}</title><meta name="description" content="${e(description)}">
<meta property="og:title" content="${e(pageTitle)}"><meta property="og:description" content="${e(description)}"><meta property="og:type" content="${article ? 'article' : 'website'}">${absolute ? `<link rel="canonical" href="${e(absolute)}"><meta property="og:url" content="${e(absolute)}">` : ''}${article ? `<meta property="article:published_time" content="${e(article.date)}">` : ''}
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="manifest" href="${e(manifestPath)}"><link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/fieldnotes-green-180.png"><meta name="apple-mobile-web-app-title" content="${e(appTitle)}"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes"><link rel="alternate" type="application/rss+xml" title="${e(site.name)} RSS" href="/feed.xml"><link rel="stylesheet" href="/assets/katex.min.css"><link rel="stylesheet" href="/assets/styles.css"><link rel="stylesheet" href="/assets/mascot.css"><link rel="stylesheet" href="/assets/boot.css"><script src="/assets/theme.js"></script><script defer src="/assets/boot.js"></script><script type="module" src="/assets/app.js"></script></head>
<body data-page="${article ? 'article' : active}"><template id="mascot-template">${renderMascot()}</template><a class="skip-link" href="#main">Skip to content</a><div class="read-progress" aria-hidden="true"></div>
<header class="site-header wrap"><a class="brand" href="/" aria-label="${e(site.name)} home"><span class="brand-symbol" aria-hidden="true">f<span>_</span></span><span>${e(site.name)}<span class="brand-cursor">_</span></span></a><nav aria-label="Main navigation"><a href="/#notebook" ${active === 'articles' ? 'aria-current="page"' : ''}>Articles</a><a href="/lab/" ${active === 'lab' ? 'aria-current="page"' : ''}>The lab</a><a href="/about/" ${active === 'about' ? 'aria-current="page"' : ''}>About Patrick</a><a href="/card/qr/" ${active === 'card-qr' ? 'aria-current="page"' : ''}>QR card</a><a class="button primary nav-call" href="/connect/" ${active === 'connect' ? 'aria-current="page"' : ''}>Say hello <span aria-hidden="true">&#8599;</span></a></nav><div class="header-tools"><button class="search-trigger" data-search aria-label="Search notes and commands"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"></circle><path d="m15 15 5 5"></path></svg><span>Search</span><kbd>/</kbd></button><button class="theme-toggle" data-theme-toggle aria-label="Change color theme"><span aria-hidden="true">&#9680;</span><span class="theme-name">Green</span></button></div></header>
<main id="main" tabindex="-1">${body}${article ? `<div class="wrap">${renderChannels(site)}</div>` : ''}</main>
<footer class="site-footer wrap"><div><a class="footer-brand" href="/">${e(site.name)}<span>_</span></a><p>Notes by <a href="/about/">${e(site.author)}</a> on software and technical teams.</p><button class="reboot-link" data-reboot>Replay terminal boot <span aria-hidden="true">[ &gt;_ ]</span></button></div><div class="footer-right"><a href="/connect/#subscribe">Subscribe by email &#8599;</a><a href="/connect/#book">Book a call &#8599;</a><a href="/card/">Digital card &#8599;</a><a href="/card/qr/">Card QR &#8599;</a>${site.email ? `<a href="mailto:${e(site.email)}">Email Patrick &#8599;</a>` : ''}<a href="/feed.xml">RSS feed &#8599;</a>${profileLinks(site).map(([label, url]) => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${label} &#8599;</a>`).join('')}<a href="/about/">About ${e(site.author)} &#8599;</a><span>Thanks for reading.</span></div></footer>
<div class="statusbar"><div><button data-vim-toggle aria-pressed="true" aria-label="Toggle Vim navigation" title="Turn keyboard navigation on or off">VIM: ON</button><a class="status-file" href="${article ? notePath(article) + 'index.md' : active === 'articles' ? '/#notebook' : '#main'}" title="${article ? 'Open this article as Markdown' : active === 'articles' ? 'Go to the notebook' : 'Back to page content'}">${article ? e(article.slug) + '.md' : active + '.md'}</a></div><div class="key-hints"><span><kbd>j</kbd><kbd>k</kbd> navigate</span><button data-search><kbd>/</kbd> search</button><button data-help><kbd>?</kbd> keys</button></div><span class="status-position" data-scroll-position>TOP</span></div>
<dialog id="command-dialog" aria-labelledby="command-title"><div class="dialog-heading"><span id="command-title">COMMAND LINE</span><button data-close aria-label="Close search">esc</button></div><div class="command-field"><span aria-hidden="true">&gt;</span><input id="command-input" type="search" autocomplete="off" spellcheck="false" placeholder="Find a note, or type :help" aria-label="Search notes and commands" aria-controls="command-results"></div><div id="command-results" class="command-results" aria-live="polite"></div><div class="dialog-footer"><span><kbd>&#8593;</kbd><kbd>&#8595;</kbd> select <kbd>enter</kbd> open</span><span>Start with <kbd>:</kbd> for commands</span></div></dialog>
<dialog id="help-dialog" aria-labelledby="help-title"><div class="dialog-heading"><span id="help-title">A LITTLE LESS MOUSE</span><button data-close aria-label="Close keyboard help">esc</button></div><p class="help-intro">A familiar way to move around. All controls also work with a mouse or touch.</p><dl class="shortcut-list"><div><dt><kbd>h</kbd> / <kbd>l</kbd></dt><dd>Back / forward in browser history</dd></div><div><dt><kbd>j</kbd> / <kbd>k</kbd></dt><dd>Next / previous visible note</dd></div><div><dt><kbd>enter</kbd></dt><dd>Open the focused note</dd></div><div><dt><kbd>g</kbd><kbd>g</kbd> / <kbd>G</kbd></dt><dd>Top / bottom of page</dd></div><div><dt><kbd>/</kbd> or <kbd>Ctrl/Cmd K</kbd></dt><dd>Search the notebook</dd></div><div><dt><kbd>:</kbd></dt><dd>Open the command line</dd></div><div><dt><kbd>?</kbd> / <kbd>esc</kbd></dt><dd>Help / close a dialog</dd></div></dl><p class="help-intro">Commands: <code>:home</code>, <code>:lab</code>, <code>:about</code>, <code>:card</code>, <code>:qr</code>, <code>:theme green</code>, <code>:theme amber</code>, <code>:theme paper</code>, <code>:reboot</code>. Turn off Vim navigation in the bottom-left status bar to disable single-key shortcuts. Ctrl/Cmd K always opens search.</p></dialog>
<div class="toast" role="status" aria-live="polite"></div>
</body></html>`;
}

function metadata(article) {
  return `<span class="category-label">${e(article.category)}</span><span class="note-type">FIELD NOTE</span>`;
}

function noteCard(article, index) {
  return `<article class="note-card" data-note data-category="${e(article.category)}" data-search-text="${e([article.title, article.description, article.category, ...article.tags].join(' ').toLowerCase())}"><div class="note-meta">${metadata(article)}</div><a class="note-link" href="${notePath(article)}"><span class="note-number">${String(index + 1).padStart(2, '0')}</span><h3>${e(article.title)}</h3><span class="note-arrow" aria-hidden="true">&#8599;</span></a><p>${e(article.description)}</p><div class="note-bottom"><time datetime="${article.date}">${dateLabel(article.date)}</time><span>${article.readingMinutes} min read</span></div></article>`;
}

function githubPanel(site, type) {
  const configured = type === 'activity' ? site.github.username : site.github.repositories.length || site.github.username;
  return `<section class="uplink-panel" aria-labelledby="${type}-title"><div class="panel-title"><h2 id="${type}-title">${type === 'activity' ? 'PUBLIC ACTIVITY' : type === 'commits' ? 'RECENT COMMITS' : 'RELEASES'}</h2><span aria-hidden="true">${type === 'activity' ? 'events' : type === 'commits' ? 'git log' : 'git tag'}</span></div><div data-github="${type}" aria-live="polite">${configured ? '<p class="muted">Connecting to the public GitHub API...</p>' : `<div class="empty-uplink"><span class="uplink-symbol" aria-hidden="true">${type === 'activity' ? '>_' : '[+]'}</span><h3>No projects linked yet.</h3><p>${type === 'activity' ? 'Public commits and pull requests will appear here when I add my GitHub profile.' : 'I’ll link repositories here so you can read their release notes and try the projects.'}</p><span class="offline-label"><i></i> NOT CONFIGURED</span></div>`}</div></section>`;
}

export function socialPosts(site, links = externalPosts) {
  const linkedinPosts = links.filter(post => post.source === 'LinkedIn');
  return `<section class="elsewhere-posts" id="elsewhere"><div class="overline">ELSEWHERE</div><h2>Notes between notes.</h2><p>Shorter thoughts, conversations, and things I’m working on.</p><div class="external-grid social-grid">${site.links.x ? `<section class="uplink-panel"><div class="panel-title"><h3>ON X</h3><a href="${e(site.links.x)}" target="_blank" rel="noopener noreferrer">Open X &#8599;</a></div><div data-x-timeline="${e(site.links.x)}"></div><p class="social-fallback">If the timeline doesn’t load, <a href="${e(site.links.x)}" target="_blank" rel="noopener noreferrer">read my posts on X &#8599;</a></p></section>` : ''}${site.links.linkedin ? `<section class="uplink-panel"><div class="panel-title"><h3>ON LINKEDIN</h3></div><div class="social-copy">${linkedinPosts.length ? linkedinPosts.map(post => `<a class="github-event" href="${e(post.url)}" target="_blank" rel="noopener noreferrer"><strong>${e(post.title)}</strong><span>${e(post.description)}</span><time datetime="${post.date}">${dateLabel(post.date)}</time></a>`).join('') : '<p>I also write about software and technical teams on LinkedIn. Join the conversation there.</p>'}<a class="connection" href="${e(site.links.linkedin.replace(/\/$/, '') + '/recent-activity/all/')}" target="_blank" rel="noopener noreferrer">Read my LinkedIn posts &#8599;</a></div></section>` : ''}</div></section>`;
}

export function githubStats(site) {
  if (!site.github.username) return '';
  return `<section class="contribution-section" id="github-work" aria-labelledby="contribution-title"><div class="overline">THE PAST YEAR ON GITHUB</div><h2 id="contribution-title">Building, bit by bit.</h2><div data-github-stats><p>Contribution calendar and work totals are loading.</p></div><a href="https://github.com/${e(site.github.username)}?tab=overview" target="_blank" rel="noopener noreferrer">View my GitHub profile &#8599;</a></section>`;
}

function home(site, articles, links) {
  const featured = selectFeatured(articles);
  const rest = articles.filter((article) => article !== featured);
  const notebook = featured
    ? `<div class="archive-layout"><div class="notes-column"><article class="featured-note" data-note data-category="${e(featured.category)}" data-search-text="${e([featured.title, featured.description, featured.category, ...featured.tags].join(' ').toLowerCase())}"><div class="featured-copy"><div class="note-meta"><span class="featured-label"><span aria-hidden="true">*</span> FEATURED NOTE</span><span class="note-type">FIELD NOTE</span></div><span class="category-label">${e(featured.category)}</span><a class="note-link" href="${notePath(featured)}"><h3>${e(featured.title)}</h3><span class="note-arrow" aria-hidden="true">&#8599;</span></a><p>${e(featured.description)}</p><div class="note-bottom"><time datetime="${featured.date}">${dateLabel(featured.date)}</time><span>${featured.readingMinutes} min read</span></div></div><div class="featured-art" aria-hidden="true"><span>FIG. 01 / KNOW YOUR BOUNDARIES</span><div class="boundary-diagram"><div>[ DEVELOPMENT ]</div><i>:<br>:<br>v</i><div>[ SIMULATION ]</div><i>:<br>:<br>v</i><div class="boundary-production">[ PRODUCTION ]</div></div><span class="boundary-caption">TEST HERE. NOT OUT THERE.</span></div></article><div class="note-grid">${rest.map((article) => noteCard(article, articles.indexOf(article))).join('')}</div><div class="empty-search" hidden><span aria-hidden="true">[ 0 RESULTS ]</span><h3>No matching notes.</h3><p>Try another topic or a different search.</p><button class="button" data-reset>Show all notes</button></div><p class="archive-count" aria-live="polite"><span data-note-count>${articles.length}</span> notes in the notebook <span>// END OF LOG</span></p></div>
    <aside class="notebook-sidebar"><div class="sidebar-heading"><span class="signal-dot"></span> FROM THE WORKBENCH</div>${githubPanel(site, 'activity')}<a class="sidebar-lab-link" href="/lab/#github-work">Commits, graph &amp; releases <span>&#8599;</span></a><div class="sidebar-note"><span class="overline">A QUESTION TO START WITH</span><p>Can the next person <em>diagnose it?</em></p><span>Name the symptom. Explain the next step.</span></div></aside></div>`
    : `<div class="archive-layout"><div class="notes-column"><div class="empty-notebook"><span class="overline">[ NOTEBOOK OPEN ]</span><h3>No published field notes yet.</h3><p>The notebook is ready. Published notes will appear here.</p></div><p class="archive-count" aria-live="polite"><span data-note-count>0</span> notes in the notebook <span>// READY</span></p></div><aside class="notebook-sidebar"><div class="sidebar-heading"><span class="signal-dot"></span> FROM THE WORKBENCH</div>${githubPanel(site, 'activity')}<a class="sidebar-lab-link" href="/lab/#github-work">Commits, graph &amp; releases <span>&#8599;</span></a></aside></div>`;
  const body = `<div class="wrap"><div class="eyebrow-line"><span><i class="tiny-square"></i> PERSONAL ENGINEERING LOG</span><span>PATRICK MANNION / FIELDNOTES</span></div>
    <section class="hero"><div class="hero-copy"><div class="overline">// NOTES BY PATRICK MANNION</div><h1>Software for<br><span>the factory floor.<br>Notes from Patrick.</span></h1><p>Production data, unreliable integrations, AI experiments, and the work of leading a technical team. A notebook for working through the details.</p><div class="hero-actions"><a class="button primary" href="#notebook">Explore the notes <span>&#8595;</span></a><a class="text-link" href="/about/">Meet Patrick <span>&#8599;</span></a></div><span class="hero-footnote"><span class="signal-dot"></span> INDUSTRIAL SOFTWARE / DEVELOPMENT / TEAM LEADERSHIP</span></div><div class="hero-artwork" data-welcome><div class="welcome-media">${renderMascot()}<video data-src="/assets/patrick-welcome.mp4" muted playsinline preload="none" aria-label="Patrick walks to the terminal, types, and gives a thumbs-up."></video></div><button class="welcome-replay" type="button" hidden>Play animation</button></div></section>
    ${authorCard(site)}
    <script type="module" src="/assets/welcome.js"></script>
    <div class="topic-ticker" aria-label="Topics"><span>INDUSTRIAL SOFTWARE</span><i>+</i><span>SOFTWARE DEVELOPMENT</span><i>+</i><span>LEADING TEAMS</span><i>+</i><span>AI &amp; ML</span><i class="ticker-last">+</i><span class="ticker-last">THINKING OUT LOUD</span></div>
    <section class="notebook" id="notebook" aria-labelledby="notebook-title"><div class="section-heading"><div><div class="overline">01 / THE NOTEBOOK</div><h2 id="notebook-title">Latest notes<span class="accent">.</span></h2></div><span class="section-aside">PROBLEMS, DECISIONS &amp; EXAMPLES</span></div>
    ${articles.length ? `<div class="filterbar" data-enhanced hidden><div class="filter-buttons" role="group" aria-label="Filter notes by topic"><button class="filter active" data-filter="all" aria-pressed="true">All notes <span>${articles.length}</span></button>${categories.map((category) => `<button class="filter" data-filter="${e(category)}" aria-pressed="false">${e(category)}</button>`).join('')}</div><button class="filter-search" data-search aria-label="Search the notebook">Find a note <kbd>/</kbd></button></div>` : ''}
    ${notebook}
    </section>
    ${links.length ? `<section class="elsewhere-posts"><div class="overline">02 / CROSS-POSTED</div><h2>More of my writing.</h2><div class="external-grid">${links.map((post) => `<a href="${e(post.url)}" target="_blank" rel="noopener noreferrer"><span>${e(post.source)} / ${dateLabel(post.date)}</span><h3>${e(post.title)} &#8599;</h3><p>${e(post.description)}</p></a>`).join('')}</div></section>` : ''}
    ${githubStats(site)}
    ${socialPosts(site, links)}
    ${renderChannels(site)}
  </div>`;
  return shell(site, { body });
}

function tocItems(headings) {
  return `<ol>${headings.map((heading, index) => `<li><a href="#${e(heading.id)}"><span>${String(index + 1).padStart(2, '0')}</span>${e(heading.text)}</a>${heading.children?.length ? tocItems(heading.children) : ''}</li>`).join('')}</ol>`;
}

function articlePage(site, article, index, articles) {
  const next = articles[(index + 1) % articles.length];
  const navigation = article.rendered.toc.length
    ? `<aside class="reading-aside"><nav aria-label="On this page"><span class="overline">IN THIS NOTE</span>${tocItems(article.rendered.toc)}</nav><div class="reading-aside-tip"><kbd>gg</kbd> back to top<br><kbd>?</kbd> keyboard shortcuts</div></aside>`
    : '';
  const body = `<div class="wrap article-wrap"><a class="back-link" href="/#notebook">&#8592; Back to the notebook</a><header class="article-header"><div class="note-meta">${metadata(article)}</div><h1>${e(article.title)}<span class="accent">.</span></h1><p class="article-deck">${e(article.description)}</p><div class="article-byline"><a href="/about/">${e(site.author)}</a><time datetime="${article.date}">${dateLabel(article.date)}</time><span>${article.readingMinutes} min read</span></div></header><div class="reading-layout"><article class="article-body">${article.rendered.html}<div class="article-end"><span>// END OF NOTE</span><div>${article.tags.map((tag) => `<a class="tag tag-link" href="/tags/${tagSlug(tag)}/">${e(tag)}</a>`).join('')}</div><div class="article-share"><button class="button" data-copy-markdown data-enhanced hidden>Copy Markdown</button><button class="button" data-copy-link>Copy article link &#8599;</button><a class="text-link" href="${notePath(article)}index.md" download="${e(article.slug)}.md">Download .md</a></div></div></article>${navigation}</div>${authorCard(site)}<a class="next-note note-link" href="${notePath(next)}"><span class="overline">NEXT NOTE</span><h2>${e(next.title)} <span>&#8594;</span></h2><span>${e(next.category)} / ${next.readingMinutes} min read</span></a></div>`;
  const markdownData = `<script type="application/json" id="article-markdown">${JSON.stringify(article.source).replace(/</g, '\\u003c')}</script>`;
  return shell(site, { title: article.title, description: article.description, path: notePath(article), body: body + markdownData, article });
}

function tagArchives(articles) {
  const archives = new Map();
  for (const article of articles) {
    for (const label of article.tags) {
      const slug = tagSlug(label);
      const directorySlug = decodeURIComponent(slug);
      if (!/^[\p{Letter}\p{Number}]+(?:-[\p{Letter}\p{Number}]+)*$/u.test(directorySlug)) {
        throw new Error(`Tag directory slug is unsafe: ${slug}`);
      }
      const archive = archives.get(slug) ?? { slug, directorySlug, label, articles: [] };
      archive.articles.push(article);
      archives.set(slug, archive);
    }
  }
  return [...archives.values()].sort((left, right) => left.slug.localeCompare(right.slug));
}

function tagPage(site, archive) {
  const body = `<div class="wrap secondary-page tag-archive"><a class="back-link" href="/#notebook">&#8592; Back to the notebook</a><header class="secondary-header"><div><div class="overline">TAG ARCHIVE / ${archive.articles.length} ${archive.articles.length === 1 ? 'NOTE' : 'NOTES'}</div><h1>${e(archive.label)}<span class="accent">.</span></h1><p>Published field notes tagged ${e(archive.label)}.</p></div></header><div class="note-grid">${archive.articles.map((article, index) => noteCard(article, index)).join('')}</div></div>`;
  return shell(site, { title: `Notes tagged ${archive.label}`, path: `/tags/${archive.slug}/`, body });
}

function labPage(site) {
  const connected = site.github.username || site.github.repositories.length;
  const ignitionTools = `<section class="ignition-tools" aria-labelledby="ignition-tools-title"><div class="ignition-tools-heading"><div><div class="overline">IGNITION DEVELOPMENT</div><h2 id="ignition-tools-title">Ignition tools.</h2></div><p>Open-source tools for building, checking, operating, and versioning Ignition systems.</p></div><div class="ignition-project-grid">${site.ignitionTools.map((tool, index) => `<article class="ignition-project-card"><span class="ignition-project-number">${String(index + 1).padStart(2, '0')} / ${e(new URL(tool.repositoryUrl).pathname.slice(1))}</span><h3>${e(tool.name)}</h3><p>${e(tool.description)}</p><nav aria-label="${e(tool.name)} links"><a href="${e(tool.documentationUrl)}" target="_blank" rel="noopener noreferrer">Documentation <span aria-hidden="true">&#8599;</span></a><a href="${e(tool.repositoryUrl)}" target="_blank" rel="noopener noreferrer">Source repository <span aria-hidden="true">&#8599;</span></a></nav></article>`).join('')}</div></section>`;
  const body = `<div class="wrap secondary-page"><div class="overline">02 / THE WORKBENCH</div><header class="secondary-header"><div><h1>Projects &amp;<br><span class="accent">experiments.</span></h1><p>My work across public repositories, open-source contributions, and conversations elsewhere.</p></div><div class="lab-glyph" aria-hidden="true">{<span> git </span>}<br><small>BUILD. LEARN. REPEAT.</small></div></header><div class="lab-status"><span class="signal-dot ${connected ? '' : 'dim'}"></span>${connected ? 'GITHUB UPLINK CONFIGURED' : 'GITHUB UPLINK AWAITING CONFIGURATION'}<span>PUBLIC API / READ ONLY</span></div>${ignitionTools}${githubStats(site)}<div class="lab-grid">${githubPanel(site, 'commits')}${githubPanel(site, 'releases')}</div>${githubPanel(site, 'activity')}${socialPosts(site)}<section class="lab-principles"><div><div class="overline">WHAT YOU WILL FIND HERE</div><h2>Working in the open.</h2></div><div><h3>01 / Release notes</h3><p>Version numbers, changelogs, and links to the source repositories.</p></div><div><h3>02 / The little steps</h3><p>Follow a change through its issue, pull request, and commits.</p></div></section></div>`;
  return shell(site, { title: 'The lab', path: '/lab/', active: 'lab', body });
}

function aboutPage(site) {
  const body = `<div class="wrap secondary-page"><div class="overline">03 / ABOUT PATRICK</div><header class="secondary-header"><div><h1>Hi, I’m Patrick<span class="accent">.</span></h1><p>${e(site.bio?.short || site.description)}</p></div><section class="about-portrait card-portrait" aria-label="Patrick Mannion headshot"><div class="card-photo-frame"><img class="card-headshot" src="${e(contact.headshotPath)}" width="1145" height="1374" alt="Headshot of ${e(site.author)}" decoding="async"></div></section></header><div class="about-grid"><section id="bio"><h2>A little about this notebook</h2>${(site.bio?.paragraphs || []).map((paragraph) => `<p>${e(paragraph)}</p>`).join('')}<h2>What I’m writing about</h2><div class="about-topics">${categories.map((category, index) => `<div><span>0${index + 1}</span>${e(category)}</div>`).join('')}</div></section><aside id="connections"><div class="overline">KEEP IN TOUCH</div><h2>Find me here.</h2><p>If something here overlaps with your work, I’d enjoy comparing notes.</p>${emailLink(site)}${connectionLinks(site)}<a class="connection" href="/feed.xml"><span>Follow the notebook via RSS</span><span aria-hidden="true">&#8599;</span></a>${site.links.booking ? `<a class="connection" href="${e(site.links.booking)}" target="_blank" rel="noopener noreferrer"><span>Book a conversation</span><span aria-hidden="true">&#8599;</span></a>` : ''}${site.links.patreon ? `<a class="connection" href="${e(site.links.patreon)}" target="_blank" rel="noopener noreferrer">Support on Patreon &#8599;</a>` : ''}${site.membership.enabled ? `<a class="connection" href="${e(site.membership.url)}" target="_blank" rel="noopener noreferrer">Membership &#8599;</a>` : ''}</aside></div><section class="colophon"><div class="overline">ABOUT THE SITE</div><h2>A notebook with a terminal habit.</h2><p>The interface borrows from old terminals: phosphor green, a command line, and keyboard navigation. You can switch to amber or paper, skip the opening animation, or turn off the single-key shortcuts.</p><button class="button" data-help>Keyboard shortcuts <kbd>?</kbd></button></section></div>`;
  return shell(site, { title: `About ${site.author}`, path: '/about/', active: 'about', body });
}

export function renderFeed(site, notes) {
  const origin = site.siteUrl;
  const xmlText = (value) => e([...String(value)].filter((character) => {
    const point = character.codePointAt(0);
    return point === 0x9 || point === 0xa || point === 0xd
      || (point >= 0x20 && point <= 0xd7ff)
      || (point >= 0xe000 && point <= 0xfffd)
      || (point >= 0x10000 && point <= 0x10ffff);
  }).join(''));
  // A preview without a known origin deliberately has no misleading absolute links.
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>${xmlText(site.name)}</title><link>${xmlText(origin || '/')}</link><description>${xmlText(site.description)}</description><language>en</language>${notes.map((note) => { const url = origin ? new URL(notePath(note), origin).href : notePath(note); return `<item><title>${xmlText(note.title)}</title><link>${xmlText(url)}</link><guid isPermaLink="${Boolean(origin)}">${xmlText(url)}</guid><description>${xmlText(note.description)}</description><pubDate>${new Date(`${note.date}T12:00:00Z`).toUTCString()}</pubDate>${[note.category, ...note.tags].map((classification) => `<category>${xmlText(classification)}</category>`).join('')}</item>`; }).join('')}</channel></rss>`;
}

function hexToRgb(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16));
}

function blend(left, right, amount) {
  return left.map((channel, index) => Math.round(channel * (1 - amount) + right[index] * amount));
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const offset = (y * size + x) * 4;
  pixels[offset] = color[0];
  pixels[offset + 1] = color[1];
  pixels[offset + 2] = color[2];
  pixels[offset + 3] = 255;
}

function fillRect(pixels, size, x, y, width, height, color) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(size, Math.ceil(x + width));
  const bottom = Math.min(size, Math.ceil(y + height));
  for (let row = top; row < bottom; row++) {
    for (let column = left; column < right; column++) setPixel(pixels, size, column, row, color);
  }
}

const iconFont = Object.freeze({
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
});

function drawIconText(pixels, size, text, x, y, scale, color) {
  let cursor = x;
  for (const character of text) {
    const glyph = iconFont[character];
    if (!glyph) {
      cursor += scale * 3;
      continue;
    }
    glyph.forEach((row, rowIndex) => {
      [...row].forEach((bit, columnIndex) => {
        if (bit === '1') fillRect(pixels, size, cursor + columnIndex * scale, y + rowIndex * scale, scale, scale, color);
      });
    });
    cursor += scale * 6;
  }
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function encodePng(size, pixels) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let row = 0; row < size; row++) {
    const rowStart = row * (size * 4 + 1);
    rows[rowStart] = 0;
    pixels.copy(rows, rowStart + 1, row * size * 4, (row + 1) * size * 4);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows)),
    pngChunk('IEND'),
  ]);
}

function renderIconPng(size, palette) {
  const pixels = Buffer.alloc(size * size * 4);
  const bg = hexToRgb(palette.bg);
  const panel = hexToRgb(palette.panel);
  const line = hexToRgb(palette.line);
  const accent = hexToRgb(palette.accent);
  const dim = hexToRgb(palette.dim);
  fillRect(pixels, size, 0, 0, size, size, bg);
  const margin = Math.round(size * 0.08);
  const border = Math.max(2, Math.round(size * 0.018));
  fillRect(pixels, size, margin, margin, size - margin * 2, size - margin * 2, line);
  fillRect(pixels, size, margin + border, margin + border, size - (margin + border) * 2, size - (margin + border) * 2, panel);
  for (let y = margin + border; y < size - margin - border; y += Math.max(3, Math.round(size * 0.025))) {
    fillRect(pixels, size, margin + border, y, size - (margin + border) * 2, 1, blend(panel, dim, 0.65));
  }
  const markScale = Math.max(8, Math.floor(size / 13));
  const markWidth = markScale * 11;
  drawIconText(pixels, size, 'PM', Math.round((size - markWidth) / 2), Math.round(size * 0.29), markScale, accent);
  const cursorWidth = markScale * 3;
  fillRect(pixels, size, Math.round((size - cursorWidth) / 2), Math.round(size * 0.78), cursorWidth, Math.max(2, Math.round(size * 0.018)), accent);
  return encodePng(size, pixels);
}

function renderIconSvg(theme, palette) {
  const accent = e(palette.accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="FIELDNOTES ${e(theme)} CRT icon"><rect width="512" height="512" fill="${e(palette.bg)}"/><rect x="40" y="40" width="432" height="432" fill="${e(palette.line)}"/><rect x="49" y="49" width="414" height="414" fill="${e(palette.panel)}"/><path d="M49 86h414M49 124h414M49 162h414M49 200h414M49 238h414M49 276h414M49 314h414M49 352h414M49 390h414M49 428h414" stroke="${e(palette.dim)}" stroke-width="2"/><text x="256" y="299" text-anchor="middle" fill="${accent}" font-family="SFMono-Regular, Consolas, Liberation Mono, monospace" font-size="158" font-weight="700" letter-spacing="-18">PM</text><rect x="206" y="400" width="100" height="10" fill="${accent}"/></svg>`;
}

function manifestIcons() {
  return Object.keys(iconThemes).flatMap((theme) => iconSizes.map((size) => ({
    src: `/assets/icons/fieldnotes-${theme}-${size}.png`,
    sizes: `${size}x${size}`,
    type: 'image/png',
    purpose: 'any',
  })));
}

function renderManifest(site, { name, shortName, startUrl, description, theme = 'green' }) {
  const palette = iconThemes[theme];
  const shortcuts = startUrl === '/' ? [{
    name: 'Patrick Mannion card',
    short_name: 'Card',
    url: '/card/',
    icons: [{ src: '/assets/icons/fieldnotes-green-192.png', sizes: '192x192', type: 'image/png' }],
  }] : [];
  return `${JSON.stringify({
    name,
    short_name: shortName,
    description,
    start_url: startUrl,
    scope: '/',
    display: 'standalone',
    background_color: palette.bg,
    theme_color: palette.bg,
    icons: manifestIcons(),
    shortcuts,
    categories: ['productivity', 'business'],
    lang: 'en',
  }, null, 2)}\n`;
}

async function writeAppIconAssets(destination, site) {
  const iconDir = join(destination, 'assets', 'icons');
  await mkdir(iconDir, { recursive: true });
  for (const [theme, palette] of Object.entries(iconThemes)) {
    await writeFile(join(iconDir, `fieldnotes-${theme}.svg`), renderIconSvg(theme, palette));
    for (const size of iconSizes) {
      await writeFile(join(iconDir, `fieldnotes-${theme}-${size}.png`), renderIconPng(size, palette));
    }
  }
  await writeFile(join(destination, 'site.webmanifest'), renderManifest(site, {
    name: `${site.name} - Patrick Mannion`,
    shortName: site.name,
    startUrl: '/',
    description: site.description,
  }));
  await writeFile(join(destination, 'card.webmanifest'), renderManifest(site, {
    name: 'Patrick Mannion contact card',
    shortName: 'Patrick Card',
    startUrl: '/card/',
    description: 'Patrick Mannion digital contact card.',
  }));
}

function flattenHeadings(headings) {
  return headings.flatMap((heading) => [heading.text, ...flattenHeadings(heading.children ?? [])]);
}

function searchArticle(article) {
  const headings = flattenHeadings(article.rendered.toc);
  const body = article.rendered.plainText;
  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    date: article.date,
    category: article.category,
    tags: article.tags,
    readingMinutes: article.readingMinutes,
    featured: article.featured,
    url: notePath(article),
    headings,
    body,
    searchText: [article.title, article.description, article.category, ...article.tags, ...headings, body].join(' '),
  };
}

async function canonicalPath(path) {
  const absolute = resolve(path);
  try {
    return await realpath(absolute);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    const parent = dirname(absolute);
    if (parent === absolute) throw error;
    return join(await canonicalPath(parent), basename(absolute));
  }
}

function isStrictDescendant(parent, candidate) {
  const path = relative(parent, candidate);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

const generatedPublicFiles = new Set([
  '404.html', 'feed.xml', 'index.html', 'robots.txt', 'sitemap.xml',
  'assets/data.json', 'assets/fieldnotes-renderer-browser.js', 'assets/katex.min.css',
  'card.webmanifest', 'site.webmanifest',
]);
const generatedPublicDirectories = ['about', 'card', 'connect', 'lab', 'notes', 'tags', 'assets/fonts', 'assets/icons'];

function isGeneratedPublicPath(path) {
  const normalized = path.split(sep).join('/').toLowerCase();
  return generatedPublicFiles.has(normalized)
    || generatedPublicDirectories.some((directory) => normalized === directory || normalized.startsWith(`${directory}/`));
}

async function preflightPublicTree(publicDir) {
  const root = await lstat(publicDir);
  if (root.isSymbolicLink() || !root.isDirectory()) throw new Error('Public source must be a real directory, not a symbolic link.');
  async function walk(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = prefix ? join(prefix, entry.name) : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Public source contains a symbolic link: ${path}`);
      if (isGeneratedPublicPath(path)) throw new Error(`Public source collides with a generated destination: ${path}`);
      if (entry.isDirectory()) await walk(join(directory, entry.name), path);
      else if (!entry.isFile()) throw new Error(`Public source contains a non-regular entry: ${path}`);
    }
  }
  await walk(publicDir);
}

export async function loadLocalStylesheetBundle(stylesheetPath) {
  const stylesheet = await realpath(stylesheetPath);
  const directory = await realpath(dirname(stylesheet));
  const fontDirectory = await realpath(join(directory, 'fonts'));
  const css = await readFile(stylesheet, 'utf8');
  const references = [...css.matchAll(/url\(([^)]+)\)/g)].map((match) => match[1].trim().replace(/^(['"])(.*)\1$/, '$2'));
  const fonts = new Map();
  for (const reference of references) {
    if (!/^fonts\/[A-Za-z0-9_.-]+\.(?:woff2?|ttf)$/u.test(reference)) {
      throw new Error(`Stylesheet asset must be a local font path: ${reference}`);
    }
    const source = await realpath(join(directory, reference));
    if (!isStrictDescendant(fontDirectory, source)) throw new Error(`Stylesheet font escapes its package directory: ${reference}`);
    fonts.set(basename(reference), await readFile(source));
  }
  if (fonts.size === 0) throw new Error('Stylesheet must reference at least one local font.');
  return { css, fonts };
}

async function validateOutputDestination(rootDir, outputDir) {
  const [root, destination, publicDir] = await Promise.all([
    realpath(resolve(rootDir)),
    canonicalPath(outputDir),
    canonicalPath(join(rootDir, 'public')),
  ]);
  if (!isStrictDescendant(root, destination) || destination === publicDir || isStrictDescendant(publicDir, destination)) {
    throw new Error('outputDir must be a dedicated canonical strict descendant within the project boundary.');
  }
  return destination;
}

function preflightArticleAssets(destination, articles) {
  const reserved = new Set(['index.html', 'index.md']);
  for (const article of articles) {
    const noteDir = join(destination, 'notes', article.slug);
    for (const asset of article.localAssets ?? []) {
      const assetDestination = resolve(noteDir, asset.source);
      const path = relative(noteDir, assetDestination);
      if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path)) {
        throw new Error(`Article asset must remain inside its note directory: ${article.slug}/${asset.source}`);
      }
      if (reserved.has(path.toLowerCase())) {
        throw new Error(`Article asset uses a reserved generated file name: ${article.slug}/${asset.source}`);
      }
    }
  }
}

export async function writeSite({ rootDir, outputDir, site, articles, links }) {
  const destination = await validateOutputDestination(rootDir, outputDir);
  preflightArticleAssets(destination, articles);
  const publicDir = join(rootDir, 'public');
  await preflightPublicTree(publicDir);
  const rendererEntry = import.meta.resolve('@cruciblesoftware/fieldnotes-renderer');
  const katexPath = fileURLToPath(import.meta.resolve('katex/dist/katex.min.css', rendererEntry));
  const katex = await loadLocalStylesheetBundle(katexPath);
  const archives = tagArchives(articles);
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  await cp(publicDir, destination, { recursive: true });
  await preflightPublicTree(destination);
  const assets = join(destination, 'assets');
  await cp(fileURLToPath(import.meta.resolve('@cruciblesoftware/fieldnotes-renderer/browser')), join(assets, 'fieldnotes-renderer-browser.js'));
  await writeFile(join(assets, 'katex.min.css'), katex.css);
  await mkdir(join(assets, 'fonts'), { recursive: true });
  for (const [name, bytes] of katex.fonts) await writeFile(join(assets, 'fonts', name), bytes);
  await writeAppIconAssets(destination, site);
  const searchData = JSON.stringify({ site, articles: articles.map(searchArticle), externalPosts: links, ignitionTools: site.ignitionTools });
  const codeFiles = (await readdir(assets)).filter(name => /\.(js|css)$/.test(name)).sort();
  const hash = createHash('sha256');
  for (const name of codeFiles) hash.update(name).update(await readFile(join(assets, name)));
  for (const [name, bytes] of [...katex.fonts].sort(([left], [right]) => left.localeCompare(right))) hash.update(name).update(bytes);
  hash.update('data.json').update(searchData);
  const version = hash.digest('hex').slice(0, 12);
  await writeFile(join(assets, 'katex.min.css'), katex.css.replace(/url\((['"]?)(fonts\/[A-Za-z0-9_.-]+\.(?:woff2?|ttf))\1\)/g, `url($1$2?v=${version}$1)`));
  for (const name of codeFiles.filter(name => name.endsWith('.js'))) {
    const code = await readFile(join(assets, name), 'utf8');
    await writeFile(join(assets, name), code
      .replace(/((?:from\s*|import\s*)['"])(\.\/[^'"]+\.js)(['"])/g, `$1$2?v=${version}$3`)
      .replaceAll('__FIELDNOTES_BUILD_VERSION__', version));
  }
  const pages = [['index.html', home(site, articles, links)], ['lab/index.html', labPage(site)], ['about/index.html', aboutPage(site)], ['connect/index.html', connectPage(site)], ['card/index.html', cardPage(site)], ['card/qr/index.html', await cardQrPage(site)], ['404.html', shell(site, { title: 'Signal lost', active: '404', body: '<div class="wrap lost-page"><div class="overline">ERROR 404 / SIGNAL LOST</div><h1>Nothing on<br>this frequency<span class="accent">.</span></h1><p>This note may have moved, or the address might be mistyped.</p><a class="button primary" href="/">Return to the notebook &#8594;</a></div>' })], ...articles.map((article, index) => [`notes/${article.slug}/index.html`, articlePage(site, article, index, articles)]), ...archives.map((archive) => [`tags/${archive.directorySlug}/index.html`, tagPage(site, archive)])];
  for (const [path, html] of pages) {
    await mkdir(resolve(destination, path, '..'), { recursive: true });
    await writeFile(join(destination, path), html.replace(/((?:src|href)="\/assets\/[^"?]+\.(?:js|css))"/g, `$1?v=${version}"`));
  }
  for (const article of articles) {
    const noteDir = join(destination, 'notes', article.slug);
    await writeFile(join(noteDir, 'index.md'), article.source);
    for (const asset of article.localAssets) {
      const assetDestination = resolve(noteDir, asset.source);
      await mkdir(resolve(assetDestination, '..'), { recursive: true });
      await cp(asset.resolvedPath, assetDestination);
    }
  }
  await writeFile(join(assets, 'data.json'), searchData);
  await writeFile(join(destination, 'feed.xml'), renderFeed(site, articles));
  await writeFile(join(destination, 'robots.txt'), `User-agent: *\nAllow: /\n${site.siteUrl ? `Sitemap: ${site.siteUrl}sitemap.xml\n` : ''}`);
  if (site.siteUrl) await writeFile(join(destination, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['/', '/lab/', '/about/', '/connect/', '/card/', '/card/qr/', ...articles.map(notePath), ...archives.map((archive) => `/tags/${archive.slug}/`)].map((path) => `<url><loc>${e(new URL(path, site.siteUrl).href)}</loc></url>`).join('')}</urlset>`);
  return { pageCount: pages.length, noteCount: articles.length };
}

export async function build({
  rootDir = projectRoot,
  contentDir = join(rootDir, 'content', 'posts'),
  outputDir = join(rootDir, 'dist'),
} = {}) {
  const site = structuredClone(sourceSite);
  if (process.env.SITE_URL) site.siteUrl = process.env.SITE_URL;
  const posts = await loadPosts({ contentDir, schemaPath: join(rootDir, 'frontmatter.schema.json') });
  const articles = publishedPosts(posts);
  validateContent(site, articles, externalPosts);
  if (site.siteUrl) site.siteUrl = new URL(site.siteUrl).origin + '/';
  const result = await writeSite({ rootDir, outputDir, site, articles, links: externalPosts });
  console.log(`Built ${result.pageCount} pages and ${result.noteCount} notes in ${outputDir}. ${site.siteUrl ? `Site: ${site.siteUrl}` : 'Set SITE_URL when publishing to finalize feed and canonical URLs.'}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build();
