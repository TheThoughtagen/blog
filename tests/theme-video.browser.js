async (page) => {
  const checks = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  const base = 'http://127.0.0.1:4173/';
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('fieldnotes:skip-intro','true'); });
  await page.reload();
  for (const theme of ['amber', 'paper', 'green']) {
    await page.locator('[data-theme-toggle]').click();
    const suffix = theme === 'green' ? '' : `-${theme}`;
    check(await page.locator('.hero-artwork img').getAttribute('src') === `/assets/patrick-terminal${suffix}.jpg`, `${theme} still matches theme`);
    check(await page.locator('.hero-artwork video').getAttribute('src') === null, `${theme} reduced motion avoids video download`);
    await page.locator('[data-reboot]').click();
    check(await page.locator('#boot-dialog img').getAttribute('src') === `/assets/patrick-terminal${suffix}.jpg`, `${theme} splash still matches theme`);
    await page.keyboard.press('Escape');
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (const theme of ['amber', 'paper', 'green']) {
    await page.locator('[data-theme-toggle]').click();
    const suffix = theme === 'green' ? '' : `-${theme}`;
    await page.waitForFunction(suffix => { const v = document.querySelector('.hero-artwork video'); return v.getAttribute('src') === `/assets/patrick-welcome${suffix}.mp4` && v.currentTime > 0; }, suffix);
    check(true, `${theme} homepage video plays`);
    await page.locator('[data-reboot]').click();
    await page.waitForFunction(suffix => { const v = document.querySelector('#boot-dialog video'); return v.getAttribute('src') === `/assets/patrick-welcome${suffix}.mp4` && v.currentTime > 0; }, suffix);
    check(true, `${theme} splash video plays`);
    await page.keyboard.press('Escape');
  }
  await page.locator('[data-theme-toggle]').click();
  await page.locator('[data-theme-toggle]').click();
  await page.reload();
  check(await page.locator('html').getAttribute('data-theme') === 'paper', 'Theme persists on reload');
  await page.setViewportSize({ width: 390, height: 844 });
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Mobile layout fits');
  return { passed: checks.length, checks };
}
