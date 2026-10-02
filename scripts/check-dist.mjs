import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Pre-deploy check: everything in dist/ is published, so refuse hidden files, symlinks, and unexpected types.
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4', '.md': 'text/markdown; charset=utf-8', '.vcf': 'text/vcard; charset=utf-8', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' };

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

export async function verifyDist(directory) {
  const files = await collectFiles(directory);
  if (!files.some(file => file.path === 'index.html')) throw new Error('Build dist/index.html before deploying.');
  return { files: files.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await verifyDist(fileURLToPath(new URL('../dist/', import.meta.url)));
    console.log(`dist/ is ready to deploy: ${result.files} files.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
