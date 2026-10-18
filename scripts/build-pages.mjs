// Сборка статичной версии для GitHub Pages: Astro (PAGES=1) → серверный бандл → service worker sw.js.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const out = path.join(root, 'dist-pages/client');
const shim = (n) => path.join(root, `src/sw/shims/${n}.js`);

const r = spawnSync('npx', ['astro', 'build'], { stdio: 'inherit', env: { ...process.env, PAGES: '1' } });
if (r.status !== 0) process.exit(r.status ?? 1);

await build({
  entryPoints: [path.join(root, 'src/sw/worker.js')],
  outfile: path.join(out, 'sw.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  alias: {
    'node:sqlite': shim('sqlite'),
    'node:fs': shim('fs'),
    fs: shim('fs'),
    'node:path': shim('path'),
    path: shim('path'),
    'node:crypto': shim('crypto'),
    crypto: shim('crypto'),
    'node:url': shim('url'),
  },
  external: ['sharp'],
  logLevel: 'info',
});

fs.copyFileSync(path.join(root, 'node_modules/sql.js/dist/sql-wasm-browser.wasm'), path.join(out, 'sql-wasm-browser.wasm'));
const boot = fs.readFileSync(path.join(root, 'src/sw/boot.html'), 'utf8');
fs.writeFileSync(path.join(out, 'index.html'), boot);
fs.writeFileSync(path.join(out, '404.html'), boot);
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('[pages] Готово:', path.relative(root, out));
