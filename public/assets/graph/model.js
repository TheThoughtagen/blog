export const kinds = {
  equipment: { label: 'Equipment', color: '#22d3ee' },
  historian: { label: 'Historian tags', color: '#a3e635' },
  document: { label: 'Engineering records', color: '#fbbf24' },
  mes: { label: 'MES', color: '#c4b5fd' },
  cmms: { label: 'CMMS', color: '#f9a8d4' },
  electrical: { label: 'Electrical wiring', color: '#fb923c' },
  process: { label: 'Process flow', color: '#60a5fa' },
};

export function indexSnapshot(snapshot) {
  const nodes = new Map(snapshot.nodes.map(node => [node.id, node]));
  const edges = new Map(snapshot.edges.map(edge => [edge.id, edge]));
  const neighbors = new Map(snapshot.nodes.map(node => [node.id, new Set()]));
  const relationships = new Map(snapshot.nodes.map(node => [node.id, []]));
  for (const edge of snapshot.edges) {
    if (!nodes.has(edge.source) || !nodes.has(edge.target)) throw new Error('The graph has an unresolved relationship.');
    neighbors.get(edge.source).add(edge.target);
    neighbors.get(edge.target).add(edge.source);
    relationships.get(edge.source).push(edge);
    relationships.get(edge.target).push(edge);
  }
  return { nodes, edges, neighbors, relationships };
}

const normalize = text => String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function searchNodes(snapshot, query, enabled = new Set(Object.keys(kinds)), limit = 8) {
  const needle = normalize(query);
  if (!needle) return [];
  return snapshot.nodes.filter(node => enabled.has(node.kind)).map(node => {
    const label = normalize(node.label);
    const text = normalize(node.label + ' ' + node.path + ' ' + node.type);
    const rank = label === needle ? 0 : label.startsWith(needle) ? 1 : text.includes(needle) ? 2 : 3;
    return { node, rank };
  }).filter(result => result.rank < 3).sort((a, b) => a.rank - b.rank || a.node.label.localeCompare(b.node.label)).slice(0, limit).map(result => result.node);
}

export function visibleCounts(snapshot, enabled) {
  const ids = new Set(snapshot.nodes.filter(node => enabled.has(node.kind)).map(node => node.id));
  return { nodes: ids.size, edges: snapshot.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)).length };
}
