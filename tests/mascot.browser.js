async (page) => {
  const base = 'http://127.0.0.1:4173';
  const checks = [];
  const errors = [];
  const check = (condition, label) => { if (!condition) throw new Error(label); checks.push(label); };
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ media: 'screen', reducedMotion: 'no-preference' });
  await page.goto(base + '/about/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(base + '/');
  const boot = page.locator('#boot-dialog');
  const image = page.locator('.hero-artwork .mascot img');
  await page.locator('#boot-dialog[open]').waitFor();
  await boot.locator('img').evaluate((img) => img.decode());
  check(await boot.locator('img').evaluate((img) => img.naturalWidth === 1024 && img.naturalHeight === 572), 'Boot loads the supplied image at its original dimensions');
  check(await boot.evaluate((el) => ['::before', '::after'].every((pseudo) => ['none', 'normal'].includes(getComputedStyle(el, pseudo).content))), 'Boot adds no scanline or vignette overlay');
  await page.waitForFunction(() => parseInt(document.querySelector('.boot-percent').textContent) > 25);
  check(parseInt(await boot.locator('.boot-percent').textContent()) < 100, 'Boot text and progress still animate');
  await page.screenshot({ path: 'fieldnotes-original-boot-desktop.png' });
  await boot.waitFor({ state: 'hidden', timeout: 6000 });
  check(true, 'Boot auto-dismisses without waiting on artwork animation');
  await image.evaluate((img) => img.decode());
  check(await image.getAttribute('src') === '/assets/patrick-terminal.jpg', 'Homepage uses the original JPEG');
  check(await page.locator('.mascot svg').count() === 0, 'No reconstructed SVG remains');
  check(await page.locator('.terminal, [data-terminal-view], [data-animation]').count() === 0, 'Artwork has no fake window or scene controls');
  check(await page.getByRole('button', { name: /^(Walking|Typing|Thumbs up)$/ }).count() === 0, 'Unsupported pose controls removed');
  check(await image.evaluate((img) => { const style = getComputedStyle(img); return style.filter === 'none' && style.transform === 'none' && style.animationName === 'none' && style.objectFit === 'contain'; }), 'Artwork has no recoloring, transforms, cropping, or pretend animation');
  await page.locator('.hero-artwork').screenshot({ path: 'fieldnotes-original-home-desktop.png' });

  const response = await page.request.get(base + '/assets/patrick-terminal.jpg');
  check(response.status() === 200 && response.headers()['content-type'] === 'image/jpeg', 'JPEG served with correct MIME type');
  const bytes = await response.body();
  const hash = await page.evaluate(async (data) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(data)))].map((byte) => byte.toString(16).padStart(2, '0')).join(''), [...bytes]);
  check(hash === '6c396868eef2492340d48f365ef60a97a4467af0830e39c42daaf8a32688a252', 'Served image is byte-identical to the supplied file');

  for (const theme of ['amber', 'paper', 'green']) {
    await page.locator('[data-theme-toggle]').click();
    check(await page.locator('html').getAttribute('data-theme') === theme, theme + ' theme remains available');
    check(await image.evaluate((img) => getComputedStyle(img).filter) === 'none', theme + ' theme preserves original artwork colors');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [[320, 640], [390, 844], [768, 640], [1440, 1000]]) {
    await page.setViewportSize({ width, height });
    await page.goto(base + '/');
    await image.evaluate((img) => img.decode());
    check(!await boot.isVisible(), 'Reduced motion bypasses automatic boot at ' + width + 'px');
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Homepage fits ' + width + 'px');
    check(await image.evaluate((img) => { const rect = img.getBoundingClientRect(); return Math.abs(rect.width / rect.height - 1024 / 572) < 0.01; }), 'Image retains full aspect ratio at ' + width + 'px');
    if (width === 390) await page.locator('.hero-artwork').screenshot({ path: 'fieldnotes-original-home-mobile.png' });
    await page.locator('[data-reboot]').click();
    await boot.locator('img').evaluate((img) => img.decode());
    check(await boot.locator('img').isVisible(), 'Replay displays original artwork at ' + width + 'px');
    check(await boot.evaluate((el) => el.scrollWidth <= innerWidth), 'Boot fits ' + width + 'px');
    check(await boot.locator('.boot-percent').textContent() === '100%', 'Reduced-motion replay is immediately ready at ' + width + 'px');
    if (width === 390) await page.screenshot({ path: 'fieldnotes-original-boot-mobile.png' });
    await page.keyboard.press('Escape');
    await boot.waitFor({ state: 'hidden' });
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(base + '/about/');
  await page.keyboard.press(':');
  await page.locator('#command-input').fill(':reboot');
  await page.keyboard.press('Enter');
  await page.locator('#boot-dialog[open]').waitFor();
  check(await boot.locator('img').getAttribute('src') === '/assets/patrick-terminal.jpg', 'Command replay from another page uses the same original image');
  await page.keyboard.press('Enter');
  await boot.waitFor({ state: 'hidden' });
  check(await page.evaluate(() => document.body.style.overflow === ''), 'Skipping restores scrolling');

  const nojs = await page.context().browser().newContext({ javaScriptEnabled: false });
  const plain = await nojs.newPage();
  await plain.goto(base + '/');
  await plain.locator('.hero-artwork img').evaluate((img) => img.decode());
  check(await plain.locator('.hero-artwork img').isVisible(), 'Original image works without JavaScript');
  await nojs.close();
  check(errors.length === 0, 'No JavaScript page errors');
  return { passed: checks.length, checks, errors };
}
