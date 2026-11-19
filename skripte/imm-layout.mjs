#!/usr/bin/env node
// IMM Raumplaner – Kommandozeile für Claude Code und Fable-Agenten.
// Nutzt dieselbe Geometrie wie die Web-Seite (app/geom.js).
//
//   node skripte/imm-layout.mjs raum                      Raum zusammengefasst (Zonen, Türen, Fenster, Stützen)
//   node skripte/imm-layout.mjs katalog                   Inventar mit IDs, Massen, Bestand
//   node skripte/imm-layout.mjs pruefen <v.json …> [--json] [--gang 0.8]
//                                                         Überschneidungen, ausserhalb, Bestand, enge Durchgänge
//   node skripte/imm-layout.mjs bild <v.json> [-o datei.svg] [--png]
//                                                         Planbild wie im Export (SVG, optional PNG über Chrome)
//   node skripte/imm-layout.mjs db <v.json …> [--autor Fable] [--out varianten/db]
//                                                         Dokumente für die Artifact-Datenbank (Sammlung "varianten")
//
// Exit-Code von "pruefen": 0 = ohne harte Befunde, 1 = Überschneidung, ausserhalb, unbekanntes Stück oder Bestand überschritten.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import * as G from '../app/geom.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = p => JSON.parse(readFileSync(p, 'utf8'));
const args = process.argv.slice(2), cmd = args.shift();
const flag = (n, def = null) => { const i = args.indexOf(n); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const bool = n => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };

const raumPath = flag('--raum', join(root, 'raum/raeume.json'));
const katPath = flag('--katalog', join(root, 'inventar/katalog.json'));
const raum = readJSON(raumPath), kat = readJSON(katPath);
const M = G.makeModel(raum, kat);

function loadVariant(p) {
  const v = readJSON(p);
  if (!Array.isArray(v.platzierungen)) throw new Error(`${p}: "platzierungen" fehlt`);
  v.id ||= basename(p, '.json');
  v.platzierungen = v.platzierungen.map((q, i) => ({ uid: q.uid || `p${i + 1}`, stueck: q.stueck, x: +q.x, y: +q.y, rot: +q.rot || 0 }));
  return v;
}

if (cmd === 'raum') {
  const R = M.R, b = R.bounds;
  console.log(`${raum.name} (${raum.fassung}) · Geschosshöhe ${R.H} m · Fläche ${R.area.toFixed(1)} m² · Umriss x ${b.x0.toFixed(2)}…${b.x1.toFixed(2)}, y ${b.y0.toFixed(2)}…${b.y1.toFixed(2)}`);
  for (const z of R.zones) console.log(`Zone ${z.id} "${z.name}": ${z.area.toFixed(1)} m², Polygon ${JSON.stringify(z.polygon)}`);
  for (const w of R.walls) console.log(`Wand ${w.id}: ${JSON.stringify(w.a)} → ${JSON.stringify(w.b)}, Dicke ${w.t}, Raumseite Normale ${JSON.stringify(w.nIn.map(n => Math.round(n * 100) / 100))}`);
  for (const o of R.openings) {
    const p0 = o.p0.map(n => n.toFixed(2)), p1 = o.p1.map(n => n.toFixed(2));
    if (o.typ === 'tuer') console.log(`Tür ${o.id} in ${o.w.id}: von (${p0}) bis (${p1}), Breite ${o.breite} m, schlägt in den Raum, Schwenkfläche frei halten (Radius ${o.breite} m um Band (${o.H.map(n => n.toFixed(2))}))`);
    else console.log(`Fenster ${o.id} in ${o.w.id}: von (${p0}) bis (${p1}), Brüstung ${o.bruestung} m, Höhe ${o.hoehe} m`);
  }
  for (const c of R.cols) console.log(`Stütze ${c.id}: Mitte (${c.x}, ${c.y}), ${c.b} × ${c.t} m`);
  console.log('Konvention: x rechts, y unten, Ursprung oben links, Meter. Platzierung = Mittelpunkt (x, y) und Drehung rot in Grad im Uhrzeigersinn; Vorderseite eines Stücks zeigt bei rot 0 nach +y (unten).');
} else if (cmd === 'katalog') {
  for (const s of kat.stuecke) console.log(`${s.id.padEnd(26)} ${s.typ.padEnd(13)} ${(s.b * 100).toFixed(0)} × ${(s.t * 100).toFixed(0)} × ${(s.h * 100).toFixed(0)} cm  Bestand ${s.anzahl ?? '–'}  ${s.name}${s.herkunft === 'geschaetzt' ? ' (Mass geschätzt)' : ''}`);
} else if (cmd === 'pruefen') {
  const asJson = bool('--json'), gang = +flag('--gang', '0.8');
  let bad = 0; const all = [];
  for (const p of args) {
    const v = loadVariant(p), a = G.analyse(M, v, { gang });
    const hard = a.ueberschneidungen.length + a.ausserhalb.length + a.unbekannt.length + a.bestand_ueberschritten.length;
    if (hard) bad = 1;
    all.push({ datei: p, id: v.id, name: v.name, ok: !hard, ...a });
    if (asJson) continue;
    console.log(`\n${hard ? '✗' : '✓'} ${v.name || v.id}  (${p})`);
    console.log(`  ${a.stuecke} Stücke · ${a.arbeitsplaetze} Arbeitsplätze (Bürostühle) · ${a.sitzplaetze} Sitzplätze · Belegung ${a.belegung_prozent} % der Fläche`);
    for (const h of a.ueberschneidungen) console.log(`  Überschneidung: ${h.uid} ${h.name} mit ${h.mit.join(', ')}`);
    for (const u of a.ausserhalb) console.log(`  ausserhalb des Raums: ${u}`);
    for (const u of a.unbekannt) console.log(`  unbekanntes Stück (nicht im Katalog): ${u}`);
    for (const b of a.bestand_ueberschritten) console.log(`  Bestand überschritten: ${b.name} ${b.gesetzt} von ${b.vorhanden}`);
    const enge = a.enge.sort((x, y) => x.abstand - y.abstand);
    if (enge.length) console.log(`  Hinweis, enge Durchgänge < ${gang} m: ` + enge.slice(0, 8).map(e => `${e.zwischen} ${Math.round(e.abstand * 100)} cm (${e.a}${e.b ? '/' + e.b : ''})`).join('; ') + (enge.length > 8 ? ` … +${enge.length - 8}` : ''));
  }
  if (asJson) console.log(JSON.stringify(all, null, 2));
  process.exit(bad);
} else if (cmd === 'bild') {
  const out = flag('-o'), png = bool('--png'); const v = loadVariant(args[0]);
  const b = M.R.bounds, pad = 1.0, k = 80, u = 1.4 / k;
  const w = (b.x1 - b.x0 + 2 * pad) * k, h = (b.y1 - b.y0 + 2 * pad) * k + 70;
  const hits = G.computeHits(M, v.platzierungen), a = G.analyse(M, v);
  const plan = G.renderPlan(M, v, { u, k, interactive: false, hits, opts: { grid: true, dims: true, swing: true, labels: true } });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${G.EXPORT_CSS}</style>
<rect width="${w}" height="${h}" fill="#fff"/>
<text x="20" y="32" font-size="22" font-weight="600" class="t">${G.esc(v.name || v.id)}</text>
<text x="20" y="56" font-size="14" class="m">${a.stuecke} Stücke · ${a.arbeitsplaetze} Arbeitsplätze · ${a.ueberschneidungen.length} Überschneidungen · ${a.enge.length} enge Stellen · Belegung ${a.belegung_prozent} %</text>
<g transform="translate(${(pad - b.x0) * k} ${70 + (pad - b.y0) * k}) scale(${k})">${plan}</g></svg>`;
  const svgPath = resolve(out || args[0].replace(/\.json$/, '.svg'));
  writeFileSync(svgPath, svg); console.log('SVG: ' + svgPath);
  if (png) {
    const pngPath = svgPath.replace(/\.svg$/, '.png');
    const chrome = ['google-chrome', 'chromium', 'chromium-browser'].find(c => { try { execFileSync('which', [c], { stdio: 'ignore' }); return true; } catch { return false; } });
    if (!chrome) { console.error('Kein Chrome/Chromium gefunden – nur SVG geschrieben.'); process.exit(0); }
    execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${Math.ceil(w)},${Math.ceil(h)}`, `--screenshot=${pngPath}`, 'file://' + svgPath], { stdio: 'ignore' });
    console.log('PNG: ' + pngPath);
  }
} else if (cmd === 'db') {
  const autor = flag('--autor', 'Claude'), outDir = resolve(flag('--out', join(root, 'varianten/db')));
  mkdirSync(outDir, { recursive: true });
  for (const p of args) {
    const v = loadVariant(p), a = G.analyse(M, v);
    const doc = { schema: 'imm-space/variante@1', id: v.id, name: v.name || v.id, notiz: v.notiz || '', autor: v.autor || autor,
      begruendung: v.begruendung || '', basis: v.basis || null, tags: v.tags || [], raum: raum.fassung, katalog: kat.fassung, updated: Date.now(),
      kennzahlen: { stuecke: a.stuecke, arbeitsplaetze: a.arbeitsplaetze, sitzplaetze: a.sitzplaetze, belegung_prozent: a.belegung_prozent, ueberschneidungen: a.ueberschneidungen.length, enge: a.enge.length },
      platzierungen: v.platzierungen.map(q => ({ ...q, x: G.f3(q.x), y: G.f3(q.y) })) };
    const f = join(outDir, v.id + '.json'); writeFileSync(f, JSON.stringify(doc, null, 2)); console.log(f);
  }
  console.log('Hochladen: ArtifactData batch, collection "varianten", doc_id = id, file_path = obige Dateien (bestehende Dokumente mit if_version).');
} else {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  process.exit(cmd ? 2 : 0);
}
