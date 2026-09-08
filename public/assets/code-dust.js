// A small, short-lived patch of glyphs; never replaces the real pointer.
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const mouse = matchMedia('(hover: hover) and (pointer: fine)');
const glyphs = ['{', '}', '/', ';', '0', '1'];
const radius = 60;
const lifetime = 500;
let canvas, context, frame, particles = [];
let pointer = { x: 0, y: 0 };
let lastSpawn = 0;
let color;
const allowed = () => mouse.matches && !motion.matches && !document.hidden && document.documentElement.dataset.paused !== 'true';
const selectionActive = () => Boolean(window.getSelection()?.toString());
function clear() {
  cancelAnimationFrame(frame);
  frame = undefined;
  particles = [];
  if (canvas) { context.clearRect(0, 0, 120, 120); canvas.hidden = true; }
}
function draw(now) {
  frame = undefined;
  if (!allowed() || selectionActive() || document.querySelector('dialog[open]')) { clear(); return; }
  particles = particles.filter(p => now - p.born < lifetime);
  if (!particles.length) { clear(); return; }
  canvas.hidden = false;
  canvas.style.left = `${pointer.x - radius}px`;
  canvas.style.top = `${pointer.y - radius}px`;
  context.clearRect(0, 0, 120, 120);
  context.save();
  context.beginPath(); context.arc(radius, radius, radius, 0, Math.PI * 2); context.clip();
  context.fillStyle = color;
  context.font = '11px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  for (const p of particles) {
    const age = (now - p.born) / lifetime;
    const x = p.x - pointer.x + radius + p.dx * age;
    const y = p.y - pointer.y + radius + p.dy * age;
    const distance = Math.hypot(x - radius, y - radius);
    context.globalAlpha = 0.14 * (1 - age) * Math.max(0, 1 - distance / radius);
    context.fillText(p.glyph, x, y);
  }
  context.restore();
  frame = requestAnimationFrame(draw);
}
window.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || !allowed() || event.buttons || selectionActive() || document.querySelector('dialog[open]') || event.target.closest('a, button, input, textarea, select, label, [contenteditable]:not([contenteditable="false"])')) { clear(); return; }
  const moved = Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y);
  pointer = { x: event.clientX, y: event.clientY };
  const now = performance.now();
  if (moved < 2 || now - lastSpawn < 35) return;
  lastSpawn = now;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'code-dust';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.hidden = true;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = canvas.height = 120 * ratio;
    context = canvas.getContext('2d');
    if (!context) { canvas = undefined; return; }
    context.scale(ratio, ratio);
    document.body.append(canvas);
  }
  color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
  const angle = Math.random() * Math.PI * 2;
  const offset = 10 + Math.random() * 20;
  particles.push({ x: pointer.x + Math.cos(angle) * offset, y: pointer.y + Math.sin(angle) * offset, dx: Math.cos(angle) * 10, dy: 8 + Math.random() * 8, born: now, glyph: glyphs[Math.floor(Math.random() * glyphs.length)] });
  particles = particles.slice(-10);
  if (frame === undefined) frame = requestAnimationFrame(draw);
}, { passive: true });
for (const type of ['pointerdown', 'blur', 'scroll', 'resize', 'pagehide']) window.addEventListener(type, clear, { passive: true });
document.documentElement.addEventListener('pointerleave', clear);
document.addEventListener('visibilitychange', clear);
document.addEventListener('selectionchange', () => { if (selectionActive()) clear(); });
document.addEventListener('fieldnotes:boot-open', clear);
document.addEventListener('fieldnotes:theme-change', clear);
motion.addEventListener('change', clear);
mouse.addEventListener('change', clear);
