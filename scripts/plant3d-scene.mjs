// Invented scene geometry, using only public randomized equipment identities.
// Logical graph connections share illustrative transfer headers in this view.
export function makeDemoScene(snapshot) {
  const units = snapshot.nodes.filter(node => node.type === 'Unit').sort((a, b) => a.label.localeCompare(b.label));
  const elements = [];
  const evidence = [{ document_id: 'DEMO-SCHEMATIC', revision: 'B', note: 'Invented equipment bays and shared transfer headers for the public portfolio.' }];
  const common = { fidelity: 'schematic', confidence: 0, review: 'accepted', layout: 'provisional', evidence };
  const add = element => elements.push({ ...common, ...element });
  const pipe = (id, label, path, diameter = .12, equipmentId) => add({ element_id: id, ...(equipmentId ? { equipment_id: equipmentId } : {}), kind: 'pipe_run', label,
    transform: { position: [0, 0, 0] }, params: { outside_diameter_m: diameter, cross_section: 'round', bend_radius_m: .3, telemetry: Boolean(equipmentId && !id.includes('collar')) }, path });
  const box = (id, position, size) => add({ element_id: id, kind: 'structure', template: 'box',
    params: { width_m: size[0], depth_m: size[1], height_m: size[2] }, transform: { position } });
  const rows = Math.ceil(units.length / 5), headerHeight = 3.2;
  units.forEach((unit, i) => {
    const x = (i % 5 - 2) * 10, y = (Math.floor(i / 5) - (rows - 1) / 2) * 13;
    const headerY = y - 5;
    const template = i % 5 === 4 ? 'column' : i % 5 === 3 ? 'horizontal_vessel' : 'vertical_vessel';
    const params = template === 'column' ? { height_m: 10, diameter_m: 1.6, skirt_height_m: 1.2 }
      : template === 'horizontal_vessel' ? { length_m: 5.4, diameter_m: 2.2, saddle_height_m: .5 }
        : { height_m: 5.8 + (i % 3) * .6, diameter_m: 3, support_height_m: .8 };
    params.telemetry = true;
    add({ element_id: unit.id, equipment_id: unit.id, label: unit.label, kind: 'equipment', template, params, transform: { position: [x, y, 0] } });
    if (template === 'vertical_vessel') add({ element_id: `${unit.id}-agitator`, equipment_id: unit.id, label: `${unit.label} agitator`, kind: 'equipment', template: 'top_agitator', transform: { position: [x, y, params.height_m] } });

    // Axial suction faces the vessel; the motor faces the service aisle.
    // Native pump casing: local x=-.65 at the suction, z=.345 on its shaft.
    const pumpY = y - 3.2, plinth = .16;
    add({ element_id: `${unit.id}-pump-pad`, equipment_id: unit.id, kind: 'structure', template: 'slab', params: { width_m: 1, depth_m: 2, thickness_m: plinth }, transform: { position: [x, pumpY, plinth] } });
    add({ element_id: `${unit.id}-pump`, equipment_id: unit.id, label: `${unit.label} transfer pump`, kind: 'equipment', template: 'centrifugal_pump',
      params: { length_m: 1.4, width_m: .5, casing_diameter_m: .45 }, transform: { position: [x, pumpY, plinth], rotation_deg: [0, 0, -90] } });
    const suctionZ = plinth + .12 + .45 / 2;
    const radius = params.diameter_m / 2;
    const outletZ = template === 'horizontal_vessel' ? 1.6 : 1.85;
    pipe(`${unit.id}-suction`, `${unit.label} pump suction`, [
      [x, y - radius, outletZ], [x, y - 2.15, outletZ], [x, y - 2.15, suctionZ], [x, pumpY + .65, suctionZ],
    ], .14, unit.id);
    // Top discharge clears the suction and rises at the rack, not in the vessel.
    pipe(`${unit.id}-discharge`, `${unit.label} pump discharge`, [
      [x, pumpY + .475, plinth + .57], [x, pumpY + .475, 1.25], [x + 1.1, pumpY + .475, 1.25],
      [x + 1.1, headerY, 1.25], [x + 1.1, headerY, headerHeight],
    ], .1, unit.id);
    // Inlet drops stay beside the footprint; no pipe crosses an equipment shell.
    const inletZ = template === 'horizontal_vessel' ? 1.6 : template === 'column' ? 7.2 : params.height_m - 1.2;
    const side = template === 'horizontal_vessel' ? params.length_m / 2 : radius;
    const standX = x - side - .9;
    pipe(`${unit.id}-inlet`, `${unit.label} header inlet`, [
      [standX, headerY, headerHeight], [standX, headerY, inletZ], [standX, y, inletZ], [x - side, y, inletZ],
    ], .1, unit.id);
    // Short collars make the vessel and pump connection faces visible.
    pipe(`${unit.id}-outlet-collar`, `${unit.label} outlet collar`, [[x, y - radius - .08, outletZ], [x, y - radius + .02, outletZ]], .23, unit.id);
    pipe(`${unit.id}-inlet-collar`, `${unit.label} inlet collar`, [[x - side - .08, y, inletZ], [x - side + .02, y, inletZ]], .2, unit.id);
    pipe(`${unit.id}-pump-collar`, `${unit.label} pump suction collar`, [[x, pumpY + .61, suctionZ], [x, pumpY + .71, suctionZ]], .22, unit.id);
  });
  // Rack aisles and one perimeter connection replace criss-crossing graph edges.
  // The graph retains every logical route and its endpoint records.
  for (let row = 0; row < rows; row++) {
    const y = (row - (rows - 1) / 2) * 13 - 5;
    pipe(`demo-header-${row}`, `Shared transfer header ${row + 1}`, [[-25, y, headerHeight], [24, y, headerHeight]], .18);
    for (const [bay, x] of [-25, -16.6, -6.6, 3.4, 13.4, 23.4].entries()) {
      const prefix = `demo-rack-${row}-${bay}`;
      box(`${prefix}-front`, [x, y - .55, 0], [.12, .12, 3]);
      box(`${prefix}-back`, [x, y + .55, 0], [.12, .12, 3]);
      box(`${prefix}-crossbar`, [x, y, 3], [.18, 1.25, .12]);
    }
  }
  for (let span = 0; span < rows - 1; span++) {
    const y = (span - (rows - 1) / 2) * 13 + 1.5, prefix = `demo-main-support-${span}`;
    box(`${prefix}-left`, [-25.55, y, 0], [.12, .12, 3]);
    box(`${prefix}-right`, [-24.45, y, 0], [.12, .12, 3]);
    box(`${prefix}-crossbar`, [-25, y, 3], [1.25, .18, .12]);
  }
  if (rows > 1) pipe('demo-transfer-main', 'Perimeter transfer header', [[-25, -(rows - 1) / 2 * 13 - 5, headerHeight], [-25, (rows - 1) / 2 * 13 - 5, headerHeight]], .18);
  return { spec_version: '0.1.0', area: 'portfolio-demo', frame: { id: 'demo-frame', status: 'provisional' }, elements };
}
