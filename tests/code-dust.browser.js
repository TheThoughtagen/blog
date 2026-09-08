async (page) => {
  const checks = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('http://127.0.0.1:4173/about/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('fieldnotes:skip-intro', 'true'); });
  await page.goto('http://127.0.0.1:4173/');
  await page.mouse.move(100, 230);
  await page.mouse.move(130, 245, { steps: 5 });
  await page.waitForFunction(() => { const c = document.querySelector('.code-dust'); return c && !c.hidden; });
  const stats = await page.locator('.code-dust').evaluate(c => {
    const pixels = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const alpha = Array.from(pixels).filter((_, i) => i % 4 === 3);
    const r = c.getBoundingClientRect();
    return { maxAlpha: Math.max(...alpha), width: r.width, height: r.height, pointerEvents: getComputedStyle(c).pointerEvents, hiddenFromAT: c.getAttribute('aria-hidden') };
  });
  check(stats.maxAlpha > 0 && stats.maxAlpha <= 82, 'Glyphs render at restrained opacity');
  check(stats.width === 120 && stats.height === 120, 'Effect stays in a 120px square around pointer');
  check(stats.pointerEvents === 'none' && stats.hiddenFromAT === 'true', 'Effect cannot intercept clicks or enter accessibility tree');
  await page.waitForFunction(() => document.querySelector('.code-dust').hidden, { timeout: 2000 });
  check(true, 'Effect disappears when pointer rests');
  await page.mouse.move(160, 250);
  await page.locator('[data-theme-toggle]').hover();
  check(await page.locator('.code-dust').isHidden(), 'Hovering controls clears glyphs');
  await page.mouse.move(200, 250);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.mouse.move(250, 250);
  check(await page.locator('.code-dust').isHidden(), 'Reduced motion disables code dust');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.mouse.move(300, 250);
  await page.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.querySelector('h1')); getSelection().removeAllRanges(); getSelection().addRange(r); });
  await page.mouse.move(350, 250);
  check(await page.locator('.code-dust').isHidden(), 'Selected text suppresses effect');
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.mouse.move(1438, 998);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Cursor at viewport edge causes no horizontal overflow');
  return { passed: checks.length, checks };
}
