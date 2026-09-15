import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { access, cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { build } from '../scripts/build.mjs';

const require = createRequire(import.meta.url);
let playwrightCli;
try {
  const packagePath = require.resolve('@playwright/cli/package.json');
  const packageMetadata = JSON.parse(await readFile(packagePath, 'utf8'));
  const binPath = packageMetadata.bin?.['playwright-cli'];
  if (typeof binPath !== 'string' || binPath === '') throw new Error('package does not declare the playwright-cli binary');
  playwrightCli = resolve(dirname(packagePath), binPath);
  await access(playwrightCli);
} catch (error) {
  throw new Error('Local @playwright/cli is unavailable. Run npm ci before the browser gate.', { cause: error });
}

const session = `fieldnotes-markdown-${process.pid}`;
const workspace = await mkdtemp(join(tmpdir(), 'fieldnotes-browser-'));
const rootDir = join(workspace, 'project');
const contentDir = join(rootDir, 'posts');
const outputDir = join(rootDir, 'site');
const emptyContentDir = join(rootDir, 'empty-posts');
const emptyOutputDir = join(rootDir, 'empty-site');
const runner = join(workspace, 'checks.js');
const types = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
};

await mkdir(join(contentDir, 'renderer-contract/images'), { recursive: true });
await mkdir(emptyContentDir, { recursive: true });
await cp(resolve('public'), join(rootDir, 'public'), { recursive: true });
await cp(resolve('frontmatter.schema.json'), join(rootDir, 'frontmatter.schema.json'));
await writeFile(join(rootDir, 'public/assets/github-stats.json'), JSON.stringify({
  username: 'TheThoughtagen', total: 0, restricted: 0, pullRequests: 0,
  commits: 0, reviews: 0, issues: 0, repositories: 0, followers: 0,
  from: '2026-09-15T00:00:00Z', to: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z', days: [],
}));
const source = `---
title: "Renderer contract"
description: "A browser conformance fixture."
date: "2026-09-15"
category: "Development"
tags: ["Café"]
featured: true
---
## Observable heading

Trace the purple semaphore through the browser.

### Nested signal

| Signal | State |
| --- | --- |
| Renderer | Ready |

\`\`\`javascript
const extremelyLongDiagnosticIdentifier = 'this line is intentionally wider than a mobile article';
\`\`\`

Inline math $x^2 + y^2 = z^2$.

![Local signal chart](images/chart.svg "Gateway status")

Evidence remains attached to the observation.[^evidence]

[^evidence]: Browser-visible supporting evidence.

\`\`\`mermaid
flowchart LR
  Source --> Preview
\`\`\`
`;
await writeFile(join(contentDir, 'renderer-contract/index.md'), source);
await writeFile(join(contentDir, 'renderer-contract/images/chart.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 240"><rect width="640" height="240" fill="#263020"/><path d="M40 180 200 60 360 150 600 40" fill="none" stroke="#b6e889" stroke-width="12"/></svg>');
await build({ rootDir, contentDir: emptyContentDir, outputDir: emptyOutputDir });
await build({ rootDir, contentDir, outputDir });

const { renderDocument } = await import('@cruciblesoftware/fieldnotes-renderer');
const { conformanceCases } = await import('@cruciblesoftware/fieldnotes-renderer/conformance');
const browserConformance = await Promise.all(conformanceCases.map(async (fixture) => ({
  name: fixture.name,
  html: (await renderDocument(fixture.source, fixture.options)).html,
  expected: fixture.expected.hydratedDom,
})));
const articleShell = await readFile(join(outputDir, 'notes/renderer-contract/index.html'), 'utf8');
const articleOpen = '<article class="article-body">';
const articleBodyStart = articleShell.indexOf(articleOpen) + articleOpen.length;
const articleBodyEnd = articleShell.indexOf('<div class="article-end">', articleBodyStart);
if (articleBodyStart < articleOpen.length || articleBodyEnd < articleBodyStart) throw new Error('Generated article shell markers are missing.');
for (const fixture of browserConformance) {
  const directory = join(outputDir, '__conformance', fixture.name);
  await mkdir(join(directory, 'images'), { recursive: true });
  const shell = `${articleShell.slice(0, articleBodyStart)}<main id="fixture">${fixture.html}</main>${articleShell.slice(articleBodyEnd)}`;
  await writeFile(join(directory, 'index.html'), shell);
  await writeFile(join(directory, 'images/chart.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 10 10 0" stroke="black"/></svg>');
  await writeFile(join(directory, 'images/unsafe.png'), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'));
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const servesEmptySite = pathname === '/__empty/' || pathname.startsWith('/__empty/');
    const servedRoot = servesEmptySite ? emptyOutputDir : outputDir;
    const servedPathname = servesEmptySite ? pathname.slice('/__empty'.length) : pathname;
    let path = resolve(servedRoot, `.${servedPathname}`);
    if (path !== servedRoot && !path.startsWith(servedRoot + sep)) {
      response.writeHead(403); response.end('Forbidden'); return;
    }
    if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404); response.end('Not found');
  }
});
await new Promise((resolveListening) => server.listen(0, '127.0.0.1', resolveListening));
const { port } = server.address();
const base = `http://127.0.0.1:${port}`;

async function browserChecks(page) {
  const base = '__BASE__';
  const conformance = "__CONFORMANCE__";
  const localFailures = [];
  const pageErrors = [];
  const remoteScripts = [];
  const consoleErrors = [];
  const searchIndexRequests = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.url().startsWith(base) && response.status() >= 400) {
      localFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.startsWith('https://api.github.com/')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (url.startsWith(base)) {
      if (url.includes('/assets/data.json')) searchIndexRequests.push(url);
      return route.continue();
    }
    if (request.resourceType() === 'script') remoteScripts.push(url);
    if (request.resourceType() === 'image') {
      return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>' });
    }
    if (request.resourceType() === 'document') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Blocked fixture embed</title>' });
    }
    return route.abort('blockedbyclient');
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  await page.goto(base + '/notes/renderer-contract/');
  await page.locator('.article-body svg.flowchart').waitFor({ timeout: 15000 }).catch(async (error) => {
    const state = await page.locator('.fieldnotes-mermaid').evaluate((node) => node.outerHTML).catch(() => 'missing placeholder');
    const body = await page.locator('body').innerText().catch(() => 'missing body');
    throw new Error(`Mermaid did not hydrate: ${error.message}; URL: ${page.url()}; page errors: ${pageErrors.join(' | ')}; local failures: ${localFailures.join(' | ')}; state: ${state}; body: ${body.slice(0, 500)}`);
  });
  const normalized = await page.evaluate(async () => {
    const appUrl = document.querySelector('script[src*="/assets/app.js"]').src;
    const { normalizeRenderedDom } = await import(appUrl);
    return normalizeRenderedDom(document.querySelector('.article-body svg.flowchart'));
  });
  check(normalized.includes('<svg'), 'Mermaid hydration produces normalized SVG output');
  await page.reload();
  await page.locator('.article-body svg.flowchart').waitFor();
  const normalizedAgain = await page.evaluate(async () => {
    const appUrl = document.querySelector('script[src*="/assets/app.js"]').src;
    const { normalizeRenderedDom } = await import(appUrl);
    return normalizeRenderedDom(document.querySelector('.article-body svg.flowchart'));
  });
  check(normalizedAgain === normalized, 'Mermaid normalized DOM is deterministic across hydration runs');

  const richSelectors = [
    ['table', 'Markdown table'], ['pre code', 'highlighted code'], ['.katex', 'math'],
    ['figure img', 'figure image'], ['.fieldnotes-mermaid, svg.flowchart', 'Mermaid'],
    ['.footnotes', 'footnotes'], ['a.tag-link', 'tag link'], ['.reading-aside ol ol', 'nested H3 table of contents'],
  ];
  for (const [selector, label] of richSelectors) {
    check(await page.locator(selector).first().isVisible(), `${label} is visibly rendered in the article shell`);
  }
  const mathLayout = await page.locator('.article-body .katex').evaluate((node) => {
    const mathml = node.querySelector('.katex-mathml');
    const html = node.querySelector('.katex-html');
    const mathmlStyle = getComputedStyle(mathml);
    const htmlStyle = getComputedStyle(html);
    return {
      mathmlPosition: mathmlStyle.position,
      mathmlWidth: mathml.getBoundingClientRect().width,
      mathmlHeight: mathml.getBoundingClientRect().height,
      htmlVisible: htmlStyle.display !== 'none' && html.getBoundingClientRect().width > 0 && html.getBoundingClientRect().height > 0,
      fontFamily: getComputedStyle(node).fontFamily,
    };
  });
  check(mathLayout.mathmlPosition === 'absolute' && mathLayout.mathmlWidth <= 1 && mathLayout.mathmlHeight <= 1, 'KaTeX keeps accessible MathML visually hidden');
  check(mathLayout.htmlVisible && mathLayout.fontFamily.includes('KaTeX_Main'), 'KaTeX lays out one visible formatted HTML branch with its local font');
  const desktopLayout = await page.evaluate(() => ({
    columns: getComputedStyle(document.querySelector('.reading-layout')).gridTemplateColumns,
    tocPosition: getComputedStyle(document.querySelector('.reading-aside')).position,
    codeOverflow: getComputedStyle(document.querySelector('.article-body pre')).overflowX,
    tableOverflow: getComputedStyle(document.querySelector('.article-body table')).overflowX,
    imageMaxWidth: getComputedStyle(document.querySelector('.article-body figure img')).maxWidth,
  }));
  check(desktopLayout.columns.split(' ').length >= 2, 'Desktop article keeps content and nested TOC in separate columns');
  check(desktopLayout.tocPosition === 'sticky', 'Desktop nested TOC remains sticky');
  check(['auto', 'scroll'].includes(desktopLayout.codeOverflow), 'Code blocks are independently overflow-safe');
  check(['auto', 'scroll'].includes(desktopLayout.tableOverflow), 'Tables are independently overflow-safe');
  check(desktopLayout.imageMaxWidth === '100%', 'Article images are responsive');

  for (const selector of ['a.tag-link', '.reading-aside a', '[data-copy-markdown]']) {
    const element = page.locator(selector).first();
    await element.focus();
    check(await element.evaluate((node) => {
      const style = getComputedStyle(node);
      return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
    }), `${selector} has a visible keyboard focus outline`);
  }

  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.copiedMarkdown = text; } } }));
  await page.locator('[data-copy-markdown]').click();
  const expectedMarkdown = await (await page.request.get(base + '/notes/renderer-contract/index.md')).text();
  check(await page.evaluate(() => window.copiedMarkdown) === expectedMarkdown, 'Copied Markdown equals the exact generated download');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Permission denied'); } } }));
  await page.locator('[data-copy-markdown]').click();
  check((await page.locator('.toast').textContent()).includes('Download .md'), 'Clipboard denial points to the Markdown download');

  for (const [query, label] of [['Observable heading', 'heading-only'], ['purple semaphore', 'body-only']]) {
    await page.keyboard.press('Meta+k');
    await page.locator('#command-input').fill(query);
    const result = page.locator('#command-results a.command-result').first();
    await result.waitFor();
    check(await result.getAttribute('href') === '/notes/renderer-contract/', `${label} search resolves the field note`);
    check((await result.locator('small').textContent()).endsWith('Field note'), `${label} search uses the Field note label`);
    await page.keyboard.press('Escape');
  }

  await page.setViewportSize({ width: 390, height: 844 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Article controls and rendered Markdown fit mobile');
  const mobileLayout = await page.evaluate(() => ({
    direction: getComputedStyle(document.querySelector('.reading-layout')).flexDirection,
    tocPosition: getComputedStyle(document.querySelector('.reading-aside')).position,
    articleWidth: document.querySelector('.article-body').getBoundingClientRect().width,
    viewportWidth: innerWidth,
    richOverflow: [...document.querySelectorAll('.article-body table, .article-body pre, .article-body svg, .article-body figure')]
      .every((node) => node.getBoundingClientRect().right <= innerWidth + 1),
  }));
  check(mobileLayout.direction === 'column' && mobileLayout.tocPosition === 'static', 'Mobile article stacks the nested TOC above the body');
  check(mobileLayout.articleWidth < mobileLayout.viewportWidth && mobileLayout.richOverflow, 'Rich Markdown stays inside the mobile viewport');
  check(searchIndexRequests.length > 0 && searchIndexRequests.every((url) => /\/assets\/data\.json\?v=[a-f0-9]{12}$/.test(url)), 'Cmd+K requests the current versioned search index');

  await page.locator('a.tag-link', { hasText: 'Café' }).click();
  await page.waitForURL(/\/tags\/caf%C3%A9\/$/i);
  check(await page.locator('h1').textContent() === 'Café.', 'Unicode tag archive is reachable through a decoded static route');
  check(await page.locator('.tag-archive').isVisible(), 'Tag archive is visibly rendered');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Tag archive fits the mobile viewport');

  await page.goto(base + '/__empty/');
  const emptyState = page.locator('.empty-notebook, .publication-empty').first();
  check(await emptyState.isVisible(), 'Default empty publication state is visible');
  check((await emptyState.innerText()).includes('First field note in progress.'), 'Empty publication state explains that the first note is in progress');
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Default empty publication has no mobile horizontal overflow');

  await page.goto(base + '/lab/');
  const cards = await page.locator('.ignition-project-card').evaluateAll((elements) => elements.map((card) => ({
    name: card.querySelector('h3').textContent,
    documentationUrl: card.querySelector('a').href,
  })));
  check(cards.length === 5, 'All five Ignition Lab cards are present');
  for (const card of cards) {
    await page.keyboard.press('Meta+k');
    await page.locator('#command-input').fill(card.name);
    const result = page.locator('#command-results a.command-result').first();
    await result.waitFor();
    check(await result.getAttribute('href') === card.documentationUrl, `${card.name} search and Lab documentation URLs agree`);
    await page.keyboard.press('Escape');
  }

  for (const fixture of conformance) {
    await page.goto(`${base}/__conformance/${fixture.name}/`);
    await page.waitForFunction(() => document.querySelectorAll('.article-body pre.fieldnotes-mermaid').length === 0);
    check(await page.locator('.article-body > #fixture').count() === 1, `${fixture.name} runs inside a generated article shell`);
    if (fixture.name === 'mermaid') {
      check(await page.locator('.article-body #fixture > svg.flowchart').count() === 1, 'App hydration renders the valid conformance diagram');
      check(await page.locator('.article-body #fixture > .fieldnotes-mermaid-error').count() === 1, 'App hydration preserves the malformed conformance diagram as an error state');
    }
    const actual = await page.evaluate(async () => {
      const appUrl = document.querySelector('script[src*="/assets/app.js"]').src;
      const { normalizeRenderedDom } = await import(appUrl);
      return normalizeRenderedDom(document.querySelector('.article-body #fixture'));
    });
    if (actual !== fixture.expected) {
      const mismatch = [...actual].findIndex((character, index) => character !== fixture.expected[index]);
      throw new Error(`${fixture.name} hydrated DOM mismatch at ${mismatch}; actual=${actual.slice(Math.max(0, mismatch - 120), mismatch + 240)}; expected=${fixture.expected.slice(Math.max(0, mismatch - 120), mismatch + 240)}`);
    }
  }

  check(consoleErrors.length === 0, `Renderer and blog shell emit zero browser console errors: ${consoleErrors.join(' | ')}`);

  check(remoteScripts.length === 0, `No remote scripts requested: ${remoteScripts.join(', ')}`);
  check(localFailures.length === 0, `No local asset or chunk failures: ${localFailures.join(', ')}`);
  check(pageErrors.length === 0, `No browser page errors: ${pageErrors.join(', ')}`);
  return { cards: cards.length, normalizedLength: normalized.length };
}

function command(args) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(process.execPath, [playwrightCli, `-s=${session}`, ...args], {
      cwd: resolve('.'),
      env: { ...process.env, NO_UPDATE_NOTIFIER: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', rejectCommand);
    child.on('close', (code) => code === 0 ? resolveCommand(output) : rejectCommand(new Error(`playwright-cli ${args[0]} failed (${code}):\n${output}`)));
  });
}

try {
  await access(outputDir);
  const browserExpectations = browserConformance.map(({ name, expected }) => ({ name, expected }));
  await writeFile(runner, `(${browserChecks.toString().replace('__BASE__', base).replace('"__CONFORMANCE__"', JSON.stringify(browserExpectations))})`);
  await command(['open', base + '/notes/renderer-contract/', '--browser=chrome']);
  const result = await command(['run-code', `--filename=${runner}`]);
  process.stdout.write(result);
} finally {
  await command(['close']).catch(() => {});
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(workspace, { recursive: true, force: true });
}
