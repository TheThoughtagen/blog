import { Graph, Sigma } from './graph/vendor.js';
import { kinds, indexSnapshot, searchNodes, visibleCounts } from './graph/model.js';
import { drawGraphLabel, drawGraphHover, resetGraphLabels } from './graph/labels.js';
import { nodeProperties } from './graph/properties.js';

const root = document.querySelector('[data-cortex-showcase]');
if (root) {
  const $ = selector => root.querySelector(selector);
  const stage = $('[data-cortex-stage]');
  const canvas = $('[data-cortex-canvas]');
  const status = $('[data-cortex-status]');
  const search = $('[data-cortex-search]');
  const results = $('[data-cortex-results]');
  const inspector = $('[data-cortex-inspector]');
  const enabled = new Set(Object.keys(kinds));
  let renderer;
  let graph;
  let snapshot;
  let index;
  let selected = null;
  let hovered = null;
  let dragged = false;
  let neighborLimit = 12;
  let starting = false;
  let pendingSelection = null;

  function showNeighbors() {
    if (!selected) return;
    const filter = $('[data-cortex-neighbor-kind]').value;
    const groups = new Map();
    for (const id of index.neighbors.get(selected)) {
      const node = index.nodes.get(id);
      if (!enabled.has(node.kind) || (filter && filter !== node.kind)) continue;
      if (!groups.has(node.kind)) groups.set(node.kind, []);
      groups.get(node.kind).push(node);
    }
    const buckets = [...groups.values()].sort((a, b) => (a[0].kind === 'historian') - (b[0].kind === 'historian'));
    buckets.forEach(nodes => nodes.sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })));
    // Interleave domains so signal/lot counts do not bury cross-system links.
    const neighbors = [];
    while (buckets.some(nodes => nodes.length)) buckets.forEach(nodes => { if (nodes.length) neighbors.push(nodes.shift()); });
    const links = $('[data-cortex-neighbors]'); links.replaceChildren();
    neighbors.slice(0, neighborLimit).forEach(neighbor => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = neighbor.label;
      button.addEventListener('click', () => select(neighbor.id, true)); links.append(button);
    });
    const more = $('[data-cortex-more-neighbors]');
    more.hidden = neighbors.length <= neighborLimit;
    more.textContent = `Show more (${Math.max(0, neighbors.length - neighborLimit).toLocaleString()} remaining)`;
  }

  function closeResults() { results.hidden = true; results.replaceChildren(); }
  function showSearch() {
    const matches = searchNodes(snapshot, search.value, enabled);
    results.replaceChildren();
    results.hidden = !search.value.trim();
    if (!matches.length && search.value.trim()) {
      const li = document.createElement('li'); li.className = 'cortex-no-result'; li.textContent = 'No matching records in the selected layers.'; results.append(li);
    }
    for (const node of matches) {
      const li = document.createElement('li');
      const button = document.createElement('button'); button.type = 'button';
      const label = document.createElement('strong'); label.textContent = node.label;
      const detail = document.createElement('span'); detail.textContent = `${node.type} / ${node.path || node.source}`;
      button.append(label, detail);
      button.addEventListener('click', () => { select(node.id, true); closeResults(); });
      li.append(button); results.append(li);
    }
  }
  function select(id, move = false, notify = true) {
    selected = id;
    if (!id) {
      inspector.hidden = true;
      renderer.refresh();
      return;
    }
    const node = index.nodes.get(id);
    $('[data-cortex-node-name]').textContent = node.label;
    $('[data-cortex-node-type]').textContent = `${kinds[node.kind].label} / ${node.type}`;
    $('[data-cortex-node-path]').textContent = node.path || node.label;
    $('[data-cortex-node-source]').textContent = node.source;
    $('[data-cortex-model]').hidden = node.type !== 'Unit';
    const properties = $('[data-cortex-properties]'); properties.replaceChildren();
    for (const [key, value] of nodeProperties(node, index)) {
      const row = document.createElement('div');
      const term = document.createElement('dt'); term.textContent = key;
      const detail = document.createElement('dd'); detail.textContent = value;
      row.append(term, detail); properties.append(row);
    }
    $('[data-cortex-metadata]').open = false;
    const relations = index.relationships.get(id);
    const types = new Map();
    relations.forEach(edge => types.set(edge.type, (types.get(edge.type) || 0) + 1));
    $('[data-cortex-connections]').textContent = `${relations.length.toLocaleString()} relationships · ${index.neighbors.get(id).size.toLocaleString()} connected records`;
    const list = $('[data-cortex-relations]'); list.replaceChildren();
    for (const [type, count] of types) {
      const li = document.createElement('li'); li.textContent = `${type} / ${count.toLocaleString()}`; list.append(li);
    }
    const filter = $('[data-cortex-neighbor-kind]'); filter.replaceChildren();
    const all = document.createElement('option'); all.value = ''; all.textContent = 'All connected record types'; filter.append(all);
    for (const [kind, spec] of Object.entries(kinds)) {
      const count = [...index.neighbors.get(id)].filter(key => index.nodes.get(key).kind === kind && enabled.has(kind)).length;
      if (!count) continue;
      const option = document.createElement('option'); option.value = kind; option.textContent = `${spec.label} (${count.toLocaleString()})`; filter.append(option);
    }
    neighborLimit = 12; showNeighbors();
    inspector.hidden = false;
    inspector.scrollTop = 0;
    if (notify && node.type === 'Unit') window.dispatchEvent(new CustomEvent('cortex:graph-selection', { detail: { id } }));
    renderer.refresh();
    if (move) {
      const position = renderer.getNodeDisplayData(id);
      renderer.getCamera().setState({ x: position.x, y: position.y, ratio: Math.min(renderer.getCamera().ratio, .28) });
    }
  }
  function updateLayers() {
    if (selected && !enabled.has(index.nodes.get(selected).kind)) select(null);
    else if (selected) select(selected, false, false);
    const count = visibleCounts(snapshot, enabled);
    $('[data-cortex-visible]').textContent = `${count.nodes.toLocaleString()} nodes · ${count.edges.toLocaleString()} relationships visible`;
    stage.dataset.empty = String(count.nodes === 0);
    renderer.refresh();
    closeResults();
  }
  function reset() {
    enabled.clear(); Object.keys(kinds).forEach(kind => enabled.add(kind));
    root.querySelectorAll('[data-cortex-kind]').forEach(input => { input.checked = true; });
    search.value = ''; select(null); applyLayout(false); updateLayers(); closeResults();
    renderer.getCamera().setState({ x: .5, y: .5, angle: 0, ratio: 1 });
  }
  function applyLayout(workflows) {
    const positions = workflows ? snapshot.layouts?.workflows : null;
    snapshot.nodes.forEach(node => {
      const position = positions?.[node.id] || node;
      graph.mergeNodeAttributes(node.id, { x: position.x, y: position.y });
    });
    renderer.refresh();
  }
  function workflows() {
    enabled.clear(); ['equipment', 'mes', 'cmms', 'electrical', 'process'].forEach(kind => enabled.add(kind));
    root.querySelectorAll('[data-cortex-kind]').forEach(input => { input.checked = enabled.has(input.dataset.cortexKind); });
    search.value = ''; select(null); applyLayout(true); updateLayers();
    const positions = snapshot.nodes.filter(node => enabled.has(node.kind)).map(node => renderer.getNodeDisplayData(node.id));
    if (!positions.length) return;
    const xs = positions.map(p => p.x), ys = positions.map(p => p.y);
    const left = Math.min(...xs), right = Math.max(...xs), bottom = Math.min(...ys), top = Math.max(...ys);
    const ratio = Math.max((right - left) * stage.clientHeight / stage.clientWidth, top - bottom) * 1.5 + .1;
    renderer.getCamera().setState({ x: (left + right) / 2, y: (bottom + top) / 2, ratio: Math.max(.28, Math.min(1.5, ratio)), angle: 0 });
  }

  async function start() {
    if (starting) return;
    starting = true;
    try {
      const response = await fetch(root.dataset.graphSrc, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error('Graph export could not load.');
      snapshot = await response.json();
      index = indexSnapshot(snapshot);
      graph = new Graph({ type: 'directed', multi: true });
      for (const node of snapshot.nodes) graph.addNode(node.id, {
        x: node.x, y: node.y, label: node.label,
        size: node.kind === 'historian' ? 1.3 : node.kind === 'equipment' ? 8 : 3.5,
        color: kinds[node.kind].color, kind: node.kind,
      });
      for (const edge of snapshot.edges) graph.addDirectedEdgeWithKey(edge.id, edge.source, edge.target, {
        color: edge.type === 'MAPS_TO' ? '#47613b35' : `${kinds[index.nodes.get(edge.source).kind].color}55`, size: edge.type === 'MAPS_TO' ? .3 : .6,
      });
      renderer = new Sigma(graph, canvas, {
        renderEdgeLabels: false, labelFont: 'system-ui, sans-serif',
        labelSize: 12, labelColor: { color: '#e3efea' }, labelDensity: .7,
        labelGridCellSize: 120, labelRenderedSizeThreshold: 0, stagePadding: 55,
        minCameraRatio: .008, maxCameraRatio: 4,
        allowInvalidContainer: true,
        defaultDrawNodeLabel: drawGraphLabel,
        defaultDrawNodeHover: drawGraphHover,
      });
      renderer.on('beforeRender', resetGraphLabels);
      renderer.setSetting('nodeReducer', (id, attrs) => {
        const active = selected === id || index.neighbors.get(selected)?.has(id);
        const detailLabel = attrs.kind === 'historian' || index.nodes.get(id).type === 'DrawingDocument';
        return { ...attrs, hidden: !enabled.has(attrs.kind),
          label: detailLabel && id !== selected && id !== hovered ? null : attrs.label,
          forceLabel: id === selected || id === hovered || id === snapshot.root,
          color: selected && !active ? '#25342e' : attrs.color,
          size: attrs.size + (id === selected ? 3 : 0), zIndex: id === selected || id === hovered ? 1 : 0,
        };
      });
      renderer.setSetting('edgeReducer', (id, attrs) => {
        const edge = index.edges.get(id);
        const hidden = !enabled.has(index.nodes.get(edge.source).kind) || !enabled.has(index.nodes.get(edge.target).kind);
        const active = edge.source === selected || edge.target === selected;
        return { ...attrs, hidden, color: selected ? active ? '#c4e7ae' : '#1c2b2455' : attrs.color, size: active ? 1.2 : attrs.size };
      });
      renderer.on('clickNode', ({ node }) => { select(node); closeResults(); });
      renderer.on('enterNode', ({ node }) => { hovered = node; canvas.style.cursor = 'pointer'; renderer.refresh(); });
      renderer.on('leaveNode', () => { hovered = null; canvas.style.cursor = ''; renderer.refresh(); });
      renderer.on('clickStage', () => { if (!dragged) { select(null); closeResults(); } });
      let down;
      canvas.addEventListener('pointerdown', event => { down = { x: event.clientX, y: event.clientY }; dragged = false; });
      canvas.addEventListener('pointermove', event => { if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) dragged = true; });
      document.addEventListener('pointerup', () => { down = null; });
      root.querySelectorAll('[data-cortex-kind]').forEach(input => input.addEventListener('change', () => {
        if (input.checked) enabled.add(input.dataset.cortexKind); else enabled.delete(input.dataset.cortexKind);
        updateLayers();
      }));
      search.addEventListener('input', showSearch);
      search.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); results.querySelector('button')?.click(); }
        if (event.key === 'Escape') closeResults();
        if (event.key === 'ArrowDown') { event.preventDefault(); results.querySelector('button')?.focus(); }
      });
      $('[data-cortex-close]').addEventListener('click', () => select(null));
      $('[data-cortex-model]').addEventListener('click', async () => {
        if (!selected || index.nodes.get(selected).type !== 'Unit') return;
        if (document.fullscreenElement === root) {
          try { await document.exitFullscreen(); }
          catch { status.textContent = 'Exit fullscreen to view equipment in 3D.'; return; }
        }
        window.dispatchEvent(new CustomEvent('cortex:scene-select', { detail: { id: selected } }));
        document.querySelector('[data-cortex-scene]')?.scrollIntoView({ block: 'start', behavior: 'instant' });
      });
      $('[data-cortex-neighbor-kind]').addEventListener('change', () => { neighborLimit = 12; showNeighbors(); });
      $('[data-cortex-more-neighbors]').addEventListener('click', () => { neighborLimit += 24; showNeighbors(); });
      $('[data-cortex-reset]').addEventListener('click', reset);
      $('[data-cortex-workflows]').addEventListener('click', workflows);
      $('[data-cortex-zoom-in]').addEventListener('click', () => renderer.getCamera().setState({ ratio: Math.max(.008, renderer.getCamera().ratio / 1.6) }));
      $('[data-cortex-zoom-out]').addEventListener('click', () => renderer.getCamera().setState({ ratio: Math.min(4, renderer.getCamera().ratio * 1.6) }));
      const expand = $('[data-cortex-fullscreen]');
      expand.hidden = !document.fullscreenEnabled;
      expand.addEventListener('click', async () => {
        try { if (document.fullscreenElement === root) await document.exitFullscreen(); else await root.requestFullscreen(); }
        catch { status.textContent = 'Fullscreen is unavailable. You can still pan and zoom the graph.'; }
      });
      document.addEventListener('fullscreenchange', () => {
        expand.textContent = document.fullscreenElement === root ? 'Exit fullscreen' : 'Fullscreen';
        expand.setAttribute('aria-pressed', String(document.fullscreenElement === root));
        if (root.isConnected && stage.clientWidth && stage.clientHeight) renderer?.resize();
      });
      window.addEventListener('pagehide', event => { if (!event.persisted) renderer?.kill(); });
      root.querySelectorAll('[data-cortex-control]').forEach(control => { control.disabled = false; });
      root.dataset.graphReady = 'true';
      canvas.dataset.graphNodes = String(snapshot.nodes.length);
      status.textContent = 'Randomized demo data. Drag to pan, scroll to zoom, or select a record.';
      updateLayers();
      if (pendingSelection) { const detail = pendingSelection; pendingSelection = null; showFromScene(detail); }
    } catch {
      renderer?.kill();
      status.textContent = 'The exported graph is shown below. Open the graph image for a larger view.';
      root.dataset.graphReady = 'false';
    }
  }
  function showFromScene(detail) {
    if (detail.scroll) root.scrollIntoView({ block: 'start', behavior: 'instant' });
    if (root.dataset.graphReady !== 'true') { pendingSelection = detail; start(); return; }
    const node = index.nodes.get(detail.id);
    if (!node) return;
    enabled.add(node.kind);
    root.querySelector(`[data-cortex-kind="${node.kind}"]`).checked = true;
    updateLayers(); select(node.id, true);
  }
  window.addEventListener('cortex:graph-select', event => { if (event.detail?.id) showFromScene(event.detail); });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); }
    }, { rootMargin: '250px' });
    observer.observe(stage);
  } else start();
}
