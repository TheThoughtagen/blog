// One paid submission; subsequent runs only poll/download the saved request.
// Run: node --env-file=.env scripts/render-patrick.mjs submit|status
import { readFile, writeFile, open, access } from 'node:fs/promises';
const dir = new URL('../output/animation/', import.meta.url);
const key = process.env.FAL_KEY;
if (!key) throw new Error('FAL_KEY is missing');
const model = 'fal-ai/kling-video/v2.1/pro/image-to-video';
const file = (name) => new URL(name, dir);
async function api(url, options = {}) {
  if (new URL(url).origin !== 'https://queue.fal.run') throw new Error('Unexpected API origin');
  const response = await fetch(url, { ...options, redirect: 'error', headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`fal API HTTP ${response.status}; inspect the dashboard before retrying a submission`);
  return response.json();
}
const action = process.argv[2];
if (action === 'submit') {
  const lock = await open(file('submission.lock'), 'wx');
  await lock.writeFile('One submission attempted. Do not remove without checking the fal dashboard.\n');
  await lock.close();
  const prompt = 'Locked-off camera, single continuous shot, monochrome phosphor-green 2D cartoon. The same bearded man in the W cap walks two short steps to the right toward the stationary terminal, with alternating leg movement and natural arm swing. He stops, briefly taps the keyboard with his right hand, then turns toward the viewer, smiles and raises his left hand in a thumbs-up. Settle into the exact ending reference pose and hold it for the final second. Keep his face, beard, cap, clothing and proportions consistent. Keep the computer and keyboard stationary. Preserve the green linework and CRT background. Simple, friendly, readable movement.';
  const settings = { prompt, duration: '5', cfg_scale: 0.5, negative_prompt: 'camera movement, zoom, cuts, sliding without walking, extra limbs, detached hands, extra fingers, face morphing, changing cap logo, moving computer, warped keyboard, new text, color changes' };
  await writeFile(file('render-settings.json'), JSON.stringify({ model, estimatedCostUSD: 0.49, ...settings }, null, 2));
  const input = { ...settings, image_url: `data:image/png;base64,${(await readFile(file('patrick-start.png'))).toString('base64')}`, tail_image_url: `data:image/jpeg;base64,${(await readFile(file('patrick-end.jpg'))).toString('base64')}` };
  const job = await api(`https://queue.fal.run/${model}`, { method: 'POST', body: JSON.stringify(input) });
  await writeFile(file('render-job.json'), JSON.stringify(job, null, 2));
  console.log(JSON.stringify({ request_id: job.request_id, status: job.status || 'SUBMITTED' }));
} else if (action === 'status') {
  const job = JSON.parse(await readFile(file('render-job.json'), 'utf8'));
  const status = await api(job.status_url);
  console.log(JSON.stringify({ request_id: job.request_id, status: status.status, queue_position: status.queue_position, failed: Boolean(status.error) }));
  if (status.error) throw new Error('Generation failed; inspect fal dashboard');
  if (status.status === 'COMPLETED') {
    try { await access(file('patrick-test-01.mp4')); console.log('Video already downloaded'); process.exit(0); } catch {}
    const result = await api(job.response_url);
    const url = new URL(result.video.url);
    if (url.protocol !== 'https:' || !(url.hostname === 'fal.media' || url.hostname.endsWith('.fal.media'))) throw new Error('Unexpected media host');
    const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
    if (!response.ok) throw new Error(`Video download HTTP ${response.status}`);
    await writeFile(file('patrick-test-01.mp4'), Buffer.from(await response.arrayBuffer()));
    await writeFile(file('render-result.json'), JSON.stringify(result, null, 2));
    console.log('Saved output/animation/patrick-test-01.mp4');
  }
} else throw new Error('Specify submit or status');
