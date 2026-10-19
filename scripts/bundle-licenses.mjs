import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import fallbacks from './licenses/manifest.json' with { type: 'json' };

// Some published packages omit their license file. Keep version-pinned upstream
// copies locally so regeneration needs no network and cannot omit notices.
export async function bundleLicenseText(pkg) {
  const names = (await readdir(pkg.folder)).filter(name => /^(licen[cs]e|copying|notice)([._-]|$)/i.test(name)).sort();
  const texts = [], licenses = [];
  for (const name of names) {
    const text = await readFile(join(pkg.folder, name), 'utf8');
    texts.push(text);
    if (/^(licen[cs]e|copying)([._-]|$)/i.test(name)) licenses.push(text);
  }
  if (!names.some(name => /^(licen[cs]e|copying)([._-]|$)/i.test(name))) {
    const fallback = fallbacks[`${pkg.name}@${pkg.version}`];
    if (!fallback) throw new Error(`Missing full license text for ${pkg.name}@${pkg.version}`);
    for (const file of fallback.files) {
      const text = await readFile(new URL(`licenses/${file.path}`, import.meta.url), 'utf8');
      if (createHash('sha256').update(text).digest('hex') !== file.sha256) throw new Error(`License hash mismatch: ${file.path}`);
      texts.push(`Source: ${file.source}\n\n${text}`);
      licenses.push(text);
    }
  }
  if (licenses.some(text => text.trim().length < 100)) throw new Error(`Incomplete license text for ${pkg.name}@${pkg.version}`);
  return texts.join('\n\n');
}
