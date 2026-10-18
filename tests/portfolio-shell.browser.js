async (page) => {
  const checks = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  const base = 'http://127.0.0.1:4173';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('fieldnotes:skip-intro', 'true'));
  for (const path of ['/', '/work/', '/about/', '/card/', '/card/qr/', '/notes/done-means-diagnosable/']) {
    await page.goto(base + path);
    check(await page.locator('.site-header a[href="/work/"]').count() === 1, `Work navigation on ${path}`);
    check(await page.locator('.site-header a.nav-book').count() === 1, `Booking navigation on ${path}`);
    for (const width of [1440, 1280, 1171, 1170, 1024, 768, 701, 700, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} fits ${width}px`);
      check(await page.locator('.site-header').evaluate(header => {
        const boxes = [...header.querySelectorAll('a, button')].map(node => node.getBoundingClientRect()).filter(box => box.width && box.height);
        return boxes.every((a, i) => boxes.slice(i + 1).every(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) < 1 || Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) < 1));
      }), `Header controls do not overlap at ${width}px on ${path}`);
    }
    if (path === '/card/') check(await page.locator('.card-headshot').count() === 1, 'Contact card retains its headshot');
    if (path === '/card/qr/') check(await page.locator('svg.card-qr-code').count() === 1, 'Contact QR is retained');
  }
  await page.goto(base + '/');
  check(await page.locator('.work-teaser a[href="/work/"]').count() === 1, 'Homepage links to the portfolio');
  check(await page.locator('a[href="/notes/icc-2026-recap-review/"]').count() > 0, 'Published ICC note remains in the notebook');
  const index = await (await page.request.get(base + '/assets/data.json')).json();
  check(index.articles.length === 2 && index.articles.every(article => !article.sample), 'Search contains the two published notes');
  await page.goto(base + '/work/');
  check(await page.locator('.work-story').count() === 3, 'Portfolio has three project write-ups');
  for (const [query, href] of [['Ignition Dev Tools', 'https://thethoughtagen.github.io/ignition-ide-plugins/'], ['Forge Cortex Plant 3D', '/work/#plant3d']]) {
    await page.keyboard.press('Control+k');
    await page.locator('#command-input').fill(query);
    const result = page.locator('#command-results a.command-result').filter({ hasText: query }).first();
    await result.waitFor();
    check(await result.getAttribute('href') === href, `Search destination for ${query}`);
    await page.keyboard.press('Escape');
  }
  for (const [path, mime] of [['/assets/plant3d/model.glb', 'model/gltf-binary'], ['/assets/recordings/cli.cast', 'application/x-asciicast']]) {
    const response = await page.request.get(base + path);
    check(response.ok() && response.headers()['content-type'].startsWith(mime), `${path} has its media type`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: '/private/tmp/portfolio-pr-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/private/tmp/portfolio-pr-mobile.png' });
  return { passed: checks.length, checks };
}
