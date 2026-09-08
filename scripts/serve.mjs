import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';
import { copyPublishedStats } from './preview-stats.mjs';

await build();
await copyPublishedStats();
const root = fileURLToPath(new URL('../dist', import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.md': 'text/markdown; charset=utf-8', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };
createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let path = resolve(root, `.${pathname}`);
    if (!path.startsWith(root + sep) && path !== root) { response.writeHead(403); response.end('Forbidden'); return; }
    if ((await stat(path)).isDirectory()) {
      if (!pathname.endsWith('/')) { const destination = relative(root, path).split(sep).filter(Boolean).map(encodeURIComponent).join('/'); response.writeHead(302, { Location: destination ? `/${destination}/` : '/' }); response.end(); return; }
      path = resolve(path, 'index.html');
    }
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : await readFile(resolve(root, '404.html')));
  }
}).listen(port, '127.0.0.1', () => console.log(`FIELDNOTES preview: http://127.0.0.1:${port}`));
