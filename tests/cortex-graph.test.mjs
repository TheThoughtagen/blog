import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import snapshot from '../public/assets/graph/cortex.json' with { type: 'json' };
import info from '../content/cortex-graph.json' with { type: 'json' };
import { kinds, indexSnapshot, searchNodes, visibleCounts } from '../public/assets/graph/model.js';
import { extendWithDomains } from '../scripts/import-cortex-domains.mjs';
import { renderCortexGraph, validateCortexGraph } from '../scripts/graph-showcase.mjs';
import { randomizeCortexGraph, assertRandomizedGraph } from '../scripts/randomize-cortex-graph.mjs';
import { nodeProperties } from '../public/assets/graph/properties.js';

const digest = text => createHash('sha256').update(text).digest('hex');

test('the randomized graph has a complete, internally consistent inventory', () => {
  assert.equal(snapshot.nodes.length, info.nodeCount);
  assert.equal(snapshot.edges.length, info.edgeCount);
  assert.equal(new Set(snapshot.nodes.map(node => node.id)).size, info.nodeCount);
  assert.equal(new Set(snapshot.edges.map(edge => edge.id)).size, info.edgeCount);
  const inventory = {
    nodes: snapshot.nodes.map(node => node.id).sort(),
    edges: snapshot.edges.map(edge => [edge.id, edge.type, edge.source, edge.target]).sort((a, b) => a[0].localeCompare(b[0])),
  };
  assert.equal(digest(JSON.stringify(inventory)), info.inventorySha256);
  assert.doesNotThrow(() => indexSnapshot(snapshot));
  assert.equal(snapshot.randomized, true);
  assert.equal(snapshot.nodes.filter(node => node.kind === 'historian').length, snapshot.counts.historian);
  assert.doesNotThrow(() => assertRandomizedGraph(snapshot));
});

test('only graph display fields and finite layout positions are published', () => {
  const fields = ['id', 'kind', 'label', 'path', 'source', 'type', 'x', 'y'].sort();
  for (const node of snapshot.nodes) {
    assert.deepEqual(Object.keys(node).sort(), fields);
    assert.ok(Number.isFinite(node.x) && Number.isFinite(node.y));
  }
});

test('the interactive data and SVG fallback match their source evidence', async () => {
  const json = await readFile(new URL('../public/assets/graph/cortex.json', import.meta.url));
  const svg = await readFile(new URL('../public/assets/graph/cortex.svg', import.meta.url), 'utf8');
  assert.equal(digest(json), info.snapshotSha256);
  assert.equal(digest(svg), info.posterSha256);
  assert.equal((svg.match(/<circle /g) || []).length, info.nodeCount);
  assert.equal((svg.match(/<path d=/g) || []).length, info.edgeCount);
  assert.match(renderCortexGraph(), /RANDOMIZED DEMO/);
  await assert.doesNotReject(validateCortexGraph());
});

test('equipment search finds fictional unit labels and demo paths', () => {
  const result = searchNodes(snapshot, 'unit01');
  assert.equal(result[0].label, 'Unit 01');
  assert.equal(result[0].type, 'Unit');
  const tag = snapshot.nodes.find(node => node.kind === 'historian');
  assert.ok(searchNodes(snapshot, tag.path).some(node => node.id === tag.id));
  assert.deepEqual(searchNodes(snapshot, 'a-record-that-does-not-exist'), []);
  assert.deepEqual(searchNodes(snapshot, ''), []);
});

test('layer filters count relationships only when both endpoints are visible', () => {
  assert.deepEqual(visibleCounts(snapshot, new Set(Object.keys(kinds))), { nodes: info.nodeCount, edges: info.edgeCount });
  assert.deepEqual(visibleCounts(snapshot, new Set(['equipment'])), { nodes: 16, edges: 15 });
  assert.deepEqual(visibleCounts(snapshot, new Set(['equipment', 'document'])), { nodes: 23, edges: 47 });
  assert.deepEqual(visibleCounts(snapshot, new Set()), { nodes: 0, edges: 0 });
  assert.ok(searchNodes(snapshot, 'Unit 01', new Set(['document'])).every(node => node.kind === 'document'));
});

test('record details follow the randomized relationship endpoints', () => {
  const index = indexSnapshot(snapshot);
  const equipment = snapshot.nodes.find(node => node.label === 'Unit 01');
  const edges = index.relationships.get(equipment.id);
  assert.ok(edges.filter(edge => edge.type === 'MAPS_TO').length > 100);
  for (const edge of edges) assert.ok(index.neighbors.get(equipment.id).has(edge.source === equipment.id ? edge.target : edge.source));
  assert.throws(() => indexSnapshot({ nodes: [], edges: [{ id: 'broken', source: 'absent', target: 'missing' }] }), /unresolved relationship/);
});


test('randomization discards source names, IDs, scope, properties and connections', () => {
  const raw = {
    scope: { asset_path: 'private-site/secret-area' },
    nodes: [
      { id: 'source-root-secret', label: 'Cell', props: { name: 'Confidential Area' } },
      { id: 'source-unit-secret', label: 'Unit', props: { name: 'Confidential Unit', asset_path: 'private/path' } },
      { id: 'source-tag-secret', label: 'Tag', props: { tag_name: 'Confidential Signal', source_system: 'private-server' } },
    ],
    edges: [{ id: 'source-edge-secret', type: 'MAPS_TO', source: 'source-tag-secret', target: 'source-root-secret' }],
  };
  const demo = randomizeCortexGraph(raw);
  const second = randomizeCortexGraph(raw);
  const text = JSON.stringify(demo);
  for (const marker of ['source-root-secret', 'source-unit-secret', 'source-tag-secret', 'source-edge-secret', 'private', 'Confidential']) assert.ok(!text.includes(marker), marker);
  assert.notEqual(demo.nodes[0].id, second.nodes[0].id);
  const edge = demo.edges[0];
  assert.equal(demo.nodes.find(node => node.id === edge.target).type, 'Unit', 'Original tag-to-area topology is not published');
  assert.equal(demo.nodes.find(node => node.id === edge.source).type, 'Tag');
  assert.equal(demo.nodes.length, raw.nodes.length);
  assert.equal(demo.edges.length, raw.edges.length);
});

test('the publication guard rejects original fields even when hidden in the data', () => {
  const unsafe = structuredClone(snapshot);
  unsafe.nodes[0].path = 'private/plant/asset';
  assert.throws(() => assertRandomizedGraph(unsafe), /non-demo node/);
  const hidden = structuredClone(snapshot);
  hidden.originalScope = 'private/plant';
  assert.throws(() => assertRandomizedGraph(hidden), /randomized portfolio data/);
  const original = structuredClone(snapshot);
  original.randomized = false;
  assert.throws(() => assertRandomizedGraph(original), /randomized portfolio data/);
});

test('thousands of workflow records form a connected graph without containment', () => {
  const core = snapshot.nodes.filter(node => !['historian', 'document'].includes(node.kind) && node.type !== 'Cell');
  const ids = new Set(core.map(node => node.id));
  const edges = snapshot.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target) && edge.type !== 'CONTAINS');
  assert.ok(core.length >= 2500);
  assert.ok(edges.length >= 9000);
  const index = indexSnapshot({ nodes: core, edges });
  const seen = new Set(), queue = [core[0].id];
  while (queue.length) {
    const id = queue.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    for (const neighbor of index.neighbors.get(id)) if (!seen.has(neighbor)) queue.push(neighbor);
  }
  assert.equal(seen.size, core.length, 'Every workflow record belongs to one connected component');
  assert.ok([...index.neighbors.values()].filter(neighbors => neighbors.size > 1).length / core.length > .85, 'Most records connect beyond a single parent');
  assert.ok(edges.length * 2 / core.length > 6, 'Workflow mean degree exceeds six');
  for (const unit of core.filter(node => node.type === 'Unit')) {
    const domains = new Set([...index.neighbors.get(unit.id)].map(id => index.nodes.get(id).kind));
    for (const kind of ['mes', 'cmms', 'electrical', 'process']) assert.ok(domains.has(kind), `${unit.label} connects to ${kind}`);
  }
  assert.deepEqual(visibleCounts(snapshot, new Set(['equipment', 'mes', 'cmms', 'electrical', 'process'])), { nodes: 2706, edges: 9228 });
});

test('material genealogy and shared infrastructure join many workflows', () => {
  const produced = new Set(snapshot.edges.filter(edge => edge.type === 'mes:PRODUCED_LOT').map(edge => edge.target));
  const consumed = new Set(snapshot.edges.filter(edge => edge.type === 'mes:CONSUMED_LOT').map(edge => edge.target));
  assert.ok([...produced].filter(id => consumed.has(id)).length >= 350, 'Outputs become inputs to later scheduled batches');
  const index = indexSnapshot(snapshot);
  for (const [type, relation, minimum] of [
    ['isa88:MasterRecipe', 'isa88:DERIVED_FROM', 20],
    ['cmms:MaintenancePlan', 'cmms:GENERATED_FROM', 12],
    ['electrical:Circuit', 'electrical:SERVES', 2],
  ]) {
    for (const node of snapshot.nodes.filter(node => node.type === type)) {
      assert.ok(index.relationships.get(node.id).filter(edge => edge.type === relation).length >= minimum, `${node.label} is reused`);
    }
  }
  for (const prefix of ['electrical', 'process']) {
    for (const a of snapshot.edges.filter(edge => edge.type === `${prefix}:ENDPOINT_A`)) {
      const b = index.relationships.get(a.source).find(edge => edge.type === `${prefix}:ENDPOINT_B`);
      assert.ok(b);
      assert.notEqual(a.target, b.target);
      assert.equal(index.nodes.get(a.target).kind, prefix);
      assert.equal(index.nodes.get(b.target).kind, prefix);
    }
  }
});

test('the domain importer discards source names, identities, paths and properties', () => {
  const model = { model: 'connected-plant-demo', entities: [
    { id: 'private-model-unit', type: 'isa88:Unit', properties: { name: 'SECRET UNIT', equipment_id: 'SECRET UNIT' } },
    { id: 'private-model-order', type: 'mes:ScheduleOrder', properties: { name: 'SECRET CUSTOMER', source_id: 'SECRET SOURCE', drawing_ref: 'SECRET DRAWING', credentials: 'SECRET KEY' } },
  ], relationships: [{ id: 'private-model-edge', type: 'mes:SCHEDULED_ON', from: 'private-model-order', to: 'private-model-unit', properties: { private_url: 'SECRET ENDPOINT' } }] };
  const demo = extendWithDomains(snapshot, model);
  const text = JSON.stringify(demo);
  assert.doesNotMatch(text, /private-model|SECRET/);
  assert.doesNotThrow(() => assertRandomizedGraph(demo));
  assert.equal(demo.counts.mes, 1, 'Repeated imports replace previous domain nodes');
  assert.throws(() => extendWithDomains(snapshot, { ...model, model: 'production' }), /fictional/);
  const unsupported = structuredClone(model); unsupported.entities[1].type = 'anything:Secret';
  assert.throws(() => extendWithDomains(snapshot, unsupported), /Unsupported/);
});

test('every selectable type has stable fictional properties without source property bags', () => {
  const index = indexSnapshot(snapshot);
  const types = new Set();
  for (const node of snapshot.nodes) {
    const properties = nodeProperties(node, index);
    assert.ok(properties.length >= 4, `${node.type} needs useful properties`);
    assert.equal(new Set(properties.map(([key]) => key)).size, properties.length);
    for (const [key, value] of properties) {
      assert.equal(typeof key, 'string');
      assert.equal(typeof value, 'string');
      assert.ok(key && value && value.length < 200);
    }
    if (types.has(node.type)) continue;
    types.add(node.type);
    assert.deepEqual(nodeProperties(node, index), properties, 'Values stay stable when revisiting a record');
    const privateNode = { ...node, properties: { source_id: 'PRIVATE SOURCE', status: 'PRIVATE STATUS' }, props: { value: 'PRIVATE READING' }, source_id: 'PRIVATE SOURCE' };
    assert.deepEqual(nodeProperties(privateNode, index), properties, 'Source bags and fields cannot enter the inspector');
  }
  assert.equal(types.size, 22);
});

test('selected properties agree across linked orders, batches, lots, recipes, and endpoints', () => {
  const index = indexSnapshot(snapshot);
  const props = id => new Map(nodeProperties(index.nodes.get(id), index));
  for (const edge of snapshot.edges) {
    if (edge.type === 'mes:EXECUTES_BATCH') assert.equal(props(edge.source).get('Batch quantity'), props(edge.target).get('Batch quantity'));
    if (edge.type === 'isa88:PRODUCED_LOT') assert.equal(props(edge.source).get('Batch quantity'), props(edge.target).get('Quantity'));
    if (edge.type === 'isa88:DERIVED_FROM') assert.equal(props(edge.source).get('Version'), props(edge.target).get('Version'));
    for (const prefix of ['electrical', 'process']) {
      if (edge.type === `${prefix}:ENDPOINT_A`) assert.equal(props(edge.source).get('Endpoint A'), index.nodes.get(edge.target).label);
      if (edge.type === `${prefix}:ENDPOINT_B`) assert.equal(props(edge.source).get('Endpoint B'), index.nodes.get(edge.target).label);
    }
  }
  const unit = snapshot.nodes.find(node => node.label === 'Unit 01');
  assert.equal(props(unit.id).get('Scheduled runs'), '48');
  assert.equal(props(unit.id).get('Maintenance plans'), '3');
  for (const order of snapshot.nodes.filter(node => node.type === 'mes:ProductionOrder')) {
    const amount = text => Number(text.replace(/[^\d]/g, ''));
    const schedules = index.relationships.get(order.id).filter(edge => edge.type === 'mes:HAS_SCHEDULE_ORDER');
    assert.equal(amount(props(order.id).get('Planned quantity')), schedules.reduce((sum, edge) => sum + amount(props(edge.target).get('Batch quantity')), 0));
  }
});
