async (page) => {
  const checks = [];
  const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:4173/work/');
  await page.locator('[data-recording-controls]').waitFor({ state: 'visible' });
  check(await page.locator('.work-video video').count() === 4, 'Four original Forge application recordings');
  check(await page.locator('[data-recording-choice]').count() === 4, 'Four original terminal recordings');
  check(await page.evaluate(() => [...document.querySelectorAll('.work-video video')].every(video => video.controls && !video.autoplay)), 'Videos have native controls and no autoplay');
  const portal = page.locator('.portal-feature-film video');
  check(await portal.count() === 1, 'Customer portal launch film is featured');
  check(await portal.evaluate(video => video.controls && !video.autoplay && video.preload === 'none'), 'Portal film has native controls and loads on request');
  await portal.scrollIntoViewIfNeeded();
  const portalMedia = await portal.evaluate(async video => {
    video.load();
    if (video.readyState < 1) await Promise.race([
      new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', resolve, { once: true });
        video.addEventListener('error', () => reject(new Error('Portal video decode failed')), { once: true });
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Portal metadata timed out')), 6000)),
    ]);
    return { duration: video.duration, width: video.videoWidth };
  });
  check(Math.abs(portalMedia.duration - 57.5) < .1 && portalMedia.width === 1920, 'Original 57.5-second portal launch film decodes');
  await portal.evaluate(async video => {
    video.muted = true;
    await Promise.race([video.play(), new Promise((_, reject) => setTimeout(() => reject(new Error('Portal playback timed out')), 5000))]);
  });
  await page.waitForFunction(() => document.querySelector('.portal-feature-film video').currentTime > 0);
  check(true, 'Portal launch film plays in the browser');
  await portal.evaluate(video => video.pause());
  check((await page.locator('#customer-portal').textContent()).includes('DEMONSTRATION DATA'), 'Portal film identifies its demonstration data');
  await page.locator('#customer-portal').screenshot({ path: '/private/tmp/portfolio-customer-portal.png' });
  for (const clip of ['cli', 'tui', 'pi', 'nvim']) {
    await page.locator(`[data-recording-choice="${clip}"]`).click();
    await page.waitForFunction(() => document.querySelector('[data-terminal-player] pre')?.textContent.trim().length > 100);
    const cast = await page.locator('[data-recording-download]').getAttribute('href');
    check(cast.split('?')[0].endsWith(`/${clip}.cast`), `${clip} selection uses its original cast`);
    check((await page.request.get('http://127.0.0.1:4173' + cast)).ok(), `${clip} recording is served`);
  }
  const media = await page.locator('.work-video video').evaluateAll(async videos => {
    const results = [];
    for (const video of videos) {
      video.load();
      if (video.readyState < 1) await Promise.race([
        new Promise((resolve, reject) => {
          video.addEventListener('loadedmetadata', resolve, { once: true });
          video.addEventListener('error', () => reject(new Error('Video decode failed')), { once: true });
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Video metadata timed out')), 6000)),
      ]);
      results.push({ title: video.getAttribute('aria-label'), duration: video.duration, width: video.videoWidth });
    }
    return results;
  });
  media.forEach(video => check(video.duration > 10 && video.width === 1280, `${video.title} decodes as original video`));
  const firstVideo = page.locator('.work-video video').first();
  await firstVideo.scrollIntoViewIfNeeded();
  await firstVideo.evaluate(async video => {
    video.muted = true;
    await Promise.race([video.play(), new Promise((_, reject) => setTimeout(() => reject(new Error('Playback timed out')), 5000))]);
  });
  await page.waitForFunction(() => document.querySelector('.work-video video').currentTime > 0);
  check(true, 'Forge recording plays in the browser');
  await firstVideo.evaluate(video => video.pause());
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Actual media gallery fits ${width}px`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: '/private/tmp/portfolio-real-desktop.png' });
  await page.locator('#forge-walkthroughs').screenshot({ path: '/private/tmp/portfolio-real-forge.png' });
  return { passed: checks.length, checks };
}
