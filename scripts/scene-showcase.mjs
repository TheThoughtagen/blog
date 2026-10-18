import info from '../content/cortex-scene.json' with { type: 'json' };
import graphInfo from '../content/cortex-graph.json' with { type: 'json' };
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { makeDemoScene } from './plant3d-scene.mjs';

export async function validateCortexScene() {
  const base = new URL('../public/assets/plant3d/', import.meta.url);
  const [model, spec, vendor, snapshot] = await Promise.all([
    readFile(new URL('model.glb', base)), readFile(new URL('scene.json', base), 'utf8'), readFile(new URL('vendor.js', base)),
    readFile(new URL('../public/assets/graph/cortex.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const sha = value => createHash('sha256').update(value).digest('hex');
  if (!info.fictional || info.graphInventorySha256 !== graphInfo.inventorySha256
    || sha(model) !== info.modelSha256 || sha(spec) !== info.specSha256 || sha(vendor) !== info.vendorSha256
    || spec !== JSON.stringify(makeDemoScene(snapshot))) throw new Error('Cortex scene must match the generated fictional model and public graph.');
}

export function renderCortexScene() {
  return `<section class="plant-showcase" id="plant3d" data-cortex-scene data-mesh-src="/assets/plant3d/model.glb?v=${info.modelSha256.slice(0, 12)}" data-graph-src="/assets/graph/cortex.json?v=${graphInfo.snapshotSha256.slice(0, 12)}" data-renderer-version="${info.vendorSha256.slice(0, 12)}" aria-labelledby="plant-title"><header class="plant-heading"><div class="overline">FORGE CORTEX / PLANT 3D</div><h2 id="plant-title">From equipment to its history<span class="accent">.</span></h2><p>Select a vessel in 3D, inspect its current readings, or scrub through 24 hours of history. Fill level, temperature color, and pipe flow follow the selected time. Open the same asset in the graph to inspect its production, maintenance, electrical, and process relationships.</p><span class="plant-demo-label">SCHEMATIC MODEL / GENERATED TELEMETRY</span></header><div data-scene-mount><p class="plant-placeholder">The interactive 3D model loads as it comes into view.</p></div><footer class="plant-caption"><span>Cortex’s native scene renderer and model generator · ${info.assets} demo equipment assets · shared transfer headers</span><a href="#cortex-graph">Explore the connected graph &#8593;</a></footer><script type="module" src="/assets/plant3d/app.js"></script></section>`;
}
