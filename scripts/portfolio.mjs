import { portfolio, demos, workbenchVideos, portalFilm } from '../content/work.mjs';
import evidence from '../content/work-evidence.json' with { type: 'json' };
import { renderCortexGraph } from './graph-showcase.mjs';
import { renderCortexScene } from './scene-showcase.mjs';

const e = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const tags = items => `<ul class="work-tags" aria-label="Technologies">${items.map(item => `<li>${e(item)}</li>`).join('')}</ul>`;
const outbound = (url, label) => `<a href="${e(url)}" target="_blank" rel="noopener noreferrer">${e(label)} <span aria-hidden="true">&#8599;</span></a>`;
const reviewedLabel = () => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${portfolio.reviewed}T12:00:00Z`));
const mediaUrl = path => `${path}?v=${evidence.find(item => item.path === path)?.sha256.slice(0, 12) || ''}`;

export function validatePortfolio() {
  const ids = new Set();
  for (const project of [...portfolio.whiskeyHouse, ...portfolio.openSource, ...demos, ...workbenchVideos, portalFilm]) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.id) || ids.has(project.id)) throw new Error(`Invalid or duplicate portfolio ID: ${project.id}`);
    ids.add(project.id);
    if (!project.title || !project.description) throw new Error(`Incomplete portfolio entry: ${project.id}`);
    for (const field of ['source', 'docs', 'recording', 'url', 'demo']) {
      const value = project[field];
      if (!value) continue;
      if (field === 'demo' && /^#[a-z0-9-]+$/.test(value)) continue;
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`Invalid portfolio URL: ${project.id}`);
    }
    if (project.cast && (!/^\/assets\/recordings\/[a-z]+\.cast$/.test(project.cast) || !evidence.some(item => item.path === project.cast))) throw new Error(`Missing recording evidence: ${project.id}`);
    if (project.file && !evidence.some(item => item.path === `/assets/work/${project.file}.mp4`)) throw new Error(`Missing workbench video evidence: ${project.id}`);
  }
}

export function renderWorkTeaser() {
  return `<section class="work-teaser" aria-labelledby="work-teaser-title"><div><div class="overline">BUILT AT THE WORKBENCH</div><h2 id="work-teaser-title">Projects from Whiskey House and Ignition<span class="accent">.</span></h2><p>Explore production and warehouse software, the customer portal, and the Ignition tools I work on.</p></div><a class="button primary" href="/work/">Explore work &amp; demos <span aria-hidden="true">&#8594;</span></a></section>`;
}

function renderWorkbenchVideos() {
  return `<section class="work-video-section" id="forge-walkthroughs" aria-labelledby="forge-videos-title"><div class="section-heading"><div><div class="overline">FORGE CORTEX / APPLICATION WALKTHROUGHS</div><h3 id="forge-videos-title">Explore and edit the plant model<span class="accent">.</span></h3></div><span class="section-aside">RECORDED FROM THE RUNNING APPLICATION</span></div><p class="work-section-intro">These Forge Cortex walkthroughs cover equipment queries, model authoring, type libraries, and changes drafted by an agent.</p><div class="work-video-grid">${workbenchVideos.map(video => `<figure class="work-video" id="${video.id}"><video controls playsinline preload="none" poster="/assets/work/${e(video.poster)}.jpg" width="1280" height="760" aria-label="Forge Cortex: ${e(video.title)}"><source src="${mediaUrl(`/assets/work/${video.file}.mp4`)}" type="video/mp4"><a href="${mediaUrl(`/assets/work/${video.file}.mp4`)}">Download the ${e(video.title)} walkthrough</a></video><figcaption><span class="work-badge">FORGE CORTEX / RECORDED WALKTHROUGH</span><h4>${e(video.title)}</h4><p>${e(video.description)}</p><a class="text-link demo-link" href="${mediaUrl(`/assets/work/${video.file}.mp4`)}" target="_blank" rel="noopener noreferrer">Open full-size recording <span aria-hidden="true">&#8599;</span></a></figcaption></figure>`).join('')}</div></section>`;
}

function renderPortalFilm() {
  const video = mediaUrl(`/assets/work/${portalFilm.file}.mp4`);
  return `<section class="portal-feature" id="customer-portal" aria-labelledby="portal-title"><div class="portal-feature-copy"><div class="overline">WHISKEY HOUSE / CUSTOMER PORTAL</div><h2 id="portal-title">From plant floor<br>to customer<span class="accent">.</span></h2><p>The customer portal brings production records, barrel inventory, and history into one view, including a 3D rickhouse.</p><p>Access is scoped to each customer. Production records stay traceable, and changes to the plant model go through review.</p><a class="text-link" href="${video}" target="_blank" rel="noopener noreferrer">Open the launch film <span aria-hidden="true">&#8599;</span></a></div><figure class="portal-feature-film"><video controls playsinline preload="none" poster="/assets/work/${portalFilm.poster}.jpg" width="1920" height="1080" aria-label="Whiskey House customer portal launch film"><source src="${video}" type="video/mp4"><a href="${video}">Watch the customer portal launch film</a></video><figcaption><span>PORTAL 2.0 / 57 SECOND LAUNCH FILM</span><span>DEMONSTRATION DATA</span></figcaption></figure></section>`;
}

function renderTerminalDemos() {
  const catalog = demos.map(demo => ({ ...demo, cast: mediaUrl(demo.cast) }));
  const first = catalog[0];
  return `<section class="work-section" id="demos" aria-labelledby="demos-title"><div class="section-heading"><div><div class="overline">02 / IGNITION TOOLS IN USE</div><h2 id="demos-title">Work from the terminal<span class="accent">.</span></h2></div><span class="section-aside">RECORDED TERMINAL SESSIONS</span></div><p class="work-section-intro">Four recorded sessions against an isolated Ignition gateway. Inspect tags and projects with the CLI or terminal UI, use MCP from an agent, and edit project resources in Neovim.</p><div class="recording-stage"><div class="recording-choices" role="group" aria-label="Choose a project recording" data-recording-controls hidden>${catalog.map((demo, index) => `<button type="button" data-recording-choice="${demo.clip}" aria-pressed="${index === 0}">${String(index + 1).padStart(2, '0')} / ${e(demo.title)}</button>`).join('')}</div><div class="recording-screen" data-terminal-player><p class="recording-fallback">${outbound(first.url, 'Watch the Ignition CLI recording')} or choose a walkthrough from the links below.</p></div><div class="recording-detail" aria-live="polite"><div class="work-badge">RECORDED SESSION</div><h3 data-recording-title>${e(first.title)}</h3><p data-recording-summary>${e(first.description)}</p><div class="source-project-links"><a href="${e(first.url)}" target="_blank" rel="noopener noreferrer" data-recording-guide>Written walkthrough &#8599;</a><a href="${e(first.cast)}" download data-recording-download>Download recording &#8595;</a></div></div></div><div class="recording-guide-links">${catalog.map(demo => outbound(demo.url, `${demo.title} walkthrough`)).join('')}</div><script type="application/json" id="recording-catalog">${JSON.stringify(catalog).replace(/</g, '\\u003c')}</script><script defer src="/assets/recordings/vendor/asciinema-player.min.js"></script><script defer src="/assets/recordings/player.js"></script></section>`;
}

export function renderWorkPage() {
  const stories = portfolio.whiskeyHouse.map(project => `<article class="work-story" id="${project.id}"><div class="work-story-heading"><div class="overline">${project.number} / ${e(project.area)}</div><p class="work-project-name">${e(project.name)}</p><h3>${e(project.title)}</h3>${tags(project.tags)}</div><div class="work-story-copy"><dl><div><dt>The problem</dt><dd>${e(project.problem)}</dd></div><div><dt>The work</dt><dd>${e(project.approach)}</dd></div><div><dt>Engineering focus</dt><dd>${e(project.focus)}</dd></div></dl>${project.demo ? `<a class="text-link project-link" href="${e(project.demo)}"${project.demo.startsWith('https:') ? ' target="_blank" rel="noopener noreferrer"' : ''}>${e(project.demoLabel)} <span aria-hidden="true">&#8599;</span></a>${project.access ? `<small class="work-demo-caption">${e(project.access)}</small>` : ''}` : '<a class="text-link project-link" href="/connect/">Talk through the MES work <span aria-hidden="true">&#8594;</span></a>'}</div></article>`).join('');
  const projects = portfolio.openSource.map(project => `<article class="source-project" id="${project.id}"><div class="overline">${e(project.label)}</div><h3><a class="project-link" href="${e(project.source)}" target="_blank" rel="noopener noreferrer">${e(project.title)} <span aria-hidden="true">&#8599;</span></a></h3><p>${e(project.description)}</p>${tags(project.tags)}<div class="source-project-links">${outbound(project.source, 'Source')}${project.docs ? outbound(project.docs, 'Docs') : ''}${project.recording ? outbound(project.recording, 'Watch recording') : ''}</div>${project.credit ? `<small class="work-credit">${e(project.credit)}</small>` : ''}</article>`).join('');
  return `<div class="wrap work-page">
    <header class="work-hero work-hero-graph"><div><div class="overline">PATRICK MANNION / SELECTED WORK</div><h1>A connected plant.<br><span class="accent">Governed end to end.</span></h1><p class="work-review">Portfolio reviewed <time datetime="${portfolio.reviewed}">${reviewedLabel()}</time></p></div><div class="work-hero-intro"><p>At Whiskey House I work on manufacturing software, barrel inventory, the customer portal, and industrial data. These demos connect the production records to equipment and historian readings, with customer access controls and review of model changes.</p><div class="hero-actions"><a class="button primary" href="#customer-portal">Watch the portal film <span aria-hidden="true">&#8595;</span></a><a class="text-link" href="#cortex-graph">Explore the graph <span aria-hidden="true">&#8595;</span></a></div></div></header>
    <nav class="work-jump" aria-label="Explore the portfolio"><a href="#cortex-graph">The graph</a><a href="#plant3d">3D &amp; history</a><a href="#customer-portal">Customer portal</a><a href="#whiskey-house">01 / Whiskey House</a><a href="#demos">02 / Tool demos</a><a href="#open-source">03 / Open source</a><a href="/lab/#github-work">GitHub activity &#8599;</a></nav>
    ${renderCortexGraph()}
    ${renderCortexScene()}
    ${renderPortalFilm()}
    <section class="work-section" id="whiskey-house" aria-labelledby="whiskey-title"><div class="section-heading"><div><div class="overline">01 / WHISKEY HOUSE</div><h2 id="whiskey-title">Software for making whiskey<span class="accent">.</span></h2></div><span class="section-aside">PRODUCTION / WAREHOUSE / DATA</span></div><p class="work-section-intro">Three areas of my work at Whiskey House: manufacturing execution, warehouse management, and Forge Cortex.</p><div class="work-stories">${stories}</div>${renderWorkbenchVideos()}</section>
    ${renderTerminalDemos()}
    <section class="work-section" id="open-source" aria-labelledby="open-source-title"><div class="section-heading"><div><div class="overline">03 / OPEN SOURCE</div><h2 id="open-source-title">Ignition tools, from editor to gateway<span class="accent">.</span></h2></div><span class="section-aside">SOURCE / GUIDES / WALKTHROUGHS</span></div><p class="work-section-intro">Source code, documentation, and recordings for the tools I work on. They cover gateway access, editor support, linting, and version control.</p><div class="open-source-grid">${projects}</div></section>
    <section class="work-contact"><div><div class="overline">HAVE A RELATED PROBLEM?</div><h2>Let’s compare notes<span class="accent">.</span></h2><p>Tell me what you’re building or which part of the work you’d like to see in more detail.</p></div><a class="button primary" href="/connect/">Talk to Patrick <span aria-hidden="true">&#8599;</span></a></section>
  </div>`;
}
