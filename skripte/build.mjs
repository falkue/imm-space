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
