async (page) => {
  const checks = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  await page.addInitScript(() => {
    localStorage.setItem('fieldnotes:skip-intro', 'true');
    localStorage.setItem('fieldnotes:vim', 'true');
  });
  const position = () => page.evaluate(() => scrollY);
  const blur = () => page.evaluate(() => document.activeElement?.blur());
  const reset = () => page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
  try {
    for (const reducedMotion of ['reduce', 'no-preference']) {
      await page.emulateMedia({ reducedMotion });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('http://127.0.0.1:4173/work/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.documentElement.dataset.vim === 'true');
      await reset();

      check(await page.evaluate(() => document.querySelector('.work-jump').getBoundingClientRect().bottom <= document.querySelector('#cortex-graph').getBoundingClientRect().top), 'Section links precede the graph (' + reducedMotion + ')');
      await page.keyboard.press('j');
      const first = await position();
      check(first > 0 && first <= 120, 'j scrolls a small step instead of jumping to a project (' + reducedMotion + ')');
      check(await page.evaluate(() => document.activeElement === document.body), 'Scrolling preserves focus (' + reducedMotion + ')');
      await page.keyboard.press('k');
      check(await position() === 0, 'k returns from the current position (' + reducedMotion + ')');
      await page.keyboard.press('k');
      check(await position() === 0, 'k at the top stays at the top (' + reducedMotion + ')');

      let passedGraph = false;
      let reachedModel = false;
      let continuous = true;
      await page.keyboard.down('j');
      for (let step = 0; step < 120; step++) {
        const before = await position();
        await page.keyboard.down('j'); // Repeated keydown, as when holding the key.
        const after = await position();
        continuous &&= after > before && after - before <= 120;
        const visible = await page.evaluate(() => {
          const graph = document.querySelector('[data-cortex-stage]').getBoundingClientRect();
          const model = document.querySelector('[data-scene-mount]').getBoundingClientRect();
          return { graph: graph.top < innerHeight && graph.bottom > 0, model: model.top >= 0 && model.top < innerHeight * .5 };
        });
        passedGraph ||= visible.graph;
        if (visible.model) { reachedModel = true; break; }
      }
      await page.keyboard.up('j');
      check(continuous, 'Held j keeps scrolling without skipping content (' + reducedMotion + ')');
      check(passedGraph && reachedModel, 'Held j traverses the graph and reaches the 3D view (' + reducedMotion + ')');
      await page.waitForFunction(() => document.querySelector('[data-cortex-scene]')?.dataset.sceneReady === 'true', null, { timeout: 45000 });
      check(await page.locator('[data-scene-canvas] canvas').count() === 1, 'The reached 3D model renders (' + reducedMotion + ')');
      const atModel = await position();
      await page.keyboard.down('k');
      for (let step = 0; step < 7; step++) await page.keyboard.down('k');
      await page.keyboard.up('k');
      check(await position() < atModel - 400, 'Held k scrolls back through the graph (' + reducedMotion + ')');
    }

    const search = page.locator('[data-cortex-search]');
    await search.evaluate(element => { element.scrollIntoView({ block: 'center', behavior: 'instant' }); element.focus({ preventScroll: true }); });
    await search.fill('');
    const atSearch = await position();
    await page.keyboard.type('jk');
    check(await search.inputValue() === 'jk' && await position() === atSearch, 'j/k type normally in graph search');
    await search.fill('');
    const equipment = page.locator('[data-scene-equipment]');
    await equipment.evaluate(element => { element.scrollIntoView({ block: 'center', behavior: 'instant' }); element.focus({ preventScroll: true }); });
    const atSelect = await position();
    await page.keyboard.press('j');
    await page.keyboard.press('k');
    check(await position() === atSelect, '3D select controls retain their keyboard input');
    await blur();
    await page.keyboard.press('?');
    check((await page.locator('#help-dialog').textContent()).includes('Scroll down / up'), 'Help describes scrolling');
    const atHelp = await position();
    await page.keyboard.press('j');
    check(await position() === atHelp, 'Dialogs suppress page scrolling shortcuts');
    await page.keyboard.press('Escape');
    await page.locator('[data-vim-toggle]').click();
    const atDisabled = await position();
    await page.keyboard.press('j');
    await page.keyboard.press('k');
    check(await position() === atDisabled, 'Vim off disables j/k scrolling');
    await page.keyboard.press('Control+k');
    check(await page.locator('#command-dialog').evaluate(dialog => dialog.open), 'Ctrl K still opens search with Vim off');
    await page.keyboard.press('Escape');
    await page.locator('[data-vim-toggle]').click();
    await reset();
    await page.keyboard.press('G');
    await page.waitForFunction(() => Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) < 2);
    const atBottom = await position();
    await page.keyboard.press('j');
    check(Math.abs(await position() - atBottom) < 2, 'j at the bottom stays at the bottom');
    await page.keyboard.press('g');
    await page.keyboard.press('g');
    await page.waitForFunction(() => scrollY === 0);
    check(await position() === 0, 'gg still returns to the top');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await reset();
    const shortcut = page.locator('.work-jump a[href="#plant3d"]');
    await shortcut.click();
    await page.waitForFunction(() => {
      const top = document.querySelector('#plant3d').getBoundingClientRect().top;
      return top >= 0 && top < innerHeight * .25;
    });
    check(true, 'The 3D section link works on mobile');
    await blur();
    const mobilePosition = await position();
    await page.keyboard.press('j');
    await page.keyboard.press('j');
    check(await position() > mobilePosition && await position() < mobilePosition + 240, 'j scrolls through the 3D view on mobile');
    await page.keyboard.press('k');
    check(await position() < mobilePosition + 160, 'k scrolls back on mobile');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Section links fit mobile');
    check(errors.length === 0, 'No page errors');
    return { passed: checks.length, checks };
  } finally { page.off('pageerror', onError); }
}
