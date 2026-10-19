// Canvas labels use solid cards so dense edges never run through the text.
let placed = new WeakMap();
export function resetGraphLabels() { placed = new WeakMap(); }

export function drawGraphLabel(context, data) { drawLabel(context, data, false); }

function drawLabel(context, data, hover) {
  if (!data.label || data.hidden) return;
  context.save();
  context.font = '500 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const padding = 9, height = 28;
  let label = String(data.label);
  while (context.measureText(label).width > 178 && label.length > 1) label = label.slice(0, -2) + '…';
  const width = Math.ceil(context.measureText(label).width) + padding * 2;
  const canvasWidth = context.canvas.clientWidth || context.canvas.width / (globalThis.devicePixelRatio || 1);
  const canvasHeight = context.canvas.clientHeight || context.canvas.height / (globalThis.devicePixelRatio || 1);
  const boxes = placed.get(context) || [];
  const candidates = [
    { x: data.x + data.size + 9, y: data.y - height / 2 },
    { x: data.x - data.size - width - 9, y: data.y - height / 2 },
    { x: data.x - width / 2, y: data.y - data.size - height - 9 },
    { x: data.x - width / 2, y: data.y + data.size + 9 },
  ].map(p => ({ x: Math.round(Math.max(8, Math.min(canvasWidth - width - 8, p.x))) + .5, y: Math.round(Math.max(8, Math.min(canvasHeight - height - 8, p.y))) + .5, width, height }));
  const box = hover ? candidates[0] : candidates.find(a => !boxes.some(b => a.x < b.x + b.width + 5 && a.x + a.width + 5 > b.x && a.y < b.y + b.height + 5 && a.y + a.height + 5 > b.y));
  if (!box) { context.restore(); return; }
  const { x, y } = box;
  if (!hover) { boxes.push(box); placed.set(context, boxes); }
  context.beginPath();
  context.roundRect(x, y, width, height, 5);
  context.fillStyle = '#101b23'; context.fill();
  context.strokeStyle = data.color; context.globalAlpha = .4; context.lineWidth = 1; context.stroke();
  context.globalAlpha = 1; context.fillStyle = '#e3efea';
  context.textAlign = 'left'; context.textBaseline = 'middle';
  context.fillText(label, x + padding, y + height / 2);
  context.restore();
}

export function drawGraphHover(context, data) {
  context.save();
  context.beginPath(); context.arc(data.x, data.y, data.size + 4, 0, Math.PI * 2);
  context.strokeStyle = data.color; context.lineWidth = 2; context.stroke();
  context.restore();
  drawLabel(context, data, true);
}
