import { randomInt, randomUUID } from 'node:crypto';
import { kinds } from '../public/assets/graph/model.js';

export const demoNodeSchema = {
  Cell: ['equipment', 'Process area'], Unit: ['equipment', 'Unit'],
  Tag: ['historian', 'Signal'], PnIDDocument: ['document', 'Process drawing'],
  DrawingDocument: ['document', 'Drawing'], ModelBuild: ['document', 'Scene model'],
  'mes:ProductionOrder': ['mes', 'Production order'], 'mes:ScheduleOrder': ['mes', 'Schedule order'],
  'isa88:MasterRecipe': ['mes', 'Recipe'], 'isa88:ControlRecipe': ['mes', 'Execution recipe'],
  'isa88:Procedure': ['mes', 'Procedure'], 'isa88:Batch': ['mes', 'Batch'],
  'isa95:MaterialLot': ['mes', 'Lot'], 'isa95:MaterialDefinition': ['mes', 'Material'],
  'cmms:WorkOrder': ['cmms', 'Work order'], 'cmms:MaintenancePlan': ['cmms', 'Maintenance plan'],
  'electrical:Panel': ['electrical', 'Panel'], 'electrical:Circuit': ['electrical', 'Circuit'],
  'electrical:Terminal': ['electrical', 'Terminal'], 'electrical:WireConnection': ['electrical', 'Wire'],
  'process:Port': ['process', 'Port'], 'process:Connection': ['process', 'Process path'],
};
const schema = demoNodeSchema;
const relations = new Set(['CONTAINS', 'MAPS_TO', 'DEPICTS', 'PLACED_IN', 'CITES',
  'mes:HAS_SCHEDULE_ORDER', 'mes:USES_RECIPE', 'mes:EXECUTES_BATCH', 'mes:SCHEDULED_ON', 'mes:PRODUCED_LOT', 'mes:CONSUMED_LOT',
  'isa88:HAS_PROCEDURE', 'isa88:DERIVED_FROM', 'isa88:EXECUTES_RECIPE', 'isa88:USES_UNIT', 'isa88:PRODUCED_LOT', 'isa88:CONSUMED_LOT', 'isa95:DEFINED_BY',
  'cmms:MAINTAINS', 'cmms:GENERATED_FROM', 'cmms:CHILD_OF',
  'electrical:HAS_CIRCUIT', 'electrical:TERMINAL_OF', 'electrical:ENDPOINT_A', 'electrical:ENDPOINT_B', 'electrical:IN_CIRCUIT', 'electrical:SERVES',
  'process:PORT_OF', 'process:ENDPOINT_A', 'process:ENDPOINT_B', 'process:VIA']);
export const demoSource = 'Randomized portfolio data';
export const emptyCounts = () => Object.fromEntries(Object.keys(kinds).map(kind => [kind, 0]));

function shuffle(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Read only node/relationship TYPES and their counts. Names, identities, paths,
// properties, source systems, scope, coordinates and timestamps never cross
// this boundary. Connections are regenerated, not a copy of the plant layout.
export function randomizeCortexGraph(raw) {
  if (!raw.nodes?.length || !Array.isArray(raw.edges)) throw new Error('Expected a scope graph response.');
  const originalTypes = new Map(raw.nodes.map(node => [node.id, node.label]));
  if (originalTypes.size !== raw.nodes.length) throw new Error('Duplicate input identities.');
  const counts = emptyCounts();
  const byType = new Map();
  const sequence = new Map();
  const nodes = shuffle(raw.nodes).map(original => {
    const type = original.label;
    if (!schema[type]) throw new Error('Unsupported input node type.');
    const [kind, prefix] = schema[type];
    const number = (sequence.get(type) || 0) + 1;
    sequence.set(type, number);
    counts[kind]++;
    const label = `${prefix} ${String(number).padStart(type === 'Tag' ? 4 : 2, '0')}`;
    const node = {
      id: `n-${randomUUID()}`, type, kind, label,
      path: `demo/${kind}/${label.toLowerCase().replaceAll(' ', '-')}`,
      source: demoSource,
    };
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(node);
    return node;
  });
  const tags = shuffle(byType.get('Tag') || []);
  const units = byType.get('Unit') || [];
  const usedPairs = new Set();
  const pick = type => {
    if (type === 'Tag') {
      const tag = tags.pop();
      if (tag) return tag;
    }
    const pool = byType.get(type);
    if (!pool?.length) throw new Error('Missing relationship type.');
    return pool[randomInt(pool.length)];
  };
  const edges = shuffle(raw.edges).map(original => {
    if (!relations.has(original.type)) throw new Error('Unsupported input relationship type.');
    const sourceType = originalTypes.get(original.source);
    let targetType = originalTypes.get(original.target);
    if (!sourceType || !targetType) throw new Error('Unresolved input relationship.');
    // Signals are spread across fictional units instead of exposing the
    // original plant's tag assignments or degree distribution.
    if (original.type === 'MAPS_TO' && sourceType === 'Tag' && units.length) targetType = 'Unit';
    let source = pick(sourceType), target = pick(targetType);
    let key = `${original.type}:${source.id}:${target.id}`;
    for (let attempt = 0; attempt < 100 && (source === target || usedPairs.has(key)); attempt++) {
      target = pick(targetType);
      key = `${original.type}:${source.id}:${target.id}`;
    }
    if (source === target) throw new Error('Cannot generate a valid demo relationship.');
    usedPairs.add(key);
    return { id: `e-${randomUUID()}`, type: original.type, source: source.id, target: target.id };
  });
  const root = nodes.find(node => node.type === 'Cell') || nodes[0];
  return {
    source: demoSource, scope: 'Demo / Plant / Process area', randomized: true,
    dataNotice: 'Names, identifiers, paths, and connections are randomized.',
    root: root.id, counts, nodes, edges,
  };
}

export function assertRandomizedGraph(snapshot) {
  const allowed = new Set(['source', 'scope', 'randomized', 'dataNotice', 'root', 'counts', 'nodes', 'edges', 'inventorySha256', 'layouts']);
  if (Object.keys(snapshot).some(key => !allowed.has(key)) || snapshot.randomized !== true || snapshot.source !== demoSource || snapshot.scope !== 'Demo / Plant / Process area'
    || snapshot.dataNotice !== 'Names, identifiers, paths, and connections are randomized.') throw new Error('Graph must contain randomized portfolio data.');
  const fields = ['id', 'kind', 'label', 'path', 'source', 'type', 'x', 'y'].sort().join(',');
  const ids = new Set();
  for (const node of snapshot.nodes) {
    const definition = schema[node.type];
    if (!definition || Object.keys(node).sort().join(',') !== fields || node.kind !== definition[0]
      || !new RegExp(`^${definition[1]} \\d{2,4}$`).test(node.label)
      || node.path !== `demo/${node.kind}/${node.label.toLowerCase().replaceAll(' ', '-')}`
      || node.source !== demoSource || !/^n-[0-9a-f-]{36}$/.test(node.id)
      || ids.has(node.id) || !Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new Error('Graph contains a non-demo node field.');
    ids.add(node.id);
  }
  const edges = new Set();
  for (const edge of snapshot.edges) {
    if (Object.keys(edge).sort().join(',') !== 'id,source,target,type' || !/^e-[0-9a-f-]{36}$/.test(edge.id)
      || edges.has(edge.id) || !relations.has(edge.type) || !ids.has(edge.source) || !ids.has(edge.target)) throw new Error('Graph contains a non-demo relationship.');
    edges.add(edge.id);
  }
  if (!ids.has(snapshot.root)) throw new Error('Missing demo graph root.');
  if (snapshot.layouts) {
    if (Object.keys(snapshot.layouts).join(',') !== 'workflows') throw new Error('Unsupported demo layout.');
    for (const [id, position] of Object.entries(snapshot.layouts.workflows)) {
      if (!ids.has(id) || Object.keys(position).sort().join(',') !== 'x,y' || !Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error('Invalid demonstration layout position.');
    }
  }
  const counts = emptyCounts();
  for (const node of snapshot.nodes) counts[node.kind]++;
  if (Object.keys(snapshot.counts).sort().join(',') !== Object.keys(kinds).sort().join(',') || Object.keys(counts).some(kind => snapshot.counts[kind] !== counts[kind])) throw new Error('Invalid demo graph counts.');
}
