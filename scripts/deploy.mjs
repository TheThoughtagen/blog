import { readdir, readFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const endpoint = 'https://here.now/api/v1/publish/awake-iris-z6ww';
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

export async function collectFiles(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix + entry.name;
    if (entry.name.startsWith('.') || entry.isSymbolicLink()) throw new Error(`Refusing hidden file or symlink: ${path}`);
    if (entry.isDirectory()) files.push(...await collectFiles(join(directory, entry.name), `${path}/`));
    else {
      const contentType = types[extname(path)];
      if (!contentType) throw new Error(`Unsupported public asset: ${path}`);
      const bytes = await readFile(join(directory, entry.name));
      files.push({ path, contentType, size: bytes.length, hash: createHash('sha256').update(bytes).digest('hex'), bytes });
    }
  }
  return files;
}

export async function deploy({ directory, key, fetcher = fetch }) {
  if (!key?.trim()) throw new Error('Set the HERENOW_API_KEY GitHub Actions secret before deploying.');
  const files = await collectFiles(directory);
  const byPath = new Map(files.map(file => [file.path, file]));
  if (!byPath.has('index.html')) throw new Error('Build dist/index.html before deploying.');
  async function api(url, method = 'GET', body) {
    if (url !== endpoint && url !== `${endpoint}/finalize`) throw new Error('Unexpected deployment API URL');
    const response = await fetcher(url, {
      method, redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-HereNow-Client': 'codex/github-actions' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`here.now ${method} failed (HTTP ${response.status}).${response.status === 409 ? ' The live version changed; reconcile before retrying.' : ''}`);
    return response.json();
  }
  const current = await api(endpoint);
  if (!current.currentVersionId) throw new Error('Existing site has no live version; refusing an unchecked replacement.');
  const staged = await api(endpoint, 'PUT', {
    files: files.map(({ bytes, ...metadata }) => metadata),
    baseVersionId: current.currentVersionId,
  });
  const upload = staged.upload;
  if (!upload?.versionId || !Array.isArray(upload.uploads) || upload.finalizeUrl !== `${endpoint}/finalize`) throw new Error('Invalid upload response');
  for (const target of upload.uploads) {
    const file = byPath.get(target.path);
    const url = new URL(target.url);
    if (!file || target.method !== 'PUT' || url.protocol !== 'https:' || !url.hostname.endsWith('.r2.cloudflarestorage.com')) throw new Error('Unexpected upload target');
    const response = await fetcher(url.href, {
      method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(60000),
      headers: { 'Content-Type': file.contentType }, body: file.bytes,
    });
    if (!response.ok) throw new Error(`Upload failed for ${file.path} (HTTP ${response.status}); site was not finalized.`);
  }
  const result = await api(upload.finalizeUrl, 'POST', { versionId: upload.versionId });
  if (!result.success || !result.siteUrl || !result.currentVersionId) throw new Error('Deployment was not confirmed by here.now.');
  return { siteUrl: result.siteUrl, versionId: result.currentVersionId, unchanged: Boolean(result.unchanged), files: files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await deploy({ directory: fileURLToPath(new URL('../dist/', import.meta.url)), key: process.env.HERENOW_API_KEY });
    console.log(`Published ${result.files} files: ${result.siteUrl} (${result.versionId})`);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `Deployed ${process.env.GITHUB_SHA || ''} to ${result.siteUrl}\n\nVersion: ${result.versionId}\n`);
  } catch (error) {
    // Avoid logging request objects, authorization headers, or signed upload URLs.
    console.error(error.message);
    process.exitCode = 1;
  }
}
