import { connectGithub } from './github.js';
import './code-dust.js';
import './social.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const store = {
  get(key, fallback) { try { return localStorage.getItem(`fieldnotes:${key}`) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(`fieldnotes:${key}`, value); } catch { /* Preferences are optional. */ } },
};
let toastTimer;
function notify(text) {
  const toast = $('.toast'); toast.textContent = text; toast.classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

const themes = ['green', 'amber', 'paper'];
function setTheme(theme, announce = true) {
  if (!themes.includes(theme)) return;
  document.documentElement.dataset.theme = theme;
  $('.theme-name').textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
  $('[data-theme-toggle]').setAttribute('aria-label', `Color theme: ${theme}. Switch to ${themes[(themes.indexOf(theme) + 1) % themes.length]}`);
  $('meta[name="theme-color"]').content = { green: '#111510', amber: '#18130e', paper: '#eeeede' }[theme];
  store.set('theme', theme);
  $$('.mascot img').forEach(image => { image.src = window.fieldnotesArtwork().poster; });
  document.dispatchEvent(new Event('fieldnotes:theme-change'));
  if (announce) notify(`${theme.toUpperCase()} phosphor selected${theme === 'paper' ? '. Easy on the eyes.' : '.'}`);
}
setTheme(document.documentElement.dataset.theme, false);
$('[data-theme-toggle]').addEventListener('click', () => setTheme(themes[(themes.indexOf(document.documentElement.dataset.theme) + 1) % themes.length]));

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let paused = store.get('paused', 'false') === 'true';
function updateAnimation() {
  const stopped = paused || reducedMotion.matches;
  document.documentElement.dataset.paused = String(stopped);
  $$('[data-animation]').forEach((button) => {
    button.textContent = reducedMotion.matches ? '[ motion off ]' : stopped ? '[ resume ]' : '[ pause ]';
    button.setAttribute('aria-pressed', String(stopped));
    button.setAttribute('aria-label', reducedMotion.matches ? 'Animation disabled by reduced motion preference' : stopped ? 'Resume terminal animation' : 'Pause terminal animation');
    button.disabled = reducedMotion.matches;
  });
}
updateAnimation();
reducedMotion.addEventListener('change', updateAnimation);
$$('[data-animation]').forEach((button) => button.addEventListener('click', () => { paused = !paused; store.set('paused', String(paused)); updateAnimation(); }));
function reboot() {
  document.dispatchEvent(new Event('fieldnotes:reboot'));
}

let vim = store.get('vim', 'true') !== 'false';
function updateVim() {
  const button = $('[data-vim-toggle]'); button.textContent = vim ? 'VIM: ON' : 'VIM: OFF';
  document.documentElement.dataset.vim = String(vim);
  button.setAttribute('aria-pressed', String(vim));
  button.title = vim ? 'Turn off h/j/k/l keyboard navigation' : 'Turn on h/j/k/l keyboard navigation';
  button.setAttribute('aria-label', vim ? 'Vim navigation enabled. Click to turn off' : 'Vim navigation disabled. Click to turn on');
}
updateVim();
$('[data-vim-toggle]').addEventListener('click', () => { vim = !vim; store.set('vim', String(vim)); updateVim(); notify(`Vim navigation ${vim ? 'on. j/k to explore, ? for help.' : 'off. Ctrl/Cmd K still opens search.'}`); });

let category = 'all';
function filterNotes() {
  const notes = $$('[data-note]');
  let count = 0;
  notes.forEach((note) => { note.hidden = category !== 'all' && note.dataset.category !== category; if (!note.hidden) count++; });
  $$('[data-filter]').forEach((button) => { const active = category === button.dataset.filter; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  if ($('[data-note-count]')) $('[data-note-count]').textContent = count;
  if ($('.empty-search')) $('.empty-search').hidden = count > 0;
}
$$('[data-enhanced]').forEach((element) => { element.hidden = false; });
$$('[data-filter]').forEach((button) => button.addEventListener('click', () => { category = button.dataset.filter; filterNotes(); }));
$('[data-reset]')?.addEventListener('click', () => { category = 'all'; filterNotes(); $('[data-filter="all"]').focus(); });

let data;
let dataPromise;
let dataError = false;
function loadData() {
  return dataPromise ||= fetch('/assets/data.json', { signal: AbortSignal.timeout(8000) }).then((response) => {
    if (!response.ok) throw new Error('Search index unavailable');
    return response.json();
  }).then((result) => { data = result; dataError = false; connectGithub(result.site.github); return result; }).catch(() => { dataError = true; return null; });
}
loadData();

const commandDialog = $('#command-dialog');
const helpDialog = $('#help-dialog');
const input = $('#command-input');
const results = $('#command-results');
let resultIndex = 0;
let dialogOpener;
function openDialog(dialog) {
  dialogOpener = document.activeElement;
  $$('dialog[open]').forEach((open) => open.close());
  dialog.showModal();
}
function closeDialog(dialog) { dialog.close(); }
$$('dialog:not(#boot-dialog)').forEach((dialog) => {
  dialog.querySelector('[data-close]').addEventListener('click', () => closeDialog(dialog));
  dialog.addEventListener('click', (event) => { const rect = dialog.getBoundingClientRect(); if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeDialog(dialog); });
  dialog.addEventListener('close', () => { if (!$('dialog[open]') && dialogOpener?.isConnected) dialogOpener.focus({ preventScroll: true }); });
});

const commands = [
  { title: ':home', description: 'Return to the notebook', action: () => { location.href = '/'; } },
  { title: ':lab', description: 'Visit the workbench', action: () => { location.href = '/lab/'; } },
  { title: ':about', description: 'Behind the terminal', action: () => { location.href = '/about/'; } },
  { title: ':book', description: 'Book a call', action: () => { location.href = '/connect/#book'; } },
  { title: ':subscribe', description: 'Subscribe by email', action: () => { location.href = '/connect/#subscribe'; } },
  ...themes.map((theme) => ({ title: `:theme ${theme}`, description: `Switch to the ${theme} color theme`, action: () => setTheme(theme) })),
  { title: ':reboot', description: 'Replay the local terminal boot sequence', action: reboot },
  { title: ':help', description: 'Keyboard shortcuts and commands', action: () => openDialog(helpDialog) },
];
function selectResult(index, focus = false) {
  const links = [...results.querySelectorAll('.command-result')];
  if (!links.length) return;
  resultIndex = Math.max(0, Math.min(links.length - 1, index));
  links.forEach((link, i) => link.classList.toggle('selected', i === resultIndex));
  links[resultIndex].scrollIntoView({ block: 'nearest' });
  if (focus) links[resultIndex].focus({ preventScroll: true });
}
function renderPalette() {
  results.replaceChildren(); resultIndex = 0;
  const query = input.value.trim().toLowerCase();
  let matches;
  if (query.startsWith(':')) matches = commands.filter((command) => `${command.title} ${command.description}`.toLowerCase().includes(query.slice(1)));
  else if (data) matches = [...data.articles, ...data.externalPosts].filter((note) => [note.title, note.description, note.category, ...(note.tags || [])].join(' ').toLowerCase().includes(query)).map((note) => ({ title: note.title, description: `${note.category} / ${note.source || (note.sample ? 'Sample note' : 'Field note')}`, url: note.url, external: Boolean(note.source) }));
  else {
    const paragraph = document.createElement('p'); paragraph.className = 'command-empty'; paragraph.textContent = dataError ? 'Search could not load. The notebook is still available below.' : 'Loading the notebook index...'; results.append(paragraph);
    if (dataError) { const retry = document.createElement('button'); retry.className = 'command-result'; retry.textContent = 'Retry search connection'; retry.addEventListener('click', async () => { dataPromise = null; dataError = false; const pending = loadData(); renderPalette(); await pending; if (commandDialog.open && !input.value.trim().startsWith(':')) renderPalette(); }); results.append(retry); }
    return;
  }
  for (const match of matches) {
    const element = document.createElement(match.action ? 'button' : 'a'); element.className = 'command-result';
    if (match.action) element.addEventListener('click', () => { closeDialog(commandDialog); match.action(); });
    else { element.href = match.url; if (match.external) { element.target = '_blank'; element.rel = 'noopener noreferrer'; } }
    const copy = document.createElement('span'); const title = document.createElement('strong'); title.textContent = match.title;
    const desc = document.createElement('small'); desc.textContent = match.description;
    const arrow = document.createElement('span'); arrow.textContent = match.action ? '>' : '\u2197'; arrow.setAttribute('aria-hidden', 'true');
    copy.append(title, desc); element.append(copy, arrow); results.append(element);
    element.addEventListener('focus', () => { resultIndex = [...results.children].indexOf(element); [...results.children].forEach((result) => result.classList.toggle('selected', result === element)); });
  }
  if (!matches.length) { const empty = document.createElement('p'); empty.className = 'command-empty'; empty.textContent = query.startsWith(':') ? 'Unknown command. Try :help or :theme.' : 'No matching notes. Try "systems", "teams", or "AI".'; results.append(empty); }
  if (matches.length) results.firstElementChild.classList.add('selected');
}
async function openSearch(prefix = '') {
  const waitingForIndex = !data;
  openDialog(commandDialog); input.value = prefix; input.focus(); renderPalette();
  await loadData(); if (waitingForIndex && commandDialog.open && !input.value.trim().startsWith(':')) renderPalette();
}
$$('[data-search]').forEach((button) => button.addEventListener('click', () => openSearch()));
$$('[data-help]').forEach((button) => button.addEventListener('click', () => openDialog(helpDialog)));
input.addEventListener('input', renderPalette);
commandDialog.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { event.preventDefault(); closeDialog(commandDialog); }
  if (event.key === 'ArrowDown') { event.preventDefault(); selectResult(document.activeElement === input ? 0 : resultIndex + 1, true); }
  if (event.key === 'ArrowUp') { event.preventDefault(); if (resultIndex === 0) input.focus(); else selectResult(resultIndex - 1, true); }
  if (event.key === 'Enter' && document.activeElement === input) { event.preventDefault(); results.querySelectorAll('.command-result')[resultIndex]?.click(); }
});

let lastG = 0;
document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.isComposing || event.altKey) return;
  if ($('#boot-dialog')?.open) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); return; }
  if ($('dialog[open]') || event.ctrlKey || event.metaKey || event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  if (!vim) return;
  if ((event.key === 'h' || event.key === 'l') && !event.repeat) { event.preventDefault(); history.go(event.key === 'h' ? -1 : 1); return; }
  if (event.key === '/') { event.preventDefault(); openSearch(); return; }
  if (event.key === '?') { event.preventDefault(); openDialog(helpDialog); return; }
  if (event.key === ':') { event.preventDefault(); openSearch(':'); return; }
  if (event.key === 'j' || event.key === 'k') {
    const links = $$('.note-link').filter((link) => link.getClientRects().length);
    if (!links.length) return;
    event.preventDefault(); const current = links.indexOf(document.activeElement);
    const next = current === -1 ? (event.key === 'j' ? 0 : links.length - 1) : Math.max(0, Math.min(links.length - 1, current + (event.key === 'j' ? 1 : -1)));
    links[next].focus({ preventScroll: true }); links[next].scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'center' });
  }
  if (event.key === 'g') { const now = Date.now(); if (now - lastG < 600) { event.preventDefault(); window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'instant' : 'smooth' }); lastG = 0; } else lastG = now; }
  else lastG = 0;
  if (event.key === 'G') { event.preventDefault(); window.scrollTo({ top: document.documentElement.scrollHeight, behavior: reducedMotion.matches ? 'instant' : 'smooth' }); }
});

let scrollScheduled = false;
function updateScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  const progress = max <= 0 ? 0 : Math.max(0, Math.min(100, Math.round(scrollY / max * 100)));
  document.documentElement.style.setProperty('--progress', `${progress}%`);
  $('[data-scroll-position]').textContent = progress === 0 ? 'TOP' : progress === 100 ? 'END' : `${progress}%`;
  scrollScheduled = false;
}
window.addEventListener('scroll', () => { if (!scrollScheduled) { scrollScheduled = true; requestAnimationFrame(updateScroll); } }, { passive: true });
window.addEventListener('resize', updateScroll);
updateScroll();

async function copy(text, success) {
  try { await navigator.clipboard.writeText(text); notify(success); }
  catch { notify('Clipboard unavailable. Select the text or use your browser\'s address bar.'); }
}
$$('[data-copy-code]').forEach((button) => button.addEventListener('click', () => copy(button.closest('.code-block').querySelector('code').textContent, 'Code example copied.')));
$$('[data-copy-link]').forEach((button) => button.addEventListener('click', () => copy(location.origin + location.pathname, 'Article link copied.')));

$$('[data-copy-markdown]').forEach(button => button.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(JSON.parse($('#article-markdown').textContent));
    notify('Article copied as Markdown.');
  } catch { notify('Clipboard unavailable. Use Download .md to save the article.'); }
}));
