import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { site } from '../site.config.mjs';

export async function copyPublishedStats() {
  if (!site.siteUrl) return;
  try {
    const response = await fetch(new URL('/assets/github-stats.json', site.siteUrl), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const snapshot = await response.json();
    if (snapshot.username !== site.github.username || !Array.isArray(snapshot.days)) throw new Error('Unexpected snapshot');
    await writeFile(new URL('../dist/assets/github-stats.json', import.meta.url), JSON.stringify(snapshot));
    console.log('Preview uses the latest published GitHub snapshot.');
  } catch {
    console.warn('Published GitHub snapshot unavailable; preview will show the profile link.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await copyPublishedStats();
