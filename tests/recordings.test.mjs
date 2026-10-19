import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/assets/recordings/player.js', import.meta.url), 'utf8');
class Media extends EventTarget {
  paused = true;
  pause() { this.paused = true; }
  play() { this.paused = false; this.dispatchEvent(new Event('play')); }
  dispose() { this.disposed = true; }
}
function setup(terminalAvailable) {
  const portal = new Media(), walkthrough = new Media(), terminal = new Media();
  const document = new EventTarget(), window = new EventTarget(), observers = [];
  const nodes = new Map([
    ['[data-terminal-player]', { replaceChildren() {} }],
    ['#recording-catalog', { textContent: JSON.stringify([{ clip: 'cli', title: 'CLI', description: 'Demo', url: '/guide/', cast: '/cli.cast' }]) }],
    ['[data-recording-controls]', { querySelectorAll: () => [] }],
  ]);
  document.querySelector = selector => nodes.get(selector) || {};
  document.querySelectorAll = selector => selector.includes('.portal-feature-film video') ? [walkthrough, portal] : [walkthrough];
  window.AsciinemaPlayer = terminalAvailable ? { create: () => terminal } : undefined;
  class IntersectionObserver {
    constructor(callback) { this.callback = callback; this.targets = []; observers.push(this); }
    observe(target) { this.targets.push(target); }
  }
  vm.runInNewContext(source, { document, window, AsciinemaPlayer: window.AsciinemaPlayer, IntersectionObserver, URLSearchParams, location: { search: '' } });
  return { portal, walkthrough, terminal, document, observers };
}

test('portal and walkthrough videos coordinate and pause without the terminal library', () => {
  const { portal, walkthrough, document, observers } = setup(false);
  portal.play(); walkthrough.play();
  assert.equal(portal.paused, true);
  assert.equal(walkthrough.paused, false);
  portal.play();
  assert.equal(walkthrough.paused, true);
  const observer = observers.find(value => value.targets.includes(portal));
  observer.callback([{ target: portal, isIntersecting: false }]);
  assert.equal(portal.paused, true);
  portal.play(); document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(portal.paused, true);
});

test('terminal playback and the portal film pause each other', () => {
  const { portal, terminal } = setup(true);
  portal.play(); terminal.play();
  assert.equal(portal.paused, true);
  assert.equal(terminal.paused, false);
  portal.play();
  assert.equal(terminal.paused, true);
  assert.equal(portal.paused, false);
});
