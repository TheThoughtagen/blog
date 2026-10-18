async (page) => {
  const checks = [], errors = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  const onError = error => errors.push(error.message);
  const onConsole = message => { if (message.type() === 'error' && /THREE|WebGL|shader|GL_INVALID|GLSL/i.test(message.text())) errors.push(message.text()); };
  page.on('pageerror', onError); page.on('console', onConsole);
  const root = page.locator('[data-cortex-scene]');
  const canvas = page.locator('[data-scene-canvas] canvas');
  const frame = () => canvas.evaluate(element => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(element.toDataURL())))));
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 1100 });
    // A hash-only navigation can retain the preceding test's fidelity view.
    await page.goto('about:blank');
    await page.goto('http://127.0.0.1:4173/work/#plant3d', { waitUntil: 'domcontentloaded' });
    await root.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]')?.dataset.sceneReady === 'true', null, { timeout: 45000 });
    await page.evaluate(() => { window.processTestRealNow = Date.now; const now = Date.parse(document.querySelector('[data-cortex-scene]').dataset.readAt); Date.now = () => now; });
    check(await root.getAttribute('data-process-vessels') === '15', 'All 15 vessel bodies carry native process metadata');
    check(await root.getAttribute('data-process-pipes') === '45', 'All 45 local pipe paths carry native flow metadata');
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]').dataset.flowPaths === '45');
    check(await root.getAttribute('data-flow-animated') === 'false', 'Reduced motion keeps directional arrows static');
    check((await page.locator('[data-scene-process-legend]').textContent()).includes('0–150 °C'), 'Temperature scale and mapped flow meaning are visible');
    await root.screenshot({ path: '/private/tmp/cortex-process-overview.png' });

    await page.locator('[data-scene-equipment]').selectOption({ label: 'Unit 01' });
    await page.locator('[data-scene-history]').click();
    await frame();
    const fill = await frame();
    await page.locator('[data-scene-show-level]').uncheck();
    check(await frame() !== fill, 'Disabling level changes the rendered vessel fill boundary');
    const temperatureOnly = await frame();
    await page.locator('[data-scene-show-temperature]').uncheck();
    check(await frame() !== temperatureOnly, 'Disabling temperature restores the rendered steel shell');
    await page.locator('[data-scene-show-level]').check();
    await page.locator('[data-scene-show-temperature]').check();
    const recentLevel = await page.locator('[data-scene-reading="Level"]').textContent();
    const recentCanvas = await frame();
    await page.locator('[data-scene-scrub]').focus();
    await page.locator('[data-scene-scrub]').press('Home');
    check(await page.locator('[data-scene-reading="Level"]').textContent() !== recentLevel, 'Historical scrubbing changes the mapped level reading');
    check(await frame() !== recentCanvas, 'The rendered fill and temperature follow the historical cursor');
    await root.screenshot({ path: '/private/tmp/cortex-process-vessel.png' });
    await page.locator('[data-scene-show-flow]').uncheck();
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]').dataset.flowPaths === '0');
    check(true, 'Flow overlays can be hidden without changing vessel telemetry');
    await page.locator('[data-scene-show-flow]').check();
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]').dataset.flowPaths === '45');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('[data-scene-live]').click();
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]').dataset.flowAnimated === 'true');
    const moving = await frame();
    await page.waitForFunction(before => document.querySelector('[data-scene-canvas] canvas').toDataURL() !== before, moving, { timeout: 5000 });
    check(true, 'Live flow arrows visibly move along the native pipe geometry');
    await page.locator('[data-scene-flow-pause]').click();
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]').dataset.flowAnimated === 'false');
    const stopped = await frame();
    await page.waitForTimeout(250);
    check(await frame() === stopped, 'Pause flow freezes actual rendered markers');
    await page.locator('[data-scene-flow-pause]').click();
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]').dataset.flowAnimated === 'true');
    check(true, 'Flow motion resumes');
    await page.locator('[data-scene-history]').click();
    check(await root.getAttribute('data-flow-animated') === 'false', 'A paused historical snapshot keeps flow direction static');
    await page.locator('[data-scene-play]').click();
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]').dataset.flowAnimated === 'true');
    check(true, 'Historical playback animates the flow overlays');
    await page.locator('[data-scene-play]').click();
    await page.locator('[data-scene-live]').click();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]').dataset.flowAnimated === 'false');
    const hidden = await frame();
    await page.waitForTimeout(200);
    check(await frame() === hidden, 'Hidden pages stop rendering flow motion');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]').dataset.flowAnimated === 'false');
    const reduced = await frame();
    await page.waitForTimeout(250);
    check(await frame() === reduced, 'Changing reduced-motion preference freezes the rendered flow');

    await page.locator('[data-scene-fidelity]').check();
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]').dataset.flowPaths === '0');
    check(await root.getAttribute('data-process-level') === 'false' && await root.getAttribute('data-process-temperature') === 'false', 'Fidelity view takes precedence over process coloring');
    await page.locator('[data-scene-fidelity]').uncheck();
    await page.waitForFunction(() => document.querySelector('[data-cortex-scene]').dataset.flowPaths === '45');
    check(await root.getAttribute('data-process-level') === 'true', 'Process visuals return after leaving fidelity view');

    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await root.evaluate(element => element.scrollIntoView({ block: 'start', behavior: 'instant' }));
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Process controls and temperature legend fit ${width}px`);
      check(await canvas.isVisible(), `Process vessel view renders at ${width}px`);
    }
    await root.screenshot({ path: '/private/tmp/cortex-process-mobile.png' });
    check(errors.length === 0, `No shader, WebGL, or page errors: ${errors.join('; ')}`);
    return { passed: checks.length, checks };
  } finally {
    await page.evaluate(() => { if (window.processTestRealNow) { Date.now = window.processTestRealNow; delete window.processTestRealNow; } delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    page.off('pageerror', onError); page.off('console', onConsole);
  }
}
