try {
  const theme = localStorage.getItem('fieldnotes:theme');
  if (['green', 'amber', 'paper'].includes(theme)) document.documentElement.dataset.theme = theme;
  if (localStorage.getItem('fieldnotes:paused') === 'true') document.documentElement.dataset.paused = 'true';
} catch { /* The notebook still works when browser storage is unavailable. */ }

// Shared by the homepage and splash, including before app.js initializes.
window.fieldnotesArtwork = () => {
  const theme = document.documentElement.dataset.theme;
  const suffix = ['amber', 'paper'].includes(theme) ? `-${theme}` : '';
  return {
    video: `/assets/patrick-welcome${suffix}.mp4`,
    poster: `/assets/patrick-terminal${suffix}.jpg`,
  };
};
