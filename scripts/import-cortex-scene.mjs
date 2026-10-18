// Bundle the actual Cortex scene renderer/generator; no source-system reads.
import { readFile, writeFile, mkdir, realpath, readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { makeDemoScene } from './plant3d-scene.mjs';
import { assertRandomizedGraph } from './randomize-cortex-graph.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const web = resolve(process.argv[2] || join(root, '../plant3d/forge-cortex/web'));
const require = createRequire(join(await realpath(join(web, 'node_modules/vite')), 'package.json'));
const esbuild = require('esbuild');
const out = join(root, 'public/assets/plant3d');
await mkdir(out, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const snapshot = JSON.parse(await readFile(join(root, 'public/assets/graph/cortex.json'), 'utf8'));
assertRandomizedGraph(snapshot);
const spec = makeDemoScene(snapshot);
const generatorFile = '/private/tmp/portfolio-cortex-scene-generator.mjs';
await esbuild.build({
  stdin: { contents: `export {generate,generatorVersion} from './lib/scene/generate'; export {toGLB} from './lib/scene/gltf'; export {installNodeShims} from './lib/scene/node-shim';`, resolveDir: web },
  bundle: true, platform: 'node', format: 'esm', target: 'node22', outfile: generatorFile, logLevel: 'silent',
});
const native = await import(pathToFileURL(generatorFile));
native.installNodeShims();
const { root: model, report } = native.generate(spec);
if (report.warnings.length || report.skipped.length) throw new Error('Native scene generator did not render every demonstration element.');
const glb = await native.toGLB(model);
await writeFile(join(out, 'model.glb'), glb);
await writeFile(join(out, 'scene.json'), JSON.stringify(spec));
const bundle = await esbuild.build({
  stdin: { contents: `export {SceneCanvas} from './components/plant3d/scene-canvas'; export * as React from 'react'; export {createRoot} from 'react-dom/client'; export {sparkline,formatValue} from './lib/scene/sparkline';`, resolveDir: web },
  alias: { '@': web }, jsx: 'automatic', bundle: true, format: 'esm', target: 'es2020', minify: true, legalComments: 'eof',
  define: { 'process.env.NODE_ENV': '"production"' }, outfile: join(out, 'vendor.js'), metafile: true, logLevel: 'silent',
});
const sourcePaths = ['components/plant3d/scene-canvas.tsx', 'components/plant3d/process-flow.tsx', 'lib/scene/process-values.ts', 'lib/scene/process-material.ts', 'lib/scene/process-metadata.ts', 'lib/scene/generate.ts', 'lib/scene/pipe.ts', 'lib/scene/camera-fit.ts', 'lib/scene/gltf.ts', 'lib/scene/node-shim.ts', 'lib/scene/templates.ts', 'lib/scene/pick.ts', 'lib/scene/tint.ts', 'lib/scene/reference.ts', 'lib/scene/fidelity.ts', 'lib/scene/sparkline.ts'];
const files = [];
for (const path of sourcePaths) files.push({ path: `web/${path}`, sha256: sha(await readFile(join(web, path))) });
const packages = new Map();
for (const filename of Object.keys(bundle.metafile.inputs).filter(name => name !== '<stdin>')) {
  let folder = dirname(resolve(filename));
  try { await stat(folder); } catch { folder = dirname(resolve(web, filename)); }
  while (folder !== dirname(folder)) {
    try {
      const pkg = JSON.parse(await readFile(join(folder, 'package.json'), 'utf8'));
      if (pkg.name) packages.set(`${pkg.name}@${pkg.version}`, { folder, ...pkg });
      break;
    } catch { folder = dirname(folder); }
  }
}
let licenses = 'Forge Cortex scene code: Whiskey House. Reused for this portfolio with fictional scene inputs.\nThird-party dependencies bundled from the existing Cortex checkout:\n';
for (const [name, pkg] of packages) {
  licenses += `\n${name} (${pkg.license || 'see license'})\n`;
  for (const filename of (await readdir(pkg.folder)).filter(name => /^(license|copying)(\.|$)/i.test(name))) licenses += '\n' + await readFile(join(pkg.folder, filename), 'utf8') + '\n';
}
await writeFile(join(out, 'LICENSES.txt'), licenses);
const metadata = {
  source: 'https://github.com/WhiskeyHouse/forge-cortex',
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: web, encoding: 'utf8' }).trim(),
  fictional: true, generator: native.generatorVersion(spec), files,
  graphInventorySha256: snapshot.inventorySha256,
  modelSha256: sha(glb), specSha256: sha(JSON.stringify(spec)), vendorSha256: sha(await readFile(join(out, 'vendor.js'))),
  assets: snapshot.counts.equipment - 1, elements: spec.elements.length, libraries: [...packages.keys()].sort(),
};
await writeFile(join(root, 'content/cortex-scene.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify({ assets: metadata.assets, elements: metadata.elements, modelBytes: glb.length, nativeSourceFiles: files.length }));
