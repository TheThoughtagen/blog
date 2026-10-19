// Import a saved, read-only Forge Cortex GET /v1/graph response. The portfolio
// uses its schema and scale to generate randomized portfolio data. No original
// names, identities, paths or connections are published. Layout runs once here.
import { readFile, writeFile, mkdir, realpath, readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomizeCortexGraph, assertRandomizedGraph } from './randomize-cortex-graph.mjs';
import { renderGraphPoster } from './graph-poster.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const input = process.argv[2];
if (!input) throw new Error('Pass a saved Forge Cortex graph JSON response, followed optionally by the Cortex web checkout.');
const web = resolve(process.argv[3] || join(root, '../plant3d/forge-cortex/web'));
const require = createRequire(join(web, 'package.json'));
const Graph = require('graphology');
const forceAtlas2 = require('graphology-layout-forceatlas2');
const vite = await realpath(join(web, 'node_modules/vite'));
const esbuild = createRequire(join(vite, 'package.json'))('esbuild');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const rawBytes = await readFile(resolve(input));
const raw = JSON.parse(rawBytes);
if (!raw.scope?.asset_path || !raw.nodes?.length || !Array.isArray(raw.edges)) throw new Error('Expected a Forge Cortex scope graph response.');
const directory = join(root, 'public/assets/graph');
await mkdir(directory, { recursive: true });

const snapshot = randomizeCortexGraph(raw);
const { nodes, edges, counts } = snapshot;

const graph = new Graph({ type: 'directed', multi: true });
function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619) >>> 0;
  return h;
}
for (const node of nodes) {
  const h = hash(node.id);
  graph.addNode(node.id, { x: (h & 0xffff) / 0xffff - .5, y: (h >>> 16) / 0xffff - .5, size: node.kind === 'historian' ? 1.5 : 6 });
}
for (const edge of edges) graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, { weight: 1 });
const started = Date.now();
forceAtlas2.assign(graph, {
  iterations: 240,
  settings: { ...forceAtlas2.inferSettings(graph), barnesHutOptimize: true, barnesHutTheta: .7, gravity: .7, scalingRatio: 8, slowDown: 3, adjustSizes: false },
});
for (const node of nodes) {
  const p = graph.getNodeAttributes(node.id);
  node.x = Math.round(p.x * 10000) / 10000;
  node.y = Math.round(p.y * 10000) / 10000;
  if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new Error('Nonfinite graph layout.');
}

// Bundle the graph engine already used by Cortex. No installation or remote
// script is needed by the portfolio or its deployment workflow.
const bundle = await esbuild.build({
  stdin: { contents: "export { default as Graph } from 'graphology'; export { default as Sigma } from 'sigma';", resolveDir: web },
  bundle: true, format: 'esm', target: 'es2020', minify: true, legalComments: 'eof',
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: join(directory, 'vendor.js'), metafile: true, logLevel: 'silent',
});
const packages = new Map();
for (const filename of Object.keys(bundle.metafile.inputs).filter(name => name !== '<stdin>')) {
  let folder = dirname(resolve(filename));
  // esbuild input keys may be relative to cwd or to the imported checkout.
  try { await stat(folder); } catch { folder = dirname(resolve(web, filename)); }
  while (folder !== dirname(folder)) {
    try {
      const pkg = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8'));
      if (pkg.name) packages.set(`${pkg.name}@${pkg.version}`, { folder, ...pkg });
      break;
    } catch { folder = dirname(folder); }
  }
}
let licenses = 'Graph viewer libraries bundled from the existing Forge Cortex web checkout.\n\n';
for (const [name, pkg] of packages) {
  licenses += `\n${name} (${pkg.license || 'see license'})\n`;
  const files = await readdir(pkg.folder);
  for (const filename of files.filter(name => /^(license|copying)(\.|$)/i.test(name))) licenses += '\n' + await readFile(join(pkg.folder, filename), 'utf8') + '\n';
}
await writeFile(join(directory, 'LICENSES.txt'), licenses);

const inventory = {
  nodes: nodes.map(node => node.id).sort(),
  edges: edges.map(edge => [edge.id, edge.type, edge.source, edge.target]).sort((a, b) => a[0].localeCompare(b[0])),
};
snapshot.inventorySha256 = sha(JSON.stringify(inventory));
assertRandomizedGraph(snapshot);
const json = JSON.stringify(snapshot);
await writeFile(join(directory, 'cortex.json'), json);

// The fallback contains only the randomized demo graph.
const svg = renderGraphPoster(snapshot);
await writeFile(join(directory, 'cortex.svg'), svg);
const metadata = {
  source: snapshot.source, scope: snapshot.scope, randomized: true,
  dataNotice: snapshot.dataNotice, nodeCount: nodes.length, edgeCount: edges.length, counts,
  inventorySha256: snapshot.inventorySha256,
  snapshotSha256: sha(json), posterSha256: sha(svg),
  graphEngine: 'Sigma / Graphology (same libraries as Forge Cortex)',
  libraries: [...packages.keys()],
};
await writeFile(join(root, 'content/cortex-graph.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify({ nodes: nodes.length, edges: edges.length, counts, layoutSeconds: (Date.now() - started) / 1000, libraries: metadata.libraries }, null, 2));
