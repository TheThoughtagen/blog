async (page) => {
  const checks = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('http://127.0.0.1:4173/work/', { waitUntil: 'domcontentloaded' });
  const showcase = page.locator('[data-cortex-showcase]');
  await showcase.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForFunction(() => document.querySelector('[data-cortex-showcase]').dataset.graphReady === 'true', null, { timeout: 20000 });
  const snapshot = await (await page.request.get('http://127.0.0.1:4173/assets/graph/cortex.json')).json();
  check(snapshot.nodes.length >= 7500 && snapshot.edges.length >= 14000, 'Substantially expanded graph is loaded');
  check(await page.locator('[data-cortex-canvas]').getAttribute('data-graph-nodes') === String(snapshot.nodes.length), 'The complete randomized graph renders');
  const stage = await page.locator('[data-cortex-stage]').boundingBox();
  check(stage.width > 1300 && stage.height > 650, 'Graph is a large, wide centerpiece');
  check(await page.locator('[data-cortex-canvas] canvas').count() >= 3, 'Cortex Sigma engine draws the network');
  await showcase.screenshot({ path: 'test-results/cortex-graph-desktop.png' });
  const search = page.locator('[data-cortex-search]');
  await search.fill('Unit 01');
  await page.locator('[data-cortex-results] button').first().click();
  check((await page.locator('[data-cortex-node-name]').textContent()) === 'Unit 01', 'Search selects a fictional unit');
  check((await page.locator('[data-cortex-properties]').textContent()).includes('Design capacity'), 'Selected equipment shows key engineering properties');
  check(await page.locator('.cortex-demo-badge').isVisible(), 'Fictional property values are clearly marked');
  check(await page.locator('[data-cortex-metadata]').evaluate(element => !element.open), 'Technical metadata starts collapsed below properties');
  check((await page.locator('[data-cortex-connections]').textContent()).includes('relationships'), 'Selected record shows its randomized relationships');
  check(await page.locator('[data-cortex-relations]').textContent().then(text => text.includes('MAPS_TO')), 'Equipment connects to randomized signal records');
  await page.locator('[data-cortex-kind="historian"]').uncheck();
  check((await page.locator('[data-cortex-visible]').textContent()).includes('2,713 nodes'), 'Turning off historian leaves engineering, equipment, and operational nodes');
  await page.locator('[data-cortex-kind="equipment"]').uncheck();
  check(await page.locator('[data-cortex-inspector]').isHidden(), 'Hidden selections clear record details');
  await page.locator('[data-cortex-reset]').click();
  check((await page.locator('[data-cortex-visible]').textContent()).includes('7,618 nodes'), 'Reset restores the full graph');
  await page.locator('[data-cortex-workflows]').click();
  check((await page.locator('[data-cortex-visible]').textContent()).includes('2,706 nodes'), 'Connected workflows focuses the four domains and shared equipment');
  for (const [query, kind, relation, property] of [
    ['Production order 01', 'mes', 'mes:HAS_SCHEDULE_ORDER', 'Planned quantity'],
    ['Work order 01', 'cmms', 'cmms:MAINTAINS', 'Priority'],
    ['Wire 01', 'electrical', 'electrical:ENDPOINT_A', 'Conductor'],
    ['Process path 01', 'process', 'process:ENDPOINT_A', 'Flow direction'],
  ]) {
    check(await page.locator(`[data-cortex-kind="${kind}"]`).isChecked(), `${kind} layer is enabled`);
    await search.fill(query);
    await page.locator('[data-cortex-results] button').first().click();
    check((await page.locator('[data-cortex-node-name]').textContent()) === query, `${kind} node is searchable`);
    check((await page.locator('[data-cortex-relations]').textContent()).includes(relation), `${kind} relationships are inspectable`);
    check((await page.locator('[data-cortex-properties]').textContent()).includes(property), `${kind} properties match the selected record type`);
    check(await page.locator('[data-cortex-inspector]').evaluate(element => element.scrollTop === 0), `${kind} properties start at the top of the panel`);
  }
  await page.locator('[data-cortex-reset]').click();
  for (const [query, property] of [['Signal 0001', 'Snapshot value'], ['Drawing 01', 'Revision']]) {
    await search.fill(query);
    await page.locator('[data-cortex-results] button').first().click();
    check((await page.locator('[data-cortex-properties]').textContent()).includes(property), `${query} has useful properties`);
  }
  await search.fill('Unit 01');
  await page.locator('[data-cortex-results] button').first().click();
  const neighborFilter = page.locator('[data-cortex-neighbor-kind]');
  check((await neighborFilter.locator('option').count()) >= 5, 'Equipment exposes connections across every workflow domain');
  await neighborFilter.selectOption('mes');
  check(await page.locator('[data-cortex-neighbors] button').count() === 12, 'Dense connections are paginated');
  await page.locator('[data-cortex-more-neighbors]').click();
  check(await page.locator('[data-cortex-neighbors] button').count() === 36, 'More connections remain accessible');
  await neighborFilter.selectOption('cmms');
  check((await page.locator('[data-cortex-neighbors]').textContent()).includes('Work order'), 'Domain filter finds maintenance from production equipment');
  const workOrder = page.locator('[data-cortex-neighbors] button').filter({ hasText: /^Work order / }).first();
  const workOrderName = await workOrder.textContent();
  await workOrder.click();
  check((await page.locator('[data-cortex-node-name]').textContent()) === workOrderName, 'Connected records can be followed across domains');
  check((await page.locator('[data-cortex-properties]').textContent()).includes('Priority') && !(await page.locator('[data-cortex-properties]').textContent()).includes('Design capacity'), 'Following a connection replaces the previous node properties');
  await showcase.screenshot({ path: 'test-results/cortex-node-properties-desktop.png' });
  await page.locator('[data-cortex-close]').click();
  await search.fill('');
  await page.locator('[data-cortex-workflows]').click();
  await showcase.screenshot({ path: 'test-results/cortex-connected-workflows.png' });
  await page.locator('[data-cortex-reset]').click();
  await search.fill('no-such-record-123');
  check((await page.locator('[data-cortex-results]').textContent()).includes('No matching'), 'Empty search is explicit');
  await search.fill('');
  await page.locator('[data-cortex-zoom-in]').click();
  await page.locator('[data-cortex-zoom-out]').click();
  await page.locator('[data-cortex-reset]').click();
  if (await page.evaluate(() => document.fullscreenEnabled)) {
    await page.locator('[data-cortex-fullscreen]').click();
    await page.waitForFunction(() => document.fullscreenElement?.id === 'cortex-graph');
    check(true, 'Fullscreen graph opens');
    await page.locator('[data-cortex-fullscreen]').click();
    await page.waitForFunction(() => !document.fullscreenElement);
    check(true, 'Fullscreen graph exits');
  }
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Large graph fits ${width}px without page overflow`);
    await search.fill('Unit 01');
    await page.locator('[data-cortex-results] button').first().click();
    check(await page.locator('[data-cortex-inspector]').isVisible(), `Record details work at ${width}px`);
    check(await page.locator('[data-cortex-properties]').isVisible(), `Key properties are visible at ${width}px`);
    check(await page.locator('[data-cortex-inspector]').evaluate(element => element.scrollWidth <= element.clientWidth), `Property values fit the ${width}px panel`);
    if (width === 320) await showcase.screenshot({ path: 'test-results/cortex-node-properties-mobile.png' });
    await page.locator('[data-cortex-close]').click();
    await search.fill('');
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('[data-cortex-reset]').click();
  check(errors.length === 0, 'Graph layout, fullscreen, and viewport transitions have no page errors');
  return { passed: checks.length, checks };
}
