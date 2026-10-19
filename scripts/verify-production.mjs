import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const assets = ['assets/styles.css', 'assets/app.js', 'assets/cortex-graph.js', 'assets/plant3d/app.js', 'assets/plant3d/vendor.js'];

export async function verifyProduction({
  directory = fileURLToPath(new URL('../dist/', import.meta.url)),
  origin = 'https://patrickmannion.dev',
  revision = process.env.DEPLOY_REVISION,
  fetchImpl = fetch,
  attempts = 12,
  delayMs = 5000,
  onRetry = () => {},
} = {}) {
  if (!/^[a-f0-9]{40}$/.test(revision || '')) throw new Error('DEPLOY_REVISION must be a full Git commit SHA.');
  const base = new URL(origin);
  if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('Use an http(s) origin without credentials, a path, or a query.');
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error('Provide at least one verification attempt.');
  const marker = `<meta name="deployment-revision" content="${revision}">`;
  const checks = [];
  for (const [path, file] of [['/', 'index.html'], ['/work/', 'work/index.html']]) {
    const html = await readFile(join(directory, file), 'utf8');
    if (!html.includes(marker)) throw new Error(`Build ${file} with DEPLOY_REVISION=${revision} before verifying production.`);
    checks.push({ path, marker, type: /^text\/html\b/i });
  }
  for (const file of assets) {
    checks.push({ path: '/' + file, hash: sha256(await readFile(join(directory, file))), type: file.endsWith('.css') ? /^text\/css\b/i : /^(?:text|application)\/javascript\b/i });
  }
  let failures;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const results = await Promise.allSettled(checks.map(async check => {
      // Verify the public hostname itself. A redirect to a working preview must
      // not hide a misconfigured domain, and cache-busting must not hide stale URLs.
      const response = await fetchImpl(new URL(check.path, base).href, { redirect: 'error', headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(10000) });
      if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
      if (!check.type.test(response.headers.get('content-type') || '')) throw new Error('Unexpected content type');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (check.marker && !bytes.toString('utf8').includes(check.marker)) throw new Error(`Expected revision ${revision}`);
      if (check.hash && sha256(bytes) !== check.hash) throw new Error('Content differs from this build');
    }));
    failures = results.flatMap((result, index) => result.status === 'rejected' ? [`${checks[index].path}: ${result.reason.message}`] : []);
    if (!failures.length) return { origin: base.origin, revision, checks: checks.length };
    if (attempt < attempts) {
      onRetry(`Waiting for ${base.origin} (${attempt}/${attempts}): ${failures.join('; ')}`);
      await delay(delayMs);
    }
  }
  throw new Error(`Deployment verification failed for ${base.origin}:\n${failures.join('\n')}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await verifyProduction({ origin: process.argv[2] || 'https://patrickmannion.dev', onRetry: console.warn });
    console.log(`Verified ${result.origin} at ${result.revision}: ${result.checks} page and asset checks passed.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
