async (page) => {
  const checks = [], requests = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  page.on('request', request => requests.push(request.url()));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('fieldnotes:skip-intro', 'true'));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
  const film = page.locator('.landing-film video');
  check(await film.count() === 1, 'The landing hero shows the original customer portal film');
  check(await film.evaluate(node => node.controls && !node.autoplay && node.preload === 'none'), 'The film has native controls and loads on request');
  check(await page.evaluate(() => document.querySelector('.landing-work').compareDocumentPosition(document.querySelector('.author-card')) & Node.DOCUMENT_POSITION_FOLLOWING), 'Work appears before the bio');
  check(await page.evaluate(() => document.querySelector('.landing-work').compareDocumentPosition(document.querySelector('#notebook')) & Node.DOCUMENT_POSITION_FOLLOWING), 'Work appears before the notes');
  check(await page.locator('.landing-demo').count() === 3, 'Three visual entries lead to specific demos');
  await page.locator('.landing-demo').last().scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...document.querySelectorAll('.landing-demo img')].every(img => img.complete && img.naturalWidth > 0));
  check(true, 'Every demo preview loads');
  const destinations = await page.locator('.landing-demo').evaluateAll(nodes => nodes.map(node => node.getAttribute('href')));
  check(JSON.stringify(destinations) === JSON.stringify(['/work/#cortex-graph', '/work/#plant3d', '/work/#demos']), 'Cards open the graph, 3D view, and terminal recordings directly');
  const work = await (await page.request.get('http://127.0.0.1:4173/work/')).text();
  check(destinations.every(href => work.includes(`id="${href.split('#')[1]}"`)), 'Every demo destination exists on the portfolio');
  check(!requests.some(url => /\/assets\/(?:graph\/vendor|plant3d\/(?:vendor|app))\.js/.test(url)), 'The landing page does not load either interactive renderer');
  check(!requests.some(url => /\/assets\/work\/.*\.mp4(?:\?|$)/.test(url)), 'Demo videos remain unloaded until a visitor plays one');
  await film.scrollIntoViewIfNeeded();
  await film.evaluate(node => node.play());
  await page.waitForFunction(() => document.querySelector('.landing-film video').currentTime > .2);
  check(true, 'The original portal film plays from the landing page');
  await page.locator('#selected-work').evaluate(node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
  await page.waitForFunction(() => document.querySelector('.landing-film video').paused);
  check(true, 'The portal film pauses after leaving the viewport');
  await film.evaluate(node => node.load());
  await page.evaluate(() => { document.activeElement?.blur(); scrollTo({ top: 0, behavior: 'instant' }); });
  await page.keyboard.press('j');
  check(await page.evaluate(() => scrollY > 0 && scrollY <= 120), 'j scrolls through the homepage work instead of jumping to notes');
  await page.keyboard.press('k');
  check(await page.evaluate(() => scrollY === 0), 'k returns by the same step');
  await page.locator('.hero-actions a[href="#selected-work"]').click();
  await page.waitForFunction(() => { const top = document.querySelector('#selected-work').getBoundingClientRect().top; return top >= 0 && top < 100; });
  check(true, 'The primary hero action brings the demos into view');
  for (const width of [1440, 1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Landing page fits ' + width);
    if ([1440, 390, 320].includes(width)) {
      await page.screenshot({ path: 'test-results/landing-home-' + width + '.png' });
      await page.locator('#selected-work').screenshot({ path: 'test-results/landing-demos-' + width + '.png' });
    }
  }
  for (const theme of ['amber', 'paper', 'green']) {
    await page.locator('[data-theme-toggle]').click();
    check(await page.locator('html').getAttribute('data-theme') === theme, 'Showcase supports the ' + theme + ' theme');
  }
  return { passed: checks.length, checks };
}
