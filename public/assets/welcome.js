const container = document.querySelector('[data-welcome]');
if (container) {
  const video = container.querySelector('video');
  const button = container.querySelector('button');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let started = false;
  let visible = false;
  let failed = false;
  let pending = false;
  let playbackRun = 0;
  const blocked = () => document.hidden || Boolean(document.querySelector('dialog[open]'));
  const showStill = () => {
    video.pause();
    container.classList.remove('is-playing');
    button.textContent = 'Play animation';
  };
  async function play() {
    if (failed || pending || blocked()) return;
    pending = true;
    const run = ++playbackRun;
    started = true;
    if (!video.getAttribute('src')) video.src = window.fieldnotesArtwork().video;
    if (video.ended) video.currentTime = 0;
    video.muted = true;
    try {
      await video.play();
    } catch {
      if (run === playbackRun) showStill();
    } finally { if (run === playbackRun) pending = false; }
  }
  function autoPlay() {
    if (!started && visible && !blocked() && !motion.matches && document.documentElement.dataset.paused !== 'true') play();
  }
  video.addEventListener('playing', () => {
    if (blocked()) { video.pause(); return; }
    container.classList.add('is-playing');
    button.textContent = 'Pause animation';
  });
  video.addEventListener('pause', () => { button.textContent = video.ended ? 'Replay animation' : 'Resume animation'; });
  video.addEventListener('ended', () => { button.textContent = 'Replay animation'; });
  video.addEventListener('error', () => {
    failed = true;
    showStill();
    button.hidden = true;
  });
  button.addEventListener('click', () => {
    if (video.paused || video.ended) play();
    else video.pause();
  });
  motion.addEventListener('change', () => {
    if (motion.matches) showStill();
    else autoPlay();
  });
  const checkVisibility = () => {
    if (blocked()) video.pause();
    else autoPlay();
  };
  document.addEventListener('fieldnotes:theme-change', () => {
    playbackRun++;
    showStill();
    video.removeAttribute('src');
    video.load();
    pending = false;
    started = false;
    failed = false;
    button.hidden = false;
    autoPlay();
  });
  document.addEventListener('visibilitychange', checkVisibility);
  document.addEventListener('fieldnotes:boot-open', checkVisibility);
  document.addEventListener('fieldnotes:boot-close', checkVisibility);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) video.pause();
    else autoPlay();
  }, { threshold: 0.25 }).observe(container);
  button.hidden = false;
}
