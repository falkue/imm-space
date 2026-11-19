// Baut app/index.html aus app/src/index.src.html und bettet app/geom.js ein (Marker /*@@GEOM@@*/).
// Aufruf: node skripte/build.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'app/src/index.src.html'), 'utf8');
const geom = readFileSync(join(root, 'app/geom.js'), 'utf8');
const m = geom.match(/export\s*\{([\s\S]*?)\};?\s*$/);
if (!m) throw new Error('geom.js: export-Block am Ende fehlt');
const names = m[1].split(',').map(s => s.trim()).filter(Boolean);
const body = geom.slice(0, m.index);
const inlined = `const G = (() => {\n${body}\nreturn { ${names.join(', ')} };\n})();`;
if (!src.includes('/*@@GEOM@@*/')) throw new Error('Marker fehlt');
writeFileSync(join(root, 'app/index.html'), src.replace('/*@@GEOM@@*/', () => inlined));
console.log('app/index.html gebaut (' + names.length + ' Geometrie-Funktionen eingebettet)');

// Offline-Fassung: eine einzige HTML-Datei für Kolleginnen und Kollegen (Doppelklick, ohne Internet, ohne Konto).
// three.js, OrbitControls und jsPDF aus vendor/ eingebettet, Standardprojekt (Raum, Inventar, Beispiel) als JSON eingebettet.
// Aufruf: node skripte/build.mjs --offline   → dist/imm-raumplaner.html
if (process.argv.includes('--offline')) {
  const { mkdirSync } = await import('node:fs');
  const html = readFileSync(join(root, 'app/index.html'), 'utf8');
  const v = f => readFileSync(join(root, 'vendor', f));
  const dataURL = f => 'data:text/javascript;base64,' + v(f).toString('base64');
  const importmap = `<script type="importmap">\n${JSON.stringify({ imports: { three: dataURL('three.module.min.js'), 'three/addons/controls/OrbitControls.js': dataURL('OrbitControls.js') } })}\n</script>`;
  const readJ = p => JSON.parse(readFileSync(join(root, p), 'utf8'));
  const projekt = { schema: 'imm-space/projekt@1', id: 'imm', name: 'IMM-Räume', raum: readJ('raum/raeume.json'), katalog: readJ('inventar/katalog.json'), varianten: [readJ('varianten/v00-beispiel.json')] };
  const embedded = `<script type="application/json" id="imm-default">${JSON.stringify(projekt).replace(/</g, '\\u003c')}</script>`;
  const jspdf = `<script>${v('jspdf.umd.min.js').toString('utf8').replace(/<\/script/gi, '<\\/script')}</script>`;
  const re = /<script type="importmap">[\s\S]*?<\/script>/;
  if (!re.test(html)) throw new Error('importmap nicht gefunden');
  const head = '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>';
  const out = head + html.replace(re, () => embedded + '\n' + jspdf + '\n' + importmap) + '</body></html>';
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist/imm-raumplaner.html'), out);
  console.log('dist/imm-raumplaner.html gebaut (' + Math.round(out.length / 1024) + ' KB, offline)');
}
