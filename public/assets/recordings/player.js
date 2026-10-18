(() => {
  const mount = document.querySelector('[data-terminal-player]');
  if (!mount || !window.AsciinemaPlayer) return;
  const catalog = JSON.parse(document.querySelector('#recording-catalog').textContent);
  const controls = document.querySelector('[data-recording-controls]');
  const choices = [...controls.querySelectorAll('[data-recording-choice]')];
  const requested = new URLSearchParams(location.search).get('demo');
  let player;
  function choose(clip) {
    const demo = catalog.find(item => item.clip === clip) || catalog[0];
    player?.dispose();
    mount.replaceChildren();
    choices.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.recordingChoice === demo.clip)));
    document.querySelector('[data-recording-title]').textContent = demo.title;
    document.querySelector('[data-recording-summary]').textContent = demo.description;
    document.querySelector('[data-recording-guide]').href = demo.url;
    document.querySelector('[data-recording-download]').href = demo.cast;
    player = AsciinemaPlayer.create(demo.cast, mount, {
      cols: 92, rows: 26, controls: true, fit: 'width', preload: true,
      autoplay: false, poster: 'npt:0:03', speed: 1.2,
      idleTimeLimit: demo.clip === 'nvim' ? 4 : 2, cursorMode: 'steady',
    });
  }
  choose(requested);
  controls.hidden = false;
  choices.forEach(button => button.addEventListener('click', () => choose(button.dataset.recordingChoice)));
  new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) player?.pause(); }).observe(mount);
  document.addEventListener('visibilitychange', () => { if (document.hidden) player?.pause(); });
  window.addEventListener('pagehide', event => { if (!event.persisted) player?.dispose(); });
  const videos = [...document.querySelectorAll('.work-video video')];
  const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (!entry.isIntersecting) entry.target.pause(); }));
  videos.forEach(video => {
    observer.observe(video);
    video.addEventListener('play', () => { player?.pause(); videos.filter(other => other !== video).forEach(other => other.pause()); });
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) videos.forEach(video => video.pause()); });
})();
