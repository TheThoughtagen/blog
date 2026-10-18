const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export function renderGraphPoster({ nodes, edges }) {
  const color = Object.fromEntries(Object.entries(kinds).map(([kind, value]) => [kind, value.color]));
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = Math.min(1750 / (maxX - minX || 1), 930 / (maxY - minY || 1));
  const px = node => 970 + (node.x - (minX + maxX) / 2) * scale;
  const py = node => 550 - (node.y - (minY + maxY) / 2) * scale;
  const byId = new Map(nodes.map(node => [node.id, node]));
  const lines = edges.map(edge => {
    const a = byId.get(edge.source), b = byId.get(edge.target);
    return `<path d="M${px(a).toFixed(2)} ${py(a).toFixed(2)}L${px(b).toFixed(2)} ${py(b).toFixed(2)}"/>`;
  }).join('');
  const points = [...nodes].sort((a, b) => (a.kind !== 'historian') - (b.kind !== 'historian')).map(node => `<circle cx="${px(node).toFixed(2)}" cy="${py(node).toFixed(2)}" r="${node.kind === 'historian' ? 1.7 : node.type === 'Cell' ? 10 : 6}" fill="${color[node.kind]}"/>`).join('');
  const labels = nodes.filter(node => node.kind === 'equipment').map(node => {
    const width = node.label.length * 7 + 18;
    const x = Math.min(1980 - width, px(node) + 15), y = py(node) - 14;
    return `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)})"><rect width="${width}" height="28" rx="5" fill="#101b23" stroke="${color[node.kind]}" stroke-opacity=".35"/><text x="9" y="18" font-family="system-ui, sans-serif" font-size="12" font-weight="500" fill="#e3efea">${escape(node.label)}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 1100"><title>Forge Cortex — randomized portfolio graph</title><desc>All names, identifiers, paths, and connections use randomized demo data.</desc><rect width="2000" height="1100" fill="#080f15"/><g stroke="#527058" stroke-opacity=".25" stroke-width=".6">${lines}</g>${points}${labels}</svg>`;
}
import { kinds } from '../public/assets/graph/model.js';
