(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const preference = (key) => { try { return localStorage.getItem(`fieldnotes:${key}`) === 'true'; } catch { return false; } };
  let frame;
  let deadline;
  let opener;
  let automatic = false;
  let previousOverflow = '';
  let dialog;
  let video;
  let playbackRun = 0;
  const diagnostics = [
    'FIELD OS v1.0 / PERSONAL TERMINAL',
    'Copyright (c) 2026. Stay curious.',
    '',
    '> Initializing phosphor display........ OK',
    '> Checking human-machine interface.... OK',
    '> Mounting /dev/fieldnotes............ OK',
    '> Loading industrial software........ OK',
    '> Loading people, systems & ideas.... OK',
    '> Establishing an open channel....... OK',
    '',
    'ACCESS GRANTED. WELCOME TO THE NOTEBOOK.',
  ].join('\n');
  function cleanup() {
    cancelAnimationFrame(frame); clearTimeout(deadline);
    playbackRun++;
    video?.pause();
    document.body.style.overflow = previousOverflow;
  }
  function finish() {
    if (!dialog?.open) return;
    cleanup(); dialog.close();
  }
  function start(isAutomatic = false) {
    if (dialog?.open) return;
    automatic = isAutomatic;
    opener = document.activeElement;
    const still = motion.matches || preference('paused') || document.documentElement.dataset.paused === 'true';
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = 'boot-dialog';
      dialog.setAttribute('aria-labelledby', 'boot-heading');
      dialog.setAttribute('aria-describedby', 'boot-description');
      dialog.innerHTML = `<div class="boot-shell"><div class="boot-topline"><span>FIELD STATION 001</span><span>LOCAL BOOT SIMULATION</span></div><div class="boot-heading"><span class="boot-emblem" aria-hidden="true">[ f_ ]</span><div><p>PERSONAL INFORMATION TERMINAL</p><h2 id="boot-heading">FIELDNOTES</h2></div></div><p id="boot-description" class="boot-sr-only">A decorative terminal startup showing Patrick walking to a retro computer, typing, and giving a thumbs-up. The notebook is ready. Skip at any time with Enter, Escape, or the skip button.</p><div class="boot-content"><pre class="boot-output" aria-hidden="true"></pre><div class="boot-art" aria-hidden="true"></div></div><div class="boot-meter" aria-hidden="true"><span class="boot-bar"></span><span class="boot-percent">0%</span></div><div class="boot-access" aria-hidden="true">INITIALIZING TERMINAL<span>_</span></div><div class="boot-controls"><label><input type="checkbox" id="boot-skip-preference"> Skip intro next time</label><button type="button" class="boot-skip">Skip intro <span>[ ENTER ]</span></button></div><div class="boot-bottomline"><span>NO VAULT REQUIRED.</span><span>PEOPLE FIRST. SYSTEMS SECOND.</span></div></div>`;
      const mascotTemplate = document.querySelector('#mascot-template');
      if (mascotTemplate) dialog.querySelector('.boot-art').append(mascotTemplate.content.cloneNode(true));
      video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'none';
      video.setAttribute('aria-hidden', 'true');
      dialog.querySelector('.boot-art').append(video);
      dialog.querySelector('.boot-skip').addEventListener('click', finish);
      dialog.querySelector('#boot-skip-preference').addEventListener('change', (event) => {
        try { localStorage.setItem('fieldnotes:skip-intro', String(event.target.checked)); } catch { /* This visit can still be skipped. */ }
      });
      dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(); });
      dialog.addEventListener('close', () => {
        cleanup();
        document.dispatchEvent(new Event('fieldnotes:boot-close'));
        const target = automatic || !opener?.getClientRects().length ? document.querySelector('#main') : opener;
        if (target?.isConnected && !document.querySelector('dialog[open]')) target.focus({ preventScroll: true });
      });
      dialog.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' && event.target.tagName !== 'INPUT') || event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(); }
      });
      document.body.append(dialog);
    }
    const artwork = window.fieldnotesArtwork();
    dialog.querySelector('.mascot img').src = artwork.poster;
    const output = dialog.querySelector('.boot-output');
    const bar = dialog.querySelector('.boot-bar');
    const percent = dialog.querySelector('.boot-percent');
    const access = dialog.querySelector('.boot-access');
    dialog.querySelector('#boot-skip-preference').checked = preference('skip-intro');
    dialog.querySelector('.boot-skip').innerHTML = still ? 'Enter the notebook <span>[ ENTER ]</span>' : 'Skip intro <span>[ ENTER ]</span>';
    dialog.classList.toggle('boot-still', still);
    dialog.classList.remove('boot-video-playing');
    output.textContent = still ? diagnostics : '';
    bar.textContent = `[${'#'.repeat(still ? 26 : 0)}${'.'.repeat(still ? 0 : 26)}]`;
    percent.textContent = still ? '100%' : '0%';
    access.textContent = still ? 'ACCESS GRANTED. PRESS ENTER.' : 'INITIALIZING TERMINAL_';
    previousOverflow = document.body.style.overflow;
    try { dialog.showModal(); document.body.style.overflow = 'hidden'; document.dispatchEvent(new Event('fieldnotes:boot-open')); }
    catch { cleanup(); dialog.remove(); dialog = null; return; }
    dialog.querySelector('.boot-skip').focus({ preventScroll: true });
    if (still) return;
    const began = performance.now();
    const run = ++playbackRun;
    let failed = false;
    let endedAt;
    // A stalled download must never trap the reader in the splash.
    deadline = setTimeout(finish, 8500);
    const fallback = () => {
      if (run !== playbackRun || !dialog.open) return;
      failed = true;
      video.pause();
      dialog.classList.remove('boot-video-playing');
    };
    video.onerror = fallback;
    video.onplaying = () => {
      if (run !== playbackRun || !dialog.open) { video.pause(); return; }
      dialog.classList.add('boot-video-playing');
    };
    if (video.getAttribute('src') !== artwork.video) video.src = artwork.video;
    video.currentTime = 0;
    video.play().catch(fallback);
    function tick(now) {
      if (!dialog.open) return;
      const elapsed = now - began;
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 5.083;
      const progress = Math.max(0, Math.min(1, failed ? elapsed / 2500 : video.currentTime / duration));
      output.textContent = diagnostics.slice(0, Math.floor(diagnostics.length * progress));
      output.scrollTop = output.scrollHeight;
      const filled = Math.floor(progress * 26);
      bar.textContent = `[${'#'.repeat(filled)}${'.'.repeat(26 - filled)}]`;
      percent.textContent = `${Math.floor(progress * 100)}%`;
      access.textContent = progress === 1 ? 'ACCESS GRANTED. WELCOME, HUMAN.' : 'INITIALIZING TERMINAL_';
      if (video.ended && endedAt === undefined) endedAt = now;
      if ((failed && elapsed >= 3200) || (endedAt !== undefined && now - endedAt >= 350)) finish();
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  document.addEventListener('click', (event) => { if (event.target.closest('[data-reboot]')) start(); });
  document.addEventListener('fieldnotes:reboot', () => start());
  document.addEventListener('visibilitychange', () => { if (document.hidden && automatic) finish(); });
  window.addEventListener('beforeprint', finish);
  motion.addEventListener('change', () => { if (motion.matches) finish(); });
  const navigationType = performance.getEntriesByType('navigation')[0]?.type;
  const backForward = navigationType === 'back_forward';
  // Reloading after clicking the notebook link should still show the intro.
  const showOnLoad = !location.hash || navigationType === 'reload';
  if (location.pathname === '/' && showOnLoad && !backForward && !motion.matches && !preference('paused') && document.documentElement.dataset.paused !== 'true' && !preference('skip-intro')) start(true);
})();
