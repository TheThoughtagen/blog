import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';
import { build } from '../scripts/build.mjs';

const session = `fieldnotes-markdown-${process.pid}`;
const workspace = await mkdtemp(join(tmpdir(), 'fieldnotes-browser-'));
const rootDir = join(workspace, 'project');
const contentDir = join(rootDir, 'posts');
const outputDir = join(rootDir, 'site');
const runner = join(workspace, 'checks.js');
const types = {
  '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8', '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
};

await mkdir(join(contentDir, 'renderer-contract'), { recursive: true });
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

\`\`\`mermaid
flowchart LR
  Source --> Preview
\`\`\`
`;
await writeFile(join(contentDir, 'renderer-contract/index.md'), source);
await build({ rootDir, contentDir, outputDir });

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let path = resolve(outputDir, `.${pathname}`);
    if (path !== outputDir && !path.startsWith(outputDir + sep)) {
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
  const localFailures = [];
  const pageErrors = [];
  const remoteScripts = [];
  const searchIndexRequests = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); };
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url().startsWith(base) && response.status() >= 400) {
      localFailures.push(`${response.status()} ${response.url()}`);
    }
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    if (url.startsWith(base)) {
      if (url.includes('/assets/data.json')) searchIndexRequests.push(url);
      return route.continue();
    }
    if (request.resourceType() === 'script') remoteScripts.push(url);
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
  check(searchIndexRequests.length > 0 && searchIndexRequests.every((url) => /\/assets\/data\.json\?v=[a-f0-9]{12}$/.test(url)), 'Cmd+K requests the current versioned search index');

  await page.locator('a.tag-link', { hasText: 'Café' }).click();
  await page.waitForURL(/\/tags\/caf%C3%A9\/$/i);
  check(await page.locator('h1').textContent() === 'Café.', 'Unicode tag archive is reachable through a decoded static route');

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

  check(remoteScripts.length === 0, `No remote scripts requested: ${remoteScripts.join(', ')}`);
  check(localFailures.length === 0, `No local asset or chunk failures: ${localFailures.join(', ')}`);
  check(pageErrors.length === 0, `No browser page errors: ${pageErrors.join(', ')}`);
  return { cards: cards.length, normalizedLength: normalized.length };
}

function command(args) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn('playwright-cli', [`-s=${session}`, ...args], { cwd: resolve('.'), stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.on('error', rejectCommand);
    child.on('close', (code) => code === 0 ? resolveCommand(output) : rejectCommand(new Error(`playwright-cli ${args[0]} failed (${code}):\n${output}`)));
  });
}

try {
  await access(outputDir);
  await writeFile(runner, `(${browserChecks.toString().replace('__BASE__', base)})`);
  await command(['open', base + '/notes/renderer-contract/', '--browser=chrome']);
  const result = await command(['run-code', `--filename=${runner}`]);
  process.stdout.write(result);
} finally {
  await command(['close']).catch(() => {});
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(workspace, { recursive: true, force: true });
}
