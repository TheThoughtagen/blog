// Demo historian: generated readings only, keyed by already randomized IDs.
export function demoSeed(node) {
  let value = 2166136261;
  for (const char of node.id) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
const profiles = [
  { measurement: 'Temperature', unit: '°C', min: 0, max: 150 },
  { measurement: 'Pressure', unit: 'bar', min: 0, max: 10 },
  { measurement: 'Flow rate', unit: 'L/min', min: 0, max: 500 },
  { measurement: 'Level', unit: '%', min: 0, max: 100 },
];
export const DEMO_SNAPSHOT_TIME = Date.UTC(2026, 9, 17, 12);
export const signalProfile = node => profiles[demoSeed(node) % profiles.length];

export function signalSample(node, timestamp) {
  const profile = signalProfile(node), s = demoSeed(node), t = timestamp / 1000;
  if (!Number.isFinite(timestamp)) throw new Error('A finite demo reading time is required.');
  const phase = s % 628 / 100;
  const cycle = { Temperature: 3600, Pressure: 600, 'Flow rate': 180, Level: 2400 }[profile.measurement];
  const fraction = .5 + .16 * Math.sin(t / (cycle + s % 90) + phase) + .08 * Math.sin(t / 7200 + phase);
  return { value: Number((profile.max * fraction).toFixed(profile.unit === 'bar' ? 2 : 1)), quality: 'Good', timestamp: new Date(timestamp).toISOString() };
}

export function signalHistory(node, end, minutes = 1440) {
  if (!Number.isFinite(end) || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error('Demo history is bounded to 24 hours.');
  const steps = 144;
  return Array.from({ length: steps + 1 }, (_, i) => signalSample(node, end - (steps - i) / steps * minutes * 60000));
}

// Same AssetValues contract used by Cortex's Plant 3D NextTrend integration.
// A representative channel per measurement keeps the portfolio readable.
function mappedChannels(index, equipmentId) {
  const equipment = index.nodes.get(equipmentId);
  if (equipment?.type !== 'Unit') throw new Error('Select demonstration equipment.');
  const mapped = (index.relationships.get(equipmentId) || []).filter(edge => edge.type === 'MAPS_TO' && edge.target === equipmentId)
    .map(edge => index.nodes.get(edge.source)).filter(node => node?.type === 'Tag')
    .sort((a, b) => a.label.localeCompare(b.label));
  const channels = new Map();
  for (const tag of mapped) {
    const profile = signalProfile(tag);
    if (!channels.has(profile.measurement)) channels.set(profile.measurement, { node: tag, ...profile });
  }
  return { equipment, mapped, channels };
}

export function demoProcessValues(index, timestamp) {
  return Object.fromEntries([...index.nodes.values()].filter(node => node.type === 'Unit').map(unit => {
    const { channels } = mappedChannels(index, unit.id);
    const read = measurement => { const channel = channels.get(measurement); return channel ? signalSample(channel.node, timestamp).value : null; };
    return [unit.id, { levelPct: read('Level'), temperatureC: read('Temperature'), flowLpm: read('Flow rate') }];
  }));
}

export function demoAssetValues(index, equipmentId, timestamp, historyEnd = timestamp) {
  const { equipment, mapped, channels } = mappedChannels(index, equipmentId);
  return { equipment_id: equipment.id, asset_path: equipment.path, read_at: new Date(timestamp).toISOString(), tags_truncated: mapped.length > channels.size,
    tags: [...channels.values()].sort((a, b) => profiles.findIndex(profile => profile.measurement === a.measurement) - profiles.findIndex(profile => profile.measurement === b.measurement)).map(channel => ({ tag_name: channel.node.label, description: channel.measurement,
      unit: channel.unit, match_method: 'Demo graph mapping', current: signalSample(channel.node, timestamp),
      history: signalHistory(channel.node, historyEnd),
    })),
  };
}
