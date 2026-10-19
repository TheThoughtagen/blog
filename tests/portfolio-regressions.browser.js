async (page) => {
  const checks = [], errors = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => localStorage.setItem('fieldnotes:skip-intro', 'true'));
  try {
    await page.goto('http://127.0.0.1:4173/work/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => document.querySelector('#plant3d').scrollIntoView({ behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]').dataset.sceneReady === 'true', null, { timeout: 60000 });
    await page.evaluate(() => document.querySelector('#cortex-graph').scrollIntoView({ behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('[data-cortex-showcase]').dataset.graphReady === 'true', null, { timeout: 60000 });
    const select = page.locator('[data-scene-equipment]');
    const chooseUnit = async name => {
      await page.locator('[data-cortex-search]').fill(name);
      await page.locator('[data-cortex-results] button').first().click();
    };
    await chooseUnit('Unit 01');
    await page.locator('[data-scene-overview]').click();
    await page.locator('[data-cortex-kind="historian"]').uncheck();
    check(await select.inputValue() === '', 'Filtering graph layers preserves the 3D overview');
    await page.locator('[data-cortex-kind="historian"]').check();
    check(await select.inputValue() === '', 'Restoring graph layers preserves the 3D overview');
    await chooseUnit('Unit 01');
    check(await select.inputValue() !== '', 'Explicitly choosing the same graph unit still selects it in 3D');
    await page.locator('[data-scene-history]').click();
    await page.locator('[data-scene-scrub]').press('Home');
    await page.locator('[data-scene-play]').click();
    await page.waitForFunction(() => Number(document.querySelector('[data-scene-scrub]').value) > 0);
    await page.locator('[data-scene-overview]').click();
    check(await page.locator('[data-scene-play]').isEnabled(), 'History can still be paused after fitting all equipment');
    await page.locator('[data-scene-play]').click();
    const offset = await page.locator('[data-scene-scrub]').inputValue();
    await page.waitForTimeout(1100);
    check(await page.locator('[data-scene-scrub]').inputValue() === offset, 'Pausing from the overview stops historical playback');
    await chooseUnit('Unit 01');
    if (await page.evaluate(() => document.fullscreenEnabled)) {
      await page.locator('[data-cortex-fullscreen]').click();
      await page.waitForFunction(() => document.fullscreenElement?.id === 'cortex-graph');
      await page.locator('[data-cortex-model]').click();
      await page.waitForFunction(() => !document.fullscreenElement);
      await page.waitForFunction(() => {
        const top = document.querySelector('#plant3d').getBoundingClientRect().top;
        return top >= 0 && top < innerHeight / 4;
      });
      check(true, 'Opening 3D leaves fullscreen and scrolls to the model');
    }

    const counts = () => page.evaluate(() => ({ graph: document.querySelectorAll('[data-cortex-canvas] canvas').length, scene: document.querySelectorAll('[data-scene-equipment]').length }));
    const before = await counts();
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => {
        dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
        dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      });
      const restored = await counts();
      check(restored.graph === before.graph && restored.scene === before.scene, 'Persisted lifecycle retains both demos, round ' + (i + 1));
    }
    await chooseUnit('Unit 02');
    check(await page.locator('[data-scene-name]').textContent() === 'Unit 02', 'Cross-selection works after a persisted page restore');
    await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    const disposed = await counts();
    check(disposed.graph === 0 && disposed.scene === 0, 'A final non-persisted pagehide cleans up both demos');

    const failedContext = await page.context().browser().newContext();
    const failed = await failedContext.newPage();
    const failures = [];
    failed.on('pageerror', error => failures.push(error.message));
    try {
      await failed.route('**/assets/graph/vendor.js*', route => route.fulfill({ contentType: 'text/javascript', body: 'export class Graph { addNode() {} addDirectedEdgeWithKey() {} } export class Sigma { constructor() { throw new Error("Simulated WebGL failure"); } }' }));
      await failed.goto('http://127.0.0.1:4173/work/', { waitUntil: 'domcontentloaded' });
      await failed.evaluate(() => document.querySelector('#cortex-graph').scrollIntoView({ behavior: 'instant' }));
      await failed.waitForFunction(() => document.querySelector('[data-cortex-showcase]').dataset.graphReady === 'false');
      const snapshot = await (await failed.request.get('http://127.0.0.1:4173/assets/graph/cortex.json')).json();
      const id = snapshot.nodes.find(node => node.type === 'Unit').id;
      await failed.evaluate(id => dispatchEvent(new CustomEvent('cortex:graph-select', { detail: { id, scroll: true } })), id);
      check(failures.length === 0, '3D selection events remain safe after graph renderer startup fails');
      check(await failed.locator('.cortex-poster').isVisible(), 'The static graph remains visible after failed startup');
    } finally { await failedContext.close(); }
    check(errors.length === 0, 'No page errors in the interaction and lifecycle checks');
    return { passed: checks.length, checks };
  } finally { page.off('pageerror', onError); }
}
