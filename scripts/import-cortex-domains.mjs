// Extend the randomized showcase with Cortex's validated, fictional model.
// Source labels, record IDs, properties, drawing refs and review refs stay out.
import { randomUUID, randomInt, createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { demoNodeSchema, demoSource, emptyCounts, assertRandomizedGraph } from './randomize-cortex-graph.mjs';
import { renderGraphPoster } from './graph-poster.mjs';

const baseKinds = new Set(['equipment', 'historian', 'document']);
const sha = value => createHash('sha256').update(value).digest('hex');
const shuffle = input => {
  const items = [...input];
  for (let i = items.length - 1; i > 0; i--) { const j = randomInt(i + 1); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
};

export function extendWithDomains(base, model) {
  if (model.model !== 'connected-plant-demo' || !Array.isArray(model.entities) || !Array.isArray(model.relationships)) throw new Error('Use the validated, fictional connected-plant-demo export.');
  const snapshot = structuredClone(base);
  delete snapshot.layouts;
  snapshot.nodes = snapshot.nodes.filter(node => baseKinds.has(node.kind));
  const kept = new Set(snapshot.nodes.map(node => node.id));
  snapshot.edges = snapshot.edges.filter(edge => kept.has(edge.source) && kept.has(edge.target));
  snapshot.counts = emptyCounts();
  for (const node of snapshot.nodes) snapshot.counts[node.kind]++;
  assertRandomizedGraph(snapshot);
  const units = shuffle(snapshot.nodes.filter(node => node.type === 'Unit'));
  const mapping = new Map();
  const sequence = new Map();
  for (const entity of shuffle(model.entities)) {
    if (mapping.has(entity.id)) throw new Error('Duplicate demo model identity.');
    if (entity.type === 'isa88:Unit') {
      const unit = units.pop();
      if (!unit) throw new Error('Not enough demonstration equipment.');
      mapping.set(entity.id, unit.id);
      continue;
    }
    const spec = demoNodeSchema[entity.type];
    if (!spec || baseKinds.has(spec[0])) throw new Error('Unsupported demo domain type.');
    const [kind, prefix] = spec;
    const number = (sequence.get(entity.type) || 0) + 1;
    sequence.set(entity.type, number);
    const label = `${prefix} ${String(number).padStart(2, '0')}`;
    const anchor = snapshot.nodes.find(node => node.type === 'Unit');
    const node = {
      id: `n-${randomUUID()}`, type: entity.type, kind, label,
      path: `demo/${kind}/${label.toLowerCase().replaceAll(' ', '-')}`, source: demoSource,
      x: anchor.x + randomInt(100) - 50, y: anchor.y + randomInt(100) - 50,
    };
    snapshot.nodes.push(node); snapshot.counts[kind]++;
    mapping.set(entity.id, node.id);
  }
  for (const relation of model.relationships) {
    const source = mapping.get(relation.from), target = mapping.get(relation.to);
    if (!source || !target) throw new Error('Unresolved demo model relationship.');
    snapshot.edges.push({ id: `e-${randomUUID()}`, type: relation.type, source, target });
  }
  assertRandomizedGraph(snapshot);
  return snapshot;
}

async function main() {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const input = process.argv[2];
  if (!input) throw new Error('Pass a Cortex export --json of the connected-plant-demo model.');
  const base = JSON.parse(await readFile(join(root, 'public/assets/graph/cortex.json'), 'utf8'));
  const model = JSON.parse(await readFile(resolve(input), 'utf8'));
  const snapshot = extendWithDomains(base, model);
  const web = resolve(process.argv[3] || join(root, '../plant3d/forge-cortex/web'));
  const require = createRequire(join(web, 'package.json'));
  const Graph = require('graphology');
  const forceAtlas2 = require('graphology-layout-forceatlas2');
  const graph = new Graph({ type: 'directed', multi: true });
  for (const node of snapshot.nodes) graph.addNode(node.id, { x: node.x, y: node.y, size: node.kind === 'historian' ? 1.5 : 6 });
  for (const edge of snapshot.edges) graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, { weight: 1 });
  forceAtlas2.assign(graph, { iterations: 100, settings: { ...forceAtlas2.inferSettings(graph), barnesHutOptimize: true, barnesHutTheta: .7, gravity: .7, scalingRatio: 8, slowDown: 3, adjustSizes: false } });
  for (const node of snapshot.nodes) {
    const position = graph.getNodeAttributes(node.id);
    node.x = Math.round(position.x * 10000) / 10000; node.y = Math.round(position.y * 10000) / 10000;
  }
  // A second layout is solved without historian tags so the workflow view
  // has room for record names, terminal pairs, ports, orders and recipes.
  const workflowNodes = snapshot.nodes.filter(node => ['equipment', 'mes', 'cmms', 'electrical', 'process'].includes(node.kind));
  const workflowIDs = new Set(workflowNodes.map(node => node.id));
  const workflow = new Graph({ type: 'directed', multi: true });
  workflowNodes.forEach((node, i) => workflow.addNode(node.id, { x: Math.cos(i * 2.399) * Math.sqrt(i + 1) * 30, y: Math.sin(i * 2.399) * Math.sqrt(i + 1) * 30, size: 6 }));
  for (const edge of snapshot.edges) if (workflowIDs.has(edge.source) && workflowIDs.has(edge.target)) workflow.addDirectedEdgeWithKey(edge.id, edge.source, edge.target);
  forceAtlas2.assign(workflow, { iterations: 650, settings: { ...forceAtlas2.inferSettings(workflow), barnesHutOptimize: true, barnesHutTheta: .6, gravity: .5, scalingRatio: 40, slowDown: 5, adjustSizes: false } });
  const extent = Math.max(...snapshot.nodes.map(node => Math.abs(node.x)), ...snapshot.nodes.map(node => Math.abs(node.y)), 100);
  const positions = workflowNodes.map(node => workflow.getNodeAttributes(node.id));
  const minX = Math.min(...positions.map(p => p.x)), maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y)), maxY = Math.max(...positions.map(p => p.y));
  const scale = extent * 1.5 / Math.max(maxX - minX, maxY - minY, 1);
  snapshot.layouts = { workflows: Object.fromEntries(workflowNodes.map(node => {
    const p = workflow.getNodeAttributes(node.id);
    return [node.id, { x: Math.round((p.x - (minX + maxX) / 2) * scale * 10000) / 10000, y: Math.round((p.y - (minY + maxY) / 2) * scale * 10000) / 10000 }];
  })) };
  const inventory = {
    nodes: snapshot.nodes.map(node => node.id).sort(),
    edges: snapshot.edges.map(edge => [edge.id, edge.type, edge.source, edge.target]).sort((a, b) => a[0].localeCompare(b[0])),
  };
  snapshot.inventorySha256 = sha(JSON.stringify(inventory));
  assertRandomizedGraph(snapshot);
  const json = JSON.stringify(snapshot), poster = renderGraphPoster(snapshot);
  const metadataPath = join(root, 'content/cortex-graph.json');
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8'));
  Object.assign(metadata, {
    nodeCount: snapshot.nodes.length, edgeCount: snapshot.edges.length, counts: snapshot.counts,
    inventorySha256: snapshot.inventorySha256, snapshotSha256: sha(json), posterSha256: sha(poster),
    domains: { source: 'Validated Cortex connected-plant scale model', fictional: true, nodeTypes: [...new Set(model.entities.map(entity => entity.type))].sort() },
  });
  await writeFile(join(root, 'public/assets/graph/cortex.json'), json);
  await writeFile(join(root, 'public/assets/graph/cortex.svg'), poster);
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n');
  console.log(JSON.stringify({ nodes: metadata.nodeCount, edges: metadata.edgeCount, layers: metadata.counts }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
