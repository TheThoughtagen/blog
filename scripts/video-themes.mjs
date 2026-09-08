// Recolor the approved clip locally; no generation API calls or credits.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const assets = fileURLToPath(new URL('../public/assets/', import.meta.url));
for (const [theme, background, ink] of [
  ['amber', [24, 19, 14], [239, 191, 112]],
  ['paper', [238, 238, 222], [45, 112, 49]],
]) {
  // The phosphor-green channel supplies the line/glow intensity.
  const channels = ['r', 'g', 'b'].map((channel, i) => `${channel}='${background[i]}+(${ink[i]}-${background[i]})*val/255'`).join(':');
  const output = `${assets}patrick-welcome-${theme}.mp4`;
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', `${assets}patrick-welcome.mp4`, '-an', '-vf', `format=rgb24,colorchannelmixer=rr=0:rg=1:rb=0:gr=0:gg=1:gb=0:br=0:bg=1:bb=0,lutrgb=${channels}`, '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]);
  // Extract the actual final pose for the themed still-image fallback.
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-sseof', '-0.1', '-i', output, '-frames:v', '1', '-q:v', '2', `${assets}patrick-terminal-${theme}.jpg`]);
  console.log(`Created ${theme} video and final-frame poster`);
}
