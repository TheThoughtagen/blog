import { indexSnapshot } from '../graph/model.js';
import { demoAssetValues, demoProcessValues } from '../graph/signals.js';

const root = document.querySelector('[data-cortex-scene]');
if (root) {
  let started;
  let appRoot;
  const remember = event => {
    if (typeof event.detail?.id === 'string') root.dataset.selectedAsset = event.detail.id;
  };
  window.addEventListener('cortex:graph-selection', remember);
  window.addEventListener('cortex:scene-select', event => { remember(event); start(); });
  async function start() {
    if (started) return started;
    started = load().catch(() => {
      root.querySelector('[data-scene-mount]').textContent = 'The 3D view could not load. Explore the connected graph above.';
      root.dataset.sceneReady = 'false';
    });
    return started;
  }
  async function load() {
    const [native, response] = await Promise.all([
      import(`./vendor.js?v=${root.dataset.rendererVersion}`),
      fetch(root.dataset.graphSrc, { signal: AbortSignal.timeout(15000) }),
    ]);
    if (!response.ok) throw new Error('Demo graph could not load.');
    const snapshot = await response.json(), index = indexSnapshot(snapshot);
    const units = snapshot.nodes.filter(node => node.type === 'Unit').sort((a, b) => a.label.localeCompare(b.label));
    const { React, createRoot, SceneCanvas, sparkline, formatValue } = native;
    const { useState, useEffect, useMemo, useCallback } = React;
    const h = React.createElement;
    const clock = value => new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(value);
    const currentTime = () => Math.floor(Date.now() / 5000) * 5000;
    class SceneError extends React.Component {
      state = { failed: false };
      static getDerivedStateFromError() { return { failed: true }; }
      componentDidCatch() { root.dataset.sceneReady = 'false'; }
      render() { return this.state.failed ? h('p', { className: 'plant-placeholder' }, 'The 3D view is unavailable in this browser. Equipment readings remain available alongside it.') : this.props.children; }
    }
    function App() {
      const [selected, setSelected] = useState(units.some(unit => unit.id === root.dataset.selectedAsset) ? root.dataset.selectedAsset : '');
      const [mode, setMode] = useState('live');
      const [now, setNow] = useState(currentTime);
      const [historyEnd, setHistoryEnd] = useState(currentTime);
      const [offset, setOffset] = useState(1440);
      const [playing, setPlaying] = useState(false);
      const [metric, setMetric] = useState(0);
      const [fidelity, setFidelity] = useState(false);
      const [loaded, setLoaded] = useState(false);
      const [showLevel, setShowLevel] = useState(true);
      const [showTemperature, setShowTemperature] = useState(true);
      const [showFlow, setShowFlow] = useState(true);
      const [flowPaused, setFlowPaused] = useState(false);
      const [motionAllowed, setMotionAllowed] = useState(false);
      const time = mode === 'live' ? now : historyEnd - (1440 - offset) * 60000;
      const end = mode === 'live' ? now : historyEnd;
      const unit = index.nodes.get(selected);
      const values = useMemo(() => selected ? demoAssetValues(index, selected, time, end) : null, [selected, time, end]);
      const processValues = useMemo(() => demoProcessValues(index, time), [time]);
      const processView = useMemo(() => ({ level: showLevel, temperature: showTemperature, flow: showFlow }), [showLevel, showTemperature, showFlow]);
      const animateFlow = showFlow && !flowPaused && motionAllowed && !fidelity && (mode === 'live' || playing);
      const active = values?.tags[metric] || values?.tags[0];
      const plot = active ? sparkline(active.history, 640, 100) : null;
      useEffect(() => {
        if (mode !== 'live') return;
        const timer = setInterval(() => { if (!document.hidden) setNow(currentTime()); }, 5000);
        return () => clearInterval(timer);
      }, [mode]);
      useEffect(() => {
        if (!playing || mode !== 'history') return;
        const timer = setInterval(() => setOffset(value => Math.min(1440, value + 10)), 1000);
        return () => clearInterval(timer);
      }, [playing, mode]);
      useEffect(() => { if (offset >= 1440) setPlaying(false); }, [offset]);
      useEffect(() => {
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => setMotionAllowed(!media.matches && !document.hidden && document.documentElement.dataset.paused !== 'true');
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-paused'] });
        media.addEventListener('change', sync); document.addEventListener('visibilitychange', sync); sync();
        return () => { observer.disconnect(); media.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); };
      }, []);
      useEffect(() => {
        const sync = event => { if (index.nodes.get(event.detail?.id)?.type === 'Unit') setSelected(event.detail.id); };
        window.addEventListener('cortex:graph-selection', sync);
        window.addEventListener('cortex:scene-select', sync);
        return () => { window.removeEventListener('cortex:graph-selection', sync); window.removeEventListener('cortex:scene-select', sync); };
      }, []);
      useEffect(() => {
        root.dataset.sceneMode = mode; root.dataset.readAt = new Date(time).toISOString(); root.dataset.selectedAsset = selected;
        root.dataset.processLevel = String(showLevel && !fidelity); root.dataset.processTemperature = String(showTemperature && !fidelity);
        root.dataset.flowAnimated = String(animateFlow);
      }, [mode, time, selected, showLevel, showTemperature, fidelity, animateFlow]);
      const onElements = useCallback(elements => {
        const ready = units.every(unit => elements.some(element => element.equipment_id === unit.id));
        setLoaded(ready); root.dataset.sceneReady = String(ready); root.dataset.sceneAssets = String(units.length);
        root.dataset.processVessels = String(elements.filter(element => element.process_kind === 'vessel').length);
        root.dataset.processPipes = String(elements.filter(element => element.process_kind === 'pipe').length);
      }, []);
      const onFlowPaths = useCallback(count => { root.dataset.flowPaths = String(count); }, []);
      const choose = id => {
        setSelected(id);
        if (id) window.dispatchEvent(new CustomEvent('cortex:graph-select', { detail: { id, scroll: false } }));
      };
      const live = () => { setPlaying(false); setNow(currentTime()); setOffset(1440); setMode('live'); };
      const history = () => { if (mode === 'live') { setHistoryEnd(now); setOffset(1380); } setMode('history'); };
      const label = unit && values ? [unit.label, mode === 'live' ? 'LIVE DEMO' : `HISTORY · ${clock(time)}`, ...values.tags.slice(0, 2).map(tag => `${tag.description}: ${formatValue(tag.current.value, tag.unit)}`)].join('\n') : null;
      return h(React.Fragment, null,
        h('div', { className: 'plant-toolbar' },
          h('label', null, 'Equipment', h('select', { value: selected, onChange: event => choose(event.target.value), 'data-scene-equipment': '', 'aria-label': 'Select 3D equipment' },
            h('option', { value: '' }, 'All equipment'), ...units.map(unit => h('option', { key: unit.id, value: unit.id }, unit.label)))),
          h('button', { type: 'button', onClick: () => choose(''), 'data-scene-overview': '' }, 'Fit all equipment'),
          h('label', null, h('input', { type: 'checkbox', checked: fidelity, onChange: event => setFidelity(event.target.checked), 'data-scene-fidelity': '' }), 'Show model fidelity'),
          h('span', { className: 'plant-model-status', role: 'status' }, loaded ? `${units.length} equipment assets · schematic` : 'Loading Cortex model…')),
        h('div', { className: 'plant-process-controls', 'aria-label': 'Process overlays' },
          ...[['Fill level', showLevel, setShowLevel, 'level'], ['Temperature', showTemperature, setShowTemperature, 'temperature'], ['Flow', showFlow, setShowFlow, 'flow']].map(([title, checked, set, id]) =>
            h('label', { key: id }, h('input', { type: 'checkbox', checked, disabled: fidelity, onChange: event => set(event.target.checked), [`data-scene-show-${id}`]: '' }), title)),
          h('button', { type: 'button', disabled: fidelity || !showFlow || !motionAllowed || (mode === 'history' && !playing), 'aria-pressed': flowPaused, onClick: () => setFlowPaused(!flowPaused), 'data-scene-flow-pause': '' }, flowPaused ? 'Resume flow' : 'Pause flow'),
          h('span', { className: 'plant-process-state', 'data-scene-process-state': '' }, fidelity ? 'Process overlays hidden in fidelity view' : !showFlow ? 'Flow arrows hidden' : animateFlow ? 'Directional flow · speed follows the reading' : 'Static arrows · direction at the selected time')),
        h('div', { className: 'plant-process-legend', 'data-scene-process-legend': '' },
          h('span', null, 'Fill boundary = level reading'),
          h('span', { className: 'plant-temperature-scale' }, 'Temperature', h('span', { 'aria-hidden': true, className: 'plant-temperature-ramp' }), '0–150 °C'),
          h('span', null, 'Arrows show mapped local pipe flow')),
        h('div', { className: 'plant-body' },
          h('div', { className: 'plant-canvas', 'data-scene-canvas': '' }, h(SceneError, null, h(SceneCanvas, {
            frameloop: 'demand',
            screenSpaceLabel: true,
            frameAssetAssembly: true,
            processValues, processView, animateFlow, onFlowPaths,
            meshUrl: root.dataset.meshSrc, referenceUrl: null, selectedAsset: selected || null, fidelityView: fidelity, showReference: false,
            onPick: target => { if (index.nodes.get(target?.equipment_id)?.type === 'Unit') choose(target.equipment_id); }, onElements, label,
          })), h('div', { className: 'plant-orbit-hint' }, 'Drag to orbit · scroll to zoom · click equipment')),
          h('aside', { className: 'plant-values', 'aria-label': 'Equipment telemetry' },
            h('div', { className: 'plant-values-heading' }, h('div', { className: 'overline' }, mode === 'live' ? 'LIVE DEMO / 5 SECOND UPDATES' : 'HISTORICAL SNAPSHOT'), h('h3', { 'data-scene-name': '' }, unit?.label || 'Select equipment')),
            unit ? h('button', { className: 'plant-graph-link', type: 'button', 'data-scene-graph': '', onClick: () => window.dispatchEvent(new CustomEvent('cortex:graph-select', { detail: { id: selected, scroll: true } })) }, 'Open connected graph ↗') : h('p', { className: 'plant-intro' }, 'Choose a unit in the model or equipment list to explore its readings and 24-hour history.'),
            h('div', { className: 'plant-reading-list', 'data-scene-readings': '' }, ...(values?.tags || []).map((tag, i) => {
              const s = sparkline(tag.history, 120, 30);
              return h('button', { key: tag.tag_name, type: 'button', className: 'plant-reading', 'aria-pressed': metric === i, onClick: () => setMetric(i) },
                h('span', { className: 'plant-reading-title' }, tag.description, h('small', null, tag.tag_name)),
                h('strong', { 'data-scene-reading': tag.description }, formatValue(tag.current.value, tag.unit)),
                s && h('svg', { viewBox: '0 0 120 30', width: 120, height: 30, 'aria-hidden': true }, h('path', { d: s.path, fill: 'none', stroke: 'currentColor', strokeWidth: 1.25 })),
                h('span', { className: 'plant-reading-quality' }, `${tag.current.quality} · ${clock(time)}`));
            })),
            h('p', { className: 'plant-source-note' }, 'Four mapped channels · generated telemetry. Equipment and geometry are randomized.'))),
        h('div', { className: 'plant-timeline', 'data-scene-timeline': '' },
          h('div', { className: 'plant-time-controls' },
            h('div', { className: 'plant-modes', role: 'group', 'aria-label': 'Telemetry mode' },
              h('button', { type: 'button', onClick: live, 'aria-pressed': mode === 'live', 'data-scene-live': '' }, 'Live demo'),
              h('button', { type: 'button', onClick: history, 'aria-pressed': mode === 'history', 'data-scene-history': '' }, 'History')),
            h('button', { type: 'button', disabled: mode !== 'history' || !selected, onClick: () => { if (offset >= 1440) setOffset(0); setPlaying(!playing); }, 'data-scene-play': '', 'aria-pressed': playing }, playing ? 'Pause playback' : 'Play history'),
            h('time', { dateTime: new Date(time).toISOString(), 'data-scene-time': '' }, `${new Date(time).toLocaleDateString('en', { month: 'short', day: 'numeric' })} · ${clock(time)}`)),
          h('div', { className: 'plant-trend-header' }, h('span', null, active ? `${active.description} · 24 hours` : '24-hour equipment history'), plot && h('span', null, `${formatValue(plot.min, active.unit)} — ${formatValue(plot.max, active.unit)}`)),
          h('svg', { className: 'plant-trend', viewBox: '0 0 640 100', preserveAspectRatio: 'none', role: 'img', 'aria-label': active ? `${active.description} history with selected time cursor` : 'Select equipment to show history', 'data-scene-trend': '' },
            h('path', { d: 'M0 25H640 M0 50H640 M0 75H640', stroke: '#2e4046', fill: 'none' }),
            plot && h('path', { d: plot.path, stroke: '#7dd3fc', strokeWidth: 1.8, fill: 'none', vectorEffect: 'non-scaling-stroke' }),
            plot && h('path', { d: `M${1 + offset / 1440 * 638} 0V100`, stroke: '#b6e889', strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke', 'data-scene-cursor': '' })),
          h('input', { type: 'range', min: 0, max: 1440, step: 1, value: offset, disabled: !selected, 'aria-label': 'Historical time over the last 24 hours', 'aria-valuetext': new Date(time).toISOString(), 'data-scene-scrub': '', onChange: event => { if (mode === 'live') setHistoryEnd(now); setMode('history'); setPlaying(false); setOffset(Number(event.target.value)); } }),
          h('div', { className: 'plant-time-range' }, h('span', null, '24 hours ago'), h('span', null, mode === 'live' ? 'Now' : 'History window end'))));
    }
    appRoot = createRoot(root.querySelector('[data-scene-mount]'));
    appRoot.render(h(App));
  }
  const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); start(); } }, { rootMargin: '250px' });
  observer.observe(root);
  window.addEventListener('pagehide', () => { observer.disconnect(); appRoot?.unmount(); window.removeEventListener('cortex:graph-selection', remember); }, { once: true });
}
