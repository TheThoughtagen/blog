async (page) => {
  const checks = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  const base = 'http://127.0.0.1:4173';
  const expected = [
    ['Ignition Dev Tools', 'https://thethoughtagen.github.io/ignition-ide-plugins/', 'https://github.com/TheThoughtagen/ignition-ide-plugins'],
    ['ignition-lint', 'https://thethoughtagen.github.io/ignition-lint/', 'https://github.com/TheThoughtagen/ignition-lint'],
    ['Ignition CLI', 'https://thethoughtagen.github.io/ignition-cli/', 'https://github.com/TheThoughtagen/ignition-cli'],
    ['ignition-mcp', 'https://whiskeyhouse.github.io/ignition-mcp/', 'https://github.com/WhiskeyHouse/ignition-mcp'],
    ['Ignition Git Module', 'https://whiskeyhouse.github.io/ignition-git-module/', 'https://github.com/WhiskeyHouse/ignition-git-module'],
  ];

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base + '/lab/');
  const section = page.getByRole('region', { name: 'Ignition tools' });
  await section.waitFor();
  const cards = section.locator('.ignition-project-card');
  check(await cards.count() === expected.length, 'Lab renders all five Ignition tool cards');
  check(await page.locator('[data-github]').count() === 3, 'Existing GitHub panels remain on the Lab page');

  for (const [name, documentationUrl, repositoryUrl] of expected) {
    const card = cards.filter({ has: page.getByRole('heading', { name, exact: true }) });
    check(await card.count() === 1, `${name} has one semantic project card`);
    const docs = card.getByRole('link', { name: 'Documentation' });
    const source = card.getByRole('link', { name: 'Source repository' });
    check(await docs.getAttribute('href') === documentationUrl, `${name} documentation is navigable`);
    check(await source.getAttribute('href') === repositoryUrl, `${name} source is navigable`);
    for (const link of [docs, source]) {
      check(await link.getAttribute('target') === '_blank', `${name} external link opens a new tab`);
      check((await link.getAttribute('rel') || '').split(/\s+/).includes('noopener') && (await link.getAttribute('rel') || '').split(/\s+/).includes('noreferrer'), `${name} external link isolates its opener`);
    }
  }

  await page.keyboard.press('ControlOrMeta+k');
  await page.locator('#command-input').fill('ignition-mcp');
  const result = page.locator('#command-results .command-result', { hasText: 'ignition-mcp' });
  await result.waitFor();
  check(await result.getAttribute('href') === 'https://whiskeyhouse.github.io/ignition-mcp/', 'Cmd+K returns navigable project documentation');
  check(await result.getAttribute('target') === '_blank', 'Cmd+K project result is a safe external link');
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileCards = await cards.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map(({ left, top, right }) => ({ left, top, right })));
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Ignition tools do not overflow the mobile viewport');
  check(mobileCards.every((rect, index) => rect.right <= 390 && (!index || Math.abs(rect.left - mobileCards[0].left) < 1) && (!index || rect.top > mobileCards[index - 1].top)), 'Ignition tool cards stack in one mobile column');
  return { passed: checks.length, checks };
}
