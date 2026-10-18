import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import snapshot from '../public/assets/graph/cortex.json' with { type: 'json' };
import info from '../content/cortex-scene.json' with { type: 'json' };
import { indexSnapshot } from '../public/assets/graph/model.js';
import { signalProfile, signalSample, signalHistory, demoAssetValues, demoProcessValues, DEMO_SNAPSHOT_TIME } from '../public/assets/graph/signals.js';
import { makeDemoScene } from '../scripts/plant3d-scene.mjs';
import { validateCortexScene, renderCortexScene } from '../scripts/scene-showcase.mjs';

test('native Cortex model artifacts match the invented spec and randomized graph', async () => {
  await assert.doesNotReject(validateCortexScene());
  assert.equal(info.fictional, true);
  assert.match(info.commit, /^[a-f0-9]{40}$/);
  assert.ok(info.files.some(file => file.path === 'web/components/plant3d/scene-canvas.tsx'));
  assert.ok(info.files.some(file => file.path === 'web/lib/scene/generate.ts'));
  const bytes = await readFile(new URL('../public/assets/plant3d/model.glb', import.meta.url));
  assert.equal(bytes.subarray(0, 4).toString(), 'glTF');
  assert.equal(bytes.readUInt32LE(4), 2);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const spec = makeDemoScene(snapshot);
  const expected = new Set(spec.elements.map(element => element.element_id));
  const ids = new Set(snapshot.nodes.filter(node => node.type === 'Unit').map(node => node.id));
  const actual = json.nodes.filter(node => node.extras?.element_id);
  assert.equal(actual.length, spec.elements.length);
  for (const node of actual) {
    assert.ok(expected.has(node.extras.element_id));
    assert.equal(node.extras.fidelity, 'schematic');
    if (node.extras.equipment_id) assert.ok(ids.has(node.extras.equipment_id));
  }
  assert.equal(new Set(actual.map(node => node.extras.equipment_id).filter(Boolean)).size, 15);
  assert.equal(actual.filter(node => node.extras.process_visual?.kind === 'vessel').length, 15);
  assert.equal(actual.filter(node => node.extras.process_visual?.kind === 'pipe').length, 45);
  assert.match(renderCortexScene(), /GENERATED TELEMETRY/);
});

test('scene generation ignores private properties and never imports a plant layout', () => {
  const clean = makeDemoScene(snapshot);
  const unsafe = structuredClone(snapshot);
  for (const node of unsafe.nodes) Object.assign(node, { properties: { position: [912, 123, 456], name: 'PRIVATE ASSET' }, source_id: 'PRIVATE ID', drawing_ref: 'PRIVATE DRAWING', x: 912345, y: 912345 });
  assert.deepEqual(makeDemoScene(unsafe), clean);
  for (const element of clean.elements) {
    assert.equal(element.confidence, 0);
    assert.equal(element.layout, 'provisional');
    assert.ok(element.evidence.every(item => item.document_id === 'DEMO-SCHEMATIC'));
  }
});

test('pumps meet suction and discharge connections on raised plinths', () => {
  const spec = makeDemoScene(snapshot), byId = new Map(spec.elements.map(element => [element.element_id, element]));
  const close = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-9));
  for (const vessel of spec.elements.filter(element => element.template && ['vertical_vessel', 'horizontal_vessel', 'column'].includes(element.template))) {
    const pump = byId.get(`${vessel.element_id}-pump`), pad = byId.get(`${vessel.element_id}-pump-pad`);
    const [x, y, z] = pump.transform.position;
    assert.deepEqual(pump.transform.rotation_deg, [0, 0, -90]);
    assert.equal(z, pad.transform.position[2]);
    assert.equal(z, pad.params.thickness_m);
    close(byId.get(`${vessel.element_id}-suction`).path.at(-1), [x, y + .65, z + .345]);
    close(byId.get(`${vessel.element_id}-discharge`).path[0], [x, y + .475, z + .57]);
    assert.ok(vessel.transform.position[1] - y > vessel.params.diameter_m / 2 + 1);
  }
});

test('shared rack pipework stays outside equipment footprints and connects every bay', () => {
  const { elements } = makeDemoScene(snapshot);
  const vessels = elements.filter(element => ['vertical_vessel', 'horizontal_vessel', 'column'].includes(element.template));
  const headers = elements.filter(element => element.element_id.startsWith('demo-header-'));
  assert.equal(headers.length, 3);
  const attached = elements.filter(element => /-(suction|discharge|inlet)$/.test(element.element_id));
  assert.equal(attached.length, 45);
  // Probe every straight centerline (excluding short nozzle collars). None may
  // enter the conservative bounding volume of any equipment shell.
  for (const pipe of elements.filter(element => element.kind === 'pipe_run' && !element.element_id.includes('collar'))) {
    assert.equal(pipe.params.cross_section, 'round');
    for (let i = 1; i < pipe.path.length; i++) {
      const a = pipe.path[i - 1], b = pipe.path[i];
      assert.equal(a.filter((value, axis) => Math.abs(value - b[axis]) > 1e-9).length, 1, 'Routing uses orthogonal bends');
      for (let t = 1; t < 20; t++) {
        const point = a.map((value, axis) => value + (b[axis] - value) * t / 20);
        for (const vessel of vessels) {
          const [x, y] = vessel.transform.position, r = vessel.params.diameter_m / 2;
          const horizontal = vessel.template === 'horizontal_vessel';
          const dx = horizontal ? vessel.params.length_m / 2 : r;
          const low = horizontal ? .5 : vessel.params.support_height_m ?? vessel.params.skirt_height_m;
          const high = horizontal ? .5 + 2 * r : vessel.params.height_m;
          const inside = Math.abs(point[0] - x) < dx - 1e-6 && Math.abs(point[1] - y) < r - 1e-6 && point[2] > low && point[2] < high;
          assert.ok(!inside, `${pipe.label} crosses ${vessel.label}`);
        }
      }
    }
  }
  for (const vessel of vessels) {
    for (const suffix of ['discharge', 'inlet']) {
      const pipe = attached.find(element => element.element_id === `${vessel.element_id}-${suffix}`);
      const point = suffix === 'inlet' ? pipe.path[0] : pipe.path.at(-1);
      assert.ok(headers.some(header => point[1] === header.path[0][1] && point[2] === header.path[0][2] && point[0] > header.path[0][0] && point[0] < header.path[1][0]));
    }
  }
});

test('all demo equipment has mapped channels with coherent current and 24-hour history', () => {
  const index = indexSnapshot(snapshot), end = DEMO_SNAPSHOT_TIME;
  for (const unit of snapshot.nodes.filter(node => node.type === 'Unit')) {
    const values = demoAssetValues(index, unit.id, end);
    assert.equal(values.equipment_id, unit.id);
    assert.equal(values.tags.length, 4);
    for (const tag of values.tags) {
      const node = snapshot.nodes.find(node => node.label === tag.tag_name);
      assert.ok(index.relationships.get(unit.id).some(edge => edge.type === 'MAPS_TO' && edge.source === node.id));
      assert.equal(tag.history.length, 145);
      assert.deepEqual(tag.history.at(-1), tag.current);
      assert.equal(Date.parse(tag.history[0].timestamp), end - 86400000);
      const profile = signalProfile(node);
      assert.ok(tag.history.every(point => point.value >= profile.min && point.value <= profile.max));
      for (let i = 1; i < tag.history.length; i++) assert.ok(Date.parse(tag.history[i].timestamp) > Date.parse(tag.history[i - 1].timestamp));
    }
  }
});

test('historical cursor, replay, and live samples share a stable timeline', () => {
  const index = indexSnapshot(snapshot), unit = snapshot.nodes.find(node => node.type === 'Unit');
  const end = DEMO_SNAPSHOT_TIME, cursor = end - 3600000;
  const history = demoAssetValues(index, unit.id, cursor, end);
  const current = demoAssetValues(index, unit.id, end, end);
  for (let i = 0; i < history.tags.length; i++) {
    assert.deepEqual(history.tags[i].current, current.tags[i].history.find(point => Date.parse(point.timestamp) === cursor));
    assert.deepEqual(history.tags[i].history, current.tags[i].history);
  }
  const tag = snapshot.nodes.find(node => node.type === 'Tag');
  assert.deepEqual(signalSample(tag, cursor), signalSample(tag, cursor));
  assert.notDeepEqual(signalSample(tag, end), signalSample(tag, end + 5000));
  assert.throws(() => signalHistory(tag, end, 200000), /bounded/);
  assert.throws(() => signalSample(tag, NaN), /finite/);
  assert.throws(() => demoAssetValues(index, 'absent', end), /equipment/);
});

test('vessel overlays and flow use exactly the historian readings at the same cursor', () => {
  const index = indexSnapshot(snapshot);
  for (const time of [DEMO_SNAPSHOT_TIME, DEMO_SNAPSHOT_TIME - 3600000]) {
    const process = demoProcessValues(index, time);
    assert.equal(Object.keys(process).length, 15);
    for (const [id, visual] of Object.entries(process)) {
      const tags = demoAssetValues(index, id, time).tags;
      assert.deepEqual(visual, {
        levelPct: tags.find(tag => tag.description === 'Level').current.value,
        temperatureC: tags.find(tag => tag.description === 'Temperature').current.value,
        flowLpm: tags.find(tag => tag.description === 'Flow rate').current.value,
      });
    }
  }
});
