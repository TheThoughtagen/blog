try {
  const theme = localStorage.getItem('fieldnotes:theme');
  if (['green', 'amber', 'paper'].includes(theme)) document.documentElement.dataset.theme = theme;
  if (localStorage.getItem('fieldnotes:paused') === 'true') document.documentElement.dataset.paused = 'true';
} catch { /* The notebook still works when browser storage is unavailable. */ }
